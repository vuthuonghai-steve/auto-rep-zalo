#!/usr/bin/env python3
# .agents/scripts/guards/verify-tasks.py
"""
Chốt chặn cấp hệ điều hành: Thẩm định chuyển trạng thái tasks.md cho Git Pre-Commit Hook (US2).
Tuân thủ: Pure Python Standard Library, Zero 3rd-party dependencies.

Nhiệm vụ cốt lõi:
1. Đọc và phân tích git diff staging của tasks.md (git diff --cached -U0).
2. Phát hiện các task chuyển trạng thái từ '[ ]' sang '[x]'.
3. Đối với mỗi task hoàn tất:
   a. Kiểm tra sự tồn tại trên đĩa cứng (os.path.exists) của toàn bộ tệp mã nguồn mục tiêu.
   b. Trích xuất và kích hoạt Companion Unit Test tương ứng; bắt buộc trả về Exit Code 0.
4. Chặn đứng commit (Exit Code 1) nếu có bất kỳ vi phạm nào; cho phép commit (Exit Code 0) nếu hợp lệ.
"""

import os
import sys
import re
import subprocess
import argparse
from typing import Dict, Any, List, Tuple, Optional


def get_repo_root() -> str:
    """Xác định đường dẫn thư mục gốc Git repository."""
    try:
        proc = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            capture_output=True,
            text=True,
            check=True,
        )
        root = proc.stdout.strip()
        if root and os.path.isdir(root):
            return os.path.abspath(root)
    except Exception:
        pass

    # Fallback theo cấu trúc thư mục .agents/scripts/guards/verify-tasks.py
    current_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.abspath(os.path.join(current_dir, "..", "..", ".."))


def parse_task_nodes(content: str) -> Dict[str, Dict[str, Any]]:
    """
    Phân tích toàn bộ nội dung tasks.md thành từ điển các task node.
    Mỗi node neo theo mẫu '^- [ ] Txxx' hoặc '^- [x] Txxx'.
    """
    task_header_re = re.compile(
        r"^- \[(?P<state>[ xX])\]\s+(?P<task_id>T[0-9]{3})\b(?P<title>.*)",
        re.MULTILINE,
    )
    matches = list(task_header_re.finditer(content))
    task_nodes: Dict[str, Dict[str, Any]] = {}

    for i, m in enumerate(matches):
        start = m.start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(content)
        block = content[start:end]
        task_id = m.group("task_id")
        state = m.group("state").strip()

        # Trích xuất Companion Test Command trong cặp backtick `...`
        test_pattern = r"(?i)\*(?:Companion Test|Verification)\*:\s*`([^`]+)`"
        test_match = re.search(test_pattern, block)
        if not test_match:
            test_pattern2 = r"(?i)(?:Companion Test|Verification|Test):\s*`([^`]+)`"
            test_match = re.search(test_pattern2, block)
        companion_test = test_match.group(1).strip() if test_match else None

        # Trích xuất Target Files
        target_files = extract_target_files_from_block(block)

        task_nodes[task_id] = {
            "task_id": task_id,
            "state": state,
            "title": m.group("title").strip(),
            "companion_test": companion_test,
            "target_files": target_files,
            "block": block,
        }

    return task_nodes


def extract_target_files_from_block(block: str) -> List[str]:
    """Trích xuất danh sách các tệp mã nguồn mục tiêu từ một task block."""
    m = re.search(r"(?i)\*Target files?\*:\s*(.+)", block)
    if not m:
        m = re.search(r"(?i)Target files?:\s*(.+)", block)
    if not m:
        return []

    line = m.group(1).strip()
    backtick_files = re.findall(r"`([^`]+)`", line)
    if backtick_files:
        return [f.strip() for f in backtick_files if f.strip()]

    # Fallback phân tách bằng dấu phẩy nếu không có backtick
    clean_line = re.sub(r"[\*\[\]\(\)]", "", line).strip()
    parts = [p.strip() for p in clean_line.split(",") if p.strip()]
    return parts


def extract_transitioned_tasks(diff_text: str) -> List[str]:
    """
    Trích xuất danh sách các task_id chuyển đổi từ [ ] sang [x] từ git diff staging.
    Phân biệt rõ:
    - Task chuyển từ [ ] sang [x]: dòng xóa có [ ] và dòng thêm có [x].
    - Task thêm mới đã đánh dấu [x]: dòng thêm có [x] và không có trong deleted_checked.
    - Task đã [x] từ trước chỉ sửa mô tả: bỏ qua không coi là chuyển trạng thái.
    """
    if not diff_text:
        return []

    deleted_unchecked = set(
        re.findall(r"^-[\s-]*(?:-\s*)?\[\s*\]\s*(T[0-9]{3})\b", diff_text, re.MULTILINE)
    )
    deleted_checked = set(
        re.findall(r"^-[\s-]*(?:-\s*)?\[[xX]\]\s*(T[0-9]{3})\b", diff_text, re.MULTILINE)
    )
    added_checked = set(
        re.findall(r"^\+[\s-]*(?:-\s*)?\[[xX]\]\s*(T[0-9]{3})\b", diff_text, re.MULTILINE)
    )

    transitioned: List[str] = []
    for tid in added_checked:
        if tid in deleted_unchecked or tid not in deleted_checked:
            transitioned.append(tid)

    return sorted(list(set(transitioned)))


def verify_task_transitions(
    tasks_path: str,
    repo_root: Optional[str] = None,
    diff_text: Optional[str] = None,
) -> Tuple[bool, List[str]]:
    """
    Thực thi thẩm định chuyển trạng thái tác vụ cho tasks.md:
    1. Đọc diff staging hoặc diff_text truyền vào.
    2. Xác định các task chuyển sang [x].
    3. Thẩm định sự tồn tại của target_files qua os.path.exists.
    4. Thẩm định companion_test bằng cách thực thi lệnh trong timeout 10s.

    Trả về:
    - (True, []) nếu toàn bộ task hợp lệ.
    - (False, [danh sách lỗi]) nếu phát hiện vi phạm.
    """
    effective_root = repo_root or get_repo_root()

    # Chuẩn hóa đường dẫn tasks.md
    if not os.path.isabs(tasks_path):
        full_tasks_path = os.path.abspath(os.path.join(effective_root, tasks_path))
    else:
        full_tasks_path = os.path.abspath(tasks_path)

    if not os.path.exists(full_tasks_path):
        return False, [f"[TASKS_FILE_NOT_FOUND] Không tìm thấy tệp {full_tasks_path}"]

    try:
        with open(full_tasks_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
    except Exception as exc:
        return False, [f"[TASKS_READ_ERROR] Không thể đọc tệp {full_tasks_path}: {exc}"]

    task_nodes = parse_task_nodes(content)

    # Lấy nội dung git diff staging nếu không được cung cấp trực tiếp
    staged_diff = diff_text
    if staged_diff is None:
        rel_tasks_path = os.path.relpath(full_tasks_path, effective_root)
        try:
            proc = subprocess.run(
                ["git", "diff", "--cached", "-U0", "--", rel_tasks_path],
                cwd=effective_root,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
            )
            staged_diff = proc.stdout if proc.returncode == 0 else ""
        except Exception as exc:
            return False, [f"[GIT_DIFF_ERROR] Lỗi khi thực thi git diff: {exc}"]

    transitioned_ids = extract_transitioned_tasks(staged_diff)

    # Nếu không có task nào chuyển trạng thái [ ] -> [x], thông qua mặc định
    if not transitioned_ids:
        return True, []

    errors: List[str] = []

    for tid in transitioned_ids:
        node = task_nodes.get(tid)
        if not node:
            errors.append(f"[TASK_NOT_FOUND] Task {tid} không tìm thấy trong {tasks_path}")
            continue

        # 1. Kiểm tra sự tồn tại trên đĩa của target_files (os.path.exists)
        target_files = node.get("target_files", [])
        for tf in target_files:
            tf_clean = tf.strip()
            if not tf_clean:
                continue
            full_tf = (
                tf_clean
                if os.path.isabs(tf_clean)
                else os.path.join(effective_root, tf_clean)
            )
            if not os.path.exists(full_tf):
                errors.append(
                    f"[TASK_FILE_MISSING] Task {tid}: tệp khai báo '{tf_clean}' không tồn tại trên đĩa ({full_tf})"
                )

        # 2. Kiểm tra lệnh Companion Test
        companion_test = node.get("companion_test")
        if not companion_test:
            errors.append(
                f"[TASK_TEST_MISSING] Task {tid}: không tìm thấy lệnh companion test trong mô tả task"
            )
            continue

        # 3. Thực thi Companion Test
        try:
            test_proc = subprocess.run(
                companion_test,
                shell=True,
                cwd=effective_root,
                capture_output=True,
                text=True,
                timeout=10,
                encoding="utf-8",
                errors="replace",
            )
            if test_proc.returncode != 0:
                err_detail = test_proc.stderr.strip() or test_proc.stdout.strip()
                errors.append(
                    f"[TASK_TEST_FAILED] Task {tid}: companion test thất bại với Exit Code {test_proc.returncode}.\n"
                    f"  Lệnh: {companion_test}\n"
                    f"  Chi tiết: {err_detail[:300]}"
                )
        except subprocess.TimeoutExpired:
            errors.append(
                f"[TASK_TEST_TIMEOUT] Task {tid}: companion test vượt quá thời gian tối đa 10 giây ({companion_test})"
            )
        except Exception as exc:
            errors.append(
                f"[TASK_TEST_FAILED] Task {tid}: lỗi ngoại lệ khi chạy test: {exc}"
            )

    return len(errors) == 0, errors


def find_default_tasks_files(repo_root: str) -> List[str]:
    """Tìm kiếm các tệp tasks.md trong git staging hoặc thư mục specs/."""
    staged_tasks = []
    try:
        proc = subprocess.run(
            ["git", "diff", "--cached", "--name-only"],
            cwd=repo_root,
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
        if proc.returncode == 0:
            for line in proc.stdout.splitlines():
                clean_line = line.strip()
                if clean_line.endswith("tasks.md"):
                    staged_tasks.append(clean_line)
    except Exception:
        pass

    if staged_tasks:
        return staged_tasks

    # Quét trong specs/
    specs_dir = os.path.join(repo_root, "specs")
    found = []
    if os.path.isdir(specs_dir):
        for root, _, files in os.walk(specs_dir):
            for f in files:
                if f == "tasks.md":
                    rel = os.path.relpath(os.path.join(root, f), repo_root)
                    found.append(rel)
    return found


def main():
    """Hàm thực thi CLI chính khi được gọi từ pre-commit hook hoặc dòng lệnh."""
    parser = argparse.ArgumentParser(
        description="Antigravity Git Pre-Commit Hook: verify-tasks.py"
    )
    parser.add_argument(
        "tasks_path",
        nargs="?",
        default=None,
        help="Đường dẫn tới tệp tasks.md (mặc định tìm trong git staging hoặc specs/)",
    )
    parser.add_argument(
        "--diff",
        type=str,
        default=None,
        help="Nội dung git diff trực tiếp (dùng cho testing/CI)",
    )
    args = parser.parse_args()

    repo_root = get_repo_root()

    if args.tasks_path:
        target_files = [args.tasks_path]
    else:
        target_files = find_default_tasks_files(repo_root)

    if not target_files:
        sys.stdout.write("[VERIFY-TASKS-PASS] Không tìm thấy tệp tasks.md nào cần kiểm tra.\n")
        sys.exit(0)

    total_errors: List[str] = []
    for tf in target_files:
        ok, errors = verify_task_transitions(tf, repo_root=repo_root, diff_text=args.diff)
        if not ok:
            total_errors.extend(errors)

    if total_errors:
        sys.stderr.write("=" * 70 + "\n")
        sys.stderr.write("[PRE-COMMIT GATE BLOCKED] Phát hiện vi phạm khi chuyển trạng thái task:\n")
        for err in total_errors:
            sys.stderr.write(f"  • {err}\n")
        sys.stderr.write("=" * 70 + "\n")
        sys.exit(1)

    sys.stdout.write("[VERIFY-TASKS-PASS] Toàn bộ task hoàn thành đều vượt qua kiểm định cơ học (Exit Code 0).\n")
    sys.exit(0)


if __name__ == "__main__":
    main()
