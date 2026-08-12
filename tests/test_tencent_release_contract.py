from pathlib import Path
import unittest

from scripts.tencent_release.contract import load_contract
from scripts.tencent_release.scope import (
    require_container_name,
    require_database_target,
    require_path_in_app_root,
)


class ReleaseContractTest(unittest.TestCase):
    def setUp(self) -> None:
        self.contract = load_contract(Path("infra/tencent/release-contract.json"))

    def test_contract_has_exact_production_and_candidate_boundaries(self) -> None:
        self.assertEqual(self.contract.branch, "tencent/zhengwujianli")
        self.assertEqual(self.contract.production_ports, (3217, 3218))
        self.assertEqual(self.contract.candidate_ports, (3227, 3228))
        self.assertNotEqual(
            self.contract.production_project,
            self.contract.candidate_project,
        )

    def test_rejects_path_outside_application_root(self) -> None:
        with self.assertRaisesRegex(ValueError, "outside application root"):
            require_path_in_app_root(
                self.contract,
                Path("/www/wwwroot/auth-system"),
            )

    def test_rejects_employee_or_unknown_container(self) -> None:
        with self.assertRaisesRegex(ValueError, "container is not allowlisted"):
            require_container_name(self.contract, "auth-system")

    def test_rejects_forbidden_database_name(self) -> None:
        with self.assertRaisesRegex(ValueError, "database target is forbidden"):
            require_database_target(
                self.contract,
                "stellaris-zhengwujianli-candidate-db-1",
                "employees",
            )
