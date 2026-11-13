import sys
import re
import os
from typing import List, Tuple

def verify_ai_first_format(content: str) -> Tuple[bool, List[str]]:
    errors = []

    # 1. Macro XML Tags Balance: <instructions>, <context>, <output_contract>
    macro_tags = ['instructions', 'context', 'output_contract']
    for tag in macro_tags:
        open_tags = len(re.findall(rf'<{tag}(?:\s+[^>]*)?>', content))
        close_tags = len(re.findall(rf'</{tag}>', content))
        if open_tags != close_tags:
            errors.append(f"Unbalanced macro XML tag <{tag}>: {open_tags} opening vs {close_tags} closing")
        elif open_tags == 0:
            errors.append(f"Missing required macro XML tag <{tag}>")

    # 2. YAML Nesting Depth <= 3 levels (indentation <= 6 spaces in yaml blocks)
    # Find all yaml code blocks or frontmatter
    yaml_blocks = []
    # Match YAML frontmatter
    if content.startswith('---'):
        parts = content.split('---', 2)
        if len(parts) >= 3:
            yaml_blocks.append(parts[1])

    # Match ```yaml ... ``` blocks
    fenced_yaml = re.findall(r'```(?:yaml|yml)\r?\n(.*?)\r?\n```', content, re.DOTALL)
    yaml_blocks.extend(fenced_yaml)

    for block_idx, block in enumerate(yaml_blocks):
        for line_num, line in enumerate(block.splitlines(), start=1):
            stripped = line.strip()
            if not stripped or stripped.startswith('#'):
                continue
            # Calculate leading spaces
            leading_spaces = len(line) - len(line.lstrip(' '))
            # Check indentation: > 6 spaces means nesting > 3 levels (assuming 2 spaces per level)
            if leading_spaces > 6:
                errors.append(f"YAML nesting exceeds 3 levels (found {leading_spaces} leading spaces) at block {block_idx+1}, line {line_num}: '{stripped}'")
                break

    # 3. Anti Micro-tagging: distinct XML tag count <= 12
    # Find all XML-like tags <tag> or </tag>
    tags_found = re.findall(r'</?([a-zA-Z0-9_-]+)(?:\s+[^>]*)?>', content)
    # Exclude common non-xml tags or markdown indicators if any, but in strict AI-first doc, count distinct tag names
    distinct_tags = set(tags_found)
    if len(distinct_tags) > 12:
        errors.append(f"Micro-tagging detected: {len(distinct_tags)} distinct tags found (maximum allowed is 12). Tags: {sorted(list(distinct_tags))}")

    # 4. Anti Broken/Corrupted Links
    # 4a. Backtick inside markdown link text: [`f`](...) or [`file`](...)
    bad_link_text = re.findall(r'\[`[^`\]]+`\]\([^)]+\)', content)
    if bad_link_text:
        errors.append(f"Corrupted markdown link with backtick in link text found: {bad_link_text[:3]}")

    # 4b. Absolute paths check (C:\, /home/, /Users/)
    # Check inside markdown links and text, but allow file:/// only if it's not a hardcoded machine path
    # Rule specifies: cấm absolute paths cục bộ (C:\, /home/...)
    local_abs_path_matches = re.findall(r'(?:[A-Za-z]:\\[^\s\)\`\"\'\]]+|/(?:home|Users)/[^\s\)\`\"\'\]]+)', content)
    if local_abs_path_matches:
        errors.append(f"Forbidden local absolute paths found: {local_abs_path_matches[:3]}")

    # 5. Negative Space Requirement (must_not >= 3)
    # Look for "must_not:" in YAML, or explicit list items / rules under Negative Space / must_not
    must_not_count = 0
    # Search for must_not occurrences as yaml keys or bullet points
    must_not_entries = re.findall(r'(?:-\s+must_not:|must_not:|\bCẤM\b|\bMUST NOT\b|\bmust_not\b)', content, re.IGNORECASE)
    # More specifically, count distinct negative assertions (e.g. under negative_space or must_not lists)
    must_not_yaml_items = re.findall(r'-\s*(?:must_not:|[A-Z0-9_-]*_?INV_\d+|CẤM|MUST NOT|DO NOT)\s*[:\s]', content, re.IGNORECASE)
    # Fallback to general negative space count
    total_negative_cues = len(must_not_entries)
    if total_negative_cues < 3:
        errors.append(f"Negative Space insufficient: found {total_negative_cues} negative constraints (minimum required is 3)")

    if errors:
        return False, errors
    return True, []

def main():
    if len(sys.argv) < 2:
        print("Usage: python verify-ai-first-format.py <file_path_or_glob>")
        sys.exit(1)

    target_path = sys.argv[1]
    if not os.path.exists(target_path):
        print(f"Error: File not found: {target_path}")
        sys.exit(1)

    with open(target_path, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()

    passed, errors = verify_ai_first_format(content)
    if passed:
        print(f"[PASS] {target_path} strictly adheres to AI-First Doc Formatter rules.")
        sys.exit(0)
    else:
        print(f"[FAIL] {target_path} failed AI-First Doc Formatter validation:")
        for err in errors:
            print(f"  - {err}")
        sys.exit(1)

if __name__ == '__main__':
    main()
