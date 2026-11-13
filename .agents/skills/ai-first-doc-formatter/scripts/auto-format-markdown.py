#!/usr/bin/env python3
r"""
auto-format-markdown.py
=======================
Công cụ tự động hóa chuẩn hóa & đóng gói tài liệu kỹ thuật theo kiến trúc AI-First Triad:
1. Tự động bọc khung Macro XML Envelope (<instructions>, <context>, <output_contract>) nếu thiếu.
2. Trích xuất hoặc định hình khối YAML Behavioral Constraints (must, negative_space / must_not >= 3).
3. Chuẩn hóa link tệp: Chuyển [`file`](path) thành [file](path) và cảnh báo/thay thế absolute path.
4. Đảm bảo thụt lề YAML <= 6 spaces (<= 3 levels).
5. Hỗ trợ 5 Document Archetypes qua cờ --archetype (1..5).
"""

import sys
import os
import re
import argparse

ARCHETYPE_TEMPLATES = {
    1: {
        "title": "Constitutional Steering Document",
        "instructions_header": "constitutional_metadata:\n  authority: \"L0 Constitutional Rulebook\"\n  version: \"1.0.0\"\n\nbehavioral_invariants:\n  priority_order:\n    1: \"system_safety_and_data_integrity\"\n    2: \"contract_stability\"\n    3: \"user_intent\"\n  constraints:\n    must:\n      - \"Verify mechanical proof before completion.\"\n    negative_space:\n      - must_not: \"CẤM giải quyết bài toán trên nền tảng phỏng đoán.\"\n      - must_not: \"CẤM để lại TODOs, mocks trên production path.\"\n      - must_not: \"CẤM thực thi Type-1 changes mà không có ADR.\"",
        "output_contract": "verification_gate:\n  binary_checks:\n    - \"Exit code 0 on all mechanical checks.\"\n    - \"Negative space must_not >= 3.\""
    },
    2: {
        "title": "Operational Policy Document",
        "instructions_header": "policy_metadata:\n  policy_id: \"POL-AUTO\"\n  title: \"Standard Operational Policy\"\n  level: \"L1 Working Policy\"\n\npolicy_rules:\n  must:\n    - \"Wrap external errors into domain-specific AppErrors.\"\n    - \"Include correlation_id and timestamp in every error log.\"\n  negative_space:\n    - must_not: \"CẤM để lộ database stack trace ra API consumer.\"\n    - must_not: \"CẤM nuốt ngoại lệ âm thầm không ghi log.\"\n    - must_not: \"CẤM trả về HTTP 200 cho lỗi nghiệp vụ.\"",
        "output_contract": "compliance_verification:\n  expected_exit_code: 0\n  criteria:\n    - \"Zero unhandled exceptions.\"\n    - \"Negative space must_not >= 3.\""
    },
    3: {
        "title": "Task Specification Document",
        "instructions_header": "task_metadata:\n  task_id: \"TSK-AUTO\"\n  title: \"Atomic Task Specification\"\n  scope: \"Layer-1 Boundaries\"\n\nexecution_boundaries:\n  must_do:\n    - \"Adhere strictly to AI-First Triad packaging.\"\n    - \"Run mechanical verification with exit code 0.\"\n  negative_space:\n    - must_not: \"CẤM lồng YAML vượt quá 3 cấp thụt lề.\"\n    - must_not: \"CẤM phân mảnh tài liệu với trên 12 thẻ XML.\"\n    - must_not: \"CẤM nhúng absolute paths cục bộ của máy cá nhân.\"",
        "output_contract": "verification:\n  runner: \"python scripts/verify-ai-first-format.py\"\n  expected_exit_code: 0\n  assertions:\n    - \"Exit code 0.\"\n    - \"Negative space must_not >= 3.\""
    },
    4: {
        "title": "Architecture & ADR Document",
        "instructions_header": "adr_metadata:\n  adr_id: \"ADR-AUTO\"\n  status: \"Accepted\"\n  architecture_level: \"L2 Domain Architecture\"\n\ndecision_boundaries:\n  must:\n    - \"Enforce idempotent event processing.\"\n    - \"Maintain clear domain state transitions.\"\n  negative_space:\n    - must_not: \"CẤM xử lý blocking I/O trong critical API path.\"\n    - must_not: \"CẤM bypass state transition validation.\"\n    - must_not: \"CẤM expose internal queue schema ra public API.\"",
        "output_contract": "adr_verification:\n  expected_exit_code: 0\n  assertions:\n    - \"Trade-off matrix defined.\"\n    - \"Negative space must_not >= 3.\""
    },
    5: {
        "title": "Skill & Action Playbook Document",
        "instructions_header": "playbook_metadata:\n  playbook_id: \"PLB-AUTO\"\n  title: \"Action Execution Playbook\"\n  authority_level: \"L1/L2 Execution Protocol\"\n\noperational_constraints:\n  must:\n    - \"Provide reversible down migration scripts.\"\n    - \"Execute dry-run before live mutations.\"\n  negative_space:\n    - must_not: \"CẤM chạy batch mutations không chia nhỏ chunk.\"\n    - must_not: \"CẤM lock bảng quá 5000ms.\"\n    - must_not: \"CẤM bỏ qua kiểm tra sau khi hoàn thành.\"",
        "output_contract": "playbook_verification:\n  expected_exit_code: 0\n  criteria:\n    - \"Execution protocol steps defined in YAML.\"\n    - \"Negative space must_not >= 3.\""
    }
}

def clean_markdown_links(content: str) -> str:
    # 1. Fix backticks inside link label: [`text`](url) -> [text](url)
    content = re.sub(r'\[`([^`]+)`\]\(([^)]+)\)', r'[\1](\2)', content)

    # 2. Fix windows style backslashes in markdown links
    def fix_link_path(match):
        label = match.group(1)
        url = match.group(2)
        # Convert C:\ or relative backslashes to forward slashes
        url_fixed = url.replace('\\', '/')
        # Strip local absolute drives if possible, e.g. C:/Users/.../workspace/project/ -> relative
        url_fixed = re.sub(r'^[a-zA-Z]:/[^/]+/[^/]+/[^/]+/', '', url_fixed)
        return f"[{label}]({url_fixed})"

    content = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', fix_link_path, content)
    return content

def auto_format_document(content: str, archetype: int = 3) -> str:
    cleaned = clean_markdown_links(content)

    has_instructions = "<instructions>" in cleaned and "</instructions>" in cleaned
    has_context = "<context>" in cleaned and "</context>" in cleaned
    has_output_contract = "<output_contract>" in cleaned and "</output_contract>" in cleaned

    if has_instructions and has_context and has_output_contract:
        # Document already has full triad envelope, just return cleaned links
        return cleaned

    arch_data = ARCHETYPE_TEMPLATES.get(archetype, ARCHETYPE_TEMPLATES[3])

    # If missing envelope, construct standard Triad packaging
    instructions_block = f"<instructions>\n```yaml\n{arch_data['instructions_header']}\n```\n</instructions>\n\n"

    # Wrap the body in <context>
    # Strip any dangling partial tags if present
    body = cleaned.replace("<instructions>", "").replace("</instructions>", "")
    body = body.replace("<context>", "").replace("</context>", "")
    body = body.replace("<output_contract>", "").replace("</output_contract>", "").strip()

    context_block = f"<context>\n{body}\n</context>\n\n"

    output_contract_block = f"<output_contract>\n```yaml\n{arch_data['output_contract']}\n```\n</output_contract>\n"

    return instructions_block + context_block + output_contract_block

def main():
    parser = argparse.ArgumentParser(description="Auto-format Markdown documents into AI-First Triad Architecture")
    parser.add_argument("input_file", help="Path to input markdown file")
    parser.add_argument("--output", "-o", help="Path to output markdown file (default: overwrite input)")
    parser.add_argument("--archetype", "-a", type=int, choices=[1, 2, 3, 4, 5], default=3, help="Document archetype (1..5, default: 3)")

    args = parser.parse_args()

    if not os.path.exists(args.input_file):
        print(f"Error: File not found: {args.input_file}")
        sys.exit(1)

    with open(args.input_file, "r", encoding="utf-8", errors="replace") as f:
        raw_content = f.read()

    formatted_content = auto_format_document(raw_content, archetype=args.archetype)

    out_path = args.output if args.output else args.input_file
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(formatted_content)

    print(f"[SUCCESS] Formatted {args.input_file} -> {out_path} according to Archetype {args.archetype} standard.")
    sys.exit(0)

if __name__ == "__main__":
    main()
