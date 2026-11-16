#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
===============================================================================
Script: validate-document-paths.py
Mục đích:
  Kiểm tra và xác thực tính hợp lệ của các đường dẫn (paths, links, declarations)
  bên trong một tài liệu cụ thể.
  Chỉ ra chính xác vị trí dòng (line number), trích dẫn (snippet), nguyên nhân sai
  và phân loại giữa lỗi thực tế (ERROR) vs ví dụ kỹ thuật được cố ý giữ lại (WARN/EXAMPLE).

Các quy tắc kiểm tra cốt lõi:
  1. RULE-AGENT-SKILL-NAME: Trong frontmatter của agent.md, trường skills chỉ nhận
     TÊN SKILL (identifier), CẤM chứa đường dẫn file (như 'SKILL.md' hoặc 'skills/...').
  2. RULE-HOOK-COMMAND-CWD: Trong hooks.json hoặc khối cấu hình hooks, CWD là .agents/.
     Đường dẫn lệnh trong trường 'command' CẤM chứa tiền tố '.agents/' (tránh .agents/.agents/...).
  3. RULE-DISPATCHER-STRUCTURE-MISMATCH: Phát hiện đường dẫn cũ '.agents/guards/'
     thay vì cấu trúc thực tế '.agents/scripts/guards/'.
  4. RULE-MARKDOWN-DEAD-LINK: Link markdown trỏ tới file không tồn tại trên ổ đĩa.
  5. RULE-MALFORMED-FILE-URI: Link file:/// chứa dấu gạch chéo ngược '\' hoặc sai chuẩn URI.
Chế độ xuất JSON có cấu trúc
  python .agents/scripts/validate-document-paths.py <tệp_cần_kiểm_tra> --json
Chế độ Strict (báo lỗi Exit Code 1 nếu có cả WARN_REVIEW)
  python .agents/scripts/validate-document-paths.py <tệp_cần_kiểm_tra> --strict
===============================================================================
"""

import sys
import os
import re
import json
import argparse
from urllib.parse import unquote, urlparse
from pathlib import Path

# Màu sắc hiển thị Terminal ANSI (tự động tắt nếu không hỗ trợ)
COLOR_RED = "\033[91m"
COLOR_YELLOW = "\033[93m"
COLOR_GREEN = "\033[92m"
COLOR_CYAN = "\033[96m"
COLOR_GRAY = "\033[90m"
COLOR_RESET = "\033[0m"

if not sys.stdout.isatty() or os.name == "nt" and "WT_SESSION" not in os.environ and "TERM" not in os.environ:
    # Windows cmd cũ có thể không bật ANSI mặc định
    try:
        import ctypes
        kernel32 = ctypes.windll.kernel32
        kernel32.SetConsoleMode(kernel32.GetStdHandle(-11), 7)
    except Exception:
        COLOR_RED = COLOR_YELLOW = COLOR_GREEN = COLOR_CYAN = COLOR_GRAY = COLOR_RESET = ""


def find_workspace_root(start_path: Path) -> Path:
    """Tìm thư mục gốc của workspace dựa trên .git hoặc .agents hoặc package.json."""
    curr = start_path.resolve()
    for parent in [curr] + list(curr.parents):
        if (parent / ".git").exists() or (parent / ".agents").exists() or (parent / "package.json").exists():
            return parent
    return curr.parent if curr.is_file() else curr


def is_intentional_example_context(line_text: str, prev_lines: list) -> bool:
    """
    Phát hiện xem dòng hiện tại có nằm trong ngữ cảnh minh họa lỗi / quy tắc cấm / tài liệu hóa
    thay vì là lỗi cú pháp thực sự của tài liệu hay không.
    """
    indicator_keywords = [
        "cấm", "must_not", "sai:", "lỗi:", "defect", "invalid",
        "không được", "không nên", "tránh", "ví dụ:", "example",
        "thay vì", "thất bại", "phát hiện", "bị biến thành"
    ]
    combined_text = line_text.lower()
    for prev in prev_lines[-3:]:
        combined_text += " " + prev.lower()

    return any(kw in combined_text for kw in indicator_keywords)


def validate_document(doc_path: Path, workspace_root: Path) -> list:
    """
    Kiểm tra một tài liệu và trả về danh sách các diagnostics (vị trí dòng, rule, mức độ, snippet, reason, suggestion).
    """
    diagnostics = []

    if not doc_path.exists():
        diagnostics.append({
            "line": 0,
            "rule": "RULE-FILE-NOT-FOUND",
            "severity": "ERROR",
            "snippet": str(doc_path),
            "reason": f"Tệp tài liệu mục tiêu không tồn tại trên đĩa: {doc_path}",
            "suggestion": "Kiểm tra lại đường dẫn truyền vào CLI."
        })
        return diagnostics

    try:
        with open(doc_path, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()
    except Exception as e:
        diagnostics.append({
            "line": 0,
            "rule": "RULE-IO-READ-ERROR",
            "severity": "ERROR",
            "snippet": str(doc_path),
            "reason": f"Không thể đọc tệp tài liệu: {str(e)}",
            "suggestion": "Kiểm tra quyền truy cập tệp."
        })
        return diagnostics

    doc_dir = doc_path.parent
    total_lines = len(lines)
    is_json_file = doc_path.suffix.lower() == ".json"

    # -------------------------------------------------------------
    # 1. Quét YAML Frontmatter (cho agent.md, markdown files, etc.)
    # -------------------------------------------------------------
    in_frontmatter = False
    in_skills_block = False
    frontmatter_start_line = -1

    for idx, raw_line in enumerate(lines):
        line_num = idx + 1
        line = raw_line.rstrip("\r\n")
        stripped = line.strip()

        # Nhận diện ranh giới frontmatter
        if idx == 0 and stripped == "---":
            in_frontmatter = True
            frontmatter_start_line = line_num
            continue
        elif in_frontmatter and stripped == "---":
            in_frontmatter = False
            in_skills_block = False
            continue

        if in_frontmatter:
            # Nhận diện block skills:
            if re.match(r"^skills\s*:\s*$", stripped):
                in_skills_block = True
                continue
            elif in_skills_block:
                # Nếu thụt lề thụt ra hoặc gặp key mới thì kết thúc block skills
                if re.match(r"^[a-zA-Z0-9_\-]+s*:\s*", stripped) and not stripped.startswith("-"):
                    in_skills_block = False

            if in_skills_block and stripped.startswith("-"):
                # Bóc tách giá trị skill item
                skill_val = re.sub(r"^-\s*", "", stripped).strip().strip("'\"")
                
                # Kiểm tra RULE-AGENT-SKILL-NAME
                # Skill name hợp lệ là một định danh tên (e.g. speckit-analyze, codegraph-mastery)
                # Lỗi nếu chứa đường dẫn file (SKILL.md, đuôi .md, dấu gạch chéo / hoặc tiền tố .agents/ hay skills/)
                has_path_slash = "/" in skill_val or "\\" in skill_val
                has_md_extension = skill_val.lower().endswith(".md")
                has_agents_prefix = skill_val.startswith(".agents/") or skill_val.startswith("/skills/")

                if has_md_extension or has_agents_prefix or has_path_slash:
                    # Gợi ý tên skill chuẩn
                    clean_name = skill_val
                    if "skills/" in clean_name:
                        clean_name = clean_name.split("skills/")[-1]
                    clean_name = clean_name.replace("/SKILL.md", "").replace("/skill.md", "").strip("/")
                    
                    # Kiểm tra xem đây có phải là ví dụ hay cấu hình thật
                    is_example = is_intentional_example_context(line, [lines[i] for i in range(max(0, idx - 3), idx)])
                    severity = "WARN_EXAMPLE" if is_example else "ERROR"

                    diagnostics.append({
                        "line": line_num,
                        "rule": "RULE-AGENT-SKILL-NAME",
                        "severity": severity,
                        "snippet": line.strip(),
                        "reason": f"Khai báo skill '{skill_val}' chứa đường dẫn file/thư mục. Trong Frontmatter Agent, trường 'skills' chỉ được nhận TÊN CỦA SKILL (Identifier), không nhận đường dẫn tệp.",
                        "suggestion": f"- {clean_name}"
                    })

    # -------------------------------------------------------------
    # 2. Quét Hooks JSON & Command Invariants
    # -------------------------------------------------------------
    for idx, raw_line in enumerate(lines):
        line_num = idx + 1
        line = raw_line.rstrip("\r\n")

        # Tìm trường "command": "..."
        cmd_match = re.search(r'"command"\s*:\s*"([^"]+)"', line)
        if cmd_match:
            cmd_str = cmd_match.group(1)
            # Kiểm tra tiền tố .agents/ trong command của hook
            if ".agents/" in cmd_str:
                is_example = is_intentional_example_context(line, [lines[i] for i in range(max(0, idx - 3), idx)])
                severity = "WARN_EXAMPLE" if is_example else "ERROR"

                diagnostics.append({
                    "line": line_num,
                    "rule": "RULE-HOOK-COMMAND-CWD",
                    "severity": severity,
                    "snippet": line.strip(),
                    "reason": f"Lệnh hook chứa tiền tố '.agents/': '{cmd_str}'. Do Working Directory của hooks.json mặc định đã là '.agents/', tiền tố này sẽ gây lỗi nhân đôi đường dẫn (.agents/.agents/...) dẫn tới File Not Found.",
                    "suggestion": cmd_str.replace(".agents/", "")
                })

        # -------------------------------------------------------------
        # 3. Quét cấu trúc cũ đã bị đổi vị trí (RULE-DISPATCHER-STRUCTURE-MISMATCH)
        # -------------------------------------------------------------
        # Ví dụ: .agents/guards/ thay vì .agents/scripts/guards/
        if re.search(r'(?:\.agents[\\/]guards[\\/]|["\']\.agents\/guards\/)', line):
            is_example = is_intentional_example_context(line, [lines[i] for i in range(max(0, idx - 3), idx)])
            severity = "WARN_EXAMPLE" if is_example else "WARN_REVIEW"

            diagnostics.append({
                "line": line_num,
                "rule": "RULE-DISPATCHER-STRUCTURE-MISMATCH",
                "severity": severity,
                "snippet": line.strip(),
                "reason": "Phát hiện đường dẫn tới '.agents/guards/'. Cấu trúc thực tế trong repo hiện tại là '.agents/scripts/guards/'.",
                "suggestion": line.replace(".agents/guards/", ".agents/scripts/guards/").replace(".agents\\guards\\", ".agents\\scripts\\guards\\").strip()
            })

    # -------------------------------------------------------------
    # 4. Quét Markdown Links & File URI Existence
    # -------------------------------------------------------------
    # Bắt link dạng [text](target) hoặc <file:///path>
    md_link_pattern = re.compile(r'\[([^\]]*)\]\(([^)]+)\)|<((?:file:///|https?://)[^>]+)>')

    for idx, raw_line in enumerate(lines):
        line_num = idx + 1
        line = raw_line.rstrip("\r\n")

        matches = md_link_pattern.findall(line)
        for m in matches:
            # m là tuple: (link_text, link_target, bare_angle_link)
            target = m[1] if m[1] else m[2]
            target = target.strip()

            # Bỏ qua anchors nội bộ (#heading), mailto:, http/https bên ngoài
            if not target or target.startswith("#") or target.startswith("http://") or target.startswith("https://") or target.startswith("mailto:"):
                continue

            # Bóc tách anchor trong path (ví dụ: file.md#section -> file.md)
            clean_target = target.split("#")[0].strip()
            if not clean_target:
                continue

            # 4.1. Link dạng URI file:///
            if clean_target.startswith("file:///"):
                # Kiểm tra lỗi ký tự backslash trong URI
                if "\\" in clean_target:
                    diagnostics.append({
                        "line": line_num,
                        "rule": "RULE-MALFORMED-FILE-URI",
                        "severity": "ERROR",
                        "snippet": target,
                        "reason": f"URI file:/// chứa ký tự gạch chéo ngược '\\' không hợp lệ theo chuẩn RFC 8089.",
                        "suggestion": clean_target.replace("\\", "/")
                    })

                # Chuyển URI thành đường dẫn hệ thống tệp
                parsed_path = unquote(clean_target[len("file://"):])
                # Trên Windows: /c:/path -> c:/path
                if os.name == "nt" and re.match(r"^/[a-zA-Z]:", parsed_path):
                    parsed_path = parsed_path[1:]

                resolved_path = Path(parsed_path)
                if not resolved_path.exists():
                    is_example = is_intentional_example_context(line, [lines[i] for i in range(max(0, idx - 3), idx)])
                    severity = "WARN_EXAMPLE" if is_example else "WARN_REVIEW"

                    diagnostics.append({
                        "line": line_num,
                        "rule": "RULE-MARKDOWN-DEAD-LINK",
                        "severity": severity,
                        "snippet": target,
                        "reason": f"Đường dẫn tuyệt đối không tồn tại trên ổ đĩa: '{resolved_path}'.",
                        "suggestion": "Kiểm tra lại tệp đích hoặc cập nhật vị trí mới."
                    })

            # 4.2. Link dạng Relative Path
            else:
                # Bỏ qua nếu là javascript:, data:, hoặc biến template {{...}}
                if "{{" in clean_target or clean_target.startswith("javascript:"):
                    continue

                # Chỉ kiểm tra nếu trông giống file path (có extension hoặc dấu /)
                if "/" in clean_target or "\\" in clean_target or "." in clean_target:
                    # Thử 2 phương án resolve:
                    # Cách 1: Tương đối từ thư mục của chính file markdown đang duyệt
                    opt1 = (doc_dir / clean_target).resolve()
                    # Cách 2: Tương đối từ workspace root
                    opt2 = (workspace_root / clean_target).resolve()

                    exists_opt1 = opt1.exists()
                    exists_opt2 = opt2.exists()

                    if not (exists_opt1 or exists_opt2):
                        is_example = is_intentional_example_context(line, [lines[i] for i in range(max(0, idx - 3), idx)])
                        severity = "WARN_EXAMPLE" if is_example else "WARN_REVIEW"

                        diagnostics.append({
                            "line": line_num,
                            "rule": "RULE-MARKDOWN-DEAD-LINK",
                            "severity": severity,
                            "snippet": target,
                            "reason": f"Đường dẫn tương đối không tồn tại (đã thử từ doc_dir '{doc_dir}' và workspace_root '{workspace_root}'): '{clean_target}'.",
                            "suggestion": "Kiểm tra lại đường dẫn tương đối của tệp."
                        })

    return diagnostics


def print_cli_report(doc_path: Path, diagnostics: list, json_mode: bool = False, strict: bool = False) -> int:
    """Xuất báo cáo trực quan hoặc JSON, trả về exit code."""
    if json_mode:
        output_payload = {
            "document": str(doc_path.resolve()),
            "total_issues": len(diagnostics),
            "errors": sum(1 for d in diagnostics if d["severity"] == "ERROR"),
            "warnings": sum(1 for d in diagnostics if "WARN" in d["severity"]),
            "diagnostics": diagnostics
        }
        print(json.dumps(output_payload, ensure_ascii=False, indent=2))
        if strict:
            return 1 if diagnostics else 0
        return 1 if any(d["severity"] == "ERROR" for d in diagnostics) else 0

    # Chế độ Text Terminal trực quan
    print(f"\n{COLOR_CYAN}=== KIỂM ĐỊNH ĐƯỜNG DẪN TÀI LIỆU (DOCUMENT PATH VALIDATOR) ==={COLOR_RESET}")
    print(f"Tài liệu mục tiêu: {COLOR_CYAN}{doc_path.resolve()}{COLOR_RESET}")

    err_count = sum(1 for d in diagnostics if d["severity"] == "ERROR")
    warn_example_count = sum(1 for d in diagnostics if d["severity"] == "WARN_EXAMPLE")
    warn_review_count = sum(1 for d in diagnostics if d["severity"] == "WARN_REVIEW")

    if not diagnostics:
        print(f"\n{COLOR_GREEN}[PASS] Không phát hiện bất kỳ lỗi hoặc sai lệch đường dẫn nào.{COLOR_RESET}\n")
        return 0

    print(f"\nTìm thấy {len(diagnostics)} vị trí cần lưu ý:")
    print(f"  • {COLOR_RED}ERROR (Cần sửa ngay)      : {err_count}{COLOR_RESET}")
    print(f"  • {COLOR_YELLOW}WARN_REVIEW (Nghi vấn tệp) : {warn_review_count}{COLOR_RESET}")
    print(f"  • {COLOR_GRAY}WARN_EXAMPLE (Ví dụ cố ý)  : {warn_example_count}{COLOR_RESET}\n")
    print("-" * 80)

    for d in diagnostics:
        sev = d["severity"]
        if sev == "ERROR":
            color = COLOR_RED
            tag = "[ERROR]"
        elif sev == "WARN_REVIEW":
            color = COLOR_YELLOW
            tag = "[WARN:REVIEW]"
        else:
            color = COLOR_GRAY
            tag = "[INFO:EXAMPLE]"

        print(f"{color}{tag} Dòng {d['line']}: {d['rule']}{COLOR_RESET}")
        print(f"  {COLOR_CYAN}Đoạn trích:{COLOR_RESET} {d['snippet']}")
        print(f"  {COLOR_YELLOW}Nguyên nhân:{COLOR_RESET} {d['reason']}")
        if d.get("suggestion"):
            print(f"  {COLOR_GREEN}Gợi ý khắc phục:{COLOR_RESET} {d['suggestion']}")
        print("-" * 80)

    print(f"\n{COLOR_CYAN}Hướng dẫn phán đoán:{COLOR_RESET}")
    print("  - Với [ERROR]: Đường dẫn vi phạm quy chuẩn cơ học hoặc cấu trúc runtime (Cần sửa).")
    print("  - Với [WARN:REVIEW]: Tệp không tìm thấy trên ổ đĩa. Hãy xác nhận xem có phải file chưa tạo hay link bị gõ nhầm.")
    print("  - Với [INFO:EXAMPLE]: Đường dẫn sai nhưng nằm trong câu răn đe / ví dụ kỹ thuật (Nên giữ lại để làm tài liệu).\n")

    if strict:
        return 1 if (err_count > 0 or warn_review_count > 0) else 0
    return 1 if err_count > 0 else 0


def main():
    parser = argparse.ArgumentParser(
        description="Kiểm tra và xác thực các đường dẫn bên trong tài liệu kỹ thuật."
    )
    parser.add_argument("target_file", help="Đường dẫn tới tệp tài liệu cần kiểm tra (.md, .json, .yml, v.v.)")
    parser.add_argument("--workspace", default=None, help="Đường dẫn thư mục gốc workspace (tự động nhận diện nếu để trống)")
    parser.add_argument("--json", action="store_true", help="Xuất báo cáo định dạng JSON cho CI/CD hoặc Agent parser")
    parser.add_argument("--strict", action="store_true", help="Trả về Exit Code 1 nếu có cả WARN_REVIEW")

    args = parser.parse_args()

    target_path = Path(args.target_file)
    if args.workspace:
        ws_root = Path(args.workspace)
    else:
        ws_root = find_workspace_root(target_path)

    diagnostics = validate_document(target_path, ws_root)
    exit_code = print_cli_report(target_path, diagnostics, json_mode=args.json, strict=args.strict)
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
