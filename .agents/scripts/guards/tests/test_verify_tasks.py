#!/usr/bin/env python3
# .agents/scripts/guards/tests/test_verify_tasks.py
"""
Bộ kiểm thử đơn vị cơ học nhị phân cho verify-tasks.py (Feature 005 - Task T009).
Bao phủ 100% các kịch bản đối kháng theo Tài Liệu 2: Boundary & Edge Test Suite Matrix:
1. TC-GIT-01: Task chuyển [x] nhưng companion test thất bại (Exit Code != 0) -> [TASK_TEST_FAILED]
2. TC-GIT-02: Task chuyển [x] nhưng tệp khai báo không tồn tại trên đĩa -> [TASK_FILE_MISSING]
3. TC-GIT-03: Task chuyển [x] hợp lệ (Test Exit Code 0 và tệp đầy đủ trên đĩa) -> PASS (Exit Code 0)
4. TC-GIT-04: Git commit không thay đổi tasks.md (diff rỗng) -> PASS (Exit Code 0)
5. TC-GIT-05: Commit nhiều task cùng lúc: 1 task pass, 1 task fail -> FAIL (Exit Code 1, [TASK_TEST_FAILED])
6. Phân tích task node đa dòng, trích xuất companion test và target files.
7. Xử lý timeout khi companion test vượt quá 10 giây -> [TASK_TEST_TIMEOUT]
8. CLI Execution với sys.argv và bắt mã thoát sys.exit(0/1).
"""

import os
import sys
import io
import tempfile
import unittest
import importlib
from unittest.mock import patch

# Thiết lập đường dẫn import
TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
GUARDS_DIR = os.path.abspath(os.path.join(TESTS_DIR, ".."))
if GUARDS_DIR not in sys.path:
    sys.path.insert(0, GUARDS_DIR)
if TESTS_DIR not in sys.path:
    sys.path.insert(0, TESTS_DIR)

# Nạp động module verify-tasks (có chứa ký tự gạch nối)
verify_tasks = importlib.import_module("verify-tasks")
verify_task_transitions = verify_tasks.verify_task_transitions
parse_task_nodes = verify_tasks.parse_task_nodes
extract_transitioned_tasks = verify_tasks.extract_transitioned_tasks
extract_target_files_from_block = verify_tasks.extract_target_files_from_block
get_repo_root = verify_tasks.get_repo_root


class TestExtractTaskNodes(unittest.TestCase):
    """Kiểm thử trích xuất và phân tích cấu trúc task node từ tasks.md."""

    def test_parse_single_task_node(self):
        """Kịch bản danh định: Phân tích 1 task node hoàn chỉnh."""
        content = """
- [ ] T001 Xây dựng module schema validator
  *Target file*: `.agents/schemas/completion_payload.schema.json`
  *Companion Test*: `python -m json.tool .agents/schemas/completion_payload.schema.json`
"""
        nodes = parse_task_nodes(content)
        self.assertIn("T001", nodes)
        node = nodes["T001"]
        self.assertEqual(node["task_id"], "T001")
        self.assertEqual(node["state"], "")
        self.assertEqual(
            node["companion_test"],
            "python -m json.tool .agents/schemas/completion_payload.schema.json",
        )
        self.assertEqual(
            node["target_files"],
            [".agents/schemas/completion_payload.schema.json"],
        )

    def test_parse_multiple_task_nodes_mixed_states(self):
        """Kịch bản phân tích nhiều task node với trạng thái đan xen [x] và [ ]."""
        content = """
- [x] T001 Task completed
  *Target file*: `src/done.py`
  *Companion Test*: `python -c "print('ok')"`

- [ ] T002 Task pending
  *Target file*: `src/pending.py`
  *Companion Test*: `python -c "print('pending')"`
"""
        nodes = parse_task_nodes(content)
        self.assertEqual(len(nodes), 2)
        self.assertEqual(nodes["T001"]["state"], "x")
        self.assertEqual(nodes["T002"]["state"], "")

    def test_parse_multiple_target_files(self):
        """Kịch bản task có nhiều tệp mục tiêu (phân cách bằng dấu phẩy và backtick)."""
        content = """
- [ ] T003 Task multi files
  *Target files*: `src/a.ts`, `src/b.ts`, `src/c.ts`
  *Companion Test*: `bun test`
"""
        nodes = parse_task_nodes(content)
        self.assertIn("T003", nodes)
        self.assertEqual(nodes["T003"]["target_files"], ["src/a.ts", "src/b.ts", "src/c.ts"])

    def test_parse_task_without_companion_test(self):
        """Kịch bản task thiếu dòng khai báo Companion Test."""
        content = """
- [ ] T004 Task missing test
  *Target file*: `src/foo.py`
"""
        nodes = parse_task_nodes(content)
        self.assertIn("T004", nodes)
        self.assertIsNone(nodes["T004"]["companion_test"])


class TestExtractTransitionedTasks(unittest.TestCase):
    """Kiểm thử trích xuất các task chuyển đổi trạng thái từ [ ] sang [x] từ git diff."""

    def test_nominal_transition_unchecked_to_checked(self):
        """Kịch bản danh định: 1 task chuyển từ [ ] sang [x]."""
        diff = """
--- a/tasks.md
+++ b/tasks.md
@@ -10,1 +10,1 @@
-- [ ] T001 Xây dựng schema
+- [x] T001 Xây dựng schema
"""
        transitioned = extract_transitioned_tasks(diff)
        self.assertEqual(transitioned, ["T001"])

    def test_task_already_checked_description_change_ignored(self):
        """Task đã hoàn thành [x] từ trước chỉ sửa đổi mô tả thì BỎ QUA."""
        diff = """
--- a/tasks.md
+++ b/tasks.md
@@ -10,1 +10,1 @@
-- [x] T001 Cũ
+- [x] T001 Mới đã sửa chính tả
"""
        transitioned = extract_transitioned_tasks(diff)
        self.assertEqual(transitioned, [])

    def test_task_reopened_unchecked_ignored(self):
        """Task chuyển ngược từ [x] sang [ ] (mở lại) không kích hoạt kiểm thử."""
        diff = """
--- a/tasks.md
+++ b/tasks.md
@@ -10,1 +10,1 @@
-- [x] T001 Hoàn thành
+- [ ] T001 Mở lại task
"""
        transitioned = extract_transitioned_tasks(diff)
        self.assertEqual(transitioned, [])

    def test_brand_new_checked_task_detected(self):
        """Task mới thêm vào đã được đánh dấu [x] phải được phát hiện để kiểm định."""
        diff = """
--- a/tasks.md
+++ b/tasks.md
@@ -20,0 +21,3 @@
+ - [x] T005 Task bổ sung đã hoàn thành
+   *Target file*: `src/extra.py`
+   *Companion Test*: `python test.py`
"""
        transitioned = extract_transitioned_tasks(diff)
        self.assertEqual(transitioned, ["T005"])

    def test_empty_or_non_tasks_diff(self):
        """Diff rỗng hoặc không có thay đổi task checkbox trả về danh sách rỗng."""
        self.assertEqual(extract_transitioned_tasks(""), [])
        self.assertEqual(extract_transitioned_tasks("diff --git a/README.md b/README.md\n+hello"), [])

    def test_multi_task_transitions_sorted(self):
        """Nhiều task đồng thời chuyển trạng thái được phát hiện và sắp xếp thứ tự."""
        diff = """
- - [ ] T002 Task hai
+ - [x] T002 Task hai
- - [ ] T001 Task một
+ - [x] T001 Task một
"""
        transitioned = extract_transitioned_tasks(diff)
        self.assertEqual(transitioned, ["T001", "T002"])


class TestBoundaryScenariosMatrix(unittest.TestCase):
    """
    Kiểm chứng toàn diện 5 kịch bản biên đối kháng (TC-GIT-01 đến TC-GIT-05)
    theo Tài Liệu 2: Boundary & Edge Test Suite Matrix.
    """

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.repo_root = os.path.abspath(self.temp_dir.name)
        self.tasks_file = os.path.join(self.repo_root, "tasks.md")

        # Tạo tệp mục tiêu thật cho các task
        self.real_file_path = os.path.join(self.repo_root, "src", "real_module.py")
        os.makedirs(os.path.dirname(self.real_file_path), exist_ok=True)
        with open(self.real_file_path, "w", encoding="utf-8") as f:
            f.write("def compute():\n    return 42\n")

        # Nội dung tasks.md mẫu bao hàm các trường hợp
        py_exec = sys.executable
        tasks_content = f"""
- [ ] T001 Task hợp lệ danh định
  *Target file*: `src/real_module.py`
  *Companion Test*: `"{py_exec}" -c "import sys; sys.exit(0)"`

- [ ] T002 Task companion test thất bại
  *Target file*: `src/real_module.py`
  *Companion Test*: `"{py_exec}" -c "import sys; sys.exit(1)"`

- [ ] T003 Task khai báo tệp ảo không tồn tại
  *Target file*: `src/ghost_file.py`
  *Companion Test*: `"{py_exec}" -c "import sys; sys.exit(0)"`

- [ ] T004 Task companion test timeout
  *Target file*: `src/real_module.py`
  *Companion Test*: `"{py_exec}" -c "import time; time.sleep(15)"`
"""
        with open(self.tasks_file, "w", encoding="utf-8") as f:
            f.write(tasks_content)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_tc_git_01_companion_test_failed(self):
        """
        TC-GIT-01: Task chuyển [x] nhưng companion test thất bại (Exit Code != 0).
        Kỳ vọng: Hook từ chối (ok=False) kèm mã lỗi [TASK_TEST_FAILED].
        """
        diff = "- - [ ] T002 Task companion test thất bại\n+ - [x] T002 Task companion test thất bại\n"
        ok, errors = verify_task_transitions(
            self.tasks_file, repo_root=self.repo_root, diff_text=diff
        )
        self.assertFalse(ok)
        self.assertGreater(len(errors), 0)
        self.assertTrue(any("[TASK_TEST_FAILED]" in err for err in errors))
        self.assertTrue(any("Exit Code 1" in err for err in errors))

    def test_tc_git_02_task_file_missing(self):
        """
        TC-GIT-02: Task chuyển [x] nhưng tệp khai báo không tồn tại trên đĩa.
        Kỳ vọng: Hook từ chối (ok=False) kèm mã lỗi [TASK_FILE_MISSING].
        """
        diff = "- - [ ] T003 Task khai báo tệp ảo\n+ - [x] T003 Task khai báo tệp ảo\n"
        ok, errors = verify_task_transitions(
            self.tasks_file, repo_root=self.repo_root, diff_text=diff
        )
        self.assertFalse(ok)
        self.assertGreater(len(errors), 0)
        self.assertTrue(any("[TASK_FILE_MISSING]" in err for err in errors))
        self.assertTrue(any("ghost_file.py" in err for err in errors))

    def test_tc_git_03_task_transition_valid_pass(self):
        """
        TC-GIT-03: Task chuyển [x] hợp lệ (Test Exit Code 0 và tệp tồn tại đầy đủ).
        Kỳ vọng: Hook cho phép commit thành công (ok=True, errors rỗng).
        """
        diff = "- - [ ] T001 Task hợp lệ danh định\n+ - [x] T001 Task hợp lệ danh định\n"
        ok, errors = verify_task_transitions(
            self.tasks_file, repo_root=self.repo_root, diff_text=diff
        )
        self.assertTrue(ok)
        self.assertEqual(len(errors), 0)

    def test_tc_git_04_no_tasks_diff_bypass(self):
        """
        TC-GIT-04: Git commit không thay đổi tasks.md (diff rỗng).
        Kỳ vọng: Hook cho phép qua (ok=True), không kích hoạt companion test thừa.
        """
        ok, errors = verify_task_transitions(
            self.tasks_file, repo_root=self.repo_root, diff_text=""
        )
        self.assertTrue(ok)
        self.assertEqual(len(errors), 0)

    def test_tc_git_05_multi_task_one_pass_one_fail(self):
        """
        TC-GIT-05: Commit nhiều task cùng lúc: 1 task pass (T001), 1 task fail (T002).
        Kỳ vọng: Hook từ chối toàn bộ commit (ok=False), báo cáo đúng [TASK_TEST_FAILED].
        """
        diff = """
- - [ ] T001 Task hợp lệ danh định
+ - [x] T001 Task hợp lệ danh định
- - [ ] T002 Task companion test thất bại
+ - [x] T002 Task companion test thất bại
"""
        ok, errors = verify_task_transitions(
            self.tasks_file, repo_root=self.repo_root, diff_text=diff
        )
        self.assertFalse(ok)
        self.assertEqual(len(errors), 1)
        self.assertTrue(any("[TASK_TEST_FAILED]" in err and "T002" in err for err in errors))

    def test_companion_test_timeout_breach(self):
        """Kịch bản biên: Companion test chạy quá ngưỡng timeout 10 giây bị ngắt dứt khoát."""
        # Mock subprocess.run ném TimeoutExpired
        diff = "- - [ ] T001 Task hợp lệ danh định\n+ - [x] T001 Task hợp lệ danh định\n"
        import subprocess

        with patch("subprocess.run", side_effect=subprocess.TimeoutExpired(cmd="test", timeout=10)):
            ok, errors = verify_task_transitions(
                self.tasks_file, repo_root=self.repo_root, diff_text=diff
            )
            self.assertFalse(ok)
            self.assertTrue(any("[TASK_TEST_TIMEOUT]" in err for err in errors))

    def test_task_not_found_in_tasks_md(self):
        """Kịch bản biên: Diff tham chiếu tới Task ID không tồn tại trong tệp tasks.md."""
        diff = "- - [ ] T999 Task không tồn tại\n+ - [x] T999 Task không tồn tại\n"
        ok, errors = verify_task_transitions(
            self.tasks_file, repo_root=self.repo_root, diff_text=diff
        )
        self.assertFalse(ok)
        self.assertTrue(any("[TASK_NOT_FOUND]" in err for err in errors))

    def test_tasks_file_missing_on_disk(self):
        """Kịch bản biên: Tệp tasks.md được truyền vào không tồn tại."""
        ok, errors = verify_task_transitions(
            "non_existent_tasks.md", repo_root=self.repo_root, diff_text=""
        )
        self.assertFalse(ok)
        self.assertTrue(any("[TASKS_FILE_NOT_FOUND]" in err for err in errors))


class TestVerifyTasksCLIRunner(unittest.TestCase):
    """Kiểm thử giao diện thực thi CLI của verify-tasks.py."""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.repo_root = os.path.abspath(self.temp_dir.name)
        self.tasks_file = os.path.join(self.repo_root, "tasks.md")
        with open(self.tasks_file, "w", encoding="utf-8") as f:
            f.write("- [ ] T001 Clean\n  *Companion Test*: `python -c \"pass\"`\n")

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_cli_execution_nominal_pass_exit_0(self):
        """CLI chạy thành công với exit code 0 khi diff rỗng."""
        test_args = ["verify-tasks.py", self.tasks_file, "--diff", ""]
        with patch.object(sys, "argv", test_args):
            with patch("sys.stdout", new_callable=io.StringIO) as mock_stdout:
                with self.assertRaises(SystemExit) as cm:
                    verify_tasks.main()
                self.assertEqual(cm.exception.code, 0)
                self.assertIn("[VERIFY-TASKS-PASS]", mock_stdout.getvalue())

    def test_cli_execution_violation_exit_1(self):
        """CLI chặn đứng với exit code 1 và ghi thông báo ra STDERR khi có vi phạm."""
        failing_diff = "- - [ ] T001 Clean\n+ - [x] T001 Clean\n"
        # Mock verify_task_transitions trả về lỗi
        with patch.object(
            verify_tasks,
            "verify_task_transitions",
            return_value=(False, ["[TASK_TEST_FAILED] Mock test failure"]),
        ):
            test_args = ["verify-tasks.py", self.tasks_file, "--diff", failing_diff]
            with patch.object(sys, "argv", test_args):
                with patch("sys.stderr", new_callable=io.StringIO) as mock_stderr:
                    with self.assertRaises(SystemExit) as cm:
                        verify_tasks.main()
                    self.assertEqual(cm.exception.code, 1)
                    self.assertIn("[PRE-COMMIT GATE BLOCKED]", mock_stderr.getvalue())
                    self.assertIn("[TASK_TEST_FAILED]", mock_stderr.getvalue())


if __name__ == "__main__":
    unittest.main()
