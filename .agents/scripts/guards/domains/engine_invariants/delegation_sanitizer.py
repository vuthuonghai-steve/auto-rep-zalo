# .agents/guards/domains/engine_invariants/delegation_sanitizer.py
# Module kiểm dịch ngôn ngữ và chốt chặn cơ học vòng đời liên tác tử (3-Layer Quarantine Firewall)
# Tuân thủ: Pure Python Standard Library, Zero Dependencies, Execution Time < 5ms

import re
from typing import Tuple, Dict, Any

FORBIDDEN_BAIT_PATTERNS = [
    r"\?",
    r"(?i)\b(đã pass|đã xong|chỉ cần|xác nhận giúp|như đã thảo luận|tôi nghĩ|có vẻ)\b",
    r"(?i)\b(already passed|just confirm|looks good|as discussed|i fixed|please verify)\b"
]

def verify_delegation_payload(tool_name: str, tool_args: Dict[str, Any]) -> Tuple[bool, str]:
    """
    Kiểm định tính hợp lệ của gói tin giao việc (invoke_subagent) hoặc tương tác tiếp diễn (send_message).
    Trả về: (True, "OK") nếu hợp lệ; (False, "Lý do từ chối") nếu vi phạm.
    """
    tool_args = tool_args or {}

    # 1. Chặn tương tác đa lượt với Ephemeral Auditor (Chính sách bất đối xứng)
    if tool_name == "send_message":
        recipient = str(tool_args.get("Recipient", "")).lower()
        if "auditor" in recipient:
            return (
                False,
                "[AUDITOR_IS_EPHEMERAL] CẤM dùng send_message với surgical-auditor. "
                "Auditor là tác nhân One-Shot (Stateless Ephemeral). "
                "Nếu task FAIL, hãy gửi <remediation_manifest> cho Builder, sau đó tạo Auditor mới bằng invoke_subagent sau khi Builder đã commit bản vá."
            )

    raw_text = str(tool_args.get("Prompt") or tool_args.get("Message") or "")

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
    elif tool_name == "send_message":
        if "<remediation_manifest>" not in raw_text and "<task_delegation>" not in raw_text:
            return (
                False,
                "[REMEDIATION_REQUIRED] Lệnh send_message gửi cho worker bắt buộc phải đóng gói trong khung <remediation_manifest>. "
                "Cấm gửi văn xuôi giải thích chủ quan."
            )

    # 4. Quét tường lửa chống mớm ý (Anti-Sycophancy Lexical Firewall)
    for pattern in FORBIDDEN_BAIT_PATTERNS:
        match = re.search(pattern, raw_text)
        if match:
            matched_phrase = match.group(0)
            return (
                False,
                f"[SYCOPHANCY_BAIT_DETECTED] Phát hiện mẫu câu dẫn dắt hoặc định hướng chủ quan ('{matched_phrase}'). "
                "Hãy xóa bỏ nhận định cá nhân và chỉ truyền tọa độ tệp nguyên bản."
            )

    return True, "OK"
