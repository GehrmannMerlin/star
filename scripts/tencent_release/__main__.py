"""Command-line entry point for scoped Tencent release operations."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from .bootstrap import bootstrap
from .contract import load_contract
from .preflight import preflight


def main() -> int:
    parser = argparse.ArgumentParser(prog="python3 -m scripts.tencent_release")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("bootstrap")
    preflight_parser = subparsers.add_parser("preflight")
    preflight_parser.add_argument("--dry-run", action="store_true")
    arguments = parser.parse_args()

    contract = load_contract(Path("infra/tencent/release-contract.json"))
    if arguments.command == "bootstrap":
        result = bootstrap(contract)
    else:
        result = preflight(contract, dry_run=arguments.dry_run)
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
