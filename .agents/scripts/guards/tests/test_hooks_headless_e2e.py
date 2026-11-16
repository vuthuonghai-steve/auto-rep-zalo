#!/usr/bin/env python3
# .agents/scripts/guards/tests/test_hooks_headless_e2e.py
"""
Headless E2E Test Engine & Integration Suite (Track 1 - Task T002).
Kiểm thử tích hợp đầu-cuối cơ chế Headless Mode của Go Engine (agy CLI) trên Windows:
- Runner triệu gọi trực tiếp nhị phân agy ở chế độ headless (-p, --output-format json/stream-json).
- Parser luồng stream NDJSON (Newline Delimited JSON) bóc tách các sự kiện vòng đời và tool calls.
- Telemetry assertion engine thẩm định tệp nhật ký vết .agents/logs/guard-footprints.jsonl.
- Đo đạc và xác thực độ trễ của các lần kích hoạt hook (< 35ms) và tính toàn vẹn phiên (exit_code 0).
"""

import os
import sys
import time
import json
import shutil
import tempfile
import subprocess
import unittest
import statistics
from dataclasses import dataclass, field
from typing import Dict, Any, List, Tuple, Optional

# Xác định tọa độ thư mục chuẩn xác
TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
GUARDS_DIR = os.path.abspath(os.path.join(TESTS_DIR, ".."))
SCRIPTS_DIR = os.path.abspath(os.path.join(GUARDS_DIR, ".."))
AGENTS_DIR = os.path.abspath(os.path.join(SCRIPTS_DIR, ".."))
REPO_ROOT = os.path.abspath(os.path.join(AGENTS_DIR, ".."))
DEFAULT_LOG_PATH = os.path.join(AGENTS_DIR, "logs", "guard-footprints.jsonl")


@dataclass
class AgyLiveSessionResult:
    """Kết quả thực thi một phiên làm việc Headless qua agy CLI."""
    stdout: str
    stderr: str
    exit_code: int
    events: List[Dict[str, Any]] = field(default_factory=list)
    result_json: Optional[Dict[str, Any]] = None
    duration_seconds: float = 0.0
    timed_out: bool = False
    error: Optional[str] = None

    @property
    def is_success(self) -> bool:
        """Kiểm tra phiên có thành công (exit code 0, không timeout, không lỗi)."""
        return self.exit_code == 0 and not self.timed_out and self.error is None


def find_agy_binary() -> Optional[str]:
    """
    Xác định đường dẫn khả dụng của nhị phân agy trên hệ thống Windows/Unix.
    Ưu tiên:
    1. PATH hệ thống (agy hoặc agy.exe).
    2. LocalAppData của người dùng trên Windows.
    """
    agy_on_path = shutil.which("agy") or shutil.which("agy.exe")
    if agy_on_path:
        return agy_on_path

    if sys.platform == "win32":
        local_app_data = os.environ.get("LOCALAPPDATA", "")
        if local_app_data:
            candidate = os.path.join(local_app_data, "agy", "bin", "agy.exe")
            if os.path.exists(candidate):
                return candidate

    return None


def parse_ndjson_stream(raw_text: str) -> Tuple[List[Dict[str, Any]], List[str]]:
    """
    Phân tích cú pháp luồng dữ liệu Newline Delimited JSON (NDJSON).
    Xử lý:
    - Bóc tách ký tự BOM UTF-8 Windows '\\ufeff'.
    - Bỏ qua các dòng trống / whitespace.
    - Phân tách các dòng JSON hợp lệ và các dòng malformed.
    Trả về: (valid_events, malformed_lines).
    """
    if not raw_text:
        return [], []

    cleaned = raw_text.strip().lstrip("\ufeff")
    lines = cleaned.splitlines()

    valid_events: List[Dict[str, Any]] = []
    malformed_lines: List[str] = []

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        try:
            parsed = json.loads(stripped)
            if isinstance(parsed, dict):
                valid_events.append(parsed)
            else:
                malformed_lines.append(stripped)
        except Exception:
            malformed_lines.append(stripped)

    return valid_events, malformed_lines


def build_agy_command(
    prompt: str,
    output_format: str = "json",
    dangerously_skip_permissions: bool = True,
    extra_args: Optional[List[str]] = None,
    agy_executable: Optional[str] = None,
) -> List[str]:
    """
    Xây dựng danh sách tham số chuẩn hóa cho lệnh gọi agy CLI ở chế độ Headless.
    Khế ước: agy -p "<prompt>" --output-format <format> [--dangerously-skip-permissions] ...
    """
    agy_bin = agy_executable or find_agy_binary() or "agy"
    cmd = [agy_bin, "-p", prompt, "--output-format", output_format]
    if dangerously_skip_permissions:
        cmd.append("--dangerously-skip-permissions")
    if extra_args:
        cmd.extend(extra_args)
    return cmd


def run_live_agy_session(
    prompt: str,
    timeout_sec: float = 60.0,
    output_format: str = "json",
    extra_args: Optional[List[str]] = None,
    cwd: Optional[str] = None,
    agy_executable: Optional[str] = None,
) -> AgyLiveSessionResult:
    """
    Khởi chạy một phiên agy thực tế ở chế độ Headless với chốt chặn timeout 60 giây.
    Thu thập và phân tích cú pháp output:
    - Nếu format là 'stream-json': bóc tách các dòng NDJSON vào trường events.
    - Nếu format là 'json': giải mã kết quả duy nhất vào trường result_json.
    - Thẩm định lỗi timeout (TIMEOUT_BREACH).
    """
    target_bin = agy_executable or find_agy_binary()
    if not target_bin:
        return AgyLiveSessionResult(
            stdout="",
            stderr="[BINARY_NOT_FOUND] agy CLI not found on PATH or LocalAppData.",
            exit_code=1,
            error="BINARY_NOT_FOUND",
        )

    cmd = build_agy_command(
        prompt=prompt,
        output_format=output_format,
        dangerously_skip_permissions=True,
        extra_args=extra_args,
        agy_executable=target_bin,
    )

    effective_cwd = cwd or REPO_ROOT

    start_time = time.perf_counter()
    try:
        proc = subprocess.run(
            cmd,
            cwd=effective_cwd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=timeout_sec,
        )
        elapsed_sec = time.perf_counter() - start_time
        stdout_raw = proc.stdout or ""
        stderr_raw = proc.stderr or ""

        events: List[Dict[str, Any]] = []
        result_json: Optional[Dict[str, Any]] = None

        if output_format in ("stream-json", "stream_json"):
            events, _ = parse_ndjson_stream(stdout_raw)
            # Tìm event cuối cùng có type là result
            for evt in reversed(events):
                if evt.get("event") == "result" and isinstance(evt.get("result"), dict):
                    result_json = evt["result"]
                    break
        else:
            # Thử parse toàn bộ stdout thành JSON
            cleaned = stdout_raw.strip().lstrip("\ufeff")
            if cleaned:
                try:
                    result_json = json.loads(cleaned)
                except Exception:
                    # Nếu có nhiều dòng, thử parse theo dòng
                    events, _ = parse_ndjson_stream(stdout_raw)
                    if events:
                        result_json = events[-1]

        return AgyLiveSessionResult(
            stdout=stdout_raw,
            stderr=stderr_raw,
            exit_code=proc.returncode,
            events=events,
            result_json=result_json,
            duration_seconds=elapsed_sec,
            timed_out=False,
            error=None if proc.returncode == 0 else f"EXIT_NON_ZERO_{proc.returncode}",
        )

    except subprocess.TimeoutExpired as exc:
        elapsed_sec = time.perf_counter() - start_time
        out = exc.stdout.decode("utf-8", errors="replace") if isinstance(exc.stdout, bytes) else (exc.stdout or "")
        return AgyLiveSessionResult(
            stdout=out,
            stderr=f"[TIMEOUT_BREACH] Session timed out after {timeout_sec}s",
            exit_code=1,
            duration_seconds=elapsed_sec,
            timed_out=True,
            error="TIMEOUT_BREACH",
        )
    except Exception as exc:
        elapsed_sec = time.perf_counter() - start_time
        return AgyLiveSessionResult(
            stdout="",
            stderr=f"[EXECUTION_EXCEPTION] {type(exc).__name__}: {exc}",
            exit_code=1,
            duration_seconds=elapsed_sec,
            timed_out=False,
            error=str(exc),
        )


def verify_footprint_telemetry(
    min_expected_entries: int = 1,
    log_path: Optional[str] = None,
    max_duration_ms: Optional[float] = None,
) -> List[Dict[str, Any]]:
    """
    Thẩm định tệp nhật ký vết .agents/logs/guard-footprints.jsonl:
    - Xác nhận tệp tồn tại và đọc được.
    - Kiểm tra các trường dữ liệu bắt buộc: timestamp, guard, event, status, durationMs.
    - Xác thực định dạng và giá trị hợp lệ.
    - Nếu max_duration_ms được chỉ định, kiểm tra toàn bộ bản ghi có durationMs <= max_duration_ms.
    Trả về danh sách các bản ghi hợp lệ.
    """
    target_path = log_path or DEFAULT_LOG_PATH
    if not os.path.exists(target_path):
        if min_expected_entries > 0:
            raise FileNotFoundError(f"Guard footprints log not found at: {target_path}")
        return []

    entries: List[Dict[str, Any]] = []
    required_fields = ["timestamp", "guard", "event", "status", "durationMs"]

    with open(target_path, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, start=1):
            stripped = line.strip().lstrip("\ufeff")
            if not stripped:
                continue
            try:
                record = json.loads(stripped)
            except Exception as exc:
                raise ValueError(f"Malformed JSONL at line {line_num} in {target_path}: {exc}")

            if not isinstance(record, dict):
                raise ValueError(f"Record at line {line_num} is not a JSON object")

            for req in required_fields:
                if req not in record:
                    raise KeyError(f"Missing required field '{req}' at line {line_num} in footprint log")

            if not isinstance(record["durationMs"], (int, float)):
                raise TypeError(f"Field 'durationMs' at line {line_num} must be a numeric value")

            if max_duration_ms is not None and record["durationMs"] > max_duration_ms:
                raise AssertionError(
                    f"Record at line {line_num} breached latency threshold: "
                    f"{record['durationMs']}ms > {max_duration_ms}ms (guard={record.get('guard')})"
                )

            entries.append(record)

    if len(entries) < min_expected_entries:
        raise AssertionError(
            f"Expected at least {min_expected_entries} footprint entries, found {len(entries)}"
        )

    return entries


def calculate_footprint_metrics(entries: List[Dict[str, Any]]) -> Dict[str, float]:
    """Tính toán thống kê phân phối độ trễ từ danh sách bản ghi footprint."""
    if not entries:
        return {"count": 0.0, "mean_ms": 0.0, "p95_ms": 0.0, "max_ms": 0.0}

    durations = [float(e["durationMs"]) for e in entries if "durationMs" in e]
    if not durations:
        return {"count": 0.0, "mean_ms": 0.0, "p95_ms": 0.0, "max_ms": 0.0}

    mean_val = statistics.mean(durations)
    max_val = max(durations)
    if len(durations) >= 20:
        p95_val = statistics.quantiles(durations, n=20)[18]
    else:
        p95_val = max_val

    return {
        "count": float(len(durations)),
        "mean_ms": round(mean_val, 3),
        "p95_ms": round(p95_val, 3),
        "max_ms": round(max_val, 3),
    }


class TestHeadlessContractAndParsers(unittest.TestCase):
    """
    Bộ kiểm thử đơn vị & khế ước xử lý cho Headless E2E Test Engine.
    Bảo đảm 100% tính tất định cơ học, không phụ thuộc ngoại cảnh.
    """

    def test_cli_argument_construction(self):
        """Kịch bản AC-01: Cấu trúc tham số CLI agy tuân thủ nghiêm ngặt Headless-mode.md."""
        cmd = build_agy_command(
            prompt="Kiểm tra phiên",
            output_format="json",
            dangerously_skip_permissions=True,
            extra_args=["--effort", "low"],
            agy_executable="C:/mock/agy.exe",
        )

        self.assertEqual(cmd[0], "C:/mock/agy.exe")
        self.assertIn("-p", cmd)
        self.assertEqual(cmd[cmd.index("-p") + 1], "Kiểm tra phiên")
        self.assertIn("--output-format", cmd)
        self.assertEqual(cmd[cmd.index("--output-format") + 1], "json")
        self.assertIn("--dangerously-skip-permissions", cmd)
        self.assertIn("--effort", cmd)
        self.assertEqual(cmd[cmd.index("--effort") + 1], "low")

    def test_ndjson_parser_nominal(self):
        """Kịch bản AC-02: Phân tích cú pháp luồng NDJSON danh định với các sự kiện vòng đời."""
        ndjson_stream = (
            '{"event":"init","init":{"tools":["read_file","write_file"]}}\n'
            '{"event":"step_update","step_update":{"step_index":0,"state":"ACTIVE"}}\n'
            '{"event":"result","result":{"status":"SUCCESS","num_turns":1}}\n'
        )
        events, malformed = parse_ndjson_stream(ndjson_stream)
        self.assertEqual(len(events), 3)
        self.assertEqual(len(malformed), 0)
        self.assertEqual(events[0]["event"], "init")
        self.assertEqual(events[1]["event"], "step_update")
        self.assertEqual(events[2]["event"], "result")
        self.assertEqual(events[2]["result"]["status"], "SUCCESS")

    def test_ndjson_parser_with_bom_and_malformed_lines(self):
        """Kịch bản AC-03: Xử lý tiền tố BOM UTF-8 Windows '\\ufeff' và cô lập dòng hỏng."""
        mixed_stream = (
            '\ufeff{"event":"init","step":1}\n'
            '\n'
            'not_a_valid_json_line\n'
            '{"event":"result","result":{"status":"SUCCESS"}}\n'
        )
        events, malformed = parse_ndjson_stream(mixed_stream)
        self.assertEqual(len(events), 2)
        self.assertEqual(len(malformed), 1)
        self.assertEqual(malformed[0], "not_a_valid_json_line")
        self.assertEqual(events[0]["event"], "init")
        self.assertEqual(events[1]["event"], "result")

    def test_timeout_breach_enforcement(self):
        """Kịch bản AC-04: Giám sát và dứt khoát ngắt tiến trình con khi vượt ngưỡng timeout."""
        # Chạy một lệnh Python ngủ vượt quá timeout quy định
        py_exec = sys.executable
        fake_timeout_sec = 0.2
        start_t = time.perf_counter()
        try:
            subprocess.run(
                [py_exec, "-c", "import time; time.sleep(2.0)"],
                capture_output=True,
                text=True,
                timeout=fake_timeout_sec,
            )
            timed_out = False
        except subprocess.TimeoutExpired:
            timed_out = True
        elapsed = time.perf_counter() - start_t

        self.assertTrue(timed_out, "Tiến trình không kích hoạt TimeoutExpired")
        self.assertLess(elapsed, 1.5, f"Timeout không ngắt kịp thời: {elapsed}s")

    def test_footprint_telemetry_nominal_verification(self):
        """Kịch bản AC-05: Thẩm định thành công tập bản ghi telemetry từ tệp JSONL hợp lệ."""
        sample_entries = [
            {
                "timestamp": "2026-11-16 20:00:00.000",
                "guard": "workspace_guard",
                "event": "PostToolUse",
                "status": "CLEAN",
                "target": "src/feature.ts",
                "durationMs": 18.5,
                "details": {"inScope": True},
            },
            {
                "timestamp": "2026-11-16 20:00:01.000",
                "guard": "verification_gate",
                "event": "Stop",
                "status": "GATE_PASSED",
                "target": "Exit Code 0 verified",
                "durationMs": 22.1,
                "details": {"exitCode": 0},
            },
        ]

        with tempfile.TemporaryDirectory() as tmp_dir:
            log_file = os.path.join(tmp_dir, "footprints.jsonl")
            with open(log_file, "w", encoding="utf-8") as f:
                for item in sample_entries:
                    f.write(json.dumps(item) + "\n")

            parsed = verify_footprint_telemetry(min_expected_entries=2, log_path=log_file, max_duration_ms=35.0)
            self.assertEqual(len(parsed), 2)
            self.assertEqual(parsed[0]["guard"], "workspace_guard")
            self.assertEqual(parsed[1]["guard"], "verification_gate")

            metrics = calculate_footprint_metrics(parsed)
            self.assertEqual(metrics["count"], 2.0)
            self.assertLess(metrics["mean_ms"], 30.0)
            self.assertEqual(metrics["max_ms"], 22.1)

    def test_footprint_telemetry_threshold_breach_detection(self):
        """Kịch bản AC-06: Phát hiện và báo cáo khi độ trễ hook vượt quá ngưỡng trần 35ms."""
        slow_entries = [
            {
                "timestamp": "2026-11-16 20:00:00.000",
                "guard": "legacy_powershell_guard",
                "event": "PostToolUse",
                "status": "CLEAN",
                "target": "src/legacy.ts",
                "durationMs": 165.4,
                "details": {},
            }
        ]

        with tempfile.TemporaryDirectory() as tmp_dir:
            log_file = os.path.join(tmp_dir, "slow_footprints.jsonl")
            with open(log_file, "w", encoding="utf-8") as f:
                for item in slow_entries:
                    f.write(json.dumps(item) + "\n")

            with self.assertRaises(AssertionError) as ctx:
                verify_footprint_telemetry(min_expected_entries=1, log_path=log_file, max_duration_ms=35.0)
            self.assertIn("breached latency threshold", str(ctx.exception))


class TestAgyHeadlessLiveE2E(unittest.TestCase):
    """
    Bộ kiểm thử tích hợp thực địa E2E triệu gọi trực tiếp agy CLI trên môi trường Windows.
    Được bỏ qua an toàn nếu nhị phân agy chưa sẵn có trên máy trạm.
    """

    @classmethod
    def setUpClass(cls):
        cls.agy_bin = find_agy_binary()

    def setUp(self):
        if not self.agy_bin:
            self.skipTest("Bỏ qua kiểm thử thực địa: Không tìm thấy nhị phân agy trên PATH hoặc LocalAppData.")

    def test_live_agy_binary_available(self):
        """Kịch bản AC-07: Nhị phân agy CLI khả dụng và thực thi được trên môi trường Windows."""
        self.assertIsNotNone(self.agy_bin)
        self.assertTrue(os.path.exists(self.agy_bin))

    def test_live_headless_run_json_format(self):
        """Kịch bản AC-08: agy CLI Headless -p chạy thành công với --output-format json và exit code 0."""
        result = run_live_agy_session(
            prompt="Respond with exact text: OK",
            timeout_sec=60.0,
            output_format="json",
            agy_executable=self.agy_bin,
        )

        self.assertEqual(result.exit_code, 0, f"agy session thất bại: {result.stderr}")
        self.assertFalse(result.timed_out)
        self.assertIsNone(result.error)
        self.assertIsNotNone(result.result_json, "Không nhận được payload JSON kết quả từ agy")
        self.assertEqual(result.result_json.get("status"), "SUCCESS")
        self.assertNotIn("[HOOK_EXECUTION_ERROR]", result.stderr)

    def test_live_headless_run_stream_json(self):
        """Kịch bản AC-09: agy CLI Headless chạy ở chế độ stream-json, parser bắt trọn luồng NDJSON."""
        result = run_live_agy_session(
            prompt="Respond with text: Ping",
            timeout_sec=60.0,
            output_format="stream-json",
            agy_executable=self.agy_bin,
        )

        self.assertEqual(result.exit_code, 0, f"agy stream-json thất bại: {result.stderr}")
        self.assertFalse(result.timed_out)
        self.assertGreater(len(result.events), 0, "Không phân tích được sự kiện NDJSON nào từ stdout")

        event_types = [evt.get("event") for evt in result.events]
        self.assertIn("init", event_types, "Luồng stream thiếu sự kiện init")
        self.assertIn("result", event_types, "Luồng stream thiếu sự kiện result")

    def test_live_footprint_telemetry_audit(self):
        """Kịch bản AC-10: Kiểm toán nhật ký vết thực tế .agents/logs/guard-footprints.jsonl."""
        if not os.path.exists(DEFAULT_LOG_PATH):
            self.skipTest("Tệp nhật ký vết guard-footprints.jsonl chưa được tạo bởi engine.")

        entries = verify_footprint_telemetry(min_expected_entries=1, log_path=DEFAULT_LOG_PATH)
        self.assertGreater(len(entries), 0)

        metrics = calculate_footprint_metrics(entries)
        self.assertGreater(metrics["count"], 0)
        self.assertGreater(metrics["mean_ms"], 0.0)


if __name__ == "__main__":
    unittest.main()
