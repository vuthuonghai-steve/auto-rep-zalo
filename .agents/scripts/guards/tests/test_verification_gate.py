#!/usr/bin/env python3
# .agents/scripts/guards/tests/test_verification_gate.py
"""
Bộ kiểm thử đơn vị cơ học nhị phân cho verification_gate.py (Feature 004 - Task T006).
Kiểm chứng:
1. Hợp đồng STDOUT chuẩn Go Engine cho Stop hook:
   - {"decision": "stop", "reason": "..."} khi thỏa mãn Definition of Done.
   - {"decision": "continue", "reason": "[STOP_GATE_BLOCKED] ..."} khi bài kiểm tra thất bại hoặc thiếu chứng chỉ.
   - Tuyệt đối CẤM giá trị "allow" hoặc "deny" trong trường decision (Negative Scope INV-004).
2. Thẩm định bằng chứng cơ học nhị phân (test_exit_code, status).
3. Thẩm định Dual-Channel Gate Channel 1 (AI-First Triad Format Verifier).
4. Thẩm định phát tín hiệu cảnh báo ra STDERR khi gate bị chặn.
5. Thẩm định ghi nhật ký vết vi mô footprint theo chuẩn First-Class Telemetry.
6. Thẩm định liên thông với ma trận test fixtures (hook_payloads.json).
7. Thẩm định triệu gọi tiến trình con CLI subprocess với Windows BOM.
"""

import os
import sys
import io
import json
import tempfile
import subprocess
import unittest
from unittest.mock import patch, MagicMock

# Thiết lập đường dẫn import
TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
GUARDS_DIR = os.path.abspath(os.path.join(TESTS_DIR, ".."))
if GUARDS_DIR not in sys.path:
    sys.path.insert(0, GUARDS_DIR)
if TESTS_DIR not in sys.path:
    sys.path.insert(0, TESTS_DIR)

import verification_gate
from verification_gate import (
    evaluate_stop_gate,
    handle_stop,
    get_changed_in_scope_docs,
    verify_ai_first_documents,
)
from engine_simulator import load_fixtures, get_fixture


class TestEvaluateStopGate(unittest.TestCase):
    """Kiểm thử logic thẩm định điều kiện hoàn tất tác vụ (Definition of Done)."""

    def test_acceptance_scenario_1_incomplete_test_blocked(self):
        """
        User Story 3 - Acceptance Scenario 1:
        Khi chưa hoàn thành kiểm chứng (test_exit_code != 0 hoặc status=FAILURE),
        STDOUT trả về decision: 'continue' và reason bắt đầu bằng [STOP_GATE_BLOCKED].
        """
        payload = {
            "status": "FAILURE",
            "task_id": "T006",
            "test_exit_code": 1,
            "passed_assertions": 0,
            "error_summary": "Yêu cầu kiểm chứng cơ học chưa hoàn tất",
        }
        decision, reason, details = evaluate_stop_gate(payload, check_git_docs=False)
        self.assertEqual(decision, "continue")
        self.assertTrue(reason.startswith("[STOP_GATE_BLOCKED]"))
        self.assertEqual(details["status"], "BLOCKED")

    def test_acceptance_scenario_2_successful_completion_allowed_to_stop(self):
        """
        User Story 3 - Acceptance Scenario 2:
        Khi hoàn thành 100% tiêu chí nghiệm thu với test pass,
        STDOUT trả về decision: 'stop' với reason xác nhận hoàn tất.
        """
        payload = {
            "status": "SUCCESS",
            "task_id": "T006",
            "test_exit_code": 0,
            "passed_assertions": 15,
        }
        decision, reason, details = evaluate_stop_gate(payload, check_git_docs=False)
        self.assertEqual(decision, "stop")
        self.assertEqual(reason, "All completion criteria satisfied")
        self.assertEqual(details["status"], "PASSED")

    def test_acceptance_scenario_3_strict_no_allow_or_deny(self):
        """
        User Story 3 - Acceptance Scenario 3 & Negative Scope INV-004:
        Tuyệt đối không bao giờ xuất hiện 'allow' hoặc 'deny' trong trường decision.
        """
        test_payloads = [
            {"status": "SUCCESS", "test_exit_code": 0},
            {"status": "FAILURE", "test_exit_code": 1},
            {"status": "BLOCKED", "test_exit_code": 1},
            {"terminationReason": "NO_TOOL_CALL"},
            {"terminationReason": "CANCELLED"},
            {},
        ]
        for p in test_payloads:
            with self.subTest(payload=p):
                decision, _, _ = evaluate_stop_gate(p, check_git_docs=False)
                self.assertIn(decision, ("stop", "continue"))
                self.assertNotIn(decision, ("allow", "deny"))

    def test_nonzero_test_exit_code_without_status(self):
        """Kiểm thử khi payload chỉ có test_exit_code != 0 mà không có status."""
        payload = {"test_exit_code": 1}
        decision, reason, details = evaluate_stop_gate(payload, check_git_docs=False)
        self.assertEqual(decision, "continue")
        self.assertIn("[STOP_GATE_BLOCKED]", reason)
        self.assertIn("test_exit_code=1", reason)

    def test_abnormal_termination_reason(self):
        """Kiểm thử khi terminationReason là CANCELLED hoặc TIMEOUT."""
        payload = {"terminationReason": "CANCELLED_BY_USER"}
        decision, reason, details = evaluate_stop_gate(payload, check_git_docs=False)
        self.assertEqual(decision, "continue")
        self.assertIn("[STOP_GATE_BLOCKED]", reason)
        self.assertIn("bị dừng bất thường", reason)

    def test_normal_termination_reason_no_tool_call(self):
        """Kiểm thử khi terminationReason là NO_TOOL_CALL bình thường."""
        payload = {"terminationReason": "NO_TOOL_CALL"}
        decision, reason, details = evaluate_stop_gate(payload, check_git_docs=False)
        self.assertEqual(decision, "stop")
        self.assertEqual(reason, "All completion criteria satisfied")

    def test_empty_payload_defaults_to_stop_if_no_errors(self):
        """Kiểm thử payload rỗng: Mặc định cho phép stop nếu không có vi phạm tài liệu."""
        decision, reason, details = evaluate_stop_gate({}, check_git_docs=False)
        self.assertEqual(decision, "stop")
        self.assertEqual(details["status"], "PASSED")


class TestAiFirstDocumentVerification(unittest.TestCase):
    """Kiểm thử Dual-Channel Gate Channel 1 (verify-ai-first-format.py)."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.repo_root = os.path.abspath(self.temp_dir.name)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_doc_verification_passed(self):
        """Kịch bản tài liệu hợp lệ: Cổng duyệt cho phép stop."""
        passed, failed_docs, failures = verify_ai_first_documents(
            docs=[],
            repo_root=self.repo_root,
        )
        self.assertTrue(passed)
        self.assertEqual(len(failed_docs), 0)

    def test_doc_verification_blocked_on_invalid_doc(self):
        """Kịch bản tài liệu vi phạm chuẩn: Cổng duyệt chuyển sang continue."""
        mock_script = os.path.join(self.repo_root, "mock_verifier.py")
        with open(mock_script, "w", encoding="utf-8") as f:
            f.write("import sys; sys.stderr.write('Missing XML Envelope\\n'); sys.exit(1)\n")

        bad_doc = "specs/004-test/spec.md"
        full_bad_doc = os.path.join(self.repo_root, bad_doc)
        os.makedirs(os.path.dirname(full_bad_doc), exist_ok=True)
        with open(full_bad_doc, "w", encoding="utf-8") as f:
            f.write("# Bad Spec\nNo XML tags\n")

        decision, reason, details = evaluate_stop_gate(
            payload={"status": "SUCCESS", "test_exit_code": 0},
            repo_root=self.repo_root,
            check_git_docs=True,
            verify_script_path=mock_script,
            mock_docs_to_check=[bad_doc],
        )

        self.assertEqual(decision, "continue")
        self.assertIn("[STOP_GATE_BLOCKED]", reason)
        self.assertIn("AI-First Triad", reason)
        self.assertEqual(details["gate"], "DOC_FORMAT_FAILED")
        self.assertIn(bad_doc, details["failed_files"])


class TestHandleStopContract(unittest.TestCase):
    """Kiểm thử xử lý sự kiện Stop, ghi footprint và khế ước dữ liệu trả về."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.log_path = os.path.join(self.temp_dir.name, "logs", "footprints.jsonl")

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_handle_stop_nominal_success(self):
        """Kịch bản danh định: Trả về decision stop, ghi footprint STOP."""
        payload = {
            "status": "SUCCESS",
            "task_id": "T006",
            "test_exit_code": 0,
            "passed_assertions": 12,
        }
        with patch.object(sys, "stderr", io.StringIO()) as mock_stderr:
            result = handle_stop(payload, log_path=self.log_path, check_git_docs=False)

        self.assertEqual(result["decision"], "stop")
        self.assertEqual(result["reason"], "All completion criteria satisfied")
        self.assertIn("[VERIFICATION GATE]", mock_stderr.getvalue())

        # Xác thực file footprint
        self.assertTrue(os.path.exists(self.log_path))
        with open(self.log_path, "r", encoding="utf-8") as f:
            record = json.loads(f.readline().strip())

        self.assertEqual(record["guard"], "verification_gate")
        self.assertEqual(record["event"], "Stop")
        self.assertEqual(record["status"], "STOP")
        self.assertEqual(record["target"], "T006")
        self.assertIsInstance(record["durationMs"], (int, float))

    def test_handle_stop_blocked_prints_warning(self):
        """Kịch bản bị chặn: Trả về continue, ghi footprint CONTINUE và cảnh báo ra STDERR."""
        payload = {
            "status": "FAILURE",
            "task_id": "T006",
            "test_exit_code": 1,
            "error_summary": "1 assertion failed",
        }
        with patch.object(sys, "stderr", io.StringIO()) as mock_stderr:
            result = handle_stop(payload, log_path=self.log_path, check_git_docs=False)

        self.assertEqual(result["decision"], "continue")
        self.assertIn("[STOP_GATE_BLOCKED]", result["reason"])
        self.assertIn("[VERIFICATION GATE BLOCKED]", mock_stderr.getvalue())

        with open(self.log_path, "r", encoding="utf-8") as f:
            record = json.loads(f.readline().strip())

        self.assertEqual(record["status"], "CONTINUE")

    def test_fixture_matrix_integration(self):
        """Kiểm chứng trực tiếp với stop_gate_incomplete và stop_gate_success từ fixtures."""
        fixtures = load_fixtures()

        # 1. Incomplete -> continue
        with patch.object(sys, "stderr", io.StringIO()):
            res_inc = handle_stop(fixtures["stop_gate_incomplete"], log_path=self.log_path, check_git_docs=False)
        self.assertEqual(res_inc["decision"], "continue")
        self.assertIn("[STOP_GATE_BLOCKED]", res_inc["reason"])

        # 2. Success -> stop
        with patch.object(sys, "stderr", io.StringIO()):
            res_suc = handle_stop(fixtures["stop_gate_success"], log_path=self.log_path, check_git_docs=False)
        self.assertEqual(res_suc["decision"], "stop")
        self.assertEqual(res_suc["reason"], "All completion criteria satisfied")

        with open(self.log_path, "r", encoding="utf-8") as f:
            records = [json.loads(line.strip()) for line in f if line.strip()]

        self.assertEqual(len(records), 2)
        self.assertEqual(records[0]["status"], "CONTINUE")
        self.assertEqual(records[1]["status"], "STOP")


class TestSubprocessCLIExecution(unittest.TestCase):
    """Kiểm thử triệu gọi tiến trình con CLI chuẩn Go Engine cmd /c."""

    def test_cli_execution_with_payload_argument(self):
        """Kiểm thử python scripts/guards/verification_gate.py --payload '...'"""
        script_path = os.path.join(GUARDS_DIR, "verification_gate.py")
        payload = json.dumps({
            "status": "SUCCESS",
            "task_id": "T006",
            "test_exit_code": 0,
            "passed_assertions": 5,
        })

        proc = subprocess.run(
            [sys.executable, script_path, "--payload", payload],
            capture_output=True,
            text=True,
            encoding="utf-8",
        )

        self.assertEqual(proc.returncode, 0)
        parsed = json.loads(proc.stdout.strip())
        self.assertEqual(parsed["decision"], "stop")

    def test_cli_execution_via_stdin_with_windows_bom(self):
        """Kiểm thử truyền payload qua STDIN kèm ký tự BOM Windows."""
        script_path = os.path.join(GUARDS_DIR, "verification_gate.py")
        payload = '\ufeff' + json.dumps({
            "status": "FAILURE",
            "task_id": "T006",
            "test_exit_code": 1,
            "error_summary": "Tests did not pass",
        })

        proc = subprocess.run(
            [sys.executable, script_path],
            input=payload,
            capture_output=True,
            text=True,
            encoding="utf-8",
        )

        self.assertEqual(proc.returncode, 0)
        parsed = json.loads(proc.stdout.strip())
        self.assertEqual(parsed["decision"], "continue")
        self.assertIn("[STOP_GATE_BLOCKED]", parsed["reason"])
        self.assertIn("[VERIFICATION GATE BLOCKED]", proc.stderr)


if __name__ == "__main__":
    unittest.main()
