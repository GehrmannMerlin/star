from __future__ import annotations

from pathlib import Path
import json
import os
import tempfile
import unittest

from scripts.tencent_release.backup import (
    backup_production_database,
    verify_backup_in_candidate,
)
from scripts.tencent_release.bootstrap import validate_existing_repository
from scripts.tencent_release.build import build_images
from scripts.tencent_release.candidate import (
    CandidateLaunch,
    candidate_environment,
    candidate_up,
    candidate_verify,
    require_unchanged_production,
)
from scripts.tencent_release.contract import load_contract
from scripts.tencent_release.preflight import (
    preflight,
    require_clean_synced_repository,
)
from scripts.tencent_release.report import redact_payload, write_report
from scripts.tencent_release.runner import CompletedCommand, run_checked


CONTRACT = load_contract(Path("infra/tencent/release-contract.json"))


class FakeRunner:
    def __init__(self, responses: dict[tuple[str, ...], str] | None = None) -> None:
        self.responses = responses or {}
        self.commands: list[tuple[str, ...]] = []

    def run(self, argv: list[str], *, timeout: int, redact: tuple[str, ...] = ()) -> CompletedCommand:
        command = tuple(argv)
        self.commands.append(command)
        return CompletedCommand(command, 0, self.responses.get(command, ""), "")

    def run_to_file(
        self,
        argv: list[str],
        destination: Path,
        *,
        timeout: int,
        redact: tuple[str, ...] = (),
    ) -> CompletedCommand:
        command = tuple(argv)
        self.commands.append(command)
        destination.write_bytes(b"PGDMP phase-zero-test-archive")
        return CompletedCommand(command, 0, "", "")

    def find_command(self, executable: str) -> tuple[str, ...]:
        return next(
            command for command in self.commands
            if executable in command
        )


class PreflightTest(unittest.TestCase):
    def test_dirty_repository_is_rejected(self) -> None:
        fake = FakeRunner({("git", "status", "--porcelain"): " M app.ts\n"})
        with self.assertRaisesRegex(RuntimeError, "working tree is not clean"):
            require_clean_synced_repository(CONTRACT, runner=fake)

    def test_bootstrap_rejects_dirty_existing_repository(self) -> None:
        fake = FakeRunner({("git", "status", "--porcelain"): " M app.ts\n"})
        with self.assertRaisesRegex(RuntimeError, "working tree is not clean"):
            validate_existing_repository(CONTRACT, runner=fake)

    def test_local_commit_must_equal_remote_branch(self) -> None:
        fake = FakeRunner(
            {
                ("git", "status", "--porcelain"): "",
                ("git", "branch", "--show-current"): "tencent/zhengwujianli\n",
                ("git", "rev-parse", "HEAD"): "aaa\n",
                ("git", "rev-parse", "origin/tencent/zhengwujianli"): "bbb\n",
            }
        )
        with self.assertRaisesRegex(RuntimeError, "does not match origin"):
            require_clean_synced_repository(CONTRACT, runner=fake)

    def test_report_redacts_secret_values_recursively(self) -> None:
        payload = redact_payload(
            {
                "password": "secret",
                "status": "ok",
                "nested": {"Authorization": "Bearer hidden"},
                "items": [{"cookie": "private", "count": 1}],
            }
        )
        self.assertEqual(
            payload,
            {
                "password": "[REDACTED]",
                "status": "ok",
                "nested": {"Authorization": "[REDACTED]"},
                "items": [{"cookie": "[REDACTED]", "count": 1}],
            },
        )

    def test_runner_rejects_shell_command_strings(self) -> None:
        with self.assertRaisesRegex(TypeError, "argument array"):
            run_checked("git status", timeout=5)  # type: ignore[arg-type]

    def test_runner_redacts_requested_values(self) -> None:
        result = run_checked(
            ["python3", "-c", "print('sample-secret')"],
            timeout=5,
            redact=("sample-secret",),
        )
        self.assertEqual(result.stdout.strip(), "[REDACTED]")

    def test_report_is_private_and_redacted(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            report = write_report(
                Path(temporary),
                "preflight.json",
                {"password": "sample-secret", "status": "ok"},
            )
            self.assertEqual(os.stat(report).st_mode & 0o777, 0o600)
            self.assertEqual(
                json.loads(report.read_text(encoding="utf-8")),
                {"password": "[REDACTED]", "status": "ok"},
            )

    def test_dry_run_lists_checks_without_running_commands(self) -> None:
        fake = FakeRunner()
        result = preflight(CONTRACT, runner=fake, dry_run=True)
        self.assertEqual(fake.commands, [])
        self.assertIn("stellaris-zhengwujianli-db-1", result["resources"])
        self.assertNotIn("environment_values", result)


if __name__ == "__main__":
    unittest.main()


class BuildTest(unittest.TestCase):
    COMMIT = "7ecbb8daa8c51b53d13fca03488c658047ff4967"

    def clean_runner(self) -> FakeRunner:
        return FakeRunner(
            {
                ("git", "status", "--porcelain"): "",
                ("git", "branch", "--show-current"): "tencent/zhengwujianli\n",
                ("git", "rev-parse", "HEAD"): self.COMMIT + "\n",
                ("git", "rev-parse", "origin/tencent/zhengwujianli"): self.COMMIT + "\n",
                (
                    "docker",
                    "image",
                    "inspect",
                    "--format",
                    "{{.Id}}|{{join .RepoDigests \";\"}}",
                    f"stellaris-zhengwujianli-backend:{self.COMMIT}",
                ): "sha256:backend|\n",
                (
                    "docker",
                    "image",
                    "inspect",
                    "--format",
                    "{{.Id}}|{{join .RepoDigests \";\"}}",
                    f"stellaris-zhengwujianli-web:{self.COMMIT}",
                ): "sha256:web|\n",
            }
        )

    def test_build_tags_both_images_with_full_commit(self) -> None:
        runner = self.clean_runner()
        result = build_images(CONTRACT, runner=runner)
        self.assertEqual(
            result.backend_image,
            f"stellaris-zhengwujianli-backend:{self.COMMIT}",
        )
        self.assertEqual(
            result.web_image,
            f"stellaris-zhengwujianli-web:{self.COMMIT}",
        )
        command_names = [command[:2] for command in runner.commands]
        self.assertIn(("pnpm", "typecheck"), command_names)
        self.assertIn(("pnpm", "test"), command_names)
        self.assertIn(("pnpm", "build"), command_names)

    def test_candidate_never_uses_production_ports_or_directories(self) -> None:
        env = candidate_environment(CONTRACT, self.COMMIT)
        self.assertEqual(
            env["COMPOSE_PROJECT_NAME"],
            "stellaris-zhengwujianli-candidate",
        )
        values = " ".join(env.values())
        self.assertNotIn("/data/postgres", values)
        self.assertNotIn("3217", values)
        self.assertNotIn("3218", values)
        self.assertIn("phase0-canary-subject", values)


class CandidateTest(unittest.TestCase):
    COMMIT = "7ecbb8daa8c51b53d13fca03488c658047ff4967"

    def runner(self) -> FakeRunner:
        responses = {
            ("git", "status", "--porcelain"): "",
            ("git", "branch", "--show-current"): "tencent/zhengwujianli\n",
            ("git", "rev-parse", "HEAD"): self.COMMIT + "\n",
            ("git", "rev-parse", "origin/tencent/zhengwujianli"): self.COMMIT + "\n",
        }
        for name in (
            "stellaris-zhengwujianli-db-1",
            "stellaris-zhengwujianli-backend-1",
            "stellaris-zhengwujianli-web-1",
        ):
            responses[(
                "docker",
                "inspect",
                "--format",
                "{{.Id}}|{{.Image}}|{{.RestartCount}}",
                name,
            )] = f"{name}-id|{name}-image|0\n"
        return FakeRunner(responses)

    def test_candidate_up_uses_only_candidate_compose_without_build(self) -> None:
        runner = self.runner()
        candidate_up(
            CONTRACT,
            self.COMMIT,
            runner=runner,
            write_environment=False,
            write_evidence=False,
        )
        compose = next(
            command for command in runner.commands
            if command[:2] == ("docker", "compose")
        )
        joined = " ".join(compose)
        self.assertIn("infra/tencent/compose.candidate.yml", joined)
        self.assertIn("--no-build", compose)
        self.assertEqual(compose[-2:], ("--pull", "never"))
        self.assertNotIn("down", compose)
        self.assertNotIn("infra/tencent/compose.yml", joined)

    def test_candidate_verification_rejects_production_drift(self) -> None:
        before = {"backend": {"id": "old", "restart_count": 0}}
        after = {"backend": {"id": "new", "restart_count": 0}}
        with self.assertRaisesRegex(RuntimeError, "production containers changed"):
            require_unchanged_production(before, after)

    def test_candidate_verify_is_read_only_and_checks_real_boundaries(self) -> None:
        runner = self.runner()
        candidate_format = (
            '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}'
            '{{else}}missing{{end}}|{{.RestartCount}}|'
            '{{index .Config.Labels "com.docker.compose.project"}}|{{.Config.Image}}'
        )
        for service in ("db", "backend", "web"):
            name = f"stellaris-zhengwujianli-candidate-{service}-1"
            image = (
                "postgres:17"
                if service == "db"
                else f"stellaris-zhengwujianli-{service}:{self.COMMIT}"
            )
            runner.responses[(
                "docker", "inspect", "--format", candidate_format, name
            )] = (
                "running|healthy|0|stellaris-zhengwujianli-candidate|"
                f"{image}\n"
            )
        runner.responses[("ss", "-ltnH")] = (
            "LISTEN 0 4096 127.0.0.1:3227 0.0.0.0:*\n"
            "LISTEN 0 4096 127.0.0.1:3228 0.0.0.0:*\n"
        )
        runner.responses[(
            "docker", "port", "stellaris-zhengwujianli-candidate-db-1"
        )] = ""
        runner.responses[(
            "curl", "-fsS", "http://127.0.0.1:3227/health"
        )] = '{"status":"ok"}'
        runner.responses[(
            "curl", "-fsS", "-H",
            "X-IFC-User-ID: phase0-canary-subject",
            "http://127.0.0.1:3227/api/session",
        )] = '{"authenticated":true,"userId":"phase0-canary-subject"}'
        runner.responses[(
            "curl", "-fsS", "http://127.0.0.1:3228/"
        )] = (
            '<title>??????</title>'
            '<script src="/zhengwujianli/assets/app.js"></script>'
        )
        runner.responses[(
            "curl", "-fsS",
            "http://127.0.0.1:3228/zhengwujianli/assets/app.js",
        )] = "console.log('candidate')"
        baseline = CandidateLaunch(
            commit=self.COMMIT,
            compose_file="candidate.yml",
            environment_file="candidate.env",
            production_snapshot={
                name: {
                    "id": f"{name}-id",
                    "image_id": f"{name}-image",
                    "restart_count": 0,
                }
                for name in (
                    "stellaris-zhengwujianli-db-1",
                    "stellaris-zhengwujianli-backend-1",
                    "stellaris-zhengwujianli-web-1",
                )
            },
        )
        report = candidate_verify(
            CONTRACT,
            runner=runner,
            launch=baseline,
        )
        self.assertTrue(report["production_unchanged"])
        all_arguments = " ".join(argument for command in runner.commands for argument in command)
        self.assertNotIn("POST", all_arguments)
        self.assertNotIn("/api/tasks", all_arguments)


class BackupTest(unittest.TestCase):
    def test_backup_uses_only_production_stellaris_container(self) -> None:
        responses = {
            (
                "docker", "inspect", "--format",
                '{{index .Config.Labels "com.docker.compose.project"}}',
                "stellaris-zhengwujianli-db-1",
            ): "stellaris-zhengwujianli\n",
            (
                "docker", "exec", "stellaris-zhengwujianli-db-1",
                "psql", "-U", "stellaris", "-d", "stellaris",
                "-Atc", "SELECT current_database()",
            ): "stellaris\n",
            (
                "docker", "exec", "stellaris-zhengwujianli-db-1",
                "pg_restore", "--list", "/tmp/phase0-backup.dump",
            ): "archive-ok\n",
            (
                "docker", "exec", "stellaris-zhengwujianli-db-1",
                "psql", "-U", "stellaris", "-d", "stellaris",
                "-Atc", "SHOW server_version",
            ): "17.10\n",
        }
        runner = FakeRunner(responses)
        with tempfile.TemporaryDirectory() as temporary:
            manifest = backup_production_database(
                CONTRACT,
                runner=runner,
                timestamp="20260812T120000Z",
                backup_directory=Path(temporary),
                write_evidence=False,
            )
        command = runner.find_command("pg_dump")
        self.assertIn("stellaris-zhengwujianli-db-1", command)
        self.assertIn("--dbname=stellaris", command)
        self.assertNotIn("auth", " ".join(command).lower())
        self.assertNotIn("employee", " ".join(command).lower())
        self.assertGreater(manifest.byte_count, 0)
        self.assertEqual(
            set(manifest.__dict__),
            {
                "timestamp", "container", "database", "archive_path",
                "sha256", "byte_count", "postgres_version",
            },
        )

    def test_restore_is_allowed_only_in_candidate_database(self) -> None:
        with self.assertRaisesRegex(ValueError, "restore target must be candidate"):
            verify_backup_in_candidate(
                CONTRACT,
                target_container="stellaris-zhengwujianli-db-1",
            )
