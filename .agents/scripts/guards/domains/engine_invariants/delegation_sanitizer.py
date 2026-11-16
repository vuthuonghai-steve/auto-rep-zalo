# .agents/guards/domains/engine_invariants/delegation_sanitizer.py
# Module kiểm dịch ngôn ngữ và chốt chặn cơ học vòng đời liên tác tử (3-Layer Quarantine Firewall)
# Tuân thủ: Pure Python Standard Library, Zero Dependencies, Execution Time < 5ms

import re
import json
from typing import Tuple, Dict, Any

FORBIDDEN_BAIT_PATTERNS = [
    r"[\?？]",
    r"(?i)\b(đã\s+pass|đã\s+xong|chỉ\s+cần|xác\s+nhận\s+giúp|như\s+đã\s+thảo\s+luận|tôi\s+nghĩ|có\s+vẻ)\b",
    r"(?i)\b(already\s+passed|just\s+confirm|looks\s+good|as\s+discussed|i\s+fixed|please\s+verify)\b"
]

# Tối ưu hóa hiệu năng: Biên dịch trước các regex patterns tại module level
COMPILED_BAIT_PATTERNS = [
    re.compile(p) for p in FORBIDDEN_BAIT_PATTERNS
]


def verify_delegation_payload(tool_name: str, tool_args: Dict[str, Any]) -> Tuple[bool, str]:
    """
    Kiểm định tính hợp lệ của gói tin giao việc (invoke_subagent) hoặc tương tác tiếp diễn (send_message).
    Trả về: (True, "OK") nếu hợp lệ; (False, "Lý do từ chối") nếu vi phạm.
    """
    tool_name = str(tool_name or "").strip()

    # Chuẩn hóa phòng thủ tham số tool_args (hỗ trợ dict, JSON string, hoặc rỗng)
    if not isinstance(tool_args, dict):
        if isinstance(tool_args, str):
            try:
                parsed = json.loads(tool_args)
                tool_args = parsed if isinstance(parsed, dict) else {"raw_string": tool_args}
            except Exception:
                tool_args = {"raw_string": tool_args}
        else:
            tool_args = {}

    # 1. Kiểm soát tương tác với Auditor trong phiên kiểm toán bền vững (Persistent Verification Session)
    # Auditor được phép nhận tin nhắn tái thẩm định (<remediation_manifest>) hoặc giao task mới (<task_delegation>).
    # TUYỆT ĐỐI CẤM gửi văn xuôi tự do, tranh luận chủ quan tới Auditor.
    raw_text = str(
        tool_args.get("Prompt")
        or tool_args.get("prompt")
        or tool_args.get("Message")
        or tool_args.get("message")
        or tool_args.get("raw_string")
        or ""
    )

    if tool_name == "send_message":
        recipient = str(tool_args.get("Recipient") or tool_args.get("recipient") or "").strip().lower()
        if "auditor" in recipient:
            has_remediation = "<remediation_manifest>" in raw_text and "</remediation_manifest>" in raw_text
            has_delegation = "<task_delegation>" in raw_text and "</task_delegation>" in raw_text
            if not has_remediation and not has_delegation:
                return (
                    False,
                    "[AUDITOR_FREE_FORM_PROHIBITED] CẤM gửi văn bản tự do tới surgical-auditor. "
                    "Trong phiên kiểm toán bền vững, Auditor chỉ tiếp nhận gói tin tái thẩm định đóng gói trong <remediation_manifest> "
                    "hoặc chỉ thị kiểm toán mới trong <task_delegation>."
                )

    # 2. Kiểm tra giới hạn tải trọng (CRIT-DEL-06: <= 2000 chars ~ 500 tokens)
    if len(raw_text) > 2000:
        return (
            False,
            f"[DELEGATION_VIOLATION] Payload vượt quá 2000 ký tự (Độ dài hiện tại: {len(raw_text)}). "
            "Quy tắc CRIT-DEL-06 yêu cầu chỉ truyền Disk Pointers và Git Refs, cấm chép lại nội dung file."
        )

    # 3. Kiểm tra khung cấu trúc bắt buộc
    if tool_name == "invoke_subagent":
        if "<task_delegation>" not in raw_text:
            return (
                False,
                "[DELEGATION_VIOLATION] Lệnh invoke_subagent bắt buộc phải đóng gói trong khung <task_delegation>. "
                "Tham khảo mẫu Pure Data Manifest trong agent.md."
            )
        if "</task_delegation>" not in raw_text:
            return (
                False,
                "[DELEGATION_VIOLATION] Khung <task_delegation> thiếu thẻ đóng </task_delegation>."
            )
    elif tool_name == "send_message":
        # Hỗ trợ cả 2 trường hợp:
        # A) Orchestrator/Worker gửi message tái thẩm định / giao task (<remediation_manifest> / <task_delegation>)
        # B) Subagent báo cáo hoàn thành về Orchestrator bằng JSON Completion Payload ("status": "SUCCESS" | "FAILURE" | "BLOCKED")
        has_remediation_open = "<remediation_manifest>" in raw_text
        has_delegation_open = "<task_delegation>" in raw_text
        has_completion_payload = '"status"' in raw_text and ('"SUCCESS"' in raw_text or '"FAILURE"' in raw_text or '"BLOCKED"' in raw_text)

        if not has_remediation_open and not has_delegation_open and not has_completion_payload:
            return (
                False,
                "[REMEDIATION_REQUIRED] Lệnh send_message gửi cho worker bắt buộc phải đóng gói trong khung <remediation_manifest> "
                "hoặc JSON Completion Payload theo chuẩn. Cấm gửi văn xuôi giải thích chủ quan."
            )
        if has_remediation_open and "</remediation_manifest>" not in raw_text:
            return (
                False,
                "[REMEDIATION_REQUIRED] Khung <remediation_manifest> thiếu thẻ đóng </remediation_manifest>."
            )
        if has_delegation_open and "</task_delegation>" not in raw_text:
            return (
                False,
                "[REMEDIATION_REQUIRED] Khung <task_delegation> thiếu thẻ đóng </task_delegation>."
            )

    # 4. Quét tường lửa chống mớm ý (Anti-Sycophancy Lexical Firewall)
    for pattern in COMPILED_BAIT_PATTERNS:
        match = pattern.search(raw_text)
        if match:
            matched_phrase = match.group(0)
            return (
                False,
                f"[SYCOPHANCY_BAIT_DETECTED] Phát hiện mẫu câu dẫn dắt hoặc định hướng chủ quan ('{matched_phrase}'). "
                "Hãy xóa bỏ nhận định cá nhân và chỉ truyền tọa độ tệp nguyên bản."
            )

    return True, "OK"


if __name__ == "__main__":
    import sys
    # Hỗ trợ thực thi trực tiếp dạng CLI Hook khi nhận payload qua STDIN hoặc arg
    raw_input_data = ""
    if len(sys.argv) > 1:
        raw_input_data = sys.argv[1]
    elif not sys.stdin.isatty():
        raw_input_data = sys.stdin.read()

    input_payload = {}
    if raw_input_data:
        try:
            input_payload = json.loads(raw_input_data.strip().lstrip("\ufeff"))
        except Exception:
            input_payload = {}

    tool_call = input_payload.get("toolCall") or input_payload
    tool_name = str(
        tool_call.get("name")
        or tool_call.get("tool_name")
        or input_payload.get("tool_name")
        or ""
    )
    raw_args = (
        tool_call.get("args")
        or tool_call.get("tool_args")
        or input_payload.get("tool_args")
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

    ok, reason = verify_delegation_payload(tool_name, tool_args)
    if not ok:
        print(json.dumps({"decision": "deny", "reason": reason}))
    else:
        print(json.dumps({"decision": "allow"}))
    sys.exit(0)


