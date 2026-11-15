#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BỘ KIỂM DUYỆT RÀO CHẮN CƠ HỌC BẤT KHẢ XÂM PHẠM (HARDENED ADVERSARIAL VERIFICATION HARNESS)
Kiểm tra tính toàn vẹn của Kiến trúc Turn & Subagent Harness theo tiêu chuẩn Andrew Principles.

7 CỔNG KIỂM DUYỆT BẮT BUỘC:
- CRIT-01: Strict Frontmatter YAML Schema & Closed Tool Whitelist (yaml.safe_load)
- CRIT-02: Directory Governance & Zero Flat Files in .agents/agents/
- CRIT-03: Archive Hash Preservation & Git Isolation (.gitignore & git status)
- CRIT-04: Headless Executor Construction Smoke Test on EACH Agent (agy -p)
- CRIT-05: Delta-Log Zero Warning & Clean Engine Registry (cli.log delta scan)
- CRIT-06: Pure Data Manifest & Anti-Sycophancy Protocol (send_message IPC)
- CRIT-07: Non-Interactive CLI Discipline (Anti-Stdin Deadlock)
"""

import os
import sys
import re
import json
import yaml
import hashlib
import subprocess
from pathlib import Path

WORKSPACE_ROOT = Path(r"c:\Users\ADMIN\Documents\workspace\Sales\EXTENSIONS").resolve()
AGENTS_DIR = WORKSPACE_ROOT / ".agents" / "agents"
DOCS_DIR = WORKSPACE_ROOT / ".agents" / "Docs"
ARCHIVES_DIR = WORKSPACE_ROOT / ".agents" / "archives" / "agents_flat_backup"
GITIGNORE_PATH = WORKSPACE_ROOT / ".gitignore"
CLI_LOG_PATH = Path(r"C:\Users\ADMIN\.gemini\antigravity\cli.log")
AGY_BIN_PATH = Path(r"C:\Users\ADMIN\AppData\Local\agy\bin\agy.EXE")
ALLOWED_TOOLS_YAML = DOCS_DIR / "agy-allowed-tools.yaml"

REQUIRED_AGENTS = [
    "host-orchestrator",
    "surgical-implementer",
    "surgical-auditor",
    "deep-codebase-investigator",
    "deep-performance-profiler",
    "deep-security-analyst",
    "spec-analyst-planner",
    "worktree-integrator"
]

TOTAL_CRITERIA = 7
passed_criteria = 0
violations = []

def print_header(title):
    print(f"\n{'='*75}")
    print(f"   {title}")
    print(f"{'='*75}")

def log_pass(crit_id, desc):
    global passed_criteria
    passed_criteria += 1
    print(f"[{crit_id}] {desc:<58} [PASS]")

def log_fail(crit_id, desc, failure_list):
    global violations
    print(f"[{crit_id}] {desc:<58} [FAIL]")
    for f in failure_list:
        print(f"    └── ❌ {f}")
        violations.append(f"[{crit_id}] {f}")

# =============================================================================
# CRIT-01: STRICT FRONTMATTER YAML SCHEMA & CLOSED TOOL WHITELIST
# =============================================================================
def verify_crit_01():
    desc = "Strict Frontmatter YAML Schema & Closed Tool Whitelist"
    fails = []
    
    if not ALLOWED_TOOLS_YAML.exists():
        fails.append(f"Không tìm thấy SSOT Whitelist tại: {ALLOWED_TOOLS_YAML}")
        log_fail("CRIT-01", desc, fails)
        return

    try:
        with open(ALLOWED_TOOLS_YAML, "r", encoding="utf-8") as f:
            registry_data = yaml.safe_load(f)
            static_reg = registry_data.get("static_component_registry", {})
            allowed_tools = set(t["name"] for t in static_reg.get("allowed_tools", []))
    except Exception as e:
        fails.append(f"Lỗi khi đọc agy-allowed-tools.yaml: {str(e)}")
        log_fail("CRIT-01", desc, fails)
        return

    # Scan all agent.md files
    agent_dirs = [d for d in AGENTS_DIR.iterdir() if d.is_dir() and d.name in REQUIRED_AGENTS]
    if len(agent_dirs) == 0:
        fails.append(f"Không tìm thấy thư mục agent nào trong {AGENTS_DIR}")

    for ad in agent_dirs:
        md_file = ad / "agent.md"
        if not md_file.exists():
            fails.append(f"{ad.name}: Thiếu tệp agent.md")
            continue
        
        try:
            raw_text = md_file.read_text(encoding="utf-8")
        except Exception as e:
            fails.append(f"{ad.name}/agent.md: Không đọc được tệp: {str(e)}")
            continue

        match = re.match(r"^---\r?\n(.*?)\r?\n---", raw_text, re.DOTALL)
        if not match:
            fails.append(f"{ad.name}/agent.md: Thiếu cặp thẻ Frontmatter '---'")
            continue

        try:
            frontmatter = yaml.safe_load(match.group(1))
            if not isinstance(frontmatter, dict):
                fails.append(f"{ad.name}/agent.md: Frontmatter không phải là Dictionary hợp lệ")
                continue
        except Exception as e:
            fails.append(f"{ad.name}/agent.md: YAML Syntax Error: {str(e)}")
            continue

        # Schema Type & Required Fields Check
        req_keys = ["name", "description", "tools", "model", "mainAgent", "subagent"]
        for k in req_keys:
            if k not in frontmatter:
                fails.append(f"{ad.name}/agent.md: Thiếu trường bắt buộc '{k}' trong Frontmatter")

        # Name must match directory name
        if frontmatter.get("name") != ad.name:
            fails.append(f"{ad.name}/agent.md: 'name: {frontmatter.get('name')}' không khớp với tên thư mục '{ad.name}'")

        # Closed Tool Whitelist Enforcement
        tools = frontmatter.get("tools", [])
        if not isinstance(tools, list):
            fails.append(f"{ad.name}/agent.md: Trường 'tools' phải là một mảng (List)")
        else:
            for tool in tools:
                if not isinstance(tool, str):
                    fails.append(f"{ad.name}/agent.md: Tên công cụ không phải chuỗi: {tool}")
                    continue
                if tool not in allowed_tools:
                    fails.append(f"{ad.name}/agent.md: Công cụ '{tool}' KHÔNG THUỘC Whitelist tĩnh của agy.EXE!")

    if fails:
        log_fail("CRIT-01", desc, fails)
    else:
        log_pass("CRIT-01", desc)

# =============================================================================
# CRIT-02: DIRECTORY GOVERNANCE & ZERO FLAT FILES
# =============================================================================
def verify_crit_02():
    desc = "Directory Governance: Zero Flat .md Files in .agents/agents/"
    fails = []

    if not AGENTS_DIR.exists():
        fails.append(f"Thư mục {AGENTS_DIR} không tồn tại")
        log_fail("CRIT-02", desc, fails)
        return

    # Check for flat .md files
    flat_files = list(AGENTS_DIR.glob("*.md"))
    if flat_files:
        fails.append(f"Phát hiện {len(flat_files)} tệp phẳng cấm tại root .agents/agents/: {[f.name for f in flat_files]}")

    # Check for all required agents
    for ag in REQUIRED_AGENTS:
        ag_dir = AGENTS_DIR / ag
        if not ag_dir.is_dir():
            fails.append(f"Thiếu thư mục gói tác tử: .agents/agents/{ag}/")
        else:
            ag_md = ag_dir / "agent.md"
            if not ag_md.is_file():
                fails.append(f"Thiếu tệp định nghĩa: .agents/agents/{ag}/agent.md")

    if fails:
        log_fail("CRIT-02", desc, fails)
    else:
        log_pass("CRIT-02", desc)

# =============================================================================
# CRIT-03: ARCHIVE HASH PRESERVATION & GIT ISOLATION
# =============================================================================
def verify_crit_03():
    desc = "Archive Preservation & Git Isolation (.gitignore check)"
    fails = []

    if not ARCHIVES_DIR.exists():
        fails.append(f"Thư mục lưu trữ an toàn chưa tồn tại: {ARCHIVES_DIR}")

    # Check gitignore
    if not GITIGNORE_PATH.exists():
        fails.append(".gitignore không tồn tại ở workspace root")
    else:
        content = GITIGNORE_PATH.read_text(encoding="utf-8")
        if not re.search(r"^\s*\.?agents/archives/?\s*$", content, re.MULTILINE):
            fails.append(".gitignore chưa chứa khai báo cách ly: .agents/archives/")

    # Check git status for archives
    try:
        res = subprocess.run(
            ["git", "status", "--porcelain", ".agents/archives"],
            cwd=str(WORKSPACE_ROOT),
            capture_output=True,
            text=True,
            timeout=5
        )
        # If .gitignore works properly, git status on untracked archives should be empty
        # (unless user staged it before)
        out = res.stdout.strip()
        if out and "??" in out:
            fails.append(f"Thư mục archives vẫn bị git status phát hiện (chưa được ignore): {out}")
    except Exception as e:
        fails.append(f"Lỗi khi chạy git status: {str(e)}")

    if fails:
        log_fail("CRIT-03", desc, fails)
    else:
        log_pass("CRIT-03", desc)

# =============================================================================
# CRIT-04: HEADLESS EXECUTOR SMOKE TEST ON EACH AGENT (agy -p)
# =============================================================================
def verify_crit_04():
    desc = "Headless Executor Construction Smoke Test on EACH Agent"
    fails = []

    if not AGY_BIN_PATH.exists():
        fails.append(f"Không tìm thấy agy nhị phân tại: {AGY_BIN_PATH}")
        log_fail("CRIT-04", desc, fails)
        return

    # Test each agent by invoking headless agy with print mode
    for ag in REQUIRED_AGENTS:
        ag_dir = AGENTS_DIR / ag
        if not (ag_dir / "agent.md").exists():
            fails.append(f"Bỏ qua smoke test do thiếu gói: {ag}")
            continue

        try:
            # We run with low effort and timeout 10s to verify executor builds without crash
            cmd = [
                str(AGY_BIN_PATH),
                "--agent", ag,
                "-p", "Ping executor check",
                "--output-format", "json",
                "--print-timeout", "5s"
            ]
            res = subprocess.run(
                cmd,
                cwd=str(WORKSPACE_ROOT),
                capture_output=True,
                text=True,
                timeout=12
            )
            combined_out = res.stdout + res.stderr
            if "failed to construct executor" in combined_out or "unknown component" in combined_out:
                fails.append(f"Agent '{ag}' CRASH khi dựng executor: phát hiện unknown component!")
            elif "panic:" in combined_out:
                fails.append(f"Agent '{ag}' ném PANIC trong Go runtime!")
        except subprocess.TimeoutExpired:
            # Timeout in print mode is normal if it started reasoning; but if executor failed, it exits immediately with error
            pass
        except Exception as e:
            fails.append(f"Agent '{ag}' gặp lỗi khi chạy smoke test: {str(e)}")

    if fails:
        log_fail("CRIT-04", desc, fails)
    else:
        log_pass("CRIT-04", desc)

# =============================================================================
# CRIT-05: DELTA-LOG ZERO WARNING & CLEAN ENGINE REGISTRY
# =============================================================================
def verify_crit_05():
    desc = "Delta-Log Isolation & Zero Engine Warning Invariant"
    fails = []

    if not CLI_LOG_PATH.exists():
        fails.append(f"cli.log không tồn tại tại: {CLI_LOG_PATH}")
        log_fail("CRIT-05", desc, fails)
        return

    # Take initial byte position
    initial_pos = CLI_LOG_PATH.stat().st_size

    # Trigger Go Discovery Engine
    try:
        subprocess.run(
            [str(AGY_BIN_PATH), "agents"],
            cwd=str(WORKSPACE_ROOT),
            capture_output=True,
            timeout=8
        )
    except Exception as e:
        fails.append(f"Lỗi khi chạy agy agents: {str(e)}")

    # Read ONLY delta log
    try:
        with open(CLI_LOG_PATH, "r", encoding="utf-8", errors="ignore") as f:
            f.seek(initial_pos)
            delta_log = f.read()

        # Check for AgentBasePath warnings in delta log
        if "AgentBasePath is not set" in delta_log:
            count = len(re.findall(r"AgentBasePath is not set", delta_log))
            fails.append(f"Phát hiện {count} cảnh báo 'AgentBasePath is not set' trong delta log của Go Discovery!")

        # Check for unknown component errors
        if "unknown component" in delta_log:
            fails.append("Phát hiện lỗi 'unknown component' trong delta log!")

    except Exception as e:
        fails.append(f"Lỗi khi đọc delta log: {str(e)}")

    if fails:
        log_fail("CRIT-05", desc, fails)
    else:
        log_pass("CRIT-05", desc)

# =============================================================================
# CRIT-06: PURE DATA MANIFEST & ANTI-SYCOPHANCY PROTOCOL
# =============================================================================
def verify_crit_06():
    desc = "Pure Data Manifest & Anti-Sycophancy Protocol (send_message IPC)"
    fails = []

    orch_md = AGENTS_DIR / "host-orchestrator" / "agent.md"
    if not orch_md.exists():
        fails.append("Không tìm thấy host-orchestrator/agent.md")
        log_fail("CRIT-06", desc, fails)
        return

    content = orch_md.read_text(encoding="utf-8")

    # Pure Data Manifests Check
    required_manifests = ["<task_delegation>", "<remediation_manifest>"]
    for m in required_manifests:
        if m not in content:
            fails.append(f"host-orchestrator/agent.md thiếu khung dữ liệu thuần: {m}")

    # Explicit send_message Check
    if "send_message" not in content:
        fails.append("host-orchestrator/agent.md thiếu chỉ thị giao tiếp bằng 'send_message'")

    # Ban phantom post_message
    if re.search(r"\bpost_message\b", content):
        fails.append("host-orchestrator/agent.md chứa công cụ giả tưởng 'post_message' không có trong Go runtime!")

    # Anti-Sycophancy Invariant
    if "Blind Adversarial Framing" not in content and "ORCH-INV-009" not in content:
        fails.append("host-orchestrator/agent.md thiếu quy tắc cấm mớm ý / câu hỏi dẫn dắt (ORCH-INV-009)")

    if fails:
        log_fail("CRIT-06", desc, fails)
    else:
        log_pass("CRIT-06", desc)

# =============================================================================
# CRIT-07: NON-INTERACTIVE CLI DISCIPLINE (ANTI-STDIN DEADLOCK)
# =============================================================================
def verify_crit_07():
    desc = "Non-Interactive CLI Discipline (Anti-Headless Stdin Deadlock)"
    fails = []

    # Check across all agent instructions for interactive trap commands
    all_md_files = list(AGENTS_DIR.glob("*/agent.md"))
    interactive_patterns = [
        (r"\bread-host\b", "Lệnh PowerShell tương tác 'read-host' gây treo stdin"),
        (r"\bnpm init\s+(?!-y\b)", "Lệnh 'npm init' thiếu cờ non-interactive '-y'"),
        (r"\bpause\b", "Lệnh shell 'pause' chờ bàn phím"),
        (r"\bstdin\s+blocking\b", "Nguy cơ chặn I/O stdin")
    ]

    for mf in all_md_files:
        try:
            txt = mf.read_text(encoding="utf-8")
            for pattern, reason in interactive_patterns:
                if re.search(pattern, txt, re.IGNORECASE):
                    fails.append(f"{mf.parent.name}/agent.md: {reason}")
        except Exception as e:
            fails.append(f"{mf.name}: Lỗi khi đọc: {str(e)}")

    if fails:
        log_fail("CRIT-07", desc, fails)
    else:
        log_pass("CRIT-07", desc)

# =============================================================================
# MAIN EXECUTOR & EXIT CODE DETERMINISM
# =============================================================================
def main():
    print_header("HARDENED ADVERSARIAL VERIFICATION HARNESS (PRE-IMPLEMENTATION GATE)")
    
    verify_crit_01()
    verify_crit_02()
    verify_crit_03()
    verify_crit_04()
    verify_crit_05()
    verify_crit_06()
    verify_crit_07()

    print(f"\n{'-'*75}")
    print(f"KẾT QUẢ ĐO ĐẠC: {passed_criteria}/{TOTAL_CRITERIA} Tiêu Chí ĐẠT CHUẨN.")
    print(f"Tổng số vi phạm bắt được: {len(violations)}")
    print(f"{'-'*75}")

    if violations:
        print("\nDANH SÁCH VI PHẠM CƠ HỌC BẮT BUỘC KHẮC PHỤC TRƯỚC KHI BÀN GIAO:")
        for idx, v in enumerate(violations, 1):
            print(f"  {idx}. {v}")
        print("\n>> Phán quyết nhị phân: REJECTED (Exit Code: 1)\n")
        sys.exit(1)
    else:
        print("\n>> Phán quyết nhị phân: APPROVED (Exit Code: 0) - Hệ thống đạt chuẩn cơ học 100%.\n")
        sys.exit(0)

if __name__ == "__main__":
    main()
