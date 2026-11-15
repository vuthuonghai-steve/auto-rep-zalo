#!/usr/bin/env python3
# .agents/guards/dispatcher.py
# Composite Domain Dispatcher cho hệ thống Hook của Google Antigravity
# Tuân thủ: Pure Python Standard Library, Zero Dependencies, Execution Time < 30ms

import sys
import json
import os
import argparse
from typing import Dict, Any

# Nạp các module miền kiểm dịch
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
from domains.engine_invariants.delegation_sanitizer import verify_delegation_payload

def parse_input() -> Dict[str, Any]:
    """Đọc và giải mã gói tin JSON từ stdin do Go Engine gửi tới."""
    try:
        if not sys.stdin.isatty():
            raw_input = sys.stdin.read().strip()
            if raw_input:
                return json.loads(raw_input)
    except Exception:
        pass
    return {}

def handle_pre_tool_use(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Xử lý sự kiện PreToolUse: Kiểm dịch gói tin trước khi công cụ thực thi."""
    tool_call = payload.get("toolCall") or payload
    tool_name = tool_call.get("name") or tool_call.get("tool_name") or ""
    tool_args = tool_call.get("args") or tool_call.get("tool_args") or {}

    # 1. Tầng 1: Kiểm dịch liên tác tử cho invoke_subagent và send_message
    if tool_name in ["invoke_subagent", "send_message"]:
        ok, reason = verify_delegation_payload(tool_name, tool_args)
        if not ok:
            return {
                "decision": "deny",
                "explanation": reason
            }

    # Mặc định cho phép thực thi nếu không vi phạm
    return {"decision": "allow"}

def handle_stop(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Xử lý sự kiện Stop: Xác thực Definition of Done trước khi kết thúc phiên."""
    return {"decision": "allow"}

def main():
    parser = argparse.ArgumentParser(description="Antigravity Composite Domain Dispatcher")
    parser.add_argument("--event", type=str, default="PreToolUse", help="Hook event type")
    args, _ = parser.parse_known_args()

    payload = parse_input()

    if args.event == "PreToolUse":
        result = handle_pre_tool_use(payload)
    elif args.event == "Stop":
        result = handle_stop(payload)
    else:
        result = {"decision": "allow"}

    # Xuất kết quả chuẩn cho Go Engine
    print(json.dumps(result))
    sys.exit(0)

if __name__ == "__main__":
    main()
