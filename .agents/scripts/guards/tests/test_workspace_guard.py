#!/usr/bin/env python3
# .agents/scripts/guards/tests/test_workspace_guard.py
"""
Bộ kiểm thử đơn vị cơ học nhị phân cho workspace_guard.py (Feature 004 - Task T005).
Kiểm chứng:
1. Thẩm định Placeholder Guard (TODO, FIXME, STUB_IMPLEMENTATION, fake_data, mock_response).
2. Thẩm định Diff-Scope Isolation (ngăn chặn rò rỉ ra ngoài workspace hoặc tệp cấm).
3. Thẩm định Directory Governance (Max Depth <= 2, cấm cross-screen import trong src/screens).
4. Thẩm định hợp đồng STDOUT của Go Engine (luôn trả về {} với Exit Code 0).
5. Thẩm định phát tín hiệu cảnh báo ra STDERR khi phát hiện vi phạm.
6. Thẩm định ghi nhật ký vết vi mô footprint (< 25ms) tương thích Test Harness.
7. Thẩm định liên thông với ma trận test fixtures (hook_payloads.json).
"""

import os
import sys
import io
import json
import tempfile
import subprocess
import unittest
from unittest.mock import patch

# Thiết lập đường dẫn import
TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
GUARDS_DIR = os.path.abspath(os.path.join(TESTS_DIR, ".."))
if GUARDS_DIR not in sys.path:
    sys.path.insert(0, GUARDS_DIR)
if TESTS_DIR not in sys.path:
    sys.path.insert(0, TESTS_DIR)

import workspace_guard
from workspace_guard import (
    check_placeholders,
    check_diff_scope,
    check_directory_governance,
    inspect_workspace_safety,
    handle_post_tool_use,
    get_workspace_root,
)
from engine_simulator import load_fixtures, get_fixture


class TestCheckPlaceholders(unittest.TestCase):
    """Kiểm thử phát hiện placeholder bị cấm trên production code."""

    def test_clean_file_no_placeholders(self):
        """Kịch bản danh định: Không có placeholder bị cấm."""
        content = "def calculate_sum(a: int, b: int) -> int:\n    return a + b\n"
        count, matches = check_placeholders("dummy.py", fallback_content=content)
        self.assertEqual(count, 0)
        self.assertEqual(len(matches), 0)

    def test_detect_all_forbidden_placeholders(self):
        """Kịch bản phát hiện toàn bộ các từ khóa placeholder bị cấm."""
        patterns = ["TODO", "FIXME", "STUB_IMPLEMENTATION", "fake_data", "mock_response"]
        for p in patterns:
            with self.subTest(placeholder=p):
                content = f"// Sample code\nconst x = '{p}: replace later';\nreturn x;"
                count, matches = check_placeholders("dummy.ts", fallback_content=content)
                self.assertEqual(count, 1)
                self.assertIn("Line 2:", matches[0])
                self.assertIn(p, matches[0])

    def test_read_from_actual_file_on_disk(self):
        """Kịch bản đọc trực tiếp từ tệp vật lý trên đĩa."""
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False) as f:
            f.write("# Clean line\n# FIXME: must fix this bug\n# Another clean line\n")
            temp_path = f.name

        try:
            count, matches = check_placeholders(temp_path)
            self.assertEqual(count, 1)
            self.assertIn("Line 2: # FIXME:", matches[0])
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)


class TestCheckDiffScope(unittest.TestCase):
    """Kiểm thử cô lập phạm vi thay đổi (Diff-Scope Isolation)."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.workspace_root = os.path.abspath(self.temp_dir.name)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_in_scope_nominal(self):
        """Kịch bản danh định: Tệp nằm trong thư mục workspace."""
        file_path = os.path.join(self.workspace_root, "src", "feature.py")
        in_scope, reason = check_diff_scope(file_path, self.workspace_root)
        self.assertTrue(in_scope)
        self.assertEqual(reason, "OK")

    def test_out_of_scope_outside_workspace(self):
        """Kịch bản biên: Tệp nằm ngoài thư mục workspace."""
        outside_path = os.path.abspath("/tmp/dangerous_leak.py" if os.name != "nt" else "C:\\Windows\\temp\\leak.py")
        in_scope, reason = check_diff_scope(outside_path, self.workspace_root)
        self.assertFalse(in_scope)
        self.assertIn("nằm ngoài workspace", reason)

    def test_out_of_scope_forbidden_path(self):
        """Kịch bản biên: Tệp nằm trong thư mục mang tiền tố forbidden."""
        forbidden_file = os.path.join(self.workspace_root, "src", "forbidden", "core", "secret.py")
        in_scope, reason = check_diff_scope(forbidden_file, self.workspace_root)
        self.assertFalse(in_scope)
        self.assertIn("forbidden", reason)


class TestCheckDirectoryGovernance(unittest.TestCase):
    """Kiểm thử kỷ luật cấu trúc thư mục 3 tầng và import chéo."""

    def test_valid_screen_structure_depth(self):
        """Cấu trúc hợp lệ: src/screens/menu/components/MenuItem.tsx (độ sâu 2 cấp con)."""
        valid_path = "src/screens/menu/components/MenuItem.tsx"
        status, reason = check_directory_governance(valid_path)
        self.assertIsNone(status)
        self.assertIsNone(reason)

    def test_max_depth_violation_in_screens(self):
        """Vi phạm Max Depth: Cấp lồng > 3 trong src/screens/ (ví dụ có thư mục con trong components)."""
        deep_path = "src/screens/menu/components/sub/deep/MenuItem.tsx"
        status, reason = check_directory_governance(deep_path)
        self.assertEqual(status, "FLAGGED_DIRECTORY_DEPTH")
        self.assertIn("Max Depth", reason)

    def test_cross_screen_component_import_violation(self):
        """Vi phạm Cross-screen Import: src/screens/menu/ import từ ../settings/components."""
        screen_file = "src/screens/menu/components/MenuView.tsx"
        bad_import = "import { SettingPanel } from '../settings/components/SettingPanel';\n"
        status, reason = check_directory_governance(screen_file, fallback_content=bad_import)
        self.assertEqual(status, "FLAGGED_CROSS_IMPORT")
        self.assertIn("cross-screen component import", reason)
        self.assertIn("settings", reason)

    def test_non_screens_files_not_subject_to_screens_rules(self):
        """Các tệp nằm ngoài src/screens không bị áp đặt quy tắc screens."""
        other_path = "src/features/auth/services/deep/token.ts"
        status, reason = check_directory_governance(other_path)
        self.assertIsNone(status)


class TestInspectWorkspaceSafety(unittest.TestCase):
    """Kiểm thử chuỗi thẩm định an toàn tổng thể inspect_workspace_safety."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.workspace_root = os.path.abspath(self.temp_dir.name)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_clean_file_payload(self):
        """Kịch bản danh định: Tệp an toàn hoàn toàn -> CLEAN."""
        payload = {
            "name": "write_file",
            "args": {
                "Path": os.path.join(self.workspace_root, "src", "main.py"),
                "Content": "def run():\n    return 42\n"
            }
        }
        status, target, details = inspect_workspace_safety(payload, self.workspace_root)
        self.assertEqual(status, "CLEAN")
        self.assertTrue(details["inScope"])
        self.assertEqual(details["violations"], 0)

    def test_placeholder_payload(self):
        """Kịch bản phát hiện placeholder -> FLAGGED_PLACEHOLDER."""
        payload = {
            "name": "write_file",
            "args": {
                "Path": os.path.join(self.workspace_root, "src", "main.py"),
                "Content": "def run():\n    # TODO: implement later\n    pass\n"
            }
        }
        status, target, details = inspect_workspace_safety(payload, self.workspace_root)
        self.assertEqual(status, "FLAGGED_PLACEHOLDER")
        self.assertEqual(details["violations"], 1)

    def test_diff_scope_violation_payload(self):
        """Kịch bản tệp vi phạm ranh giới -> OUT_OF_SCOPE."""
        payload = {
            "name": "write_file",
            "args": {
                "Path": os.path.join(self.workspace_root, "src", "forbidden", "leak.py"),
                "Content": "pass\n"
            }
        }
        status, target, details = inspect_workspace_safety(payload, self.workspace_root)
        self.assertEqual(status, "OUT_OF_SCOPE")
        self.assertFalse(details["inScope"])

    def test_missing_path_payload(self):
        """Kịch bản không có đường dẫn tệp -> SKIPPED_NO_PATH."""
        payload = {"name": "write_file", "args": {}}
        status, target, details = inspect_workspace_safety(payload, self.workspace_root)
        self.assertEqual(status, "SKIPPED_NO_PATH")


class TestHandlePostToolUse(unittest.TestCase):
    """Kiểm thử xử lý PostToolUse và bảo đảm khế ước STDOUT / STDERR."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.workspace_root = os.path.abspath(self.temp_dir.name)
        self.log_path = os.path.join(self.workspace_root, "logs", "footprints.jsonl")

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_clean_file_execution_contract(self):
        """
        User Story 2 - Acceptance Scenario 1:
        Payload sạch trả về {} ra STDOUT, ghi footprint với status CLEAN trong < 25ms.
        """
        payload = {
            "toolCall": {
                "name": "write_file",
                "args": {
                    "Path": os.path.join(self.workspace_root, "src", "clean.py"),
                    "Content": "print('hello world')\n"
                }
            }
        }
        with patch.object(sys, "stderr", io.StringIO()) as mock_stderr:
            result = handle_post_tool_use(
                payload,
                workspace_root=self.workspace_root,
                log_path=self.log_path,
            )

        self.assertEqual(result, {})
        self.assertEqual(mock_stderr.getvalue(), "")

        # Kiểm tra footprint được ghi vào file JSONL
        self.assertTrue(os.path.exists(self.log_path))
        with open(self.log_path, "r", encoding="utf-8") as f:
            record = json.loads(f.readline().strip())

        self.assertEqual(record["guard"], "workspace_guard")
        self.assertEqual(record["event"], "PostToolUse")
        self.assertEqual(record["status"], "CLEAN")
        self.assertLess(record["durationMs"], 25.0)

    def test_flagged_placeholder_contract(self):
        """
        User Story 2 - Acceptance Scenario 2:
        Payload chứa TODO ghi cảnh báo ra STDERR, ghi log FLAGGED_PLACEHOLDER, trả về {}.
        """
        payload = {
            "toolCall": {
                "name": "write_file",
                "args": {
                    "Path": os.path.join(self.workspace_root, "src", "service.py"),
                    "Content": "def fetch():\n    return mock_response\n"
                }
            }
        }
        with patch.object(sys, "stderr", io.StringIO()) as mock_stderr:
            result = handle_post_tool_use(
                payload,
                workspace_root=self.workspace_root,
                log_path=self.log_path,
            )

        self.assertEqual(result, {})
        stderr_output = mock_stderr.getvalue()
        self.assertIn("[GUARD WARNING]", stderr_output)
        self.assertIn("placeholder", stderr_output)

        with open(self.log_path, "r", encoding="utf-8") as f:
            record = json.loads(f.readline().strip())

        self.assertEqual(record["status"], "FLAGGED_PLACEHOLDER")
        self.assertEqual(record["details"]["violations"], 1)

    def test_diff_scope_violation_contract(self):
        """
        User Story 2 - Acceptance Scenario 3:
        Payload vi phạm diff-scope ghi cảnh báo ra STDERR, ghi log OUT_OF_SCOPE, trả về {}.
        """
        payload = {
            "toolCall": {
                "name": "write_file",
                "args": {
                    "Path": os.path.join(self.workspace_root, "src", "forbidden", "secret.py"),
                    "Content": "KEY = 123\n"
                }
            }
        }
        with patch.object(sys, "stderr", io.StringIO()) as mock_stderr:
            result = handle_post_tool_use(
                payload,
                workspace_root=self.workspace_root,
                log_path=self.log_path,
            )

        self.assertEqual(result, {})
        stderr_output = mock_stderr.getvalue()
        self.assertIn("[GUARD WARNING]", stderr_output)
        self.assertIn("forbidden", stderr_output)

        with open(self.log_path, "r", encoding="utf-8") as f:
            record = json.loads(f.readline().strip())

        self.assertEqual(record["status"], "OUT_OF_SCOPE")
        self.assertFalse(record["details"]["inScope"])

    def test_integration_with_fixture_matrix(self):
        """Kiểm chứng trực tiếp với 3 fixture PostToolUse trong hook_payloads.json."""
        fixtures = load_fixtures()

        # 1. Clean file
        res_clean = handle_post_tool_use(fixtures["post_tool_use_clean_file"], log_path=self.log_path)
        self.assertEqual(res_clean, {})

        # 2. Flagged placeholder
        with patch.object(sys, "stderr", io.StringIO()):
            res_flagged = handle_post_tool_use(fixtures["post_tool_use_flagged_placeholder"], log_path=self.log_path)
        self.assertEqual(res_flagged, {})

        # 3. Diff scope violation
        with patch.object(sys, "stderr", io.StringIO()):
            res_diff = handle_post_tool_use(fixtures["post_tool_use_diff_scope_violation"], log_path=self.log_path)
        self.assertEqual(res_diff, {})

        with open(self.log_path, "r", encoding="utf-8") as f:
            records = [json.loads(line.strip()) for line in f if line.strip()]

        self.assertEqual(len(records), 3)
        self.assertEqual(records[0]["status"], "CLEAN")
        self.assertEqual(records[1]["status"], "FLAGGED_PLACEHOLDER")
        self.assertEqual(records[2]["status"], "OUT_OF_SCOPE")


class TestSubprocessCLIExecution(unittest.TestCase):
    """Kiểm thử triệu gọi tiến trình con CLI chuẩn Go Engine cmd /c."""

    def test_cli_execution_with_payload_argument(self):
        """Kiểm thử python scripts/guards/workspace_guard.py --payload '...'"""
        script_path = os.path.join(GUARDS_DIR, "workspace_guard.py")
        payload = json.dumps({
            "name": "write_file",
            "args": {"Path": "src/dummy.py", "Content": "val = 1\n"}
        })

        proc = subprocess.run(
            [sys.executable, script_path, "--payload", payload],
            capture_output=True,
            text=True,
            encoding="utf-8",
        )

        self.assertEqual(proc.returncode, 0)
        self.assertEqual(proc.stdout.strip(), "{}")

    def test_cli_execution_via_stdin(self):
        """Kiểm thử truyền payload qua STDIN với BOM Windows."""
        script_path = os.path.join(GUARDS_DIR, "workspace_guard.py")
        payload = '\ufeff' + json.dumps({
            "name": "write_file",
            "args": {"Path": "src/dummy.py", "Content": "// TODO: clean\n"}
        })

        proc = subprocess.run(
            [sys.executable, script_path],
            input=payload,
            capture_output=True,
            text=True,
            encoding="utf-8",
        )

        self.assertEqual(proc.returncode, 0)
        self.assertEqual(proc.stdout.strip(), "{}")
        self.assertIn("[GUARD WARNING]", proc.stderr)


if __name__ == "__main__":
    unittest.main()
