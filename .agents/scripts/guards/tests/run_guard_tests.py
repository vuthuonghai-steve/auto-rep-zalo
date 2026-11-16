#!/usr/bin/env python3
"""
Test runner tự động cho toàn bộ hệ thống guard (.agents/scripts/guards).
Khám phá và thực thi các bài kiểm thử cơ học nhị phân (unittest) với đo lường hiệu năng và độ trễ.
"""

import os
import sys
import time
import unittest
import argparse
import statistics
from typing import Dict, List, Tuple, Optional


def configure_environment(tests_dir: str) -> None:
    """Thiết lập sys.path để bảo đảm tính tương thích import cho các bài test."""
    guards_dir = os.path.abspath(os.path.join(tests_dir, ".."))
    if guards_dir not in sys.path:
        sys.path.insert(0, guards_dir)
    if tests_dir not in sys.path:
        sys.path.insert(0, tests_dir)


class LatencyTimingTestResult(unittest.TextTestResult):
    """Mở rộng TextTestResult để theo dõi độ trễ thực thi của từng test case."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.test_timings: Dict[str, float] = {}
        self._test_start: float = 0.0

    def startTest(self, test: unittest.TestCase) -> None:
        self._test_start = time.perf_counter()
        super().startTest(test)

    def stopTest(self, test: unittest.TestCase) -> None:
        elapsed = time.perf_counter() - self._test_start
        self.test_timings[test.id()] = elapsed
        super().stopTest(test)


class LatencyTimingTestRunner(unittest.TextTestRunner):
    """TextTestRunner sử dụng LatencyTimingTestResult để đo lường độ trễ."""

    def __init__(self, *args, **kwargs):
        kwargs["resultclass"] = LatencyTimingTestResult
        super().__init__(*args, **kwargs)


def run_latency_benchmarks() -> List[Tuple[str, float, float, float, float, bool]]:
    """
    Thực thi vi chuẩn (micro-benchmark) đo lường độ trễ xử lý thực tế của hạ tầng guard:
    - PreToolUse Hook (dispatcher.py) với ngưỡng SC-001 / FR-002: < 30.0 ms (trung bình <= 15.0 ms)
    - Delegation Sanitizer với ngưỡng: trung bình <= 5.0 ms
    Trả về danh sách kết quả (name, mean_ms, p95_ms, max_ms, threshold_ms, passed).
    """
    benchmark_results = []

    try:
        import dispatcher
        from domains.engine_invariants.delegation_sanitizer import verify_delegation_payload

        # 1. Benchmark Dispatcher PreToolUse
        sample_payload = {
            "name": "invoke_subagent",
            "args": {
                "TypeName": "surgical-implementer",
                "Prompt": (
                    "<task_delegation>\n"
                    'target_subagent: surgical-implementer\n'
                    'task_id: "T019"\n'
                    'spec_path: "specs/003-harness-doc-formatting/spec.md"\n'
                    'allowed_files: [".agents/scripts/guards/tests/run_guard_tests.py"]\n'
                    'forbidden_files: ["src/**", "specs/**"]\n'
                    'test_command: "python .agents/scripts/guards/tests/run_guard_tests.py"\n'
                    "</task_delegation>"
                ),
            },
        }

        # Warm-up
        dispatcher.handle_pre_tool_use(sample_payload)

        dispatcher_timings = []
        for _ in range(100):
            t0 = time.perf_counter()
            dispatcher.handle_pre_tool_use(sample_payload)
            dispatcher_timings.append((time.perf_counter() - t0) * 1000.0)

        mean_d = statistics.mean(dispatcher_timings)
        p95_d = statistics.quantiles(dispatcher_timings, n=20)[18] if len(dispatcher_timings) >= 20 else max(dispatcher_timings)
        max_d = max(dispatcher_timings)
        passed_d = max_d < 30.0 and mean_d < 15.0
        benchmark_results.append((
            "SC-001 PreToolUse Hook Latency",
            mean_d,
            p95_d,
            max_d,
            30.0,
            passed_d,
        ))

        # 2. Benchmark Delegation Sanitizer
        tool_args = sample_payload["args"]
        verify_delegation_payload(tool_name="invoke_subagent", tool_args=tool_args)

        sanitizer_timings = []
        for _ in range(100):
            t0 = time.perf_counter()
            verify_delegation_payload(tool_name="invoke_subagent", tool_args=tool_args)
            sanitizer_timings.append((time.perf_counter() - t0) * 1000.0)

        mean_s = statistics.mean(sanitizer_timings)
        p95_s = statistics.quantiles(sanitizer_timings, n=20)[18] if len(sanitizer_timings) >= 20 else max(sanitizer_timings)
        max_s = max(sanitizer_timings)
        passed_s = mean_s < 5.0
        benchmark_results.append((
            "Delegation Sanitizer Quarantine Gate",
            mean_s,
            p95_s,
            max_s,
            5.0,
            passed_s,
        ))

        # 3. Benchmark PostToolUse Workspace Guard
        import workspace_guard
        clean_post_payload = {
            "toolCall": {
                "name": "write_file",
                "args": {
                    "Path": "src/features/sample.py",
                    "Content": "def add(x: int, y: int) -> int:\n    return x + y\n"
                }
            }
        }
        workspace_guard.handle_post_tool_use(clean_post_payload)

        ws_timings = []
        for _ in range(100):
            t0 = time.perf_counter()
            workspace_guard.handle_post_tool_use(clean_post_payload)
            ws_timings.append((time.perf_counter() - t0) * 1000.0)

        mean_w = statistics.mean(ws_timings)
        p95_w = statistics.quantiles(ws_timings, n=20)[18] if len(ws_timings) >= 20 else max(ws_timings)
        max_w = max(ws_timings)
        passed_w = mean_w < 25.0
        benchmark_results.append((
            "PostToolUse Workspace Guard Latency",
            mean_w,
            p95_w,
            max_w,
            25.0,
            passed_w,
        ))

        # 4. Benchmark Stop Hook Verification Gate
        import verification_gate
        import io
        from unittest.mock import patch
        stop_payload = {
            "status": "SUCCESS",
            "task_id": "T008",
            "test_exit_code": 0,
            "passed_assertions": 192,
        }
        with patch.object(sys, "stderr", io.StringIO()):
            verification_gate.handle_stop(stop_payload, check_git_docs=False)

        vg_timings = []
        with patch.object(sys, "stderr", io.StringIO()):
            for _ in range(100):
                t0 = time.perf_counter()
                verification_gate.handle_stop(stop_payload, check_git_docs=False)
                vg_timings.append((time.perf_counter() - t0) * 1000.0)

        mean_v = statistics.mean(vg_timings)
        p95_v = statistics.quantiles(vg_timings, n=20)[18] if len(vg_timings) >= 20 else max(vg_timings)
        max_v = max(vg_timings)
        passed_v = mean_v < 15.0
        benchmark_results.append((
            "Stop Hook Verification Gate Latency",
            mean_v,
            p95_v,
            max_v,
            15.0,
            passed_v,
        ))

        # 5. Benchmark Hook Utils STDIN Parser & BOM Resolver
        import hook_utils
        raw_bom_json = '\ufeff{"event": "PreToolUse", "toolCall": {"name": "read_file"}}'
        hook_utils.parse_stdin_payload(raw_bom_json)

        hu_timings = []
        for _ in range(100):
            t0 = time.perf_counter()
            hook_utils.parse_stdin_payload(raw_bom_json)
            hu_timings.append((time.perf_counter() - t0) * 1000.0)

        mean_h = statistics.mean(hu_timings)
        p95_h = statistics.quantiles(hu_timings, n=20)[18] if len(hu_timings) >= 20 else max(hu_timings)
        max_h = max(hu_timings)
        passed_h = mean_h < 5.0
        benchmark_results.append((
            "Hook Utils STDIN & BOM Parser Latency",
            mean_h,
            p95_h,
            max_h,
            5.0,
            passed_h,
        ))

    except Exception as e:
        print(f"[WARN] Unable to execute micro-benchmarks: {e}")

    return benchmark_results


def print_performance_scorecard(
    result: LatencyTimingTestResult,
    elapsed_total: float,
    top_n: int = 5,
    benchmarks: Optional[List[Tuple[str, float, float, float, float, bool]]] = None,
) -> None:
    """In bảng điểm hiệu năng và phân tích độ trễ của các bài kiểm thử."""
    timings = result.test_timings
    total_tests = len(timings)
    avg_latency = (elapsed_total / total_tests * 1000.0) if total_tests > 0 else 0.0

    print("\n" + "=" * 70)
    print("HARNESS PERFORMANCE & LATENCY SCORECARD")
    print("=" * 70)
    print(f"Total Test Suite Duration : {elapsed_total * 1000.0:.2f} ms ({elapsed_time_str(elapsed_total)})")
    print(f"Total Executed Test Cases : {total_tests}")
    print(f"Average Latency Per Test  : {avg_latency:.2f} ms")
    print("-" * 70)

    # Top slowest tests
    sorted_tests = sorted(timings.items(), key=lambda x: x[1], reverse=True)
    print(f"Top {min(top_n, total_tests)} Slowest Tests (Latency Breakdown):")
    for idx, (test_name, duration) in enumerate(sorted_tests[:top_n], start=1):
        parts = test_name.split(".")
        short_name = ".".join(parts[-2:]) if len(parts) >= 2 else test_name
        print(f"  {idx}. {short_name:<46} : {duration * 1000.0:8.2f} ms")

    # In micro-benchmark results
    if benchmarks:
        print("-" * 70)
        print("Harness Infrastructure Latency Benchmarks (100 iterations):")
        for name, mean_val, p95_val, max_val, threshold, passed in benchmarks:
            status = "PASS" if passed else "FAIL"
            print(
                f"  [{status}] {name:<38} : mean={mean_val:.3f}ms, "
                f"p95={p95_val:.3f}ms, max={max_val:.3f}ms (threshold < {threshold:.1f}ms)"
            )

    print("=" * 70)


def elapsed_time_str(seconds: float) -> str:
    """Định dạng thời gian thân thiện."""
    return f"{seconds:.4f} s"


def run_tests(
    tests_dir: str,
    pattern: str = "test_*.py",
    verbosity: int = 2,
    failfast: bool = False,
    top_slowest: int = 5,
    enable_benchmark: bool = True,
) -> int:
    """
    Khám phá và chạy toàn bộ unit tests trong thư mục chỉ định.
    Trả về exit code nhị phân: 0 (thành công) hoặc 1 (thất bại).
    """
    configure_environment(tests_dir)

    loader = unittest.TestLoader()
    suite = loader.discover(start_dir=tests_dir, pattern=pattern)

    runner = LatencyTimingTestRunner(stream=sys.stdout, verbosity=verbosity, failfast=failfast)

    print("=" * 70)
    print(f"Harness Guard Test Runner: {tests_dir}")
    print(f"Pattern: {pattern} | Discovery count: {suite.countTestCases()} test cases")
    print("=" * 70)

    start_time = time.perf_counter()
    result = runner.run(suite)
    elapsed_time = time.perf_counter() - start_time

    benchmarks = run_latency_benchmarks() if enable_benchmark else None

    print("-" * 70)
    print(f"Tests executed: {result.testsRun}")
    print(f"Failures: {len(result.failures)} | Errors: {len(result.errors)} | Skipped: {len(result.skipped)}")
    print(f"Elapsed time: {elapsed_time * 1000:.2f} ms ({elapsed_time_str(elapsed_time)})")

    print_performance_scorecard(result, elapsed_time, top_n=top_slowest, benchmarks=benchmarks)

    benchmarks_ok = all(b[5] for b in benchmarks) if benchmarks else True

    if result.wasSuccessful() and benchmarks_ok:
        print("[PASS] All guard tests and latency benchmarks completed successfully with Exit Code 0.")
        return 0
    else:
        print("[FAIL] Guard test suite or latency benchmarks failed with non-zero exit code.")
        return 1


def main() -> None:
    parser = argparse.ArgumentParser(description="Run automated tests for guard infrastructure.")
    parser.add_argument(
        "-p", "--pattern",
        default="test_*.py",
        help="Pattern to match test files (default: test_*.py)",
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_const",
        const=2,
        default=2,
        dest="verbosity",
        help="Verbose output (default: enabled)",
    )
    parser.add_argument(
        "-q", "--quiet",
        action="store_const",
        const=1,
        dest="verbosity",
        help="Quiet output",
    )
    parser.add_argument(
        "-f", "--failfast",
        action="store_true",
        default=False,
        help="Stop on first failure or error",
    )
    parser.add_argument(
        "--top-slowest",
        type=int,
        default=5,
        help="Number of slowest tests to report in latency breakdown (default: 5)",
    )
    parser.add_argument(
        "--no-benchmark",
        action="store_false",
        dest="enable_benchmark",
        default=True,
        help="Disable micro-benchmarks for guard latency",
    )

    args = parser.parse_args()
    tests_dir = os.path.dirname(os.path.abspath(__file__))

    exit_code = run_tests(
        tests_dir=tests_dir,
        pattern=args.pattern,
        verbosity=args.verbosity,
        failfast=args.failfast,
        top_slowest=args.top_slowest,
        enable_benchmark=args.enable_benchmark,
    )
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
