import sys
import re
import os
import bisect
import glob
from typing import List, Tuple

def compute_line_offsets(content: str) -> List[int]:
    """Precompute starting character offset of each line for fast line/col lookup."""
    offsets = [0]
    for idx, ch in enumerate(content):
        if ch == '\n':
            offsets.append(idx + 1)
    return offsets

def offset_to_line_col(line_offsets: List[int], offset: int) -> Tuple[int, int]:
    """Convert a 0-based character offset to 1-based (line, column)."""
    line_idx = bisect.bisect_right(line_offsets, offset) - 1
    line_num = line_idx + 1
    col_num = offset - line_offsets[line_idx] + 1
    return line_num, col_num

def verify_ai_first_format(content: str) -> Tuple[bool, List[str]]:
    errors = []
    line_offsets = compute_line_offsets(content)

    # 1. Macro XML Tags Balance: <instructions>, <context>, <output_contract>
    macro_tags = ['instructions', 'context', 'output_contract']
    for tag in macro_tags:
        open_matches = list(re.finditer(rf'<{tag}(?:\s+[^>]*)?>', content))
        close_matches = list(re.finditer(rf'</{tag}>', content))
        open_tags = len(open_matches)
        close_tags = len(close_matches)
        if open_tags != close_tags:
            if open_tags > close_tags:
                extra_match = open_matches[close_tags]
                line, col = offset_to_line_col(line_offsets, extra_match.start())
            elif close_tags > open_tags:
                extra_match = close_matches[open_tags]
                line, col = offset_to_line_col(line_offsets, extra_match.start())
            else:
                line, col = 1, 1
            errors.append(f"[line {line}, col {col}] Unbalanced macro XML tag <{tag}>: {open_tags} opening vs {close_tags} closing")
        elif open_tags == 0:
            errors.append(f"[line 1, col 1] Missing required macro XML tag <{tag}>")

    # 2. YAML Nesting Depth <= 3 levels (indentation <= 6 spaces in yaml blocks)
    yaml_block_info = []
    block_idx = 0
    fm_match = re.match(r'^---\r?\n(.*?)\r?\n---', content, re.DOTALL)
    if fm_match:
        block_idx += 1
        yaml_block_info.append((block_idx, fm_match.group(1), fm_match.start(1)))

    for m in re.finditer(r'```(?:yaml|yml)\r?\n(.*?)\r?\n```', content, re.DOTALL):
        block_idx += 1
        yaml_block_info.append((block_idx, m.group(1), m.start(1)))

    for block_num, block, start_offset in yaml_block_info:
        current_offset = start_offset
        for line_idx, line in enumerate(block.splitlines(keepends=True), start=1):
            line_str = line.rstrip('\r\n')
            stripped = line_str.strip()
            if stripped and not stripped.startswith('#'):
                leading_spaces = len(line_str) - len(line_str.lstrip(' '))
                if leading_spaces > 6:
                    doc_line, doc_col = offset_to_line_col(line_offsets, current_offset + leading_spaces)
                    errors.append(
                        f"[line {doc_line}, col {doc_col}] YAML nesting exceeds 3 levels "
                        f"(found {leading_spaces} leading spaces) at block {block_num}, line {line_idx}: '{stripped}'"
                    )
                    break
            current_offset += len(line)

    # 3. Anti Micro-tagging: distinct XML tag count <= 12
    tags_found = re.findall(r'</?([a-zA-Z0-9_-]+)(?:\s+[^>]*)?>', content)
    distinct_tags = set(tags_found)
    if len(distinct_tags) > 12:
        seen = set()
        tag_13_offset = 0
        for m in re.finditer(r'</?([a-zA-Z0-9_-]+)(?:\s+[^>]*)?>', content):
            t_name = m.group(1)
            seen.add(t_name)
            if len(seen) > 12:
                tag_13_offset = m.start()
                break
        doc_line, doc_col = offset_to_line_col(line_offsets, tag_13_offset)
        errors.append(
            f"[line {doc_line}, col {doc_col}] Micro-tagging detected: "
            f"{len(distinct_tags)} distinct tags found (maximum allowed is 12). Tags: {sorted(list(distinct_tags))}"
        )

    # 4. Anti Broken/Corrupted Links
    # 4a. Backtick inside markdown link text: [`f`](...) or [`file`](...)
    for m in re.finditer(r'\[`[^`\]]+`\]\([^)]+\)', content):
        line, col = offset_to_line_col(line_offsets, m.start())
        errors.append(f"[line {line}, col {col}] Corrupted markdown link with backtick in link text found: '{m.group(0)}'")

    # 4b. Absolute paths check (C:\, /home/, /Users/)
    for m in re.finditer(r'(?:[A-Za-z]:\\[^\s\)\`\"\'\]]+|/(?:home|Users)/[^\s\)\`\"\'\]]+)', content):
        line, col = offset_to_line_col(line_offsets, m.start())
        errors.append(f"[line {line}, col {col}] Forbidden local absolute paths found: '{m.group(0)}'")

    # 5. Negative Space Requirement (must_not >= 3)
    must_not_entries = re.findall(r'(?:-\s+must_not:|must_not:|\bCẤM\b|\bMUST NOT\b|\bmust_not\b)', content, re.IGNORECASE)
    total_negative_cues = len(must_not_entries)
    if total_negative_cues < 3:
        errors.append(f"[line 1, col 1] Negative Space insufficient: found {total_negative_cues} negative constraints (minimum required is 3)")

    if errors:
        return False, errors
    return True, []

def main():
    if len(sys.argv) < 2:
        print("Usage: python verify-ai-first-format.py <file_path_or_glob>")
        sys.exit(1)

    targets = []
    for arg in sys.argv[1:]:
        if '*' in arg or '?' in arg:
            matched = glob.glob(arg, recursive=True)
            if not matched:
                print(f"Error: No files matched pattern: {arg}")
                sys.exit(1)
            targets.extend(matched)
        elif not os.path.exists(arg):
            print(f"Error: File not found: {arg}")
            sys.exit(1)
        else:
            targets.append(arg)

    if not targets:
        print("Error: No files to verify")
        sys.exit(1)

    all_passed = True
    for target_path in targets:
        with open(target_path, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()

        passed, errors = verify_ai_first_format(content)
        if passed:
            print(f"[PASS] {target_path} strictly adheres to AI-First Doc Formatter rules.")
        else:
            all_passed = False
            print(f"[FAIL] {target_path} failed AI-First Doc Formatter validation:")
            for err in errors:
                print(f"  - {err}")

    if all_passed:
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == '__main__':
    main()
