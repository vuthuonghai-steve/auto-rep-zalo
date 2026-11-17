# .agents/guards/tests/test_delegation_sanitizer.py
# Bộ kiểm thử cơ học nhị phân toàn diện cho delegation_sanitizer
# Bao phủ danh định (nominal), biên lỗi (boundary/error), anti-sycophancy và độ trễ (<5ms)

import os
import sys
import time
import json
import unittest

# Đảm bảo đường dẫn import tương thích
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from domains.engine_invariants.delegation_sanitizer import (
    verify_delegation_payload,
    validate_completion_schema,
)


class TestDelegationSanitizer(unittest.TestCase):

    def test_valid_invoke_subagent(self):
        """Khung <task_delegation> hợp lệ cho invoke_subagent phải PASS."""
        payload = {
            "TypeName": "surgical-implementer",
            "Role": "Builder",
            "Prompt": """<task_delegation>
target_subagent: surgical-implementer
task_id: "TSK-01"
spec_path: "specs/feature/spec.md"
allowed_files: ["src/foo.ts"]
forbidden_files: ["src/bar.ts"]
test_command: "bun test"
</task_delegation>"""
        }
        ok, reason = verify_delegation_payload("invoke_subagent", payload)
        self.assertTrue(ok, f"Expected PASS but got: {reason}")
        self.assertEqual(reason, "OK")

    def test_valid_remediation_send_message(self):
        """Khung <remediation_manifest> hợp lệ cho send_message gửi worker phải PASS."""
        payload = {
            "Recipient": "builder_conversation_123",
            "Message": """<remediation_manifest>
task_id: "TSK-01"
audit_verdict: "FAIL"
failure_coordinates: ["src/foo.ts:42"]
uncovered_criteria: ["Given user is logged in"]
test_command: "bun test"
</remediation_manifest>"""
        }
        ok, reason = verify_delegation_payload("send_message", payload)
        self.assertTrue(ok, f"Expected PASS but got: {reason}")
        self.assertEqual(reason, "OK")

    def test_valid_forwarding_send_message(self):
        """Khung <task_delegation> trong send_message (chuyển tiếp tác vụ hợp lệ) phải PASS."""
        payload = {
            "Recipient": "worker_conversation_456",
            "Message": """<task_delegation>
target_subagent: surgical-implementer
task_id: "TSK-02"
spec_path: "specs/feature/spec.md"
allowed_files: ["src/bar.ts"]
forbidden_files: ["src/baz.ts"]
test_command: "bun test"
</task_delegation>"""
        }
        ok, reason = verify_delegation_payload("send_message", payload)
        self.assertTrue(ok, f"Expected PASS but got: {reason}")
        self.assertEqual(reason, "OK")

    def test_valid_completion_payload_send_message(self):
        """Khung JSON Completion Payload hợp lệ gửi về Orchestrator qua send_message phải PASS."""
        payload = {
            "Recipient": "parent_conversation_orchestrator",
            "Message": json.dumps({
                "status": "SUCCESS",
                "task_id": "T001",
                "test_exit_code": 0,
                "passed_assertions": 36,
                "blast_radius_files": [".agents/agents/surgical-auditor/agent.md"]
            })
        }
        ok, reason = verify_delegation_payload("send_message", payload)
        self.assertTrue(ok, f"Expected PASS but got: {reason}")
        self.assertEqual(reason, "OK")

    def test_non_delegation_tool_bypass(self):
        """Công cụ không thuộc invoke_subagent/send_message (e.g., write_file) không bị cản trở."""
        payload = {
            "Path": "src/services/auth.ts",
            "Content": "export const auth = true;"
        }
        ok, reason = verify_delegation_payload("write_file", payload)
        self.assertTrue(ok)
        self.assertEqual(reason, "OK")

    def test_deny_free_form_send_message_to_auditor_case_insensitive(self):
        """CẤM gửi văn bản tự do tới surgical-auditor dưới mọi biến thể viết hoa/thường."""
        recipients = [
            "surgical-auditor-session-1",
            "Surgical-Auditor-2",
            "AUDITOR_PRIMARY",
            "worker_auditor_4"
        ]
        for recipient in recipients:
            with self.subTest(recipient=recipient):
                payload = {
                    "Recipient": recipient,
                    "Message": "Hãy kiểm tra lại giúp tôi task TSK-01 xem đã pass chưa"
                }
                ok, reason = verify_delegation_payload("send_message", payload)
                self.assertFalse(ok)
                self.assertIn("AUDITOR_FREE_FORM_PROHIBITED", reason)

    def test_allow_structured_send_message_to_auditor_re_audit(self):
        """Cho phép gửi <remediation_manifest> tới surgical-auditor để tái thẩm định (Stateful Session)."""
        payload = {
            "Recipient": "surgical-auditor-session-1",
            "Message": "<remediation_manifest>\ntask_id: \"TSK-01\"\naudit_verdict: \"FIXED\"\ntest_command: \"bun test\"\n</remediation_manifest>"
        }
        ok, reason = verify_delegation_payload("send_message", payload)
        self.assertTrue(ok, f"Expected PASS for structured re-audit message to auditor, got: {reason}")
        self.assertEqual(reason, "OK")

    def test_allow_invoke_subagent_targeting_auditor(self):
        """invoke_subagent khởi tạo session auditor mới với manifest hợp lệ được phép."""
        payload = {
            "TypeName": "surgical-auditor",
            "Prompt": """<task_delegation>
target_subagent: surgical-auditor
task_id: "TSK-01"
spec_path: "specs/feature/spec.md"
allowed_files: ["src/foo.ts"]
forbidden_files: ["src/bar.ts"]
test_command: "bun test"
</task_delegation>"""
        }
        ok, reason = verify_delegation_payload("invoke_subagent", payload)
        self.assertTrue(ok, f"Expected PASS for invoke_subagent to auditor, got: {reason}")
        self.assertEqual(reason, "OK")

    def test_deny_free_form_invoke(self):
        """invoke_subagent không có khung <task_delegation> bị từ chối với [DELEGATION_VIOLATION]."""
        payload = {
            "TypeName": "surgical-implementer",
            "Prompt": "Hãy sửa code trong file auth.ts để login hoạt động."
        }
        ok, reason = verify_delegation_payload("invoke_subagent", payload)
        self.assertFalse(ok)
        self.assertIn("DELEGATION_VIOLATION", reason)

    def test_deny_free_form_send_message(self):
        """send_message không có khung <remediation_manifest> hay <task_delegation> bị từ chối."""
        payload = {
            "Recipient": "worker_conversation_789",
            "Message": "Bạn hãy sửa lỗi tại dòng 42 như tôi đã nói nhé."
        }
        ok, reason = verify_delegation_payload("send_message", payload)
        self.assertFalse(ok)
        self.assertIn("REMEDIATION_REQUIRED", reason)

    def test_deny_sycophancy_bait_question_mark(self):
        """Chặn mớm ý có chứa dấu hỏi chấm '?'."""
        payload = {
            "TypeName": "surgical-auditor",
            "Prompt": """<task_delegation>
target_subagent: surgical-auditor
spec_path: "specs/auth.md"
target_branch: "subagent/TSK-01"
verification_command: "bun test"
Ghi chú: bạn thấy logic này đã pass chưa?
</task_delegation>"""
        }
        ok, reason = verify_delegation_payload("invoke_subagent", payload)
        self.assertFalse(ok)
        self.assertIn("SYCOPHANCY_BAIT_DETECTED", reason)

    def test_deny_sycophancy_bait_vietnamese_all_patterns(self):
        """Chặn toàn bộ 7 mẫu câu định hướng tiếng Việt."""
        vietnamese_patterns = [
            "đã pass",
            "đã xong",
            "chỉ cần",
            "xác nhận giúp",
            "như đã thảo luận",
            "tôi nghĩ",
            "có vẻ"
        ]
        for phrase in vietnamese_patterns:
            with self.subTest(phrase=phrase):
                payload = {
                    "TypeName": "surgical-auditor",
                    "Prompt": f"""<task_delegation>
target_subagent: surgical-auditor
spec_path: "specs/auth.md"
target_branch: "subagent/TSK-01"
verification_command: "bun test"
Note: {phrase}
</task_delegation>"""
                }
                ok, reason = verify_delegation_payload("invoke_subagent", payload)
                self.assertFalse(ok)
                self.assertIn("SYCOPHANCY_BAIT_DETECTED", reason)

    def test_deny_sycophancy_bait_english_all_patterns(self):
        """Chặn toàn bộ 6 mẫu câu định hướng tiếng Anh."""
        english_patterns = [
            "already passed",
            "just confirm",
            "looks good",
            "as discussed",
            "i fixed",
            "please verify"
        ]
        for phrase in english_patterns:
            with self.subTest(phrase=phrase):
                payload = {
                    "TypeName": "surgical-auditor",
                    "Prompt": f"""<task_delegation>
target_subagent: surgical-auditor
spec_path: "specs/auth.md"
target_branch: "subagent/TSK-01"
verification_command: "bun test"
Note: {phrase}
</task_delegation>"""
                }
                ok, reason = verify_delegation_payload("invoke_subagent", payload)
                self.assertFalse(ok)
                self.assertIn("SYCOPHANCY_BAIT_DETECTED", reason)

    def test_boundary_payload_length_exact_2000_chars(self):
        """Payload dài chính xác 2000 ký tự (chuẩn CRIT-DEL-06) phải PASS."""
        prefix = "<task_delegation>\n"
        suffix = "\n</task_delegation>"
        padding_len = 2000 - len(prefix) - len(suffix)
        body = "a" * padding_len
        payload = {
            "TypeName": "surgical-implementer",
            "Prompt": f"{prefix}{body}{suffix}"
        }
        self.assertEqual(len(payload["Prompt"]), 2000)
        ok, reason = verify_delegation_payload("invoke_subagent", payload)
        self.assertTrue(ok, f"Expected 2000 chars to PASS, got: {reason}")
        self.assertEqual(reason, "OK")

    def test_boundary_payload_length_2001_chars(self):
        """Payload vượt ngưỡng 2000 ký tự (2001 ký tự) phải bị từ chối với [DELEGATION_VIOLATION]."""
        prefix = "<task_delegation>\n"
        suffix = "\n</task_delegation>"
        padding_len = 2001 - len(prefix) - len(suffix)
        body = "a" * padding_len
        payload = {
            "TypeName": "surgical-implementer",
            "Prompt": f"{prefix}{body}{suffix}"
        }
        self.assertEqual(len(payload["Prompt"]), 2001)
        ok, reason = verify_delegation_payload("invoke_subagent", payload)
        self.assertFalse(ok)
        self.assertIn("DELEGATION_VIOLATION", reason)
        self.assertIn("2001", reason)

    def test_resilience_empty_and_none_arguments(self):
        """Khả năng chịu lỗi biên khi nhận tool_args None hoặc rỗng."""
        # 1. tool_args is None
        ok1, reason1 = verify_delegation_payload("invoke_subagent", None)
        self.assertFalse(ok1)
        self.assertIn("DELEGATION_VIOLATION", reason1)

        ok2, reason2 = verify_delegation_payload("send_message", None)
        self.assertFalse(ok2)
        self.assertIn("REMEDIATION_REQUIRED", reason2)

        # 2. tool_args is empty dict
        ok3, reason3 = verify_delegation_payload("invoke_subagent", {})
        self.assertFalse(ok3)
        self.assertIn("DELEGATION_VIOLATION", reason3)

        # 3. Prompt/Message are None
        ok4, reason4 = verify_delegation_payload("invoke_subagent", {"Prompt": None})
        self.assertFalse(ok4)
        self.assertIn("DELEGATION_VIOLATION", reason4)

        ok5, reason5 = verify_delegation_payload("send_message", {"Message": None})
        self.assertFalse(ok5)
        self.assertIn("REMEDIATION_REQUIRED", reason5)

    def test_execution_latency_under_5ms(self):
        """Đo lường hiệu năng: thời gian xử lý trung bình mỗi lần kiểm định < 5ms."""
        payload = {
            "TypeName": "surgical-implementer",
            "Prompt": """<task_delegation>
target_subagent: surgical-implementer
task_id: "TSK-01"
spec_path: "specs/feature/spec.md"
allowed_files: ["src/foo.ts"]
forbidden_files: ["src/bar.ts"]
test_command: "bun test"
</task_delegation>"""
        }
        iterations = 100
        start = time.perf_counter()
        for _ in range(iterations):
            ok, _ = verify_delegation_payload("invoke_subagent", payload)
            self.assertTrue(ok)
        total_time_ms = (time.perf_counter() - start) * 1000
        avg_time_ms = total_time_ms / iterations

        self.assertLess(
            avg_time_ms, 5.0,
            f"Expected avg latency < 5ms, actual: {avg_time_ms:.4f}ms (total: {total_time_ms:.2f}ms)"
        )


class TestChannel1BoundaryEdgeCases(unittest.TestCase):
    """
    Bộ kiểm thử đối kháng bao phủ 11 kịch bản biên (TC-CH1-01 đến TC-CH1-11)
    theo Tài Liệu 2: Boundary & Edge Test Suite Matrix (specs/005-structured-output-and).
    """

    def test_tc_ch1_01_missing_status(self):
        """TC-CH1-01: Thiếu trường bắt buộc status -> deny [SCHEMA_VIOLATION]."""
        payload = {
            "task_id": "T001",
            "test_exit_code": 0,
            "passed_assertions": 5,
            "blast_radius_files": ["src/file1.ts"]
        }
        ok, reason = validate_completion_schema(payload)
        self.assertFalse(ok)
        self.assertIn("[SCHEMA_VIOLATION]", reason)
        self.assertIn("Thiếu trường bắt buộc 'status'", reason)

        # Kiểm chứng liên thông qua verify_delegation_payload cho send_message
        ok_msg, reason_msg = verify_delegation_payload("send_message", payload)
        self.assertFalse(ok_msg)
        self.assertIn("[SCHEMA_VIOLATION]", reason_msg)

    def test_tc_ch1_02_missing_test_exit_code(self):
        """TC-CH1-02: Thiếu trường bắt buộc test_exit_code -> deny [SCHEMA_VIOLATION]."""
        payload = {
            "status": "SUCCESS",
            "task_id": "T001",
            "passed_assertions": 5,
            "blast_radius_files": ["src/file1.ts"]
        }
        ok, reason = validate_completion_schema(payload)
        self.assertFalse(ok)
        self.assertIn("[SCHEMA_VIOLATION]", reason)
        self.assertIn("Thiếu trường bắt buộc 'test_exit_code'", reason)

        ok_msg, reason_msg = verify_delegation_payload("send_message", payload)
        self.assertFalse(ok_msg)
        self.assertIn("[SCHEMA_VIOLATION]", reason_msg)

    def test_tc_ch1_03_status_out_of_enum(self):
        """TC-CH1-03: Giá trị status nằm ngoài enum chuẩn -> deny [SCHEMA_VIOLATION]."""
        payload = {
            "status": "COMPLETED",
            "task_id": "T001",
            "test_exit_code": 0,
            "passed_assertions": 5,
            "blast_radius_files": ["src/file1.ts"]
        }
        ok, reason = validate_completion_schema(payload)
        self.assertFalse(ok)
        self.assertIn("[SCHEMA_VIOLATION]", reason)
        self.assertIn("Trường 'status' phải thuộc ['SUCCESS', 'FAILURE', 'BLOCKED']", reason)

        ok_msg, reason_msg = verify_delegation_payload("send_message", payload)
        self.assertFalse(ok_msg)
        self.assertIn("[SCHEMA_VIOLATION]", reason_msg)

    def test_tc_ch1_04_task_id_invalid_regex(self):
        """TC-CH1-04: Định dạng task_id sai regex -> deny [SCHEMA_VIOLATION]."""
        payload = {
            "status": "SUCCESS",
            "task_id": "TASK-001",
            "test_exit_code": 0,
            "passed_assertions": 5,
            "blast_radius_files": ["src/file1.ts"]
        }
        ok, reason = validate_completion_schema(payload)
        self.assertFalse(ok)
        self.assertIn("[SCHEMA_VIOLATION]", reason)
        self.assertIn("Trường 'task_id' không khớp mẫu '^T[0-9]{3}$'", reason)

        ok_msg, reason_msg = verify_delegation_payload("send_message", payload)
        self.assertFalse(ok_msg)
        self.assertIn("[SCHEMA_VIOLATION]", reason_msg)

    def test_tc_ch1_05_test_exit_code_invalid_value(self):
        """TC-CH1-05: Giá trị test_exit_code không phải 0 hoặc 1 -> deny [SCHEMA_VIOLATION]."""
        payload = {
            "status": "SUCCESS",
            "task_id": "T001",
            "test_exit_code": 2,
            "passed_assertions": 5,
            "blast_radius_files": ["src/file1.ts"]
        }
        ok, reason = validate_completion_schema(payload)
        self.assertFalse(ok)
        self.assertIn("[SCHEMA_VIOLATION]", reason)
        self.assertIn("Trường 'test_exit_code' phải là 0 hoặc 1", reason)

        ok_msg, reason_msg = verify_delegation_payload("send_message", payload)
        self.assertFalse(ok_msg)
        self.assertIn("[SCHEMA_VIOLATION]", reason_msg)

    def test_tc_ch1_06_blast_radius_files_exceeds_limit(self):
        """TC-CH1-06: Số lượng blast_radius_files vượt ngưỡng 3 tệp -> deny [SCHEMA_VIOLATION]."""
        payload = {
            "status": "SUCCESS",
            "task_id": "T001",
            "test_exit_code": 0,
            "passed_assertions": 5,
            "blast_radius_files": ["f1.ts", "f2.ts", "f3.ts", "f4.ts"]
        }
        ok, reason = validate_completion_schema(payload)
        self.assertFalse(ok)
        self.assertIn("[SCHEMA_VIOLATION]", reason)
        self.assertIn("Số lượng tệp thay đổi vượt quá giới hạn tối đa 3 tệp", reason)

        ok_msg, reason_msg = verify_delegation_payload("send_message", payload)
        self.assertFalse(ok_msg)
        self.assertIn("[SCHEMA_VIOLATION]", reason_msg)

    def test_tc_ch1_07_additional_properties_forbidden(self):
        """TC-CH1-07: Chèn trường lạ ngoài schema (additionalProperties: false) -> deny [SCHEMA_VIOLATION]."""
        payload = {
            "status": "SUCCESS",
            "task_id": "T001",
            "test_exit_code": 0,
            "passed_assertions": 5,
            "blast_radius_files": ["src/file1.ts"],
            "extra_field": "injected"
        }
        ok, reason = validate_completion_schema(payload)
        self.assertFalse(ok)
        self.assertIn("[SCHEMA_VIOLATION]", reason)
        self.assertIn("Phát hiện thuộc tính không được phép 'extra_field'", reason)

        ok_msg, reason_msg = verify_delegation_payload("send_message", payload)
        self.assertFalse(ok_msg)
        self.assertIn("[SCHEMA_VIOLATION]", reason_msg)

    def test_tc_ch1_08_message_payload_exceeds_2000_chars(self):
        """TC-CH1-08: Tải trọng tin nhắn vượt ngưỡng 2000 ký tự (CRIT-DEL-06) -> deny [DELEGATION_VIOLATION]."""
        payload = {
            "raw_string": "A" * 2050
        }
        ok, reason = verify_delegation_payload("send_message", payload)
        self.assertFalse(ok)
        self.assertIn("[DELEGATION_VIOLATION]", reason)
        self.assertIn("Payload vượt quá 2000 ký tự", reason)

    def test_tc_ch1_09_sycophancy_bait_detected(self):
        """TC-CH1-09: Gói tin chứa mẫu từ mớm ý (Sycophancy Bait) -> deny [SYCOPHANCY_BAIT_DETECTED]."""
        payload = {
            "Recipient": "subagent_worker_123",
            "Message": "<remediation_manifest>\nTôi đã xong task T001, bạn chỉ cần xác nhận giúp tôi nhé\n</remediation_manifest>"
        }
        ok, reason = verify_delegation_payload("send_message", payload)
        self.assertFalse(ok)
        self.assertIn("[SYCOPHANCY_BAIT_DETECTED]", reason)
        self.assertIn("Phát hiện mẫu câu dẫn dắt hoặc định hướng chủ quan", reason)

    def test_tc_ch1_10_auditor_free_form_prohibited(self):
        """TC-CH1-10: Gửi văn xuôi tự do tới Auditor -> deny [AUDITOR_FREE_FORM_PROHIBITED]."""
        payload = {
            "recipient": "surgical-auditor",
            "message": "Auditor hãy kiểm tra giúp tôi module này"
        }
        ok, reason = verify_delegation_payload("send_message", payload)
        self.assertFalse(ok)
        self.assertIn("[AUDITOR_FREE_FORM_PROHIBITED]", reason)
        self.assertIn("CẤM gửi văn bản tự do tới surgical-auditor", reason)

    def test_tc_ch1_11_valid_completion_payload(self):
        """TC-CH1-11: Payload hợp lệ 100% tuân thủ schema -> allow [decision: allow, Exit Code 0]."""
        payload = {
            "status": "SUCCESS",
            "task_id": "T001",
            "test_exit_code": 0,
            "passed_assertions": 12,
            "blast_radius_files": ["src/domain/validator.py"]
        }
        ok, reason = validate_completion_schema(payload)
        self.assertTrue(ok)
        self.assertEqual(reason, "OK")

        # Kiểm chứng liên thông qua verify_delegation_payload cả dạng dict trực tiếp lẫn wrapped
        ok_direct, reason_direct = verify_delegation_payload("send_message", payload)
        self.assertTrue(ok_direct, f"Expected PASS for direct dict, got: {reason_direct}")
        self.assertEqual(reason_direct, "OK")

        wrapped_payload = {
            "Recipient": "parent_orchestrator",
            "Message": json.dumps(payload)
        }
        ok_wrapped, reason_wrapped = verify_delegation_payload("send_message", wrapped_payload)
        self.assertTrue(ok_wrapped, f"Expected PASS for wrapped message, got: {reason_wrapped}")
        self.assertEqual(reason_wrapped, "OK")


if __name__ == "__main__":
    unittest.main()
