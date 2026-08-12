from __future__ import annotations

import json
from pathlib import Path

import paramiko


CONFIG_PATH = Path(r"C:\Users\韩吉衍\.codex\skills\homer-publish-app\config.local.json")
HOST = "43.142.31.198"


def main() -> None:
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    password = config.get("ssh_password")
    if not password:
        raise RuntimeError("SSH credential is unavailable")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username="root", password=password, timeout=15)

    commands = {
        "identity": "date -Is; hostname; uname -a",
        "containers": "docker ps --format '{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}'",
        "ports": "ss -ltnp | grep -E ':(3003|3217|3218)( |$)' || true",
        "release-tree": "find /opt/stellaris-zhengwujianli -maxdepth 3 -mindepth 1 -printf '%y|%p|%TY-%Tm-%TdT%TH:%TM:%TS\\n' 2>/dev/null | sort",
        "compose-ps": "cd /opt/stellaris-zhengwujianli/releases/20260811T094203Z && docker compose --env-file /opt/stellaris-zhengwujianli/.env -f infra/tencent/compose.yml ps",
        "container-health": "docker inspect -f '{{.Name}}|{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}|restarts={{.RestartCount}}' stellaris-zhengwujianli-db-1 stellaris-zhengwujianli-backend-1 stellaris-zhengwujianli-web-1",
        "nginx-stellaris-markers": "grep -n -A70 -B5 -E 'zhengwujianli|_stellaris_session_verify|stellaris_login_redirect' /www/server/panel/vhost/nginx/tongjixinzhi.cn.conf",
        "homer-card": "grep -n -A18 -B3 -E \"id: ['\\\"]zhengwujianli|name: ['\\\"]政务简历采集|url: ['\\\"]/zhengwujianli/\" /www/wwwroot/homer/index.html | head -n 120",
        "auth-routes": "grep -n -A16 -B8 -E 'stellaris-session|/api/login|/auth|redirect' /www/wwwroot/auth-system/server.js | head -n 260",
        "auth-package": "cd /www/wwwroot/auth-system && printf 'cwd=%s\\n' \"$PWD\"; node --version; pm2 jlist | node -e \"let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{for(const p of JSON.parse(s)) console.log([p.name,p.pm2_env.status,p.pm2_env.pm_cwd,p.pm2_env.pm_exec_path].join('|'))})\"",
        "public-head": "curl -skS -o /dev/null -D - https://tongjixinzhi.cn/zhengwujianli/ | sed -n '1,20p'; curl -skS -o /dev/null -D - https://tongjixinzhi.cn/zhengwujianli/api/session | sed -n '1,20p'",
        "origin-check": "curl -skS -o /dev/null -w 'stellaris=%{http_code} %{url_effective}\\n' https://stellaris.ac.cn/; curl -skS -o /dev/null -w 'satmap=%{http_code}\\n' https://tongjixinzhi.cn/satmap/; curl -skS -o /dev/null -w 'kdocs=%{http_code}\\n' https://tongjixinzhi.cn/kdocs-sync/",
    }

    try:
        for label, command in commands.items():
            print(f"===== {label} =====")
            _, stdout, stderr = client.exec_command(command, timeout=30)
            output = stdout.read().decode("utf-8", errors="replace")
            error = stderr.read().decode("utf-8", errors="replace")
            print(output.rstrip())
            if error.strip():
                print("[stderr]")
                print(error.rstrip())
            print(f"[exit={stdout.channel.recv_exit_status()}]")
    finally:
        client.close()


if __name__ == "__main__":
    main()
