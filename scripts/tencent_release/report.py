"""Write private, recursively redacted release evidence reports."""

from __future__ import annotations

import json
import os
from pathlib import Path
import re
from typing import Mapping, TypeAlias


JsonValue: TypeAlias = object
_SECRET_KEY = re.compile(
    r"password|secret|token|cookie|authorization|credential",
    re.IGNORECASE,
)


def redact_payload(value: JsonValue) -> JsonValue:
    if isinstance(value, Mapping):
        return {
            str(key): "[REDACTED]" if _SECRET_KEY.search(str(key)) else redact_payload(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [redact_payload(item) for item in value]
    if isinstance(value, tuple):
        return [redact_payload(item) for item in value]
    return value


def write_report(
    report_dir: Path,
    name: str,
    payload: Mapping[str, object],
) -> Path:
    if Path(name).name != name or not name.endswith(".json"):
        raise ValueError("report name must be a plain JSON filename")
    report_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(report_dir, 0o700)
    destination = report_dir / name
    temporary = report_dir / f".{name}.{os.getpid()}.tmp"
    try:
        with temporary.open("x", encoding="utf-8") as handle:
            json.dump(
                redact_payload(payload),
                handle,
                ensure_ascii=False,
                indent=2,
                sort_keys=True,
            )
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temporary, 0o600)
        os.replace(temporary, destination)
        os.chmod(destination, 0o600)
    finally:
        if temporary.exists():
            temporary.unlink()
    return destination
