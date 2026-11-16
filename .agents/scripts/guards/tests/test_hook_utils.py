#!/usr/bin/env python3
# .agents/scripts/guards/tests/test_hook_utils.py
"""
Bộ kiểm thử đơn vị độc lập cho hook_utils.py (Task T004).
Kiểm chứng:
1. parse_stdin_payload:
   - Xử lý payload qua CLI args và luồng STDIN.
   - Bóc tách ký tự UTF-8 BOM Windows '\\ufeff'.
   - Khả năng chịu lỗi an toàn (empty, malformed, non-dict, whitespace).
2. extract_tool_info:
   - Trích xuất tên tool và args từ mọi biến thể payload của Go Engine.
   - Giải mã tham số args dưới dạng chuỗi JSON hoặc chuỗi kèm BOM.
   - Chịu lỗi khi args không hợp lệ hoặc thiếu trường.
3. record_footprint:
   - Ghi bản ghi hợp lệ theo chuẩn First-Class Telemetry.
   - Đảm bảo đầy đủ các trường bắt buộc (timestamp, guard, event, status, durationMs).
   - Xác thực định dạng JSONL và không gây crash khi phát sinh lỗi I/O.
   - Kiểm chứng tương thích nhị phân với verify_footprint_telemetry của Test Harness.
4. format_hook_response & emit_stdout_json:
   - Chuẩn hóa cấu trúc kết quả cho Go Engine.
   - Flush STDOUT không gây nghẽn tiến trình.
"""

import os
import sys
import io
import json
import tempfile
import unittest
from unittest.mock import patch, MagicMock

# Thiết lập đường dẫn import
TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
GUARDS_DIR = os.path.abspath(os.path.join(TESTS_DIR, ".."))
if GUARDS_DIR not in sys.path:
    sys.path.insert(0, GUARDS_DIR)
if TESTS_DIR not in sys.path:
    sys.path.insert(0, TESTS_DIR)

import hook_utils
from hook_utils import (
    parse_stdin_payload,
    parse_input,
    extract_tool_info,
    extract_tool_call_info,
    record_footprint,
    format_hook_response,
    emit_stdout_json,
    get_repo_root,
    get_default_log_path,
)

# Nạp validator từ headless e2e harness để kiểm chứng liên thông
try:
    from test_hooks_headless_e2e import verify_footprint_telemetry
except ImportError:
    verify_footprint_telemetry = None


class TestParseStdinPayload(unittest.TestCase):
    """Kiểm thử cơ chế giải mã payload từ args và STDIN kèm xử lý BOM."""

    def test_parse_valid_json_string_arg(self):
        """Kịch bản danh định: Chuỗi JSON hợp lệ truyền qua tham số."""
        payload_str = '{"event": "PreToolUse", "toolCall": {"name": "write_file"}}'
        result = parse_stdin_payload(payload_str)
        self.assertEqual(result.get("event"), "PreToolUse")
        self.assertIn("toolCall", result)

    def test_parse_valid_json_with_windows_bom_arg(self):
        """Kịch bản biên: Chuỗi JSON có chèn BOM Windows \\ufeff ở đầu."""
        payload_str = '\ufeff{"event": "PostToolUse", "status": "clean"}'
        result = parse_stdin_payload(payload_str)
        self.assertEqual(result.get("event"), "PostToolUse")
        self.assertEqual(result.get("status"), "clean")

    def test_parse_empty_and_whitespace_arg(self):
        """Kịch bản biên: Chuỗi rỗng hoặc chỉ chứa khoảng trắng/BOM."""
        self.assertEqual(parse_stdin_payload(""), {})
        self.assertEqual(parse_stdin_payload("   \n\t  "), {})
        self.assertEqual(parse_stdin_payload("\ufeff"), {})
        self.assertEqual(parse_stdin_payload("\ufeff   "), {})

    def test_parse_malformed_json_arg(self):
        """Kịch bản lỗi: Chuỗi JSON phân mảnh / sai cú pháp."""
        self.assertEqual(parse_stdin_payload('{"unclosed": "brace"'), {})
        self.assertEqual(parse_stdin_payload('random non-json string'), {})
        self.assertEqual(parse_stdin_payload('{bad: syntax}'), {})

    def test_parse_non_dict_json_arg(self):
        """Kịch bản biên: JSON hợp lệ nhưng không phải là dict/object."""
        self.assertEqual(parse_stdin_payload('"just a string"'), {})
        self.assertEqual(parse_stdin_payload('[1, 2, 3]'), {})
        self.assertEqual(parse_stdin_payload('12345'), {})
        self.assertEqual(parse_stdin_payload('true'), {})

    def test_parse_already_dict_arg(self):
        """Kịch bản phòng thủ: Tham số truyền vào đã là dict."""
        input_dict = {"event": "Stop", "decision": "stop"}
        result = parse_stdin_payload(input_dict)
        self.assertEqual(result, input_dict)

    def test_parse_from_stdin_nominal(self):
        """Kịch bản danh định: Đọc payload từ sys.stdin."""
        raw_json = '{"name": "edit_file", "args": {"Path": "src/app.ts"}}'
        mock_stdin = io.StringIO(raw_json)
        with patch.object(sys, "stdin", mock_stdin):
            mock_stdin.isatty = lambda: False
            result = parse_stdin_payload(None)
            self.assertEqual(result.get("name"), "edit_file")
            self.assertEqual(result.get("args", {}).get("Path"), "src/app.ts")

    def test_parse_from_stdin_with_windows_bom(self):
        """Kịch bản biên: Đọc payload từ sys.stdin có ký tự BOM Windows."""
        raw_json = '\ufeff{"name": "write_file", "status": "pending"}'
        mock_stdin = io.StringIO(raw_json)
        with patch.object(sys, "stdin", mock_stdin):
            mock_stdin.isatty = lambda: False
            result = parse_stdin_payload(None)
            self.assertEqual(result.get("name"), "write_file")
            self.assertEqual(result.get("status"), "pending")

    def test_parse_from_stdin_isatty_returns_empty(self):
        """Kịch bản môi trường: Khi STDIN là terminal tương tác (isatty = True)."""
        mock_stdin = MagicMock()
        mock_stdin.isatty.return_value = True
        with patch.object(sys, "stdin", mock_stdin):
            result = parse_stdin_payload(None)
            self.assertEqual(result, {})

    def test_parse_from_stdin_empty(self):
        """Kịch bản biên: STDIN rỗng không có dữ liệu."""
        mock_stdin = io.StringIO("")
        with patch.object(sys, "stdin", mock_stdin):
            mock_stdin.isatty = lambda: False
            result = parse_stdin_payload(None)
            self.assertEqual(result, {})

    def test_alias_parse_input(self):
        """Xác nhận bí danh parse_input tương thích hoàn toàn với parse_stdin_payload."""
        self.assertIs(parse_input, parse_stdin_payload)


class TestExtractToolInfo(unittest.TestCase):
    """Kiểm thử trích xuất tool_name và tool_args từ các biến thể cấu trúc payload."""

    def test_extract_nested_tool_call(self):
        """Kịch bản Go Engine chuẩn: toolCall lồng nhau."""
        payload = {
            "toolCall": {
                "name": "write_file",
                "args": {
                    "Path": "src/features/login.tsx",
                    "Content": "export const Login = () => <div/>;"
                }
            }
        }
        tool_name, tool_args = extract_tool_info(payload)
        self.assertEqual(tool_name, "write_file")
        self.assertEqual(tool_args.get("Path"), "src/features/login.tsx")

    def test_extract_flat_payload(self):
        """Kịch bản payload dạng phẳng (name và args ở root)."""
        payload = {
            "name": "edit_file",
            "args": {
                "Path": "src/components/button.tsx",
                "Target": "old",
                "Replacement": "new"
            }
        }
        tool_name, tool_args = extract_tool_info(payload)
        self.assertEqual(tool_name, "edit_file")
        self.assertEqual(tool_args.get("Target"), "old")

    def test_extract_snake_case_keys(self):
        """Kịch bản tương thích biến thể: tool_name và tool_args."""
        payload = {
            "tool_name": "invoke_subagent",
            "tool_args": {
                "TypeName": "surgical-implementer",
                "task_id": "T004"
            }
        }
        tool_name, tool_args = extract_tool_info(payload)
        self.assertEqual(tool_name, "invoke_subagent")
        self.assertEqual(tool_args.get("task_id"), "T004")

    def test_extract_json_string_encoded_args(self):
        """Kịch bản chuỗi JSON trong args: Tự động phân tích thành dict."""
        payload = {
            "name": "send_message",
            "args": json.dumps({"Recipient": "host-orchestrator", "Message": "DONE"})
        }
        tool_name, tool_args = extract_tool_info(payload)
        self.assertEqual(tool_name, "send_message")
        self.assertEqual(tool_args.get("Recipient"), "host-orchestrator")
        self.assertEqual(tool_args.get("Message"), "DONE")

    def test_extract_json_string_with_windows_bom_in_args(self):
        """Kịch bản chuỗi JSON trong args có chèn BOM Windows."""
        payload = {
            "name": "write_file",
            "args": '\ufeff{"Path": "test.txt", "Content": "ok"}'
        }
        tool_name, tool_args = extract_tool_info(payload)
        self.assertEqual(tool_name, "write_file")
        self.assertEqual(tool_args.get("Path"), "test.txt")

    def test_extract_malformed_string_args_fallback(self):
        """Kịch bản args là chuỗi không phải JSON: Bọc an toàn vào raw_string."""
        payload = {
            "name": "run_command",
            "args": "npm test -- --coverage"
        }
        tool_name, tool_args = extract_tool_info(payload)
        self.assertEqual(tool_name, "run_command")
        self.assertEqual(tool_args, {"raw_string": "npm test -- --coverage"})

    def test_extract_empty_or_missing_payload(self):
        """Kịch bản biên: Payload rỗng hoặc không phải dict."""
        self.assertEqual(extract_tool_info({}), ("", {}))
        self.assertEqual(extract_tool_info(None), ("", {}))
        self.assertEqual(extract_tool_info("not a dict"), ("", {}))

    def test_alias_extract_tool_call_info(self):
        """Xác nhận bí danh extract_tool_call_info tương thích hoàn toàn."""
        self.assertIs(extract_tool_call_info, extract_tool_info)


class TestRecordFootprint(unittest.TestCase):
    """Kiểm thử ghi vết nhật ký vi mô bền vững (First-Class Telemetry)."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.log_path = os.path.join(self.temp_dir.name, "logs", "guard-footprints.jsonl")

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_record_footprint_nominal(self):
        """Kịch bản danh định: Ghi một bản ghi footprint và kiểm tra cấu trúc."""
        success = record_footprint(
            guard_name="workspace-safety-guard",
            event="PostToolUse",
            status="CLEAN",
            target="src/features/sample.py",
            duration_ms=12.456,
            details={"violations": 0},
            log_path=self.log_path,
        )
        self.assertTrue(success)
        self.assertTrue(os.path.exists(self.log_path))

        with open(self.log_path, "r", encoding="utf-8") as f:
            lines = [line.strip() for line in f if line.strip()]
        self.assertEqual(len(lines), 1)

        record = json.loads(lines[0])
        self.assertEqual(record["guard"], "workspace-safety-guard")
        self.assertEqual(record["event"], "PostToolUse")
        self.assertEqual(record["status"], "CLEAN")
        self.assertEqual(record["target"], "src/features/sample.py")
        self.assertEqual(record["durationMs"], 12.46)
        self.assertEqual(record["details"], {"violations": 0})
        self.assertIn("timestamp", record)

    def test_record_footprint_appends_multiple_lines(self):
        """Kịch bản ghi nhiều dòng: Xác nhận định dạng JSONL chuẩn xác."""
        record_footprint("guard-1", "PreToolUse", "ALLOW", duration_ms=5.0, log_path=self.log_path)
        record_footprint("guard-2", "PostToolUse", "CLEAN", duration_ms=10.0, log_path=self.log_path)
        record_footprint("guard-3", "Stop", "STOP", duration_ms=2.5, log_path=self.log_path)

        with open(self.log_path, "r", encoding="utf-8") as f:
            records = [json.loads(line.strip()) for line in f if line.strip()]

        self.assertEqual(len(records), 3)
        self.assertEqual(records[0]["guard"], "guard-1")
        self.assertEqual(records[1]["guard"], "guard-2")
        self.assertEqual(records[2]["guard"], "guard-3")

    def test_record_footprint_with_none_target_and_details(self):
        """Kịch bản biên: Target và details là None."""
        success = record_footprint(
            guard_name="verification-gate",
            event="Stop",
            status="STOP",
            target=None,
            duration_ms=8.0,
            details=None,
            log_path=self.log_path,
        )
        self.assertTrue(success)

        with open(self.log_path, "r", encoding="utf-8") as f:
            record = json.loads(f.readline().strip())

        self.assertIsNone(record["target"])
        self.assertEqual(record["details"], {})
        self.assertEqual(record["durationMs"], 8.0)

    def test_record_footprint_io_error_handling(self):
        """Kịch bản phòng thủ: Thư mục không thể ghi (I/O error), không raise exception."""
        # Đường dẫn không hợp lệ trên Windows
        invalid_path = "Z:\\non_existent_drive_6789\\sub\\log.jsonl"
        with patch.object(sys, "stderr", io.StringIO()) as mock_stderr:
            result = record_footprint(
                guard_name="error-guard",
                event="PreToolUse",
                status="ERROR",
                log_path=invalid_path,
            )
            self.assertFalse(result)
            self.assertIn("[FOOTPRINT_LOG_ERROR]", mock_stderr.getvalue())

    def test_interoperability_with_headless_e2e_verifier(self):
        """Kịch bản kiểm thử tích hợp: Xác nhận tương thích 100% với verify_footprint_telemetry."""
        if verify_footprint_telemetry is None:
            self.skipTest("verify_footprint_telemetry not available in test environment")

        # Ghi 3 bản ghi
        record_footprint("workspace-guard", "PostToolUse", "CLEAN", duration_ms=15.2, log_path=self.log_path)
        record_footprint("workspace-guard", "PostToolUse", "CLEAN", duration_ms=22.8, log_path=self.log_path)
        record_footprint("verification-gate", "Stop", "ALLOW", duration_ms=9.1, log_path=self.log_path)

        # Kiểm chứng qua harness validator độc lập
        entries = verify_footprint_telemetry(
            min_expected_entries=3,
            log_path=self.log_path,
            max_duration_ms=35.0,
        )
        self.assertEqual(len(entries), 3)
        self.assertEqual(entries[0]["guard"], "workspace-guard")
        self.assertLessEqual(entries[0]["durationMs"], 35.0)


class TestHookResponseAndStdout(unittest.TestCase):
    """Kiểm thử chuẩn hóa kết quả hook và xuất STDOUT an toàn."""

    def test_format_hook_response_with_reason(self):
        """Kiểm chứng chuẩn hóa kết quả có lý do kèm theo."""
        resp = format_hook_response("deny", reason="Forbidden placeholder detected")
        self.assertEqual(resp, {"decision": "deny", "reason": "Forbidden placeholder detected"})

    def test_format_hook_response_without_reason(self):
        """Kiểm chứng chuẩn hóa kết quả không có lý do."""
        resp = format_hook_response("allow")
        self.assertEqual(resp, {"decision": "allow"})

    def test_format_hook_response_with_extra_fields(self):
        """Kiểm chứng mở rộng tham số."""
        resp = format_hook_response("stop", reason="Tests passed", exit_code=0)
        self.assertEqual(resp, {"decision": "stop", "reason": "Tests passed", "exit_code": 0})

    def test_emit_stdout_json(self):
        """Kiểm chứng xuất JSON ra STDOUT và flush bộ đệm."""
        payload = {"decision": "allow", "count": 42}
        mock_stdout = io.StringIO()
        with patch.object(sys, "stdout", mock_stdout):
            emit_stdout_json(payload)
            output = mock_stdout.getvalue()

        parsed = json.loads(output.strip())
        self.assertEqual(parsed, payload)

    def test_paths_resolution(self):
        """Kiểm chứng hàm xác định đường dẫn get_repo_root và get_default_log_path."""
        root = get_repo_root()
        self.assertTrue(os.path.isdir(root))
        self.assertTrue(os.path.exists(os.path.join(root, ".agents")))

        log_path = get_default_log_path()
        self.assertTrue(log_path.endswith(os.path.join(".agents", "logs", "guard-footprints.jsonl")))


if __name__ == "__main__":
    unittest.main()
