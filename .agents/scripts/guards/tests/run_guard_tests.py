#!/usr/bin/env python3
"""
Test runner tự động cho toàn bộ hệ thống guard (.agents/scripts/guards).
Khám phá và thực thi các bài kiểm thử cơ học nhị phân (unittest) với đo lường hiệu năng.
"""

import os
import sys
import time
import unittest
import argparse


def configure_environment(tests_dir: str) -> None:
    """Thiết lập sys.path để bảo đảm tính tương thích import cho các bài test."""
    guards_dir = os.path.abspath(os.path.join(tests_dir, ".."))
    if guards_dir not in sys.path:
        sys.path.insert(0, guards_dir)
    if tests_dir not in sys.path:
        sys.path.insert(0, tests_dir)


def run_tests(tests_dir: str, pattern: str = "test_*.py", verbosity: int = 2, failfast: bool = False) -> int:
    """
    Khám phá và chạy toàn bộ unit tests trong thư mục chỉ định.
    Trả về exit code nhị phân: 0 (thành công) hoặc 1 (thất bại).
    """
    configure_environment(tests_dir)

    loader = unittest.TestLoader()
    suite = loader.discover(start_dir=tests_dir, pattern=pattern)

    runner = unittest.TextTestRunner(stream=sys.stdout, verbosity=verbosity, failfast=failfast)

    print("=" * 70)
    print(f"Harness Guard Test Runner: {tests_dir}")
    print(f"Pattern: {pattern} | Discovery count: {suite.countTestCases()} test cases")
    print("=" * 70)

    start_time = time.perf_counter()
    result = runner.run(suite)
    elapsed_time = time.perf_counter() - start_time

    print("-" * 70)
    print(f"Tests executed: {result.testsRun}")
    print(f"Failures: {len(result.failures)} | Errors: {len(result.errors)} | Skipped: {len(result.skipped)}")
    print(f"Elapsed time: {elapsed_time * 1000:.2f} ms ({elapsed_time:.4f} s)")
    print("=" * 70)

    if result.wasSuccessful():
        print("[PASS] All guard tests completed successfully with Exit Code 0.")
        return 0
    else:
        print("[FAIL] Guard test suite failed with non-zero exit code.")
        return 1


def main() -> None:
    parser = argparse.ArgumentParser(description="Run automated tests for guard infrastructure.")
    parser.add_argument(
        "-p", "--pattern",
        default="test_*.py",
        help="Pattern to match test files (default: test_*.py)"
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_const",
        const=2,
        default=2,
        dest="verbosity",
        help="Verbose output (default: enabled)"
    )
    parser.add_argument(
        "-q", "--quiet",
        action="store_const",
        const=1,
        dest="verbosity",
        help="Quiet output"
    )
    parser.add_argument(
        "-f", "--failfast",
        action="store_true",
        default=False,
        help="Stop on first failure or error"
    )

    args = parser.parse_args()
    tests_dir = os.path.dirname(os.path.abspath(__file__))

    exit_code = run_tests(
        tests_dir=tests_dir,
        pattern=args.pattern,
        verbosity=args.verbosity,
        failfast=args.failfast,
    )
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
