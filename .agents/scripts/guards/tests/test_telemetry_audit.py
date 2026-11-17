#!/usr/bin/env python3
# .agents/scripts/guards/tests/test_telemetry_audit.py
"""
Bộ kiểm thử cơ học nhị phân (Automated Unit Tests) cho tiện ích kiểm toán log audit_session_logs.py.
Thuộc User Story 4 (Feature 005 - Task T014).

Kiểm chứng toàn diện:
1. Định vị đường dẫn log mặc định và tuỳ chỉnh (resolve_log_path).
2. Đối khớp session ID đa cấp (root, details, target, case-insensitive).
3. Trích xuất footprint với các bộ lọc: session_id, event, status, limit.
4. Chịu lỗi phòng thủ: BOM Windows, dòng JSON hỏng, tệp không tồn tại.
5. Tổng hợp chỉ số kiểm toán: event breakdown, status breakdown, violations, avg duration.
6. Chế độ nghiệm thu khô (dry_run) cho CI/CD và companion test.
7. Giao diện dòng lệnh CLI (sys.argv, --dry-run, --json, plain text, exit code 0).
"""

import os
import sys
import io
import json
import tempfile
import unittest
from unittest.mock import patch

# Thiết lập đường dẫn import
TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
GUARDS_DIR = os.path.abspath(os.path.join(TESTS_DIR, ".."))
if GUARDS_DIR not in sys.path:
    sys.path.insert(0, GUARDS_DIR)

from audit_session_logs import (
    resolve_log_path,
    match_session_id,
    extract_session_footprints,
    summarize_audit_trail,
    audit_session,
    main,
)


class TestResolveLogPath(unittest.TestCase):
    """Kiểm tra logic phân giải đường dẫn tệp nhật ký."""

    def test_resolve_custom_path(self):
        custom = os.path.join("custom", "path", "test.jsonl")
        resolved = resolve_log_path(custom)
        self.assertEqual(resolved, os.path.abspath(custom))

    def test_resolve_default_path(self):
        resolved = resolve_log_path(None)
        self.assertTrue(resolved.endswith("guard-footprints.jsonl"))
        self.assertTrue(os.path.isabs(resolved))


class TestMatchSessionId(unittest.TestCase):
    """Kiểm tra logic nhận diện và đối khớp session ID đa cấp."""

    def test_match_empty_or_none_returns_true(self):
        rec = {"guard": "test"}
        self.assertTrue(match_session_id(rec, ""))
        self.assertTrue(match_session_id(rec, None))

    def test_match_root_session_id(self):
        rec1 = {"session_id": "sess-alpha-001"}
        self.assertTrue(match_session_id(rec1, "sess-alpha-001"))
        self.assertTrue(match_session_id(rec1, "SESS-ALPHA-001"))
        self.assertFalse(match_session_id(rec1, "sess-beta"))

        rec2 = {"sessionId": "sess-alpha-002"}
        self.assertTrue(match_session_id(rec2, "sess-alpha-002"))

    def test_match_details_session_id(self):
        rec = {"details": {"session_id": "sub-worker-10"}}
        self.assertTrue(match_session_id(rec, "sub-worker-10"))
        self.assertTrue(match_session_id(rec, "SUB-WORKER-10"))

        rec_camel = {"details": {"sessionId": "sub-worker-20"}}
        self.assertTrue(match_session_id(rec_camel, "sub-worker-20"))

    def test_match_details_subagent_and_recipient(self):
        rec_sub = {"details": {"subagent_id": "implementer-turn-5"}}
        self.assertTrue(match_session_id(rec_sub, "implementer"))

        rec_recip = {"details": {"recipient": "auditor-gate-99"}}
        self.assertTrue(match_session_id(rec_recip, "auditor-gate-99"))

    def test_match_target_substring(self):
        rec = {"target": "session-batch-77-task"}
        self.assertTrue(match_session_id(rec, "batch-77"))

    def test_mismatch_returns_false(self):
        rec = {"session_id": "one", "details": {"subagent_id": "two"}, "target": "three"}
        self.assertFalse(match_session_id(rec, "four"))


class TestExtractSessionFootprints(unittest.TestCase):
    """Kiểm tra trích xuất bản ghi footprint và khả năng chịu lỗi phòng thủ."""

    def setUp(self):
        self.temp_file = tempfile.NamedTemporaryFile(mode="w+", delete=False, encoding="utf-8")
        self.temp_path = self.temp_file.name

    def tearDown(self):
        self.temp_file.close()
        if os.path.exists(self.temp_path):
            os.remove(self.temp_path)

    def test_extract_nonexistent_file_returns_empty(self):
        result = extract_session_footprints(log_path="non_existent_file_99999.jsonl")
        self.assertEqual(result, [])

    def test_extract_valid_records(self):
        records = [
            {"timestamp": "2026-11-17 01:00:00", "guard": "g1", "event": "PreToolUse", "status": "ALLOW"},
            {"timestamp": "2026-11-17 01:00:01", "guard": "g2", "event": "PostToolUse", "status": "CLEAN"},
            {"timestamp": "2026-11-17 01:00:02", "guard": "g3", "event": "Stop", "status": "STOP"},
        ]
        with open(self.temp_path, "w", encoding="utf-8") as f:
            for r in records:
                f.write(json.dumps(r) + "\n")

        extracted = extract_session_footprints(log_path=self.temp_path)
        self.assertEqual(len(extracted), 3)
        self.assertEqual(extracted[0]["event"], "PreToolUse")
        self.assertEqual(extracted[2]["event"], "Stop")

    def test_extract_with_bom_and_empty_lines(self):
        with open(self.temp_path, "w", encoding="utf-8") as f:
            f.write("\ufeff" + json.dumps({"event": "PreToolUse", "status": "ALLOW"}) + "\n\n")
            f.write("   \n")
            f.write(json.dumps({"event": "Stop", "status": "STOP"}) + "\n")

        extracted = extract_session_footprints(log_path=self.temp_path)
        self.assertEqual(len(extracted), 2)
        self.assertEqual(extracted[0]["event"], "PreToolUse")

    def test_extract_skip_corrupted_lines(self):
        with open(self.temp_path, "w", encoding="utf-8") as f:
            f.write("corrupted-not-json\n")
            f.write(json.dumps({"event": "PreToolUse", "status": "ALLOW"}) + "\n")
            f.write("{unclosed_json: true\n")
            f.write(json.dumps({"event": "Stop", "status": "STOP"}) + "\n")

        extracted = extract_session_footprints(log_path=self.temp_path)
        self.assertEqual(len(extracted), 2)

    def test_extract_filter_by_session(self):
        with open(self.temp_path, "w", encoding="utf-8") as f:
            f.write(json.dumps({"session_id": "sess-A", "event": "PreToolUse"}) + "\n")
            f.write(json.dumps({"session_id": "sess-B", "event": "PreToolUse"}) + "\n")
            f.write(json.dumps({"session_id": "sess-A", "event": "Stop"}) + "\n")

        extracted = extract_session_footprints(session_id="sess-A", log_path=self.temp_path)
        self.assertEqual(len(extracted), 2)
        for r in extracted:
            self.assertEqual(r["session_id"], "sess-A")

    def test_extract_filter_by_event_and_status(self):
        with open(self.temp_path, "w", encoding="utf-8") as f:
            f.write(json.dumps({"event": "PreToolUse", "status": "ALLOW"}) + "\n")
            f.write(json.dumps({"event": "PreToolUse", "status": "DENY"}) + "\n")
            f.write(json.dumps({"event": "Stop", "status": "STOP"}) + "\n")

        ev_filtered = extract_session_footprints(event_filter="pretooluse", log_path=self.temp_path)
        self.assertEqual(len(ev_filtered), 2)

        st_filtered = extract_session_footprints(status_filter="deny", log_path=self.temp_path)
        self.assertEqual(len(st_filtered), 1)
        self.assertEqual(st_filtered[0]["status"], "DENY")

    def test_extract_limit_returns_tail(self):
        with open(self.temp_path, "w", encoding="utf-8") as f:
            for i in range(5):
                f.write(json.dumps({"index": i}) + "\n")

        tail = extract_session_footprints(log_path=self.temp_path, limit=2)
        self.assertEqual(len(tail), 2)
        self.assertEqual(tail[0]["index"], 3)
        self.assertEqual(tail[1]["index"], 4)


class TestSummarizeAuditTrail(unittest.TestCase):
    """Kiểm tra hàm tổng hợp và thống kê chỉ số chuỗi footprint."""

    def test_summarize_empty_list(self):
        summary = summarize_audit_trail([])
        self.assertEqual(summary["total_records"], 0)
        self.assertEqual(summary["violations"], 0)
        self.assertEqual(summary["average_duration_ms"], 0.0)

    def test_summarize_counts_and_metrics(self):
        sample = [
            {"event": "PreToolUse", "status": "ALLOW", "durationMs": 10.0},
            {"event": "PreToolUse", "status": "DENY", "durationMs": 20.0},
            {"event": "PostToolUse", "status": "FLAGGED_PLACEHOLDER", "durationMs": 30.0},
            {"event": "Stop", "status": "STOP", "durationMs": 40.0},
        ]
        summary = summarize_audit_trail(sample)
        self.assertEqual(summary["total_records"], 4)
        self.assertEqual(summary["event_counts"]["PreToolUse"], 2)
        self.assertEqual(summary["event_counts"]["PostToolUse"], 1)
        self.assertEqual(summary["event_counts"]["Stop"], 1)
        self.assertEqual(summary["status_counts"]["ALLOW"], 1)
        self.assertEqual(summary["status_counts"]["DENY"], 1)
        self.assertEqual(summary["violations"], 2)  # DENY + FLAGGED_PLACEHOLDER
        self.assertEqual(summary["average_duration_ms"], 25.0)

    def test_summarize_handles_non_numeric_duration(self):
        sample = [
            {"event": "PreToolUse", "status": "ALLOW", "durationMs": None},
            {"event": "PreToolUse", "status": "ALLOW"},
            {"event": "Stop", "status": "STOP", "durationMs": 50.0},
        ]
        summary = summarize_audit_trail(sample)
        self.assertEqual(summary["total_records"], 3)
        self.assertEqual(summary["average_duration_ms"], 50.0)


class TestAuditSession(unittest.TestCase):
    """Kiểm tra hàm nghiệp vụ cấp cao audit_session."""

    def test_audit_session_dry_run(self):
        report = audit_session(dry_run=True)
        self.assertEqual(report["status"], "SUCCESS")
        self.assertTrue(report["dry_run"])
        self.assertEqual(report["total_records"], 3)
        self.assertIn("summary", report)
        self.assertEqual(report["summary"]["total_records"], 3)

    def test_audit_session_real_file(self):
        with tempfile.NamedTemporaryFile(mode="w+", delete=False, encoding="utf-8") as f:
            f.write(json.dumps({"event": "PreToolUse", "status": "ALLOW"}) + "\n")
            temp_path = f.name

        try:
            report = audit_session(log_path=temp_path)
            self.assertEqual(report["status"], "SUCCESS")
            self.assertEqual(report["total_records"], 1)
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    def test_audit_session_missing_file(self):
        report = audit_session(log_path="nonexistent_audit_log_file.jsonl")
        self.assertEqual(report["status"], "EMPTY")
        self.assertEqual(report["total_records"], 0)


class TestAuditSessionLogsCLI(unittest.TestCase):
    """Kiểm tra giao diện thực thi CLI runner (sys.argv, main(), exit code)."""

    def test_cli_dry_run(self):
        test_args = ["audit_session_logs.py", "--dry-run"]
        with patch.object(sys, "argv", test_args):
            with patch("sys.stdout", new_callable=io.StringIO) as mock_stdout:
                with self.assertRaises(SystemExit) as cm:
                    main()
                self.assertEqual(cm.exception.code, 0)
                output = mock_stdout.getvalue().strip()
                parsed = json.loads(output)
                self.assertEqual(parsed.get("status"), "SUCCESS")
                self.assertTrue(parsed.get("dry_run"))

    def test_cli_json_mode(self):
        with tempfile.NamedTemporaryFile(mode="w+", delete=False, encoding="utf-8") as f:
            f.write(json.dumps({"event": "Stop", "status": "STOP"}) + "\n")
            temp_path = f.name

        try:
            test_args = ["audit_session_logs.py", "-l", temp_path, "--json"]
            with patch.object(sys, "argv", test_args):
                with patch("sys.stdout", new_callable=io.StringIO) as mock_stdout:
                    with self.assertRaises(SystemExit) as cm:
                        main()
                    self.assertEqual(cm.exception.code, 0)
                    parsed = json.loads(mock_stdout.getvalue().strip())
                    self.assertEqual(parsed.get("status"), "SUCCESS")
                    self.assertEqual(parsed.get("total_records"), 1)
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    def test_cli_plain_mode(self):
        test_args = ["audit_session_logs.py", "-l", "nonexistent.jsonl"]
        with patch.object(sys, "argv", test_args):
            with patch("sys.stdout", new_callable=io.StringIO) as mock_stdout:
                with self.assertRaises(SystemExit) as cm:
                    main()
                self.assertEqual(cm.exception.code, 0)
                output = mock_stdout.getvalue()
                self.assertIn("Guard Telemetry Audit Report", output)


if __name__ == "__main__":
    unittest.main()
