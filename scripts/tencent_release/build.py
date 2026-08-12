"""Build immutable backend and web images from a verified commit."""

from __future__ import annotations

from dataclasses import asdict, dataclass
import re

from .contract import ReleaseContract
from .preflight import require_clean_synced_repository
from .report import write_report
from .runner import CommandRunner, SubprocessRunner


_COMMIT = re.compile(r"[0-9a-f]{40}")
_INSPECT_FORMAT = '{{.Id}}|{{join .RepoDigests ";"}}'


@dataclass(frozen=True)
class ImageMetadata:
    reference: str
    image_id: str
    repo_digests: tuple[str, ...]


@dataclass(frozen=True)
class BuildResult:
    commit: str
    backend_image: str
    web_image: str
    backend: ImageMetadata
    web: ImageMetadata


def _run(
    runner: CommandRunner,
    argv: list[str],
    *,
    timeout: int,
) -> str:
    return runner.run(argv, timeout=timeout).stdout.strip()


def _inspect(runner: CommandRunner, reference: str) -> ImageMetadata:
    raw = _run(
        runner,
        ["docker", "image", "inspect", "--format", _INSPECT_FORMAT, reference],
        timeout=30,
    )
    image_id, separator, digest_text = raw.partition("|")
    if not separator or not image_id:
        raise RuntimeError(f"cannot inspect built image: {reference}")
    return ImageMetadata(
        reference=reference,
        image_id=image_id,
        repo_digests=tuple(item for item in digest_text.split(";") if item),
    )


def build_images(
    contract: ReleaseContract,
    *,
    runner: CommandRunner | None = None,
) -> BuildResult:
    write_evidence = runner is None
    active_runner = runner or SubprocessRunner()
    commit = require_clean_synced_repository(contract, runner=active_runner)
    if not _COMMIT.fullmatch(commit):
        raise RuntimeError("verified commit must be a full lowercase SHA-1")

    for command in (
        ["pnpm", "install", "--frozen-lockfile"],
        ["pnpm", "typecheck"],
        ["pnpm", "test"],
        ["pnpm", "build"],
    ):
        _run(active_runner, command, timeout=1800)

    backend_reference = f"stellaris-zhengwujianli-backend:{commit}"
    web_reference = f"stellaris-zhengwujianli-web:{commit}"
    for target, reference in (
        ("backend", backend_reference),
        ("web", web_reference),
    ):
        _run(
            active_runner,
            [
                "docker",
                "build",
                "--target",
                target,
                "--build-arg",
                "VITE_PUBLIC_BASE=/zhengwujianli/",
                "-t",
                reference,
                ".",
            ],
            timeout=3600,
        )

    result = BuildResult(
        commit=commit,
        backend_image=backend_reference,
        web_image=web_reference,
        backend=_inspect(active_runner, backend_reference),
        web=_inspect(active_runner, web_reference),
    )
    if write_evidence:
        write_report(
            contract.state_directory / "reports",
            "build.json",
            asdict(result),
        )
    return result
