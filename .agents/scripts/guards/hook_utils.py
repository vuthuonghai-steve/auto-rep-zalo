#!/usr/bin/env python3
# .agents/scripts/guards/hook_utils.py
"""
Hạ tầng tiện ích nền tảng dùng chung cho hệ thống Runtime Guards (Feature 004).
Tuân thủ: Pure Python Standard Library, Zero Dependencies, Execution Latency < 5ms.

Các chức năng cốt lõi:
1. parse_stdin_payload: Giải mã an toàn JSON từ STDIN/CLI args, bóc tách triệt để BOM Windows '\\ufeff'.
2. extract_tool_info: Trích xuất chuẩn hóa tool_name và tool_args từ mọi biến thể payload của Go Engine.
3. record_footprint: Ghi vết nhật ký vi mô bền vững vào .agents/logs/guard-footprints.jsonl.
4. emit_stdout_json & format_hook_response: Chuẩn hóa xuất STDOUT JSON tương thích struct Go Engine.
"""

import os
import sys
import json
import time
from datetime import datetime
from typing import Dict, Any, Tuple, Optional, Union


def get_repo_root() -> str:
    """
    Xác định đường dẫn thư mục gốc repository (Workspace Root).
    Tọa độ tệp: .agents/scripts/guards/hook_utils.py -> lùi 3 cấp thư mục.
    """
    guards_dir = os.path.dirname(os.path.abspath(__file__))
    scripts_dir = os.path.dirname(guards_dir)
    agents_dir = os.path.dirname(scripts_dir)
    return os.path.dirname(agents_dir)


def get_default_log_path() -> str:
    """Xác định đường dẫn SSOT của tệp nhật ký vết guard-footprints.jsonl."""
    repo_root = get_repo_root()
    return os.path.join(repo_root, ".agents", "logs", "guard-footprints.jsonl")


def parse_stdin_payload(raw_payload: Optional[Union[str, Dict[str, Any]]] = None) -> Dict[str, Any]:
    """
    Đọc và giải mã an toàn gói tin JSON từ tham số CLI hoặc luồng STDIN do Go Engine gửi tới.
    Xử lý:
    - Bóc tách triệt để ký tự UTF-8 BOM Windows '\\ufeff'.
    - Bỏ qua chuỗi rỗng / whitespace.
    - Chịu lỗi an toàn trước dữ liệu phân mảnh hoặc JSON không hợp lệ (không bao giờ raise).
    - Bảo đảm trả về một Dict[str, Any] trong mọi tình huống.
    """
    if raw_payload is not None:
        if isinstance(raw_payload, dict):
            return raw_payload

        raw_text = str(raw_payload).strip().lstrip("\ufeff")
        if not raw_text:
            return {}
        try:
            parsed = json.loads(raw_text)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}

    # Khi raw_payload là None, đọc dữ liệu từ STDIN
    try:
        if sys.stdin and not sys.stdin.isatty():
            raw_input = sys.stdin.read()
            if raw_input:
                cleaned_input = raw_input.strip().lstrip("\ufeff")
                if cleaned_input:
                    parsed = json.loads(cleaned_input)
                    return parsed if isinstance(parsed, dict) else {}
    except Exception:
        pass

    return {}


# Bí danh tương thích ngược
parse_input = parse_stdin_payload


def extract_tool_info(payload: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
    """
    Trích xuất tên công cụ (tool_name) và tham số (tool_args) từ các biến thể cấu trúc
    payload khác nhau do Go Engine (agy.exe) gửi tới.
    
    Hỗ trợ các dạng:
    1. {"toolCall": {"name": "...", "args": {...}}}
    2. {"name": "...", "args": {...}}
    3. {"tool_name": "...", "tool_args": {...}}
    4. args được mã hóa dưới dạng chuỗi JSON hoặc chuỗi có chèn BOM Windows.
    """
    if not isinstance(payload, dict):
        return "", {}

    tool_call = payload.get("toolCall")
    if not isinstance(tool_call, dict):
        tool_call = payload

    tool_name = (
        tool_call.get("name")
        or tool_call.get("tool_name")
        or payload.get("tool_name")
        or payload.get("name")
        or ""
    )

    raw_args = (
        tool_call.get("args")
        or tool_call.get("tool_args")
        or payload.get("tool_args")
        or payload.get("args")
        or {}
    )

    if isinstance(raw_args, str):
        cleaned_args = raw_args.strip().lstrip("\ufeff")
        try:
            parsed_args = json.loads(cleaned_args)
            if isinstance(parsed_args, dict):
                tool_args = parsed_args
            else:
                tool_args = {"raw_string": raw_args}
        except Exception:
            tool_args = {"raw_string": raw_args}
    elif isinstance(raw_args, dict):
        tool_args = raw_args
    else:
        tool_args = {}

    return str(tool_name).strip(), tool_args


# Bí danh tương thích ngược
extract_tool_call_info = extract_tool_info


def record_footprint(
    guard_name: str,
    event: str,
    status: str,
    target: Optional[str] = None,
    duration_ms: float = 0.0,
    details: Optional[Dict[str, Any]] = None,
    log_path: Optional[str] = None,
) -> bool:
    """
    Ghi một bản ghi nhật ký vết vi mô vào tệp .agents/logs/guard-footprints.jsonl.
    
    Khế ước trường dữ liệu bắt buộc (First-Class Telemetry Contract):
    - timestamp: Thời gian theo định dạng 'YYYY-MM-DD HH:MM:SS.mmm'.
    - guard: Tên guard thực thi (ví dụ: 'workspace-safety-guard').
    - event: Sự kiện vòng đời (PreToolUse, PostToolUse, Stop).
    - status: Trạng thái thẩm định (CLEAN, FLAGGED_PLACEHOLDER, ALLOW, DENY, etc.).
    - durationMs: Thời gian thực thi (số thực/nguyên tính bằng ms).
    - target: Đối tượng kiểm tra (đường dẫn tệp hoặc tên tool), có thể là None.
    - details: Chi tiết bổ sung (dict).

    Phòng thủ: Không bao giờ làm crash chương trình gọi nếu phát sinh lỗi I/O.
    """
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    record = {
        "timestamp": now_str,
        "guard": str(guard_name),
        "event": str(event),
        "status": str(status),
        "target": str(target) if target is not None else None,
        "durationMs": round(float(duration_ms), 2),
        "details": details if isinstance(details, dict) else {},
    }

    effective_path = log_path or get_default_log_path()

    try:
        log_dir = os.path.dirname(os.path.abspath(effective_path))
        if log_dir and not os.path.exists(log_dir):
            os.makedirs(log_dir, exist_ok=True)

        with open(effective_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
        return True
    except Exception as exc:
        # Ghi cảnh báo ra stderr mà không raise exception
        sys.stderr.write(f"[FOOTPRINT_LOG_ERROR] Không thể ghi footprint vào {effective_path}: {exc}\n")
        return False


def format_hook_response(decision: str, reason: Optional[str] = None, **kwargs) -> Dict[str, Any]:
    """
    Chuẩn hóa cấu trúc kết quả trả về của hook tương thích struct Go Engine.
    - PreToolUse: decision ('allow' | 'deny' | 'ask')
    - Stop: decision ('stop' | 'continue')
    - PostToolUse: thường là dict rỗng {}
    """
    response: Dict[str, Any] = {"decision": decision}
    if reason is not None:
        response["reason"] = str(reason)
    response.update(kwargs)
    return response


def emit_stdout_json(data: Dict[str, Any]) -> None:
    """Xuất an toàn dữ liệu JSON ra STDOUT và flush bộ đệm cho Go Engine."""
    output = json.dumps(data, ensure_ascii=False)
    sys.stdout.write(output + "\n")
    sys.stdout.flush()
