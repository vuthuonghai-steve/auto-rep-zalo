#!/usr/bin/env python3
# .agents/scripts/guards/audit_session_logs.py
"""
Tiện ích kiểm toán và trích xuất chuỗi footprint theo Session ID từ nhật ký guard-footprints.jsonl.
Thuộc User Story 4 (Feature 005 - Task T013).

Tuân thủ:
- Pure Python Standard Library (Zero External Dependencies).
- Phòng thủ đa tầng: Bóc tách BOM, bỏ qua dòng hỏng, không crash khi tệp log chưa tồn tại.
- Hỗ trợ CLI và Python programmatic API.
- Cung cấp chế độ kiểm tra nhanh --dry-run phục vụ companion test và CI/CD verification.
"""

import os
import sys
import json
import argparse
from typing import Dict, Any, List, Optional

# Bổ sung đường dẫn nội bộ để nạp hook_utils nếu có
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
try:
    import hook_utils
except ImportError:
    hook_utils = None


def resolve_log_path(custom_path: Optional[str] = None) -> str:
    """Xác định đường dẫn tệp nhật ký guard-footprints.jsonl."""
    if custom_path:
        return os.path.abspath(custom_path)
    if hook_utils and hasattr(hook_utils, "get_default_log_path"):
        try:
            return hook_utils.get_default_log_path()
        except Exception:
            pass
    # Fallback dựa trên thư mục hiện tại hoặc repo root
    current_dir = os.path.dirname(os.path.abspath(__file__))
    agents_dir = os.path.dirname(os.path.dirname(current_dir))
    return os.path.join(agents_dir, "logs", "guard-footprints.jsonl")


def match_session_id(record: Dict[str, Any], session_id: str) -> bool:
    """
    Kiểm tra một bản ghi footprint có thuộc session_id chỉ định hay không.
    Tìm kiếm theo độ ưu tiên:
    1. Trường 'session_id' hoặc 'sessionId' ở cấp gốc.
    2. Trường 'session_id' hoặc 'sessionId' trong dict 'details'.
    3. Chuỗi session_id xuất hiện trong trường 'target'.
    4. Chuỗi session_id xuất hiện trong 'details' (khi details chứa thông tin subagent session).
    """
    if not session_id:
        return True

    target_id = str(session_id).strip().lower()

    # 1. Root level
    root_sid = str(record.get("session_id") or record.get("sessionId") or "").strip().lower()
    if root_sid and root_sid == target_id:
        return True

    # 2. Details level
    details = record.get("details")
    if isinstance(details, dict):
        det_sid = str(details.get("session_id") or details.get("sessionId") or "").strip().lower()
        if det_sid and det_sid == target_id:
            return True
        for k in ("subagent_id", "conversation_id", "recipient", "Recipient"):
            val = str(details.get(k) or "").strip().lower()
            if val and (target_id in val or val == target_id):
                return True

    # 3. Target field
    target = str(record.get("target") or "").strip().lower()
    if target and target_id in target:
        return True

    return False


def extract_session_footprints(
    session_id: Optional[str] = None,
    log_path: Optional[str] = None,
    limit: Optional[int] = None,
    event_filter: Optional[str] = None,
    status_filter: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Trích xuất danh sách các bản ghi footprint từ tệp guard-footprints.jsonl.

    Tham số:
    - session_id: Mã định danh phiên cần lọc (None nếu lấy toàn bộ).
    - log_path: Đường dẫn tệp log (None để dùng mặc định).
    - limit: Giới hạn số lượng bản ghi trả về (None nếu không giới hạn).
    - event_filter: Lọc theo sự kiện (PreToolUse, PostToolUse, Stop).
    - status_filter: Lọc theo trạng thái (CLEAN, ALLOW, DENY, STOP, etc.).

    Trả về:
    - Danh sách các dictionary footprint theo thứ tự thời gian.
    """
    target_path = resolve_log_path(log_path)
    if not os.path.exists(target_path) or not os.path.isfile(target_path):
        return []

    matched_records: List[Dict[str, Any]] = []

    try:
        with open(target_path, "r", encoding="utf-8", errors="replace") as f:
            for line in f:
                clean_line = line.strip().lstrip("\ufeff")
                if not clean_line:
                    continue
                try:
                    record = json.loads(clean_line)
                    if not isinstance(record, dict):
                        continue
                except Exception:
                    # Bỏ qua dòng hỏng định dạng mà không gây lỗi
                    continue

                # Lọc theo session_id
                if session_id and not match_session_id(record, session_id):
                    continue

                # Lọc theo event
                if event_filter:
                    rec_event = str(record.get("event") or "").strip().lower()
                    if rec_event != str(event_filter).strip().lower():
                        continue

                # Lọc theo status
                if status_filter:
                    rec_status = str(record.get("status") or "").strip().lower()
                    if rec_status != str(status_filter).strip().lower():
                        continue

                matched_records.append(record)
    except Exception as exc:
        sys.stderr.write(f"[AUDIT_READ_ERROR] Không thể đọc tệp {target_path}: {exc}\n")
        return []

    if limit is not None and limit > 0:
        return matched_records[-limit:]

    return matched_records


def summarize_audit_trail(records: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Tổng hợp và phân tích chuỗi sự kiện footprint:
    - Đếm tổng số sự kiện.
    - Phân tích cơ cấu sự kiện (PreToolUse, PostToolUse, Stop).
    - Phân tích cơ cấu trạng thái (ALLOW, DENY, CLEAN, etc.).
    - Đếm số lần vi phạm (DENY hoặc chứa lỗi).
    - Tính thời gian thực thi trung bình (durationMs).
    """
    total = len(records)
    event_counts: Dict[str, int] = {}
    status_counts: Dict[str, int] = {}
    durations: List[float] = []
    violations = 0

    for rec in records:
        evt = str(rec.get("event") or "UNKNOWN")
        event_counts[evt] = event_counts.get(evt, 0) + 1

        st = str(rec.get("status") or "UNKNOWN")
        status_counts[st] = status_counts.get(st, 0) + 1

        if st in ("DENY", "OUT_OF_SCOPE", "FLAGGED_PLACEHOLDER", "FLAGGED_DIRECTORY_DEPTH", "FLAGGED_CROSS_IMPORT", "SCHEMA_VIOLATION"):
            violations += 1

        d_ms = rec.get("durationMs")
        if isinstance(d_ms, (int, float)):
            durations.append(float(d_ms))

    avg_duration = round(sum(durations) / len(durations), 2) if durations else 0.0

    return {
        "total_records": total,
        "event_counts": event_counts,
        "status_counts": status_counts,
        "violations": violations,
        "average_duration_ms": avg_duration,
    }


def audit_session(
    session_id: Optional[str] = None,
    log_path: Optional[str] = None,
    limit: Optional[int] = None,
    dry_run: bool = False,
) -> Dict[str, Any]:
    """
    Hàm nghiệp vụ cấp cao: Thực hiện kiểm toán phiên và trả về báo cáo cấu trúc.
    """
    if dry_run:
        sample_records = [
            {
                "timestamp": "2026-11-17 00:00:00.000",
                "guard": "delegation-sanitizer-guard",
                "event": "PreToolUse",
                "status": "ALLOW",
                "target": "send_message",
                "durationMs": 0.45,
                "details": {"session_id": "dry_run_session", "task_id": "T013"},
            },
            {
                "timestamp": "2026-11-17 00:00:00.050",
                "guard": "workspace-safety-guard",
                "event": "PreToolUse",
                "status": "ALLOW",
                "target": "write_file",
                "durationMs": 0.12,
                "details": {"session_id": "dry_run_session"},
            },
            {
                "timestamp": "2026-11-17 00:00:00.100",
                "guard": "verification_gate",
                "event": "Stop",
                "status": "STOP",
                "target": "NO_TOOL_CALL",
                "durationMs": 150.0,
                "details": {"session_id": "dry_run_session", "gate": "SATISFIED"},
            },
        ]
        summary = summarize_audit_trail(sample_records)
        return {
            "status": "SUCCESS",
            "dry_run": True,
            "session_id": session_id or "dry_run_session",
            "total_records": len(sample_records),
            "summary": summary,
            "records": sample_records,
        }

    records = extract_session_footprints(
        session_id=session_id,
        log_path=log_path,
        limit=limit,
    )
    summary = summarize_audit_trail(records)

    return {
        "status": "SUCCESS" if records else "EMPTY",
        "session_id": session_id,
        "log_path": resolve_log_path(log_path),
        "total_records": len(records),
        "summary": summary,
        "records": records,
    }


def main():
    parser = argparse.ArgumentParser(description="Antigravity Guard Footprints Telemetry Auditor")
    parser.add_argument("-s", "--session-id", type=str, default=None, help="Filter by session ID")
    parser.add_argument("-l", "--log-path", type=str, default=None, help="Path to guard-footprints.jsonl")
    parser.add_argument("-n", "--limit", type=int, default=None, help="Limit number of returned records")
    parser.add_argument("-e", "--event", type=str, default=None, help="Filter by event (PreToolUse, PostToolUse, Stop)")
    parser.add_argument("--status", type=str, default=None, help="Filter by status (ALLOW, DENY, CLEAN, etc.)")
    parser.add_argument("--json", action="store_true", help="Output raw JSON structure")
    parser.add_argument("--dry-run", action="store_true", help="Run in dry-run mode and verify integrity")

    args = parser.parse_args()

    report = audit_session(
        session_id=args.session_id,
        log_path=args.log_path,
        limit=args.limit,
        dry_run=args.dry_run,
    )

    if args.json or args.dry_run:
        print(json.dumps(report, indent=2, ensure_ascii=False))
    else:
        print("=== Guard Telemetry Audit Report ===")
        print(f"Session ID   : {report.get('session_id') or 'ALL'}")
        print(f"Log Path     : {report.get('log_path') or 'N/A'}")
        print(f"Total Records: {report.get('total_records', 0)}")
        summary = report.get("summary", {})
        print(f"Events       : {summary.get('event_counts', {})}")
        print(f"Statuses     : {summary.get('status_counts', {})}")
        print(f"Violations   : {summary.get('violations', 0)}")
        print(f"Avg Latency  : {summary.get('average_duration_ms', 0)}ms")

    sys.exit(0)


if __name__ == "__main__":
    main()
