#!/usr/bin/env python3
# .agents/scripts/guards/verification_gate.py
"""
Stop Hook Verification Gate (Feature 004 - Task T006).
Chốt chặn nghiệm thu cuối cùng (Definition of Done) của Go Engine trước khi đóng phiên làm việc.

Khế ước cốt lõi:
1. STDOUT Contract của Go Engine cho sự kiện Stop:
   - {"decision": "stop", "reason": "..."} khi thỏa mãn toàn bộ tiêu chí hoàn tất.
   - {"decision": "continue", "reason": "[STOP_GATE_BLOCKED] ..."} khi còn lỗi cơ học hoặc chưa hoàn tất.
   - TUYỆT ĐỐI CẤM trả về "allow" hoặc "deny" cho sự kiện Stop.
2. Kiểm tra bằng chứng cơ học nhị phân (test_exit_code == 0, status == "SUCCESS").
3. Dual-Channel Gate Channel 1: Thẩm định định dạng AI-First Triad cho các tài liệu specs/** và Docs/**.
4. Ghi nhật ký vết vi mô footprint bền vững vào .agents/logs/guard-footprints.jsonl.
"""

import os
import sys
import json
import time
import subprocess
import argparse
from typing import Dict, Any, Tuple, List, Optional, Union

# Nạp thư viện tiện ích nền tảng hook_utils
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
import hook_utils


def get_changed_in_scope_docs(repo_root: str) -> List[str]:
    """
    Xác định danh sách các tài liệu Markdown thuộc phạm vi kiểm định (specs/** và Docs/**).
    Tuân thủ Diff Scope Isolation (EC-001): Loại trừ Docs/Archives/ và Docs/archives/.
    """
    changed_docs: List[str] = []
    try:
        proc = subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=repo_root,
            capture_output=True,
            text=True,
            encoding="utf-8",
        )
        if proc.returncode == 0 and proc.stdout:
            for line in proc.stdout.splitlines():
                stripped = line.strip()
                if not stripped:
                    continue
                parts = stripped.split(maxsplit=1)
                if len(parts) >= 2:
                    raw_file = parts[1].strip('"').strip()
                    if "->" in raw_file:
                        raw_file = raw_file.split("->")[1].strip('"').strip()
                    norm = raw_file.replace("\\", "/").lower()
                    if (norm.startswith("specs/") or norm.startswith("docs/")) and norm.endswith(".md"):
                        if not norm.startswith("docs/archives/"):
                            changed_docs.append(raw_file)
    except Exception:
        pass

    # Loại bỏ trùng lặp mà vẫn bảo toàn thứ tự
    return list(dict.fromkeys(changed_docs))


def verify_ai_first_documents(
    docs: List[str],
    repo_root: str,
    verify_script_path: Optional[str] = None,
) -> Tuple[bool, List[str], List[str]]:
    """
    Thực thi kịch bản kiểm định verify-ai-first-format.py trên từng tài liệu trong danh sách.
    Trả về: (all_passed, failed_docs, failure_details)
    """
    if not docs:
        return True, [], []

    target_script = verify_script_path or os.path.join(
        repo_root, ".agents", "skills", "ai-first-doc-formatter", "scripts", "verify-ai-first-format.py"
    )

    if not os.path.exists(target_script):
        # Không tìm thấy script kiểm định, ghi cảnh báo và bỏ qua an toàn
        sys.stderr.write(f"[STOP_GATE_WARNING] Không tìm thấy verify-ai-first-format.py tại {target_script}\n")
        return True, [], []

    failed_docs: List[str] = []
    failure_details: List[str] = []

    for doc in docs:
        full_doc_path = os.path.abspath(os.path.join(repo_root, doc))
        if not os.path.exists(full_doc_path):
            continue

        try:
            proc = subprocess.run(
                [sys.executable, target_script, full_doc_path],
                capture_output=True,
                text=True,
                encoding="utf-8",
            )
            if proc.returncode != 0:
                failed_docs.append(doc)
                err_text = (proc.stderr or proc.stdout or "").strip()
                failure_details.append(f"[{doc}] {err_text}")
        except Exception as exc:
            failed_docs.append(doc)
            failure_details.append(f"[{doc}] Lỗi thực thi kiểm định: {exc}")

    return len(failed_docs) == 0, failed_docs, failure_details


def evaluate_stop_gate(
    payload: Dict[str, Any],
    repo_root: Optional[str] = None,
    check_git_docs: bool = True,
    verify_script_path: Optional[str] = None,
    mock_docs_to_check: Optional[List[str]] = None,
) -> Tuple[str, str, Dict[str, Any]]:
    """
    Thẩm định toàn diện điều kiện đóng phiên làm việc của Stop Hook.
    Trả về: (decision, reason, details)
    - decision: "stop" hoặc "continue" (Tuyệt đối CẤM "allow" / "deny").
    - reason: Lý do thẩm định.
    - details: Thông tin nhật ký chi tiết.
    """
    effective_root = repo_root or hook_utils.get_repo_root()
    details: Dict[str, Any] = {
        "status": "EVALUATING",
        "gate": "IN_PROGRESS",
    }

    # 1. Thẩm định trạng thái hoàn thành từ completion payload (nếu có)
    status_field = payload.get("status")
    if status_field in ("FAILURE", "BLOCKED"):
        raw_summary = payload.get("error_summary") or payload.get("error_message") or "Yêu cầu kiểm chứng cơ học chưa hoàn tất"
        prefix = "[STOP_GATE_BLOCKED] " if not raw_summary.startswith("[STOP_GATE_BLOCKED]") else ""
        reason = f"{prefix}{raw_summary}"
        details["status"] = "BLOCKED"
        details["gate"] = "COMPLETION_STATUS_FAILURE"
        details["error"] = reason
        return "continue", reason, details

    # 2. Thẩm định test_exit_code (bắt buộc phải là 0)
    if "test_exit_code" in payload:
        exit_code = payload.get("test_exit_code")
        if exit_code != 0:
            reason = f"[STOP_GATE_BLOCKED] Yêu cầu kiểm chứng cơ học chưa hoàn tất (test_exit_code={exit_code})"
            details["status"] = "BLOCKED"
            details["gate"] = "TEST_EXIT_CODE_NONZERO"
            details["error"] = reason
            return "continue", reason, details

    # 3. Thẩm định terminationReason từ Go Engine
    term_reason = payload.get("terminationReason")
    if term_reason:
        details["terminationReason"] = term_reason
        if term_reason not in ("NO_TOOL_CALL", "COMPLETED", "NORMAL", "TASK_FINISHED"):
            # Phiên dừng bất thường (như bị cancel hoặc lỗi ngoài ý muốn)
            reason = f"[STOP_GATE_BLOCKED] Phiên bị dừng bất thường: {term_reason}"
            details["status"] = "BLOCKED"
            details["gate"] = "ABNORMAL_TERMINATION"
            details["error"] = reason
            return "continue", reason, details

    # 4. Thẩm định Dual-Channel Gate Channel 1: AI-First Triad Documentation Quality
    docs_to_verify = mock_docs_to_check if mock_docs_to_check is not None else (
        get_changed_in_scope_docs(effective_root) if check_git_docs else []
    )

    if docs_to_verify:
        passed, failed_docs, failures = verify_ai_first_documents(
            docs_to_verify, effective_root, verify_script_path
        )
        if not passed:
            details["status"] = "BLOCKED"
            details["gate"] = "DOC_FORMAT_FAILED"
            details["failed_files"] = failed_docs
            reason = f"[STOP_GATE_BLOCKED] Tài liệu đặc tả/kỹ thuật vi phạm chuẩn AI-First Triad: {', '.join(failed_docs)}"
            return "continue", reason, details
        else:
            details["ai_first_docs"] = "PASSED"
    else:
        details["ai_first_docs"] = "SKIPPED_NO_CHANGES"

    # Tất cả các chốt chặn đều thỏa mãn Definition of Done
    details["status"] = "PASSED"
    details["gate"] = "SATISFIED"
    return "stop", "All completion criteria satisfied", details


def handle_stop(
    payload: Dict[str, Any],
    repo_root: Optional[str] = None,
    log_path: Optional[str] = None,
    check_git_docs: bool = True,
    mock_docs_to_check: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Xử lý sự kiện Stop Hook cho Go Engine:
    - Thẩm định điều kiện đóng phiên qua evaluate_stop_gate.
    - Ghi footprint vi mô theo First-Class Telemetry.
    - Xuất cảnh báo ra STDERR nếu bị block.
    - Trả về STDOUT đúng chuẩn struct Go Engine: {"decision": "stop" | "continue", "reason": "..."}.
    """
    t0 = time.perf_counter()
    decision, reason, details = evaluate_stop_gate(
        payload=payload,
        repo_root=repo_root,
        check_git_docs=check_git_docs,
        mock_docs_to_check=mock_docs_to_check,
    )
    duration_ms = (time.perf_counter() - t0) * 1000.0

    # Phát cảnh báo ra STDERR nếu bị block
    if decision == "continue":
        sys.stderr.write(f"[VERIFICATION GATE BLOCKED] {reason}\n")
    else:
        sys.stderr.write("[VERIFICATION GATE] Hoàn tất phiên làm việc. Xác thực cổng Definition of Done thành công.\n")

    # Ghi nhật ký vết vi mô footprint
    footprint_status = "STOP" if decision == "stop" else "CONTINUE"
    target_identifier = str(payload.get("task_id") or payload.get("terminationReason") or "STOP_GATE")
    hook_utils.record_footprint(
        guard_name="verification_gate",
        event="Stop",
        status=footprint_status,
        target=target_identifier,
        duration_ms=duration_ms,
        details=details,
        log_path=log_path,
    )

    return {
        "decision": decision,
        "reason": reason,
    }


def main():
    """Hàm thực thi CLI chính khi Go Engine triệu gọi Stop hook qua cmd /c."""
    parser = argparse.ArgumentParser(description="Antigravity Verification Gate (Stop Hook)")
    parser.add_argument("--payload", type=str, default=None, help="JSON payload passed as CLI argument")
    args, _ = parser.parse_known_args()

    payload = hook_utils.parse_stdin_payload(args.payload)
    result = handle_stop(payload)

    # Xuất kết quả chuẩn Go Engine: {"decision": "stop" | "continue", "reason": "..."}
    hook_utils.emit_stdout_json(result)
    sys.exit(0)


if __name__ == "__main__":
    main()
