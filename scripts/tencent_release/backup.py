"""Scoped PostgreSQL backup and candidate-only restore verification."""

from __future__ import annotations

from dataclasses import asdict, dataclass
import hashlib
import json
import os
from pathlib import Path
import re
from typing import cast

from .contract import ReleaseContract
from .report import write_report
from .runner import CommandRunner, SubprocessRunner
from .scope import (
    require_container_name,
    require_database_target,
    require_path_in_app_root,
)


_PRODUCTION_CONTAINER = "stellaris-zhengwujianli-db-1"
_CANDIDATE_CONTAINER = "stellaris-zhengwujianli-candidate-db-1"
_ARCHIVE_IN_PRODUCTION = "/tmp/phase0-backup.dump"
_ARCHIVE_IN_CANDIDATE = "/tmp/phase0-restore.dump"
_PROJECT_FORMAT = '{{index .Config.Labels "com.docker.compose.project"}}'
_TIMESTAMP = re.compile(r"[0-9]{8}T[0-9]{6}Z")


@dataclass(frozen=True)
class BackupManifest:
    timestamp: str
    container: str
    database: str
    archive_path: str
    sha256: str
    byte_count: int
    postgres_version: str


def _run(
    runner: CommandRunner,
    argv: list[str],
    *,
    timeout: int = 30,
) -> str:
    return runner.run(argv, timeout=timeout).stdout.strip()


def _validate_project(
    runner: CommandRunner,
    container: str,
    expected_project: str,
) -> None:
    actual = _run(
        runner,
        ["docker", "inspect", "--format", _PROJECT_FORMAT, container],
    )
    if actual != expected_project:
        raise RuntimeError(f"container project mismatch: {container}")


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _timestamp_now() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def backup_production_database(
    contract: ReleaseContract,
    *,
    runner: CommandRunner | None = None,
    timestamp: str | None = None,
    backup_directory: Path | None = None,
    write_evidence: bool = True,
) -> BackupManifest:
    active_runner = runner or SubprocessRunner()
    require_container_name(contract, _PRODUCTION_CONTAINER)
    require_database_target(
        contract,
        _PRODUCTION_CONTAINER,
        contract.production_database,
    )
    _validate_project(
        active_runner,
        _PRODUCTION_CONTAINER,
        contract.production_project,
    )
    current_database = _run(
        active_runner,
        [
            "docker", "exec", _PRODUCTION_CONTAINER,
            "psql", "-U", "stellaris", "-d", contract.production_database,
            "-Atc", "SELECT current_database()",
        ],
    )
    if current_database != contract.production_database:
        raise RuntimeError("production database identity mismatch")

    measured_timestamp = timestamp or _timestamp_now()
    if not _TIMESTAMP.fullmatch(measured_timestamp):
        raise ValueError("backup timestamp must be measured UTC YYYYMMDDTHHMMSSZ")
    directory = backup_directory or (contract.state_directory / "backups")
    if backup_directory is None:
        require_path_in_app_root(contract, directory)
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(directory, 0o700)
    temporary = directory / f".{measured_timestamp}.dump.tmp"
    if temporary.exists():
        raise RuntimeError("backup temporary file already exists")

    dump_command = [
        "docker", "exec", _PRODUCTION_CONTAINER,
        "pg_dump", "--format=custom", "--no-owner", "--no-acl",
        f"--dbname={contract.production_database}",
    ]
    try:
        active_runner.run_to_file(
            dump_command,
            temporary,
            timeout=1800,
        )
        os.chmod(temporary, 0o600)
        if temporary.stat().st_size <= 0:
            raise RuntimeError("database backup archive is empty")
        _run(
            active_runner,
            ["docker", "cp", str(temporary), f"{_PRODUCTION_CONTAINER}:{_ARCHIVE_IN_PRODUCTION}"],
            timeout=120,
        )
        _run(
            active_runner,
            ["docker", "exec", _PRODUCTION_CONTAINER, "pg_restore", "--list", _ARCHIVE_IN_PRODUCTION],
            timeout=120,
        )
        version = _run(
            active_runner,
            [
                "docker", "exec", _PRODUCTION_CONTAINER,
                "psql", "-U", "stellaris", "-d", contract.production_database,
                "-Atc", "SHOW server_version",
            ],
        )
        digest = _sha256_file(temporary)
        byte_count = temporary.stat().st_size
        final_path = directory / f"{measured_timestamp}-{digest}.dump"
        os.replace(temporary, final_path)
        os.chmod(final_path, 0o600)
    finally:
        if temporary.exists():
            temporary.unlink()
        try:
            _run(
                active_runner,
                ["docker", "exec", _PRODUCTION_CONTAINER, "rm", "-f", "--", _ARCHIVE_IN_PRODUCTION],
            )
        except RuntimeError:
            pass

    manifest = BackupManifest(
        timestamp=measured_timestamp,
        container=_PRODUCTION_CONTAINER,
        database=contract.production_database,
        archive_path=str(final_path),
        sha256=digest,
        byte_count=byte_count,
        postgres_version=version,
    )
    if write_evidence:
        write_report(
            contract.state_directory / "manifests",
            "backup.json",
            asdict(manifest),
        )
    return manifest


def _load_manifest(contract: ReleaseContract) -> BackupManifest:
    path = require_path_in_app_root(
        contract,
        contract.state_directory / "manifests" / "backup.json",
    )
    payload = json.loads(path.read_text(encoding="utf-8"))
    return BackupManifest(**payload)


def verify_backup_in_candidate(
    contract: ReleaseContract,
    *,
    target_container: str = _CANDIDATE_CONTAINER,
    target_database: str | None = None,
    manifest: BackupManifest | None = None,
    runner: CommandRunner | None = None,
) -> dict[str, object]:
    database = target_database or contract.candidate_database
    if target_container != _CANDIDATE_CONTAINER or database != contract.candidate_database:
        raise ValueError("restore target must be candidate")
    require_container_name(contract, target_container)
    require_database_target(contract, target_container, database)

    active_runner = runner or SubprocessRunner()
    source = manifest or _load_manifest(contract)
    archive = require_path_in_app_root(contract, Path(source.archive_path))
    expected_root = (contract.state_directory / "backups").resolve(strict=False)
    if not archive.resolve(strict=False).is_relative_to(expected_root):
        raise ValueError("backup archive is outside the approved backup directory")
    if not archive.is_file():
        raise RuntimeError("backup archive is missing")
    if _sha256_file(archive) != source.sha256:
        raise RuntimeError("backup archive hash mismatch")
    _validate_project(active_runner, target_container, contract.candidate_project)

    user = "stellaris_candidate"
    try:
        _run(active_runner, ["docker", "cp", str(archive), f"{target_container}:{_ARCHIVE_IN_CANDIDATE}"], timeout=120)
        _run(
            active_runner,
            [
                "docker", "exec", target_container,
                "psql", "-U", user, "-d", "postgres", "-v", "ON_ERROR_STOP=1",
                "-c", f'DROP DATABASE IF EXISTS "{database}" WITH (FORCE)',
            ],
        )
        _run(
            active_runner,
            [
                "docker", "exec", target_container,
                "psql", "-U", user, "-d", "postgres", "-v", "ON_ERROR_STOP=1",
                "-c", f'CREATE DATABASE "{database}"',
            ],
        )
        _run(
            active_runner,
            [
                "docker", "exec", target_container,
                "pg_restore", "--clean", "--if-exists", "--no-owner", "--no-acl",
                f"--dbname={database}", _ARCHIVE_IN_CANDIDATE,
            ],
            timeout=1800,
        )
        table_text = _run(
            active_runner,
            [
                "docker", "exec", target_container,
                "psql", "-U", user, "-d", database, "-Atc",
                "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
            ],
        )
        table_counts: dict[str, int] = {}
        for table in [line for line in table_text.splitlines() if line]:
            quoted = table.replace('"', '""')
            count = _run(
                active_runner,
                [
                    "docker", "exec", target_container,
                    "psql", "-U", user, "-d", database, "-Atc",
                    f'SELECT count(*) FROM "{quoted}"',
                ],
            )
            table_counts[table] = int(count)
        migration_versions = _run(
            active_runner,
            [
                "docker", "exec", target_container,
                "psql", "-U", user, "-d", database, "-Atc",
                'SELECT name FROM "kysely_migration" ORDER BY timestamp',
            ],
        ).splitlines()
    finally:
        try:
            _run(
                active_runner,
                ["docker", "exec", target_container, "rm", "-f", "--", _ARCHIVE_IN_CANDIDATE],
            )
        except RuntimeError:
            pass

    report = {
        "archive_sha256": source.sha256,
        "target_container": target_container,
        "target_database": database,
        "migration_versions": migration_versions,
        "table_counts": table_counts,
    }
    if runner is None:
        write_report(
            contract.state_directory / "reports",
            "restore-verify.json",
            report,
        )
    return report
