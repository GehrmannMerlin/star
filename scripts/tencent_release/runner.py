"""Subprocess execution with argument arrays, timeouts, and output redaction."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import subprocess
from typing import Protocol, Sequence


@dataclass(frozen=True)
class CompletedCommand:
    argv: tuple[str, ...]
    returncode: int
    stdout: str
    stderr: str


class CommandRunner(Protocol):
    def run(
        self,
        argv: list[str],
        *,
        timeout: int,
        redact: tuple[str, ...] = (),
    ) -> CompletedCommand: ...

    def run_to_file(
        self,
        argv: list[str],
        destination: Path,
        *,
        timeout: int,
        redact: tuple[str, ...] = (),
    ) -> CompletedCommand: ...


def _redact_text(value: str, secrets: Sequence[str]) -> str:
    redacted = value
    for secret in secrets:
        if secret:
            redacted = redacted.replace(secret, "[REDACTED]")
    return redacted


def run_checked(
    argv: list[str],
    *,
    timeout: int,
    redact: tuple[str, ...] = (),
) -> CompletedCommand:
    if not isinstance(argv, list) or not argv or not all(
        isinstance(argument, str) and argument for argument in argv
    ):
        raise TypeError("run_checked requires a non-empty argument array")
    completed = subprocess.run(
        argv,
        shell=False,
        check=False,
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    result = CompletedCommand(
        tuple(argv),
        completed.returncode,
        _redact_text(completed.stdout, redact),
        _redact_text(completed.stderr, redact),
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"command failed with status {result.returncode}: {result.argv[0]}"
        )
    return result




def run_to_file(
    argv: list[str],
    destination: Path,
    *,
    timeout: int,
    redact: tuple[str, ...] = (),
) -> CompletedCommand:
    if not isinstance(argv, list) or not argv or not all(
        isinstance(argument, str) and argument for argument in argv
    ):
        raise TypeError("run_to_file requires a non-empty argument array")
    with destination.open("xb") as output:
        completed = subprocess.run(
            argv,
            shell=False,
            check=False,
            stdout=output,
            stderr=subprocess.PIPE,
            timeout=timeout,
        )
    stderr = completed.stderr.decode("utf-8", "replace")
    result = CompletedCommand(
        tuple(argv),
        completed.returncode,
        "",
        _redact_text(stderr, redact),
    )
    if result.returncode != 0:
        destination.unlink(missing_ok=True)
        raise RuntimeError(
            f"command failed with status {result.returncode}: {result.argv[0]}"
        )
    return result


class SubprocessRunner:
    def run(
        self,
        argv: list[str],
        *,
        timeout: int,
        redact: tuple[str, ...] = (),
    ) -> CompletedCommand:
        return run_checked(argv, timeout=timeout, redact=redact)

    def run_to_file(
        self,
        argv: list[str],
        destination: Path,
        *,
        timeout: int,
        redact: tuple[str, ...] = (),
    ) -> CompletedCommand:
        return run_to_file(
            argv,
            destination,
            timeout=timeout,
            redact=redact,
        )
