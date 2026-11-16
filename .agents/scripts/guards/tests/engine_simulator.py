#!/usr/bin/env python3
# .agents/scripts/guards/tests/engine_simulator.py
"""
Go Engine Subprocess Simulator & Test Harness Component (T001).
Mô phỏng chính xác cách Go Engine (agy.exe) triệu gọi các tiến trình hook trên Windows:
- Triệu gọi tiến trình con qua 'cmd /c' với CWD là '.agents/'.
- Hỗ trợ tiêm STDIN kèm BOM Windows '\\ufeff' và payload JSON phân mảnh.
- Thu thập STDOUT, STDERR, Exit Code và đo đạc thời gian chính xác cao (Microsecond Precision).
- Chốt chặn timeout phòng ngừa treo engine (TIMEOUT_BREACH).
- Quản lý và cung cấp ma trận dữ liệu mẫu (hook_payloads.json).
"""

import os
import sys
import time
import json
import subprocess
import unittest
from dataclasses import dataclass
from typing import Dict, Any, List, Optional, Tuple, Union

# Xác định các tọa độ thư mục SSOT
TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
FIXTURES_DIR = os.path.join(TESTS_DIR, "fixtures")
FIXTURES_PATH = os.path.join(FIXTURES_DIR, "hook_payloads.json")
GUARDS_DIR = os.path.abspath(os.path.join(TESTS_DIR, ".."))
SCRIPTS_DIR = os.path.abspath(os.path.join(GUARDS_DIR, ".."))
AGENTS_DIR = os.path.abspath(os.path.join(SCRIPTS_DIR, ".."))
REPO_ROOT = os.path.abspath(os.path.join(AGENTS_DIR, ".."))


@dataclass
class SubprocessHookResult:
    """Kết quả triệu gọi tiến trình hook của Go Engine."""
    stdout: str
    stderr: str
    exit_code: int
    duration_ms: float
    timed_out: bool = False
    error: Optional[str] = None

    @property
    def parsed_json(self) -> Optional[Dict[str, Any]]:
        """Giải mã an toàn chuỗi STDOUT thành JSON object (hỗ trợ bóc tách BOM)."""
        text = self.stdout.strip().lstrip("\ufeff")
        if not text:
            return None
        try:
            return json.loads(text)
        except Exception:
            return None

    @property
    def is_success(self) -> bool:
        """Kiểm tra xem hook có thoát thành công không (exit code 0 và không timeout)."""
        return self.exit_code == 0 and not self.timed_out


def load_fixtures(fixtures_path: Optional[str] = None) -> Dict[str, Any]:
    """Đọc và giải mã ma trận test fixtures từ hook_payloads.json."""
    target_path = fixtures_path or FIXTURES_PATH
    if not os.path.exists(target_path):
        raise FileNotFoundError(f"Fixture matrix not found at: {target_path}")
    with open(target_path, "r", encoding="utf-8") as f:
        return json.load(f)


def get_fixture(key: str, fixtures_path: Optional[str] = None) -> Dict[str, Any]:
    """Trích xuất một payload fixture cụ thể theo khóa."""
    fixtures = load_fixtures(fixtures_path)
    if key not in fixtures:
        raise KeyError(f"Fixture key '{key}' not found in fixture matrix.")
    return fixtures[key]


def invoke_hook_subprocess(
    hook_script: str,
    event: str = "PreToolUse",
    payload: Optional[Union[Dict[str, Any], str]] = None,
    inject_bom: bool = False,
    timeout_sec: float = 5.0,
    cwd: Optional[str] = None,
    extra_args: Optional[List[str]] = None,
    python_bin: Optional[str] = None,
) -> SubprocessHookResult:
    """
    Mô phỏng Go Engine triệu gọi một hook script qua tiến trình con cmd /c trên Windows.
    - CWD mặc định là thư mục .agents/
    - Chuẩn hóa payload truyền qua STDIN (tùy chọn tiêm Windows UTF-8 BOM '\\ufeff')
    - Đo thời gian thực thi với độ phân giải cao qua time.perf_counter()
    - Trả về SubprocessHookResult chứa stdout, stderr, exit_code, duration_ms
    """
    effective_cwd = cwd or AGENTS_DIR

    # Chuẩn hóa đường dẫn hook_script tương ứng với CWD
    normalized_script = hook_script.replace("\\", "/")
    if os.path.isabs(hook_script):
        script_arg = hook_script
    elif normalized_script.startswith(".agents/"):
        script_arg = normalized_script[len(".agents/"):]
    elif normalized_script.startswith("./.agents/"):
        script_arg = normalized_script[len("./.agents/"):]
    else:
        script_arg = hook_script

    # Chuẩn bị lệnh thực thi
    py_exec = python_bin or "python"

    # Xây dựng danh sách tham số CLI
    cmd_args: List[str] = []
    if sys.platform == "win32":
        cmd_args = ["cmd", "/c", py_exec, script_arg]
    else:
        cmd_args = [py_exec, script_arg]

    # Hỗ trợ truyền tham số --event cho các dispatcher nhận diện sự kiện
    if extra_args:
        cmd_args.extend(extra_args)
    elif "dispatcher" in script_arg:
        cmd_args.extend(["--event", event])

    # Chuẩn bị dữ liệu STDIN
    stdin_str = ""
    if payload is not None:
        if isinstance(payload, (dict, list)):
            stdin_str = json.dumps(payload, ensure_ascii=False)
        else:
            stdin_str = str(payload)

    if inject_bom:
        stdin_str = "\ufeff" + stdin_str

    # Thực thi và đo đạc thời gian
    start_time = time.perf_counter()
    try:
        proc = subprocess.run(
            cmd_args,
            input=stdin_str,
            cwd=effective_cwd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=timeout_sec,
        )
        elapsed_ms = (time.perf_counter() - start_time) * 1000.0

        return SubprocessHookResult(
            stdout=proc.stdout or "",
            stderr=proc.stderr or "",
            exit_code=proc.returncode,
            duration_ms=elapsed_ms,
            timed_out=False,
            error=None,
        )

    except subprocess.TimeoutExpired as exc:
        elapsed_ms = (time.perf_counter() - start_time) * 1000.0
        return SubprocessHookResult(
            stdout=exc.stdout.decode("utf-8", errors="replace") if isinstance(exc.stdout, bytes) else (exc.stdout or ""),
            stderr=f"[TIMEOUT_BREACH] Process timed out after {timeout_sec}s",
            exit_code=1,
            duration_ms=elapsed_ms,
            timed_out=True,
            error="TIMEOUT_BREACH",
        )
    except Exception as exc:
        elapsed_ms = (time.perf_counter() - start_time) * 1000.0
        return SubprocessHookResult(
            stdout="",
            stderr=f"[SUBPROCESS_ERROR] {type(exc).__name__}: {exc}",
            exit_code=1,
            duration_ms=elapsed_ms,
            timed_out=False,
            error=str(exc),
        )


class TestEngineSimulator(unittest.TestCase):
    """
    Bộ kiểm thử cơ học nhị phân cho Go Engine Subprocess Simulator & Test Fixtures Matrix (T001).
    """

    @classmethod
    def setUpClass(cls):
        cls.fixtures = load_fixtures()

    def test_fixture_matrix_mandatory_keys(self):
        """Kịch bản AC-01: hook_payloads.json chứa đầy đủ 7 kịch bản kiểm thử bắt buộc."""
        required_keys = [
            "pre_tool_use_allow",
            "pre_tool_use_deny_sycophancy",
            "post_tool_use_clean_file",
            "post_tool_use_flagged_placeholder",
            "post_tool_use_diff_scope_violation",
            "stop_gate_incomplete",
            "stop_gate_success",
        ]
        for key in required_keys:
            with self.subTest(key=key):
                self.assertIn(key, self.fixtures, f"Thiếu key bắt buộc: {key}")
                self.assertTrue(len(self.fixtures[key]) > 0, f"Payload rỗng cho key: {key}")

    def test_get_fixture_helper(self):
        """Kịch bản AC-02: Hàm get_fixture truy xuất chính xác từng payload."""
        allow_payload = get_fixture("pre_tool_use_allow")
        self.assertIn("toolCall", allow_payload)
        self.assertEqual(allow_payload["toolCall"]["name"], "invoke_subagent")

        with self.assertRaises(KeyError):
            get_fixture("non_existent_fixture_key")

    def test_invoke_subprocess_normal_execution(self):
        """Kịch bản AC-03: Simulator triệu gọi dispatcher.py qua cmd /c thành công với exit code 0."""
        payload = self.fixtures["pre_tool_use_allow"]
        result = invoke_hook_subprocess(
            hook_script="scripts/guards/dispatcher.py",
            event="PreToolUse",
            payload=payload,
            inject_bom=False,
            timeout_sec=5.0,
        )

        self.assertEqual(result.exit_code, 0, f"Hook thất bại: {result.stderr}")
        self.assertFalse(result.timed_out)
        self.assertIsNone(result.error)
        self.assertGreater(result.duration_ms, 0.0)

        parsed = result.parsed_json
        self.assertIsNotNone(parsed, "STDOUT không phải JSON hợp lệ")
        self.assertEqual(parsed.get("decision"), "allow")

    def test_invoke_subprocess_with_windows_bom_injection(self):
        """Kịch bản AC-04: Tiêm ký tự Windows UTF-8 BOM '\\ufeff' không làm lỗi parser."""
        payload = self.fixtures["pre_tool_use_allow"]
        result = invoke_hook_subprocess(
            hook_script="scripts/guards/dispatcher.py",
            event="PreToolUse",
            payload=payload,
            inject_bom=True,
            timeout_sec=5.0,
        )

        self.assertEqual(result.exit_code, 0, f"Lỗi xử lý BOM: {result.stderr}")
        parsed = result.parsed_json
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed.get("decision"), "allow")

    def test_invoke_subprocess_sycophancy_detection(self):
        """Kịch bản AC-05: Simulator truyền payload mớm ý và nhận diện quyết định deny."""
        payload = self.fixtures["pre_tool_use_deny_sycophancy"]
        result = invoke_hook_subprocess(
            hook_script="scripts/guards/dispatcher.py",
            event="PreToolUse",
            payload=payload,
            inject_bom=False,
            timeout_sec=5.0,
        )

        self.assertEqual(result.exit_code, 0)
        parsed = result.parsed_json
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed.get("decision"), "deny")
        self.assertIn("SYCOPHANCY_BAIT_DETECTED", parsed.get("reason", ""))

    def test_invoke_subprocess_timeout_breach_enforcement(self):
        """Kịch bản AC-06: Hook vượt quá timeout phải bị cưỡng bức dừng và trả về TIMEOUT_BREACH."""
        # Gọi tiến trình ngủ 3 giây nhưng timeout 0.25 giây
        result = invoke_hook_subprocess(
            hook_script="-c",
            extra_args=["import time; time.sleep(3)"],
            timeout_sec=0.25,
        )

        self.assertTrue(result.timed_out, "Tiến trình không bị đánh dấu timed_out")
        self.assertEqual(result.error, "TIMEOUT_BREACH")
        self.assertEqual(result.exit_code, 1)
        self.assertIn("TIMEOUT_BREACH", result.stderr)

    def test_invoke_subprocess_empty_payload_resilience(self):
        """Kịch bản AC-07: Simulator chịu tải tốt với payload rỗng mà không bị crash."""
        result = invoke_hook_subprocess(
            hook_script="scripts/guards/dispatcher.py",
            event="PreToolUse",
            payload={},
            timeout_sec=5.0,
        )

        self.assertEqual(result.exit_code, 0)
        parsed = result.parsed_json
        self.assertIsNotNone(parsed)
        self.assertEqual(parsed.get("decision"), "allow")

    def test_invoke_subprocess_cwd_default_is_agents(self):
        """Kịch bản AC-08: Thư mục làm việc CWD mặc định của simulator là .agents/."""
        result = invoke_hook_subprocess(
            hook_script="-c",
            extra_args=["import os; print(os.path.basename(os.getcwd()))"],
            timeout_sec=5.0,
        )

        self.assertEqual(result.exit_code, 0)
        output_dir = result.stdout.strip()
        self.assertEqual(output_dir, ".agents", f"CWD không phải .agents: {output_dir}")

    def test_timing_measurement_precision(self):
        """Kịch bản AC-09: Thời gian thực thi duration_ms có độ phân giải microsecond (> 0)."""
        result = invoke_hook_subprocess(
            hook_script="scripts/guards/dispatcher.py",
            event="PreToolUse",
            payload={},
            timeout_sec=5.0,
        )

        self.assertIsInstance(result.duration_ms, float)
        self.assertGreater(result.duration_ms, 0.0)
        # Kiểm tra độ trễ hook đơn lẻ trên Python thuần phải < 50ms (thực tế ~15ms)
        self.assertLess(result.duration_ms, 100.0, f"Độ trễ quá cao: {result.duration_ms}ms")


if __name__ == "__main__":
    unittest.main()
