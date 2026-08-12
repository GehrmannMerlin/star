from __future__ import annotations

import hashlib
import json
import shlex
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path

import paramiko

from deploy_reauth_handoff_fix import CONFIG_PATH


HOST = "43.142.31.198"
RELEASE = "/opt/stellaris-zhengwujianli/releases/20260811T094203Z"
COMPOSE = f"{RELEASE}/infra/tencent/compose.yml"
ENV_FILE = "/opt/stellaris-zhengwujianli/.env"
RELATIVE_SOURCE = "apps/web/src/components/TaskHistory.tsx"
REMOTE_SOURCE = f"{RELEASE}/{RELATIVE_SOURCE}"
LOCAL_SOURCE = Path(__file__).resolve().parents[1] / RELATIVE_SOURCE
WEB_CONTAINER = "stellaris-zhengwujianli-web-1"
BACKEND_CONTAINER = "stellaris-zhengwujianli-backend-1"
DB_CONTAINER = "stellaris-zhengwujianli-db-1"
WEB_IMAGE = "stellaris-zhengwujianli-web:latest"


def run(client: paramiko.SSHClient, command: str, timeout: int = 30) -> tuple[int, str]:
    _, stdout, stderr = client.exec_command(command, timeout=timeout)
    output = stdout.read().decode("utf-8", errors="replace") + stderr.read().decode("utf-8", errors="replace")
    return stdout.channel.recv_exit_status(), output


def atomic_write(
    sftp: paramiko.SFTPClient,
    remote_path: str,
    data: bytes,
    mode: int,
    suffix: str,
) -> None:
    temporary = f"{remote_path}.codex-tmp-{suffix}"
    with sftp.open(temporary, "wb") as handle:
        handle.write(data)
        handle.flush()
    sftp.chmod(temporary, mode)
    sftp.posix_rename(temporary, remote_path)


def container_id(client: paramiko.SSHClient, name: str) -> str:
    code, output = run(client, f"docker inspect -f '{{{{.Id}}}}' {shlex.quote(name)}")
    if code != 0 or not output.strip():
        raise RuntimeError(f"Unable to inspect {name}: {output.strip()}")
    return output.strip()


def wait_healthy(client: paramiko.SSHClient, name: str, timeout: int = 180) -> None:
    deadline = time.monotonic() + timeout
    last = ""
    while time.monotonic() < deadline:
        code, output = run(
            client,
            f"docker inspect -f '{{{{.State.Status}}}}|{{{{if .State.Health}}}}{{{{.State.Health.Status}}}}{{{{end}}}}' {shlex.quote(name)}",
        )
        last = output.strip()
        if code == 0 and last == "running|healthy":
            return
        time.sleep(5)
    raise RuntimeError(f"{name} did not become healthy: {last}")


def main() -> None:
    password = json.loads(CONFIG_PATH.read_text(encoding="utf-8")).get("ssh_password")
    if not password:
        raise RuntimeError("SSH credential is unavailable")

    new_source = LOCAL_SOURCE.read_bytes()
    old_source = subprocess.run(
        ["git", "show", f"HEAD:{RELATIVE_SOURCE}"],
        cwd=LOCAL_SOURCE.parents[4],
        check=True,
        stdout=subprocess.PIPE,
    ).stdout
    old_marker = b"if (tasks.length === 0 && !loading && offset === 0 && !error)"
    new_marker = b"useEffect(() =>"
    if old_marker not in old_source or new_marker in old_source:
        raise RuntimeError("Git baseline is not the audited pre-fix version")
    if old_marker in new_source or new_marker not in new_source:
        raise RuntimeError("Local source is not the validated fixed version")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", password=password, timeout=15)
    sftp = client.open_sftp()
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    source_backup = f"{REMOTE_SOURCE}.bak-history-loop-{stamp}"
    rollback_image = f"stellaris-zhengwujianli-web:rollback-history-{stamp.lower()}"
    build_log = f"/opt/stellaris-zhengwujianli/build-history-fix-{stamp}.log"
    build_status = f"/opt/stellaris-zhengwujianli/build-history-fix-{stamp}.status"
    compose_cmd = f"docker compose --env-file {shlex.quote(ENV_FILE)} -f {shlex.quote(COMPOSE)}"
    source_mode = 0
    source_changed = False
    deploy_attempted = False
    try:
        with sftp.open(REMOTE_SOURCE, "rb") as handle:
            remote_source = handle.read()
        if remote_source != old_source:
            raise RuntimeError("Remote TaskHistory source differs from the audited Git baseline; refusing to overwrite")
        source_mode = sftp.stat(REMOTE_SOURCE).st_mode & 0o777

        code, output = run(client, f"{compose_cmd} config --services")
        services = output.split()
        if code != 0 or services != ["db", "backend", "web"]:
            raise RuntimeError(f"Unexpected Compose scope: {output.strip()}")

        backend_before = container_id(client, BACKEND_CONTAINER)
        db_before = container_id(client, DB_CONTAINER)
        old_web_image = run(client, f"docker inspect -f '{{{{.Image}}}}' {WEB_CONTAINER}")[1].strip()
        if not old_web_image.startswith("sha256:"):
            raise RuntimeError("Unable to resolve the current Web image")

        code, output = run(client, f"cp -p -- {shlex.quote(REMOTE_SOURCE)} {shlex.quote(source_backup)}")
        if code != 0:
            raise RuntimeError(f"Source backup failed: {output.strip()}")
        code, output = run(client, f"docker image tag {shlex.quote(old_web_image)} {shlex.quote(rollback_image)}")
        if code != 0:
            raise RuntimeError(f"Image backup failed: {output.strip()}")

        atomic_write(sftp, REMOTE_SOURCE, new_source, source_mode, stamp)
        source_changed = True
        with sftp.open(REMOTE_SOURCE, "rb") as handle:
            if handle.read() != new_source:
                raise RuntimeError("Remote source byte verification failed")

        build_inner = (
            "set -o pipefail; "
            f"{compose_cmd} build web > {shlex.quote(build_log)} 2>&1; "
            f"printf '%s\\n' $? > {shlex.quote(build_status)}"
        )
        code, output = run(
            client,
            f"nohup /bin/bash -lc {shlex.quote(build_inner)} </dev/null >/dev/null 2>&1 & echo $!",
        )
        if code != 0 or not output.strip().isdigit():
            raise RuntimeError(f"Unable to start isolated Web build: {output.strip()}")
        print(f"web_build_started_pid={output.strip()}", flush=True)

        deadline = time.monotonic() + 1800
        next_progress = time.monotonic() + 30
        build_exit: int | None = None
        while time.monotonic() < deadline:
            try:
                with sftp.open(build_status, "r") as handle:
                    build_exit = int(handle.read().decode("ascii").strip())
                break
            except FileNotFoundError:
                pass
            if time.monotonic() >= next_progress:
                code, output = run(client, f"tail -n 3 -- {shlex.quote(build_log)}")
                print(f"web_build_progress={output.strip() if code == 0 else 'running'}", flush=True)
                next_progress = time.monotonic() + 30
            time.sleep(5)
        if build_exit is None:
            raise RuntimeError("Web build timed out")
        if build_exit != 0:
            code, output = run(client, f"tail -n 80 -- {shlex.quote(build_log)}")
            raise RuntimeError(f"Web build failed ({build_exit}): {output.strip()}")
        print("web_build=passed", flush=True)

        deploy_attempted = True
        code, output = run(client, f"{compose_cmd} up -d --no-deps web", timeout=180)
        if code != 0:
            raise RuntimeError(f"Isolated Web rollout failed: {output.strip()}")
        wait_healthy(client, WEB_CONTAINER)

        if container_id(client, BACKEND_CONTAINER) != backend_before:
            raise RuntimeError("Backend container changed during Web-only rollout")
        if container_id(client, DB_CONTAINER) != db_before:
            raise RuntimeError("Database container changed during Web-only rollout")

        code, output = run(
            client,
            "curl -fsS http://127.0.0.1:3218/zhengwujianli/ | grep -q '/zhengwujianli/assets/'",
        )
        if code != 0:
            raise RuntimeError(f"Web subpath smoke test failed: {output.strip()}")

        print(f"source_backup={source_backup}")
        print(f"rollback_image={rollback_image}")
        print(f"source_sha256={hashlib.sha256(new_source).hexdigest()}")
        print(f"web_container={container_id(client, WEB_CONTAINER)}")
        print("web_health=healthy")
        print("backend_container_unchanged=true")
        print("database_container_unchanged=true")
        print("employee_data_paths_touched=0")
    except Exception:
        if source_changed:
            atomic_write(sftp, REMOTE_SOURCE, old_source, source_mode, f"rollback-{stamp}")
        if deploy_attempted:
            run(client, f"docker image tag {shlex.quote(rollback_image)} {shlex.quote(WEB_IMAGE)}")
            run(client, f"{compose_cmd} up -d --no-deps --force-recreate web", timeout=180)
            wait_healthy(client, WEB_CONTAINER)
        raise
    finally:
        sftp.close()
        client.close()


if __name__ == "__main__":
    main()
