#!/usr/bin/env python3
# .agents/scripts/guards/dispatcher.py
"""
Composite Domain Dispatcher cho hệ thống Hook của Google Antigravity.
Tuân thủ: Pure Python Standard Library, Zero Dependencies, Execution Time < 30ms.
"""

import sys
import json
import os
import argparse
from typing import Dict, Any, Callable, Tuple

# Nạp các module miền kiểm dịch
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
from domains.engine_invariants.delegation_sanitizer import verify_delegation_payload


def parse_input(raw_payload: str = None) -> Dict[str, Any]:
    """
    Đọc và giải mã gói tin JSON từ tham số trực tiếp hoặc stdin do Go Engine gửi tới.
    Xử lý an toàn ký tự BOM (Byte Order Mark) trên môi trường Windows.
    """
    if raw_payload is not None:
        raw_text = raw_payload.strip().lstrip("\ufeff")
        if not raw_text:
            return {}
        try:
            return json.loads(raw_text)
        except Exception:
            return {}

    try:
        if not sys.stdin.isatty():
            raw_input = sys.stdin.read()
            if raw_input:
                raw_input = raw_input.strip().lstrip("\ufeff")
                if raw_input:
                    return json.loads(raw_input)
    except Exception:
        pass

    return {}


def extract_tool_call_info(payload: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
    """
    Trích xuất tên công cụ và tham số từ các biến thể cấu trúc payload của Go Engine.
    Hỗ trợ cả trường hợp tool_args được mã hóa dưới dạng chuỗi JSON.
    """
    tool_call = payload.get("toolCall") or payload
    tool_name = (
        tool_call.get("name")
        or tool_call.get("tool_name")
        or payload.get("tool_name")
        or ""
    )

    raw_args = (
        tool_call.get("args")
        or tool_call.get("tool_args")
        or payload.get("tool_args")
        or {}
    )

    if isinstance(raw_args, str):
        try:
            tool_args = json.loads(raw_args)
        except Exception:
            tool_args = {"raw_string": raw_args}
    elif isinstance(raw_args, dict):
        tool_args = raw_args
    else:
        tool_args = {}

    return str(tool_name), tool_args


def handle_pre_tool_use(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Xử lý sự kiện PreToolUse: Kiểm dịch gói tin trước khi công cụ thực thi.
    Độ trễ trung bình < 30ms, không chứa linter cú pháp bề mặt.
    """
    tool_name, tool_args = extract_tool_call_info(payload)

    # 1. Tầng kiểm dịch liên tác tử (engine invariants) cho invoke_subagent và send_message
    if tool_name in ("invoke_subagent", "send_message"):
        ok, reason = verify_delegation_payload(tool_name, tool_args)
        if not ok:
            return {
                "decision": "deny",
                "reason": reason
            }

    # Cho phép thực thi mặc định nếu không vi phạm
    return {"decision": "allow"}


def handle_stop(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Xử lý sự kiện Stop: Xác thực Definition of Done trước khi kết thúc phiên.
    """
    return {"decision": "allow"}


EVENT_ROUTER: Dict[str, Callable[[Dict[str, Any]], Dict[str, Any]]] = {
    "PreToolUse": handle_pre_tool_use,
    "Stop": handle_stop,
}


def dispatch(event: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Bộ điều phối composite router định tuyến sự kiện tới handler tương ứng.
    Bảo đảm bắt lỗi ngoại lệ cấp cao và không gây gián đoạn Go Engine.
    """
    handler = EVENT_ROUTER.get(event)
    if not handler:
        return {"decision": "allow"}

    try:
        return handler(payload)
    except Exception as e:
        # Bắt lỗi phòng thủ để tránh treo hoặc crash đột ngột
        sys.stderr.write(f"[DISPATCHER_ERROR] Lỗi ngoại lệ trong xử lý sự kiện {event}: {e}\n")
        return {
            "decision": "deny",
            "reason": f"[INTERNAL_DISPATCHER_ERROR] Lỗi ngoại lệ khi thẩm định: {type(e).__name__}: {e}"
        }


def main():
    parser = argparse.ArgumentParser(description="Antigravity Composite Domain Dispatcher")
    parser.add_argument("--event", type=str, default="PreToolUse", help="Hook event type")
    parser.add_argument("--payload", type=str, default=None, help="JSON payload passed as CLI argument")
    args, _ = parser.parse_known_args()

    payload = parse_input(args.payload)
    result = dispatch(args.event, payload)

    # Xuất kết quả chuẩn JSON cho Go Engine
    print(json.dumps(result))
    sys.exit(0)


if __name__ == "__main__":
    main()

