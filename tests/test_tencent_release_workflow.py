from __future__ import annotations

from pathlib import Path
import json
import os
import tempfile
import unittest

from scripts.tencent_release.bootstrap import validate_existing_repository
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
