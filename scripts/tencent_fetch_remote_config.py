from __future__ import annotations

import json
from pathlib import Path, PurePosixPath

import paramiko


CONFIG_PATH = Path(r"C:\Users\韩吉衍\.codex\skills\homer-publish-app\config.local.json")
DESTINATION = Path(r"E:\Stellaris-Tencent\.remote-audit")
REMOTE_FILES = (
    "/www/wwwroot/auth-system/server.js",
    "/www/wwwroot/auth-system/auth_routes.js",
    "/www/wwwroot/auth-system/public/auth.html",
    "/www/wwwroot/auth-system/public/index.html",
    "/www/wwwroot/auth-system/stellaris-session.cjs",
    "/www/wwwroot/homer/index.html",
    "/www/server/panel/vhost/nginx/tongjixinzhi.cn.conf",
)


def main() -> None:
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    password = config.get("ssh_password")
    if not password:
        raise RuntimeError("SSH credential is unavailable")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect("43.142.31.198", username="root", password=password, timeout=15)
    try:
        sftp = client.open_sftp()
        try:
            for remote_path in REMOTE_FILES:
                relative = PurePosixPath(remote_path).relative_to("/")
                destination = DESTINATION.joinpath(*relative.parts)
                destination.parent.mkdir(parents=True, exist_ok=True)
                sftp.get(remote_path, str(destination))
                print(f"fetched {remote_path} -> {destination}")
        finally:
            sftp.close()
    finally:
        client.close()


if __name__ == "__main__":
    main()
