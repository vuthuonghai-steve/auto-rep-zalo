#!/usr/bin/env python3
# .agents/scripts/guards/tests/test_dispatcher.py
"""
Bộ kiểm thử cơ học nhị phân (Automated Unit Tests) cho Composite Domain Dispatcher (dispatcher.py).
Kiểm chứng:
1. Định tuyến sự kiện PreToolUse và Stop Hook.
2. Kiểm dịch liên tác tử cho invoke_subagent và send_message.
3. Không can thiệp (allow) các thao tác ghi mã nguồn (write_file, edit_file).
4. Độ trễ kiểm định siêu tốc (< 30ms, trung bình <= 15ms).
5. Khả năng chịu lỗi và chuẩn hóa cấu trúc payload (BOM, JSON string args).
6. Tương thích giao diện thực thi CLI runner (dispatcher.main(), sys.argv, exit code 0).
"""

import os
import sys
import time
import json
import io
import unittest
from unittest.mock import patch

# Bảo đảm đường dẫn import tương thích
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import dispatcher
from dispatcher import (
    parse_input,
    extract_tool_call_info,
    handle_pre_tool_use,
    handle_stop,
    dispatch,
)


class TestDispatcherPreToolUse(unittest.TestCase):
    """Kiểm chứng hành vi kiểm dịch và tính bất biến của PreToolUse."""

    def test_write_file_is_allowed_without_syntax_linter(self):
        """Kịch bản AC-01: write_file không bị quét cú pháp XML/YAML, luôn allow."""
        payload = {
            "name": "write_file",
            "args": {
                "Path": "src/features/sample.ts",
                "Content": "export const a = 1; // <unclosed_tag> yaml: bad  indent"
            }
        }
        result = handle_pre_tool_use(payload)
        self.assertEqual(result.get("decision"), "allow")

    def test_edit_file_is_allowed_without_syntax_linter(self):
        """Kịch bản AC-01: edit_file luôn được cho phép mà không bị gián đoạn."""
        payload = {
            "toolCall": {
                "name": "edit_file",
                "args": {
                    "Path": "src/app.tsx",
                    "Target": "const x = 1;",
                    "Replacement": "const x = 2;"
                }
            }
        }
        result = handle_pre_tool_use(payload)
        self.assertEqual(result.get("decision"), "allow")

    def test_read_and_run_command_tools_allowed(self):
        """Các công cụ phụ trợ (read_file, run_command) luôn allow mặc định."""
        for tool_name in ["read_file", "run_command", "view_file"]:
            payload = {
                "name": tool_name,
                "args": {"CommandLine": "bun test"}
            }
            result = handle_pre_tool_use(payload)
            self.assertEqual(result.get("decision"), "allow", f"Tool {tool_name} must be allowed")

    def test_valid_invoke_subagent_allowed(self):
        """Kịch bản AC-02: invoke_subagent với Pure Data Manifest hợp lệ được thông qua."""
        valid_prompt = """<task_delegation>
target_subagent: surgical-implementer
task_id: "T005"
spec_path: "specs/003-harness-doc-formatting/spec.md"
allowed_files: [".agents/scripts/guards/tests/test_dispatcher.py"]
forbidden_files: ["src/**", "specs/**"]
test_command: "bun test"
</task_delegation>"""
        payload = {
            "name": "invoke_subagent",
            "args": {
                "TypeName": "surgical-implementer",
                "Prompt": valid_prompt
            }
        }
        result = handle_pre_tool_use(payload)
        self.assertEqual(result.get("decision"), "allow")

    def test_valid_send_message_allowed(self):
        """Kịch bản AC-02: send_message với remediation manifest hợp lệ được thông qua."""
        valid_msg = """<remediation_manifest>
task_id: "T005"
audit_verdict: "FAIL"
failure_coordinates: ["tests/foo.py:10"]
uncovered_criteria: ["Given x When y Then z"]
test_command: "bun test"
</remediation_manifest>"""
        payload = {
            "name": "send_message",
            "args": {
                "Recipient": "subagent_implementer_session",
                "Message": valid_msg
            }
        }
        result = handle_pre_tool_use(payload)
        self.assertEqual(result.get("decision"), "allow")

    def test_deny_send_message_to_ephemeral_auditor(self):
        """Kịch bản AC-03: send_message gửi tới surgical-auditor bị chặn dứt khoát."""
        payload = {
            "name": "send_message",
            "args": {
                "Recipient": "subagent-surgical-auditor-1234",
                "Message": "<remediation_manifest>task_id: T005</remediation_manifest>"
            }
        }
        result = handle_pre_tool_use(payload)
        self.assertEqual(result.get("decision"), "deny")
        self.assertIn("AUDITOR_IS_EPHEMERAL", result.get("reason", ""))

    def test_deny_sycophancy_bait_in_invoke(self):
        """Kịch bản AC-03: invoke_subagent chứa câu hỏi dẫn dắt hoặc khẳng định bị chặn."""
        bait_prompt = """<task_delegation>
target_subagent: surgical-auditor
spec_path: "specs/auth.md"
verification_command: "bun test"
Ghi chú: bạn thấy bài kiểm tra đã pass chưa?
</task_delegation>"""
        payload = {
            "name": "invoke_subagent",
            "args": {
                "TypeName": "surgical-auditor",
                "Prompt": bait_prompt
            }
        }
        result = handle_pre_tool_use(payload)
        self.assertEqual(result.get("decision"), "deny")
        self.assertIn("SYCOPHANCY_BAIT_DETECTED", result.get("reason", ""))

    def test_deny_unstructured_invoke_prompt(self):
        """Lệnh invoke_subagent thiếu thẻ XML cấu trúc bị từ chối."""
        payload = {
            "name": "invoke_subagent",
            "args": {
                "TypeName": "surgical-implementer",
                "Prompt": "Hãy sửa lỗi và chạy test giúp tôi."
            }
        }
        result = handle_pre_tool_use(payload)
        self.assertEqual(result.get("decision"), "deny")
        self.assertIn("DELEGATION_VIOLATION", result.get("reason", ""))


class TestDispatcherPayloadExtraction(unittest.TestCase):
    """Kiểm tra tính bền bỉ và chuẩn hóa cấu trúc đầu vào của dispatcher."""

    def test_extract_tool_call_info_standard_and_variations(self):
        # Biến thể 1: phẳng
        p1 = {"name": "write_file", "args": {"Path": "a.ts"}}
        self.assertEqual(extract_tool_call_info(p1), ("write_file", {"Path": "a.ts"}))

        # Biến thể 2: lồng trong toolCall
        p2 = {"toolCall": {"tool_name": "read_file", "tool_args": {"Path": "b.ts"}}}
        self.assertEqual(extract_tool_call_info(p2), ("read_file", {"Path": "b.ts"}))

        # Biến thể 3: args dạng stringified JSON
        p3 = {"name": "invoke_subagent", "args": json.dumps({"TypeName": "test"})}
        self.assertEqual(extract_tool_call_info(p3), ("invoke_subagent", {"TypeName": "test"}))

        # Biến thể 4: args không phải dict hay JSON hợp lệ
        p4 = {"name": "foo", "args": "invalid-json"}
        self.assertEqual(extract_tool_call_info(p4), ("foo", {"raw_string": "invalid-json"}))

    def test_parse_input_cli_string_and_bom(self):
        # Chuỗi JSON thường
        self.assertEqual(parse_input('{"key": "val"}'), {"key": "val"})

        # Chuỗi JSON có Windows UTF-8 BOM
        self.assertEqual(parse_input('\ufeff{"bom": true}'), {"bom": True})

        # Chuỗi rỗng hoặc rác
        self.assertEqual(parse_input(""), {})
        self.assertEqual(parse_input("not-a-json"), {})


class TestDispatcherRoutingAndResilience(unittest.TestCase):
    """Kiểm tra bộ định tuyến dispatch(), hàm handle_stop và khả năng bắt lỗi phòng thủ."""

    def test_handle_stop_direct(self):
        """Kiểm chứng trực tiếp hàm handle_stop trả về decision allow."""
        payload = {"status": "SUCCESS", "response": "All tasks verified"}
        result = handle_stop(payload)
        self.assertEqual(result, {"decision": "allow"})

    def test_dispatch_pre_tool_use_event(self):
        payload = {"name": "write_file", "args": {}}
        res = dispatch("PreToolUse", payload)
        self.assertEqual(res.get("decision"), "allow")

    def test_dispatch_stop_event(self):
        payload = {"response": "Task completed successfully"}
        res = dispatch("Stop", payload)
        self.assertEqual(res.get("decision"), "allow")

    def test_dispatch_unknown_event(self):
        res = dispatch("NonExistentEvent", {})
        self.assertEqual(res.get("decision"), "allow")

    def test_dispatch_exception_handling_failsafe(self):
        """Khi handler ném ngoại lệ đột ngột, dispatch phải trả về deny phòng thủ mà không crash."""
        with patch.dict(dispatcher.EVENT_ROUTER, {"ExplosiveEvent": lambda p: 1 / 0}):
            with patch("sys.stderr.write"):
                res = dispatch("ExplosiveEvent", {})
                self.assertEqual(res.get("decision"), "deny")
                self.assertIn("INTERNAL_DISPATCHER_ERROR", res.get("reason", ""))


class TestDispatcherCLIRunner(unittest.TestCase):
    """Kiểm tra khả năng tương thích khi thực thi dispatcher.main() qua giao diện CLI."""

    def test_cli_pre_tool_use_allow(self):
        test_args = [
            "dispatcher.py",
            "--event", "PreToolUse",
            "--payload", json.dumps({"name": "write_file", "args": {}})
        ]
        with patch.object(sys, "argv", test_args):
            with patch("sys.stdout", new_callable=io.StringIO) as mock_stdout:
                with self.assertRaises(SystemExit) as cm:
                    dispatcher.main()
                self.assertEqual(cm.exception.code, 0)
                parsed = json.loads(mock_stdout.getvalue().strip())
                self.assertEqual(parsed.get("decision"), "allow")

    def test_cli_stop_event(self):
        test_args = [
            "dispatcher.py",
            "--event", "Stop",
            "--payload", "{}"
        ]
        with patch.object(sys, "argv", test_args):
            with patch("sys.stdout", new_callable=io.StringIO) as mock_stdout:
                with self.assertRaises(SystemExit) as cm:
                    dispatcher.main()
                self.assertEqual(cm.exception.code, 0)
                parsed = json.loads(mock_stdout.getvalue().strip())
                self.assertEqual(parsed.get("decision"), "allow")


class TestDispatcherPerformanceLatency(unittest.TestCase):
    """
    Kiểm chứng ràng buộc phi chức năng:
    Thời gian xử lý của PreToolUse phải tuyệt đối dưới 30ms (mục tiêu trung bình <= 15ms).
    """

    def test_pre_tool_use_latency_under_30ms(self):
        sample_payload = {
            "name": "invoke_subagent",
            "args": {
                "TypeName": "surgical-implementer",
                "Prompt": """<task_delegation>
target_subagent: surgical-implementer
task_id: "T005"
spec_path: "specs/003-harness-doc-formatting/spec.md"
allowed_files: [".agents/scripts/guards/tests/test_dispatcher.py"]
forbidden_files: ["src/**", "specs/**"]
test_command: "bun test"
</task_delegation>"""
            }
        }

        durations_ms = []
        iterations = 50

        # Làm ấm cache (warm-up)
        handle_pre_tool_use(sample_payload)

        for _ in range(iterations):
            start = time.perf_counter()
            res = handle_pre_tool_use(sample_payload)
            elapsed = (time.perf_counter() - start) * 1000.0
            durations_ms.append(elapsed)

            self.assertEqual(res.get("decision"), "allow")
            self.assertLess(
                elapsed, 30.0,
                f"Dispatcher execution took {elapsed:.3f}ms, which exceeds 30ms threshold!"
            )

        avg_latency = sum(durations_ms) / len(durations_ms)
        self.assertLess(avg_latency, 15.0, f"Average latency ({avg_latency:.3f}ms) exceeds 15ms")


if __name__ == "__main__":
    unittest.main()
