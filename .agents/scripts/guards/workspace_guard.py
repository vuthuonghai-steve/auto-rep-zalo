#!/usr/bin/env python3
# .agents/scripts/guards/workspace_guard.py
"""
PostToolUse Workspace Guard (Feature 004 - Task T005).
Chốt chặn an toàn không gian làm việc sau các thao tác ghi tệp (write_file, edit_file).

Trách nhiệm:
1. Placeholder Guard: Quét các placeholder bị cấm (TODO, FIXME, STUB_IMPLEMENTATION, fake_data, mock_response).
2. Diff-Scope Isolation: Kiểm soát phạm vi thay đổi tệp, ngăn ngừa thoát ra ngoài workspace root hoặc tệp cấm.
3. Directory Governance: Cưỡng chế giới hạn độ sâu (Max Depth <= 2) và cấm import chéo trong src/screens.
4. Ghi footprint vi mô bền vững vào .agents/logs/guard-footprints.jsonl.
5. STDOUT Contract: Luôn trả về {} ra STDOUT với Exit Code 0, cảnh báo ghi ra STDERR.
"""

import os
import sys
import re
import time
import argparse
from typing import Dict, Any, Tuple, List, Optional, Union

# Nạp thư viện tiện ích nền tảng hook_utils
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
import hook_utils

# Biểu thức chính quy quét placeholder bị cấm trên production flow
FORBIDDEN_PLACEHOLDER_REGEX = re.compile(
    r"(TODO|FIXME|STUB_IMPLEMENTATION|fake_data|mock_response)"
)

# Biểu thức chính quy phát hiện cross-screen component import
CROSS_SCREEN_IMPORT_REGEX = re.compile(
    r"import\s+.*from\s+['\"]\.\./([^/'\"]+)/components"
)


def get_workspace_root(payload: Optional[Dict[str, Any]] = None) -> str:
    """Xác định thư mục gốc workspace từ payload hoặc fallback từ môi trường."""
    if payload and isinstance(payload, dict):
        workspace_paths = payload.get("workspacePaths")
        if isinstance(workspace_paths, list) and len(workspace_paths) > 0 and workspace_paths[0]:
            return os.path.abspath(str(workspace_paths[0]))

    env_root = os.environ.get("WORKSPACE_ROOT")
    if env_root and os.path.isdir(env_root):
        return os.path.abspath(env_root)

    return os.path.abspath(hook_utils.get_repo_root())


def check_diff_scope(file_path: str, workspace_root: str) -> Tuple[bool, str]:
    """
    Kiểm tra xem tệp có nằm trong phạm vi workspace cho phép không (Diff-Scope Isolation).
    Phát hiện các tệp nằm ngoài thư mục workspace hoặc thuộc các đường dẫn cấm (như forbidden/**).
    """
    norm_path = file_path.replace("\\", "/").lower()

    # Kiểm tra tiền tố cấm tường minh (forbidden path)
    path_segments = [seg for seg in norm_path.split("/") if seg]
    if "forbidden" in path_segments:
        return False, f"Đường dẫn thuộc phạm vi cấm (forbidden path): {file_path}"

    full_target = os.path.abspath(file_path)
    normalized_workspace = os.path.abspath(workspace_root)

    try:
        common = os.path.commonpath([normalized_workspace, full_target])
        if common.lower() != normalized_workspace.lower():
            return False, f"File nằm ngoài workspace root: {full_target} (Workspace: {normalized_workspace})"
    except Exception:
        # Trong trường hợp khác ổ đĩa trên Windows
        return False, f"File nằm ngoài ổ đĩa workspace: {full_target}"

    return True, "OK"


def check_placeholders(file_path: str, fallback_content: Optional[str] = None) -> Tuple[int, List[str]]:
    """
    Quét placeholder bị cấm trong tệp mã nguồn.
    Ưu tiên đọc nội dung tệp trực tiếp từ đĩa; fallback đọc từ fallback_content nếu tệp chưa ghi xong.
    """
    lines: List[str] = []

    if os.path.exists(file_path) and os.path.isfile(file_path):
        try:
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                lines = f.readlines()
        except Exception as exc:
            sys.stderr.write(f"[GUARD_READ_WARNING] Không thể đọc {file_path}: {exc}\n")

    if not lines and fallback_content:
        lines = fallback_content.splitlines(keepends=True)

    matches: List[str] = []
    for line_num, line in enumerate(lines, start=1):
        if FORBIDDEN_PLACEHOLDER_REGEX.search(line):
            matches.append(f"Line {line_num}: {line.strip()}")

    return len(matches), matches


def check_directory_governance(file_path: str, fallback_content: Optional[str] = None) -> Tuple[Optional[str], Optional[str]]:
    """
    Kiểm tra quy chuẩn cấu trúc thư mục (Kỷ luật 3 tầng trong src/screens):
    1. Max Depth: Cấm lồng sâu quá 2 cấp thư mục con bên dưới src/screens/ (segments <= 3).
    2. Cấm cross-screen component import (import từ ../<other>/components/...).
    """
    norm_path = file_path.replace("\\", "/")

    screens_marker = "src/screens/"
    if screens_marker in norm_path:
        idx = norm_path.find(screens_marker)
        rel_screens = norm_path[idx + len(screens_marker):]
        segments = [s for s in rel_screens.split("/") if s]

        # Segments: [0] = module, [1] = file hoặc 'components', [2] = file trong components
        # Nếu segments > 3 tức là có thư mục con lồng sâu bên trong components
        if len(segments) > 3:
            return "FLAGGED_DIRECTORY_DEPTH", f"Vi phạm Max Depth (Quá 2 cấp thư mục trong src/screens): {rel_screens}"

        # Kiểm tra cross-screen component import với các tệp .tsx / .ts
        if norm_path.endswith(".tsx") or norm_path.endswith(".ts"):
            lines: List[str] = []
            if os.path.exists(file_path) and os.path.isfile(file_path):
                try:
                    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                        lines = f.readlines()
                except Exception:
                    pass
            if not lines and fallback_content:
                lines = fallback_content.splitlines()

            for line_num, line in enumerate(lines, start=1):
                match = CROSS_SCREEN_IMPORT_REGEX.search(line)
                if match:
                    target_module = match.group(1)
                    return (
                        "FLAGGED_CROSS_IMPORT",
                        f"Phát hiện cross-screen component import tại Line {line_num}: {line.strip()} -> ../{target_module}/components"
                    )

    return None, None


def inspect_workspace_safety(
    payload: Dict[str, Any],
    workspace_root: Optional[str] = None,
) -> Tuple[str, Optional[str], Dict[str, Any]]:
    """
    Thực thi chuỗi thẩm định an toàn không gian làm việc.
    Trả về: (status, target_path, details)
    """
    tool_name, tool_args = hook_utils.extract_tool_info(payload)
    file_path = str(tool_args.get("Path") or tool_args.get("path") or "").strip()
    fallback_content = tool_args.get("Content") or tool_args.get("content")

    if not file_path:
        return "SKIPPED_NO_PATH", None, {"inScope": True, "violations": 0, "matches": []}

    effective_root = workspace_root or get_workspace_root(payload)

    # 1. Thẩm định Diff-Scope Isolation
    in_scope, diff_reason = check_diff_scope(file_path, effective_root)
    if not in_scope:
        details = {
            "inScope": False,
            "resolvedPath": os.path.abspath(file_path),
            "workspaceRoot": effective_root,
            "reason": diff_reason,
            "violations": 0,
            "matches": [],
        }
        return "OUT_OF_SCOPE", file_path, details

    # 2. Thẩm định Placeholder Guard
    violation_count, matches = check_placeholders(file_path, fallback_content)
    if violation_count > 0:
        details = {
            "inScope": True,
            "resolvedPath": os.path.abspath(file_path),
            "workspaceRoot": effective_root,
            "violations": violation_count,
            "matches": matches,
        }
        return "FLAGGED_PLACEHOLDER", file_path, details

    # 3. Thẩm định Directory Governance
    dir_violation_status, dir_reason = check_directory_governance(file_path, fallback_content)
    if dir_violation_status:
        details = {
            "inScope": True,
            "resolvedPath": os.path.abspath(file_path),
            "workspaceRoot": effective_root,
            "violations": 1,
            "matches": [dir_reason],
            "reason": dir_reason,
        }
        return dir_violation_status, file_path, details

    # Tất cả các chốt chặn đều an toàn
    details = {
        "inScope": True,
        "resolvedPath": os.path.abspath(file_path),
        "workspaceRoot": effective_root,
        "violations": 0,
        "matches": [],
    }
    return "CLEAN", file_path, details


def handle_post_tool_use(
    payload: Dict[str, Any],
    workspace_root: Optional[str] = None,
    log_path: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Xử lý sự kiện PostToolUse cho write_file và edit_file:
    - Thực thi thẩm định placeholder, diff-scope, directory governance.
    - Ghi cảnh báo ra STDERR nếu phát hiện vi phạm.
    - Ghi nhật ký vết vi mô footprint vào JSONL.
    - Luôn trả về {} ra STDOUT để không làm nghẽn luồng engine.
    """
    t0 = time.perf_counter()
    status, target_path, details = inspect_workspace_safety(payload, workspace_root)
    duration_ms = (time.perf_counter() - t0) * 1000.0

    # Phát tín hiệu cảnh báo ra STDERR khi có vi phạm
    if status == "FLAGGED_PLACEHOLDER":
        violations = details.get("violations", 0)
        matches = details.get("matches", [])
        sys.stderr.write(f"[GUARD WARNING] Phát hiện {violations} placeholder trong {target_path}:\n")
        for match_line in matches:
            sys.stderr.write(f"  {match_line}\n")
    elif status == "OUT_OF_SCOPE":
        reason = details.get("reason", "File nằm ngoài phạm vi workspace")
        sys.stderr.write(f"[GUARD WARNING] {reason}\n")
    elif status in ("FLAGGED_DIRECTORY_DEPTH", "FLAGGED_CROSS_IMPORT"):
        reason = details.get("reason", "Vi phạm kỷ luật cấu trúc thư mục")
        sys.stderr.write(f"[GUARD WARNING] {reason}\n")

    # Ghi log footprint vi mô theo chuẩn First-Class Telemetry
    hook_utils.record_footprint(
        guard_name="workspace_guard",
        event="PostToolUse",
        status=status,
        target=target_path,
        duration_ms=duration_ms,
        details=details,
        log_path=log_path,
    )

    # STDOUT Contract của Go Engine cho PostToolUse luôn là dict rỗng {}
    return {}


def main():
    """Hàm thực thi CLI chính khi Go Engine triệu gọi qua subprocess cmd /c."""
    parser = argparse.ArgumentParser(description="Antigravity Workspace Guard (PostToolUse)")
    parser.add_argument("--payload", type=str, default=None, help="JSON payload passed as CLI argument")
    args, _ = parser.parse_known_args()

    payload = hook_utils.parse_stdin_payload(args.payload)
    result = handle_post_tool_use(payload)

    # Xuất kết quả {} ra STDOUT
    hook_utils.emit_stdout_json(result)
    sys.exit(0)


if __name__ == "__main__":
    main()
