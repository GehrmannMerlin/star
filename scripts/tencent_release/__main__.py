"""Command-line entry point for scoped Tencent release operations."""

from __future__ import annotations

import argparse
from dataclasses import asdict, is_dataclass
import json
import os
from pathlib import Path
import re

from .backup import backup_production_database, verify_backup_in_candidate
from .bootstrap import bootstrap
from .build import build_images
from .candidate import candidate_up, candidate_verify
from .contract import load_contract
from .preflight import preflight, require_clean_synced_repository


def _activate_node_24() -> None:
    root = Path("/root/.nvm/versions/node")
    candidates: list[tuple[tuple[int, ...], Path]] = []
    for path in root.glob("v24.*/bin"):
        match = re.fullmatch(r"v(\d+(?:\.\d+)+)", path.parent.name)
        if match:
            candidates.append(
                (tuple(int(part) for part in match.group(1).split(".")), path)
            )
    if candidates:
        node_bin = max(candidates)[1]
        os.environ["PATH"] = f"{node_bin}{os.pathsep}{os.environ.get('PATH', '')}"


def _serializable(value: object) -> object:
    return asdict(value) if is_dataclass(value) else value


def main() -> int:
    parser = argparse.ArgumentParser(prog="python3 -m scripts.tencent_release")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("bootstrap")
    preflight_parser = subparsers.add_parser("preflight")
    preflight_parser.add_argument("--dry-run", action="store_true")
    subparsers.add_parser("build")
    subparsers.add_parser("candidate-up")
    subparsers.add_parser("candidate-verify")
    subparsers.add_parser("backup")
    subparsers.add_parser("restore-verify")
    arguments = parser.parse_args()

    _activate_node_24()
    contract = load_contract(Path("infra/tencent/release-contract.json"))
    if arguments.command == "bootstrap":
        result = bootstrap(contract)
    elif arguments.command == "preflight":
        result = preflight(contract, dry_run=arguments.dry_run)
    elif arguments.command == "build":
        result = build_images(contract)
    elif arguments.command == "candidate-up":
        result = candidate_up(
            contract,
            require_clean_synced_repository(contract),
        )
    elif arguments.command == "candidate-verify":
        result = candidate_verify(contract)
    elif arguments.command == "backup":
        result = backup_production_database(contract)
    else:
        result = verify_backup_in_candidate(contract)
    print(
        json.dumps(
            _serializable(result),
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
