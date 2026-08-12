"""Load and validate the machine-readable Tencent release contract."""

from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
from typing import Any


_REQUIRED_FIELDS = {
    "appRoot",
    "repository",
    "branch",
    "productionProject",
    "candidateProject",
    "productionPorts",
    "candidatePorts",
    "productionDatabase",
    "candidateDatabase",
    "allowedContainerPrefixes",
    "forbiddenPathFragments",
    "forbiddenDatabaseNames",
    "productionCompose",
    "candidateCompose",
    "stateDirectory",
    "candidateDataDirectory",
}


@dataclass(frozen=True)
class ReleaseContract:
    app_root: Path
    repository: Path
    branch: str
    production_project: str
    candidate_project: str
    production_ports: tuple[int, int]
    candidate_ports: tuple[int, int]
    production_database: str
    candidate_database: str
    allowed_container_prefixes: tuple[str, ...]
    forbidden_path_fragments: tuple[str, ...]
    forbidden_database_names: tuple[str, ...]
    production_compose: Path
    candidate_compose: Path
    state_directory: Path
    candidate_data_directory: Path


def _pair_of_ports(value: Any, field: str) -> tuple[int, int]:
    if (
        not isinstance(value, list)
        or len(value) != 2
        or not all(isinstance(port, int) and 1 <= port <= 65535 for port in value)
    ):
        raise ValueError(f"{field} must contain exactly two valid ports")
    return value[0], value[1]


def _strings(value: Any, field: str) -> tuple[str, ...]:
    if (
        not isinstance(value, list)
        or not value
        or not all(isinstance(item, str) and item for item in value)
    ):
        raise ValueError(f"{field} must be a non-empty string list")
    return tuple(value)


def _string(data: dict[str, Any], field: str) -> str:
    value = data[field]
    if not isinstance(value, str) or not value:
        raise ValueError(f"{field} must be a non-empty string")
    return value


def _absolute_path(data: dict[str, Any], field: str) -> Path:
    value = Path(_string(data, field))
    if not value.is_absolute():
        raise ValueError(f"{field} must be an absolute path")
    return value


def load_contract(path: Path) -> ReleaseContract:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("release contract must be a JSON object")

    missing = sorted(_REQUIRED_FIELDS.difference(data))
    if missing:
        raise ValueError(f"release contract missing fields: {', '.join(missing)}")

    branch = _string(data, "branch")
    if branch != "tencent/zhengwujianli":
        raise ValueError("release contract branch must be tencent/zhengwujianli")

    production_project = _string(data, "productionProject")
    candidate_project = _string(data, "candidateProject")
    if production_project == candidate_project:
        raise ValueError("production and candidate projects must differ")

    production_ports = _pair_of_ports(data["productionPorts"], "productionPorts")
    candidate_ports = _pair_of_ports(data["candidatePorts"], "candidatePorts")
    if set(production_ports).intersection(candidate_ports):
        raise ValueError("production and candidate ports must not overlap")

    app_root = _absolute_path(data, "appRoot")
    repository = _absolute_path(data, "repository")
    state_directory = _absolute_path(data, "stateDirectory")
    candidate_data_directory = _absolute_path(data, "candidateDataDirectory")
    for field, target in (
        ("repository", repository),
        ("stateDirectory", state_directory),
        ("candidateDataDirectory", candidate_data_directory),
    ):
        if not target.is_relative_to(app_root):
            raise ValueError(f"{field} must be inside appRoot")

    return ReleaseContract(
        app_root=app_root,
        repository=repository,
        branch=branch,
        production_project=production_project,
        candidate_project=candidate_project,
        production_ports=production_ports,
        candidate_ports=candidate_ports,
        production_database=_string(data, "productionDatabase"),
        candidate_database=_string(data, "candidateDatabase"),
        allowed_container_prefixes=_strings(
            data["allowedContainerPrefixes"], "allowedContainerPrefixes"
        ),
        forbidden_path_fragments=_strings(
            data["forbiddenPathFragments"], "forbiddenPathFragments"
        ),
        forbidden_database_names=_strings(
            data["forbiddenDatabaseNames"], "forbiddenDatabaseNames"
        ),
        production_compose=Path(_string(data, "productionCompose")),
        candidate_compose=Path(_string(data, "candidateCompose")),
        state_directory=state_directory,
        candidate_data_directory=candidate_data_directory,
    )
