from __future__ import annotations

import hashlib
import json
import shlex
from datetime import datetime, timezone
from pathlib import Path

import paramiko


CONFIG_PATH = Path(r"C:\Users\韩吉衍\.codex\skills\homer-publish-app\config.local.json")
LOCAL_HOMER = Path(r"E:\Stellaris-Tencent\.remote-audit\www\wwwroot\homer\index.html")
LOCAL_NGINX = Path(r"E:\Stellaris-Tencent\.remote-audit\www\server\panel\vhost\nginx\tongjixinzhi.cn.conf")
REMOTE_HOMER = "/www/wwwroot/homer/index.html"
REMOTE_NGINX = "/www/server/panel/vhost/nginx/tongjixinzhi.cn.conf"
NGINX_TEST = "/www/server/nginx/sbin/nginx -t -c /www/server/nginx/conf/nginx.conf"
NGINX_RELOAD = "/www/server/nginx/sbin/nginx -s reload -c /www/server/nginx/conf/nginx.conf"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def run(client: paramiko.SSHClient, command: str) -> tuple[int, str]:
    _, stdout, stderr = client.exec_command(command, timeout=30)
    output = stdout.read().decode("utf-8", errors="replace") + stderr.read().decode("utf-8", errors="replace")
    return stdout.channel.recv_exit_status(), output


def atomic_write(sftp: paramiko.SFTPClient, remote_path: str, data: bytes, mode: int, stamp: str) -> None:
    temporary = f"{remote_path}.codex-tmp-{stamp}"
    with sftp.open(temporary, "wb") as handle:
        handle.write(data)
        handle.flush()
    sftp.chmod(temporary, mode)
    sftp.posix_rename(temporary, remote_path)


def main() -> None:
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    password = config.get("ssh_password")
    if not password:
        raise RuntimeError("SSH credential is unavailable")

    new_homer = LOCAL_HOMER.read_bytes()
    new_nginx = LOCAL_NGINX.read_bytes()
    old_nginx_marker = b"return 302 /auth/;"
    new_nginx_marker = b'return 302 "/?redirect=%2Fzhengwujianli%2F&reauth=1";'
    old_homer_marker = b"    async function checkAuthState() {"
    new_homer_marker = b"    function requiresFreshLogin() {"
    if new_nginx.count(new_nginx_marker) != 1 or old_nginx_marker in new_nginx:
        raise RuntimeError("Local Nginx candidate does not contain the expected single replacement")
    if new_homer.count(new_homer_marker) != 1 or new_homer.count(old_homer_marker) != 1:
        raise RuntimeError("Local Homer candidate does not contain the expected re-auth guard")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect("43.142.31.198", username="root", password=password, timeout=15)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup_homer = f"{REMOTE_HOMER}.bak-reauth-{stamp}"
    backup_nginx = f"{REMOTE_NGINX}.bak-reauth-{stamp}"
    sftp = client.open_sftp()
    old_homer = b""
    old_nginx = b""
    homer_mode = 0
    nginx_mode = 0
    changed = False
    try:
        with sftp.open(REMOTE_HOMER, "rb") as handle:
            old_homer = handle.read()
        with sftp.open(REMOTE_NGINX, "rb") as handle:
            old_nginx = handle.read()
        homer_mode = sftp.stat(REMOTE_HOMER).st_mode & 0o777
        nginx_mode = sftp.stat(REMOTE_NGINX).st_mode & 0o777

        if old_homer.count(old_homer_marker) != 1 or new_homer_marker in old_homer:
            raise RuntimeError("Remote Homer changed since the audit; refusing to overwrite")
        if old_nginx.count(old_nginx_marker) != 1 or new_nginx_marker in old_nginx:
            raise RuntimeError("Remote Nginx changed since the audit; refusing to overwrite")

        for source, backup in ((REMOTE_HOMER, backup_homer), (REMOTE_NGINX, backup_nginx)):
            code, output = run(client, f"cp -p -- {shlex.quote(source)} {shlex.quote(backup)}")
            if code != 0:
                raise RuntimeError(f"Backup failed for {source}: {output.strip()}")

        atomic_write(sftp, REMOTE_HOMER, new_homer, homer_mode, stamp)
        atomic_write(sftp, REMOTE_NGINX, new_nginx, nginx_mode, stamp)
        changed = True

        code, output = run(client, NGINX_TEST)
        if code != 0 or "syntax is ok" not in output or "test is successful" not in output:
            raise RuntimeError(f"Nginx validation failed: {output.strip()}")

        code, output = run(client, NGINX_RELOAD)
        if code != 0:
            raise RuntimeError(f"Nginx reload failed: {output.strip()}")

        with sftp.open(REMOTE_HOMER, "rb") as handle:
            deployed_homer = handle.read()
        with sftp.open(REMOTE_NGINX, "rb") as handle:
            deployed_nginx = handle.read()
        if deployed_homer != new_homer or deployed_nginx != new_nginx:
            raise RuntimeError("Post-deploy byte verification failed")

        print(f"backup_homer={backup_homer}")
        print(f"backup_nginx={backup_nginx}")
        print(f"homer_sha256={sha256(deployed_homer)}")
        print(f"nginx_sha256={sha256(deployed_nginx)}")
        print("nginx_test=passed")
        print("nginx_reload=passed")
        print("employee_data_paths_touched=0")
    except Exception:
        if changed and old_homer and old_nginx:
            atomic_write(sftp, REMOTE_HOMER, old_homer, homer_mode, f"rollback-{stamp}")
            atomic_write(sftp, REMOTE_NGINX, old_nginx, nginx_mode, f"rollback-{stamp}")
            run(client, NGINX_TEST)
            run(client, NGINX_RELOAD)
        raise
    finally:
        sftp.close()
        client.close()


if __name__ == "__main__":
    main()
