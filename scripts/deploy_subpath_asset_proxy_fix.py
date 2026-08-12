from __future__ import annotations

import hashlib
import json
import shlex
from datetime import datetime, timezone

import paramiko

from deploy_reauth_handoff_fix import CONFIG_PATH, NGINX_RELOAD, NGINX_TEST, REMOTE_NGINX, run


OLD_PROXY = b"proxy_pass http://127.0.0.1:3218;"
NEW_PROXY = b"proxy_pass http://127.0.0.1:3218/;"


def atomic_write(sftp: paramiko.SFTPClient, remote_path: str, data: bytes, mode: int, suffix: str) -> None:
    temporary = f"{remote_path}.codex-tmp-{suffix}"
    with sftp.open(temporary, "wb") as handle:
        handle.write(data)
        handle.flush()
    sftp.chmod(temporary, mode)
    sftp.posix_rename(temporary, remote_path)


def main() -> None:
    password = json.loads(CONFIG_PATH.read_text(encoding="utf-8")).get("ssh_password")
    if not password:
        raise RuntimeError("SSH credential is unavailable")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect("43.142.31.198", username="root", password=password, timeout=15)
    sftp = client.open_sftp()
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup = f"{REMOTE_NGINX}.bak-subpath-assets-{stamp}"
    original = b""
    mode = 0
    changed = False
    try:
        with sftp.open(REMOTE_NGINX, "rb") as handle:
            original = handle.read()
        mode = sftp.stat(REMOTE_NGINX).st_mode & 0o777
        if original.count(OLD_PROXY) != 1 or NEW_PROXY in original:
            raise RuntimeError("Remote Nginx no longer has the single audited Web proxy marker")

        candidate = original.replace(OLD_PROXY, NEW_PROXY, 1)
        if candidate.count(NEW_PROXY) != 1 or OLD_PROXY in candidate:
            raise RuntimeError("Candidate Nginx replacement is ambiguous")

        code, output = run(client, f"cp -p -- {shlex.quote(REMOTE_NGINX)} {shlex.quote(backup)}")
        if code != 0:
            raise RuntimeError(f"Nginx backup failed: {output.strip()}")

        atomic_write(sftp, REMOTE_NGINX, candidate, mode, stamp)
        changed = True
        code, output = run(client, NGINX_TEST)
        if code != 0 or "syntax is ok" not in output or "test is successful" not in output:
            raise RuntimeError(f"Nginx validation failed: {output.strip()}")

        code, output = run(client, NGINX_RELOAD)
        if code != 0:
            raise RuntimeError(f"Nginx reload failed: {output.strip()}")

        with sftp.open(REMOTE_NGINX, "rb") as handle:
            deployed = handle.read()
        if deployed != candidate:
            raise RuntimeError("Post-deploy Nginx byte verification failed")

        print(f"backup_nginx={backup}")
        print(f"nginx_sha256={hashlib.sha256(deployed).hexdigest()}")
        print("nginx_test=passed")
        print("nginx_reload=passed")
        print("employee_data_paths_touched=0")
    except Exception:
        if changed and original:
            atomic_write(sftp, REMOTE_NGINX, original, mode, f"rollback-{stamp}")
            run(client, NGINX_TEST)
            run(client, NGINX_RELOAD)
        raise
    finally:
        sftp.close()
        client.close()


if __name__ == "__main__":
    main()
