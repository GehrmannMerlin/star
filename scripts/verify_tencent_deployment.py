from __future__ import annotations

import json
from pathlib import Path

import paramiko


CONFIG_PATH = Path(r"C:\Users\韩吉衍\.codex\skills\homer-publish-app\config.local.json")


def main() -> None:
    password = json.loads(CONFIG_PATH.read_text(encoding="utf-8")).get("ssh_password")
    if not password:
        raise RuntimeError("SSH credential is unavailable")

    commands = {
        "public-routing": "curl -skS -o /dev/null -D - https://tongjixinzhi.cn/zhengwujianli/ | sed -n '1,12p'; curl -skS -o /dev/null -w 'root_reauth=%{http_code}\\n' 'https://tongjixinzhi.cn/?redirect=%2Fzhengwujianli%2F&reauth=1'; curl -skS -o /dev/null -w 'protected_api=%{http_code}\\n' https://tongjixinzhi.cn/zhengwujianli/api/session",
        "local-app": "html=$(curl -sS http://127.0.0.1:3218/); printf '%s\\n' \"$html\" | grep -o '<title>[^<]*</title>'; for resource in $(printf '%s\\n' \"$html\" | grep -o '/zhengwujianli/assets/[^\" ]*'); do upstream=${resource#/zhengwujianli}; printf 'mapped_resource=%s -> %s\\n' \"$resource\" \"$upstream\"; curl -sS -D - -o /dev/null \"http://127.0.0.1:3218$upstream\" | grep -iE 'HTTP/|content-type|content-length'; done; curl -sS -o /dev/null -w 'backend_health=%{http_code}\\n' http://127.0.0.1:3217/health",
        "containers": "docker inspect -f '{{.Name}}|{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}|restarts={{.RestartCount}}' stellaris-zhengwujianli-db-1 stellaris-zhengwujianli-backend-1 stellaris-zhengwujianli-web-1; ss -ltn | grep -E '127.0.0.1:(3217|3218)'",
        "app-database": "docker compose --env-file /opt/stellaris-zhengwujianli/.env -f /opt/stellaris-zhengwujianli/releases/20260811T094203Z/infra/tencent/compose.yml exec -T db psql -U stellaris -d stellaris -Atc \"SELECT 'task_run_count=' || count(*) FROM task_run; SELECT 'owner_nullable=' || is_nullable FROM information_schema.columns WHERE table_name='task_run' AND column_name='owner_user_id';\"",
        "homer": "grep -c '\"id\": \"zhengwujianli\"' /www/wwwroot/homer/index.html; grep -n -A16 '\"id\": \"zhengwujianli\"' /www/wwwroot/homer/index.html | grep -E '\"name\"|\"url\"'; grep -n \"get('reauth') === '1'\" /www/wwwroot/homer/index.html",
        "nginx": "/www/server/nginx/sbin/nginx -t -c /www/server/nginx/conf/nginx.conf 2>&1; sed -n '914,952p' /www/server/panel/vhost/nginx/tongjixinzhi.cn.conf | grep -E 'zhengwujianli|stellaris|proxy_pass|return 302'; if sed -n '914,952p' /www/server/panel/vhost/nginx/tongjixinzhi.cn.conf | grep -q 'stellaris.ac.cn'; then exit 9; fi",
        "unchanged-services": "curl -skS -o /dev/null -w 'stellaris_ali=%{http_code}\\n' https://stellaris.ac.cn/; curl -skS -o /dev/null -w 'satmap=%{http_code}\\n' https://tongjixinzhi.cn/satmap/; curl -skS -o /dev/null -w 'kdocs=%{http_code}\\n' https://tongjixinzhi.cn/kdocs-sync/; pm2 pid auth-system",
    }

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect("43.142.31.198", username="root", password=password, timeout=15)
    failures: list[str] = []
    try:
        for label, command in commands.items():
            print(f"===== {label} =====")
            _, stdout, stderr = client.exec_command(command, timeout=45)
            output = stdout.read().decode("utf-8", errors="replace")
            error = stderr.read().decode("utf-8", errors="replace")
            code = stdout.channel.recv_exit_status()
            print(output.rstrip())
            if error.strip():
                print(error.rstrip())
            print(f"exit={code}")
            if code != 0:
                failures.append(label)
    finally:
        client.close()
    if failures:
        raise RuntimeError(f"Verification failures: {', '.join(failures)}")


if __name__ == "__main__":
    main()
