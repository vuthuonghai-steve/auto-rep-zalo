#!/usr/bin/env python3
# .agents/scripts/guards/tests/test_isolation.py
"""
Bộ kiểm thử cơ học nhị phân (Automated Isolation & Concurrency Test Suite) cho T018:
Kiểm chứng tính toàn vẹn, cô lập ranh giới tác tử và không giao thoa tệp giữa các subagents.

Bao phủ các khế ước và bất biến cốt lõi:
1. Zero File Intersection: Các tác vụ hoặc subagents song song ([P]) có tập tệp hoàn toàn tách rời.
2. Giới hạn Blast Radius: Mỗi tác vụ chỉ được phép can thiệp tối đa <= 3 tệp vật lý.
3. Ranh giới Allowed vs Forbidden: Ngăn chặn triệt để hành vi xâm phạm mã nguồn cấm (src/**, specs/**).
4. Cô lập Không Gian Làm Việc (Workspace / Worktree Boundary): Chặn đứng path traversal thoát khỏi workspace.
5. Kiểm Dịch Giao Việc (Delegation Manifest Isolation): Bảo đảm manifest thuần dữ liệu không gây rò rỉ prompt.
6. Thẩm Định Kết Quả Bàn Giao: Kiểm tra blast_radius_files trong completion payload không vượt ranh giới.
"""

import os
import sys
import re
import fnmatch
import unittest
from typing import Dict, Any, List, Set, Tuple, Optional


def normalize_path(path: str) -> str:
    """
    Chuẩn hóa đường dẫn tệp tin:
    - Loại bỏ khoảng trắng và dấu nháy bao quanh
    - Chuyển đổi toàn bộ dấu phân cách thành '/'
    - Khử các tiền tố './'
    - Chuẩn hóa chữ thường (case-insensitive) để phòng ngừa xung đột trên Windows
    """
    cleaned = path.strip().strip("`'\"")
    cleaned = cleaned.replace("\\", "/")
    # Chuẩn hóa các đường dẫn tương đối có ./
    while cleaned.startswith("./"):
        cleaned = cleaned[2:]
    # Chuẩn hóa các dấu // kép
    while "//" in cleaned:
        cleaned = cleaned.replace("//", "/")
    return os.path.normpath(cleaned).replace("\\", "/").lower()


def match_glob(path: str, pattern: str) -> bool:
    """
    Kiểm tra một đường dẫn có khớp với mẫu glob hay không (hỗ trợ ** cho thư mục đệ quy).
    """
    norm_p = normalize_path(path)
    norm_pat = normalize_path(pattern)

    if norm_pat.endswith("/**"):
        prefix = norm_pat[:-3]
        return norm_p == prefix or norm_p.startswith(prefix + "/")
    if norm_pat.startswith("**/"):
        suffix = norm_pat[3:]
        return norm_p == suffix or norm_p.endswith("/" + suffix)
    return fnmatch.fnmatch(norm_p, norm_pat)


def paths_intersect(path_a: str, path_b: str) -> bool:
    """
    Kiểm tra xem hai đường dẫn hoặc mẫu đường dẫn có giao thoa với nhau không.
    Bao gồm trường hợp khớp chính xác hoặc một bên là mẫu glob bao trùm bên kia.
    """
    norm_a = normalize_path(path_a)
    norm_b = normalize_path(path_b)

    if norm_a == norm_b:
        return True

    # Kiểm tra glob wildcard
    if "*" in norm_a and match_glob(norm_b, norm_a):
        return True
    if "*" in norm_b and match_glob(norm_a, norm_b):
        return True

    return False


def calculate_intersection(files_a: List[str], files_b: List[str]) -> Set[str]:
    """
    Tính toán tập hợp các tệp giao thoa giữa hai danh sách tệp.
    """
    conflicts: Set[str] = set()
    for fa in files_a:
        for fb in files_b:
            if paths_intersect(fa, fb):
                conflicts.add(f"{fa} <=> {fb}")
    return conflicts


def validate_zero_file_intersection(tasks: List[Dict[str, Any]]) -> Tuple[bool, List[str]]:
    """
    Thẩm định quy tắc Zero File Intersection cho tập hợp các tác vụ song song:
    Không có bất kỳ hai tác vụ [P] nào có giao điểm về tệp tin vật lý can thiệp.
    """
    errors: List[str] = []
    parallel_tasks = [t for t in tasks if t.get("is_parallel", False)]

    for i in range(len(parallel_tasks)):
        for j in range(i + 1, len(parallel_tasks)):
            task_i = parallel_tasks[i]
            task_j = parallel_tasks[j]

            files_i = task_i.get("target_files", [])
            files_j = task_j.get("target_files", [])

            conflicts = calculate_intersection(files_i, files_j)
            if conflicts:
                errors.append(
                    f"Xung đột giao thoa tệp giữa tác vụ {task_i.get('task_id')} "
                    f"và {task_j.get('task_id')}: {list(conflicts)}"
                )

    return len(errors) == 0, errors


def validate_blast_radius(target_files: List[str], max_allowed: int = 3) -> Tuple[bool, Optional[str]]:
    """
    Thẩm định giới hạn bán kính tác động (Blast Radius):
    Mỗi tác vụ nguyên tử chỉ được phép tác động từ 1 đến tối đa max_allowed tệp.
    """
    count = len(target_files)
    if count == 0:
        return False, "Bán kính tác động rỗng: Tác vụ không khai báo tệp mục tiêu nào."
    if count > max_allowed:
        return (
            False,
            f"Bán kính tác động vượt quá giới hạn cho phép: Khai báo {count} tệp (tối đa {max_allowed}). "
            f"Danh sách tệp: {target_files}"
        )
    return True, None


def validate_scope_boundaries(
    modified_files: List[str],
    allowed_files: List[str],
    forbidden_patterns: List[str]
) -> Tuple[bool, List[str]]:
    """
    Thẩm định ranh giới cho phép và vùng cấm can thiệp:
    - 100% tệp sửa đổi phải nằm trong danh sách allowed_files.
    - 0% tệp sửa đổi được phép khớp với bất kỳ mẫu nào trong forbidden_patterns.
    """
    violations: List[str] = []

    for f in modified_files:
        norm_f = normalize_path(f)

        # 1. Kiểm tra vùng cấm (Forbidden Patterns)
        for pattern in forbidden_patterns:
            if match_glob(norm_f, pattern):
                violations.append(f"Xâm phạm vùng cấm: '{f}' khớp với mẫu cấm '{pattern}'.")

        # 2. Kiểm tra vùng được phép (Allowed Files)
        is_allowed = False
        for allowed in allowed_files:
            if match_glob(norm_f, allowed) or normalize_path(allowed) == norm_f:
                is_allowed = True
                break

        if not is_allowed:
            violations.append(f"Vượt ngoài phạm vi ủy quyền: '{f}' không nằm trong allowed_files.")

    return len(violations) == 0, violations


def validate_workspace_path(file_path: str, workspace_root: str) -> Tuple[bool, Optional[str]]:
    """
    Kiểm tra ranh giới workspace vật lý:
    Ngăn chặn kỹ thuật Path Traversal (../) thoát khỏi thư mục workspace được cấp phát.
    """
    abs_root = os.path.abspath(workspace_root)
    # Xử lý đường dẫn tương đối hoặc tuyệt đối
    if os.path.isabs(file_path):
        target_abs = os.path.abspath(file_path)
    else:
        target_abs = os.path.abspath(os.path.join(abs_root, file_path))

    # Chuẩn hóa để so sánh tiền tố thư mục
    norm_root = os.path.normcase(abs_root)
    norm_target = os.path.normcase(target_abs)

    in_workspace = (
        norm_target == norm_root or
        norm_target.startswith(norm_root + os.sep) or
        norm_target.startswith(norm_root + "/")
    )

    if not in_workspace:
        return (
            False,
            f"Path traversal breach: Tệp '{file_path}' (đích: '{target_abs}') nằm ngoài workspace '{abs_root}'."
        )
    return True, None


def parse_delegation_manifest(manifest_text: str) -> Dict[str, Any]:
    """
    Trích xuất và chuẩn hóa thông số từ khối XML <task_delegation>.
    """
    data: Dict[str, Any] = {}
    m = re.search(r"<task_delegation>([\s\S]*?)</task_delegation>", manifest_text)
    if not m:
        return data

    body = m.group(1)
    for line in body.splitlines():
        line = line.strip()
        if not line or ":" not in line:
            continue
        key, val = line.split(":", 1)
        key = key.strip()
        val = val.strip()

        # Parse JSON list nếu có dạng ["...", "..."]
        if val.startswith("[") and val.endswith("]"):
            items = re.findall(r'["\']([^"\']+)["\']', val)
            data[key] = items
        else:
            data[key] = val.strip('"`\'')

    return data


def extract_files_from_task_line(line: str) -> List[str]:
    """
    Trích xuất các đường dẫn tệp tin vật lý được nhắc tới trong một dòng mô tả tác vụ.
    """
    # Nhận diện chuỗi đường dẫn có phân tách / hoặc \ và đuôi tệp phổ biến
    pattern = r'[`\'\"]?((?:\.?[a-zA-Z0-9_\-]+[\\/])+[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+)[`\'\"]?'
    matches = re.findall(pattern, line)
    return [m.strip("`'\",.") for m in matches]


def parse_tasks_markdown(content: str) -> List[Dict[str, Any]]:
    """
    Trích xuất danh sách tác vụ từ định dạng Markdown của tasks.md:
    - [ ] [TaskID] [P?] [Story?] Mô tả tác vụ với đường dẫn tệp
    """
    tasks: List[Dict[str, Any]] = []
    lines = content.splitlines()

    task_pattern = re.compile(r"^-\s*\[([ xX])\]\s*(T\d{3})\s*(\[P\])?\s*(\[[A-Z0-9]+\])?\s*(.*)$")

    for line in lines:
        line_clean = line.strip()
        m = task_pattern.match(line_clean)
        if m:
            is_completed = m.group(1).lower() == "x"
            task_id = m.group(2)
            is_parallel = m.group(3) is not None
            story_tag = m.group(4) or ""
            description = m.group(5)

            target_files = extract_files_from_task_line(description)

            tasks.append({
                "task_id": task_id,
                "is_completed": is_completed,
                "is_parallel": is_parallel,
                "story_tag": story_tag,
                "description": description,
                "target_files": target_files
            })

    return tasks


# ==============================================================================
# UNIT TEST CASES
# ==============================================================================

class TestZeroFileIntersection(unittest.TestCase):
    """Kiểm thử nguyên tắc Zero File Intersection giữa các tác vụ và subagents chạy song song."""

    def test_disjoint_parallel_tasks_pass(self):
        """Các tác vụ có danh sách tệp hoàn toàn tách rời phải PASS."""
        tasks = [
            {
                "task_id": "T009",
                "is_parallel": True,
                "target_files": [".agents/skills/ai-first-doc-formatter/tests/test_verify_format.py"]
            },
            {
                "task_id": "T010",
                "is_parallel": True,
                "target_files": [".agents/agents/spec-analyst-planner.md"]
            },
            {
                "task_id": "T012",
                "is_parallel": True,
                "target_files": [".agents/skills/ai-first-doc-formatter/SKILL.md"]
            }
        ]
        ok, errors = validate_zero_file_intersection(tasks)
        self.assertTrue(ok)
        self.assertEqual(len(errors), 0)

    def test_overlapping_exact_file_detected(self):
        """Hai tác vụ song song cùng can thiệp vào một tệp vật lý phải bị PHÁT HIỆN và CHẶN."""
        tasks = [
            {
                "task_id": "T001",
                "is_parallel": True,
                "target_files": [".agents/scripts/guards/dispatcher.py"]
            },
            {
                "task_id": "T002",
                "is_parallel": True,
                "target_files": [".agents/scripts/guards/dispatcher.py"]
            }
        ]
        ok, errors = validate_zero_file_intersection(tasks)
        self.assertFalse(ok)
        self.assertEqual(len(errors), 1)
        self.assertIn("Xung đột giao thoa tệp", errors[0])

    def test_overlapping_normalized_slashes_detected(self):
        """Khác biệt dấu gạch chéo (/ vs \\) và tiền tố ./ vẫn phải bị nhận diện là xung đột."""
        tasks = [
            {
                "task_id": "T015",
                "is_parallel": True,
                "target_files": [".agents/agents/surgical-implementer/agent.md"]
            },
            {
                "task_id": "T016",
                "is_parallel": True,
                "target_files": [".agents\\agents\\surgical-implementer\\agent.md"]
            }
        ]
        ok, errors = validate_zero_file_intersection(tasks)
        self.assertFalse(ok)
        self.assertEqual(len(errors), 1)

    def test_overlapping_case_insensitivity_detected(self):
        """Khác biệt hoa thường (trên hệ điều hành Windows) phải được chuẩn hóa và bắt xung đột."""
        tasks = [
            {
                "task_id": "T011",
                "is_parallel": True,
                "target_files": ["src/screens/HomeScreen.tsx"]
            },
            {
                "task_id": "T012",
                "is_parallel": True,
                "target_files": ["src/screens/homescreen.tsx"]
            }
        ]
        ok, errors = validate_zero_file_intersection(tasks)
        self.assertFalse(ok)
        self.assertEqual(len(errors), 1)

    def test_glob_pattern_file_intersection_detected(self):
        """Mẫu wildcard đè lên một tệp cụ thể phải được nhận diện là giao thoa."""
        tasks = [
            {
                "task_id": "T005",
                "is_parallel": True,
                "target_files": [".agents/scripts/guards/tests/*.py"]
            },
            {
                "task_id": "T006",
                "is_parallel": True,
                "target_files": [".agents/scripts/guards/tests/test_dispatcher.py"]
            }
        ]
        ok, errors = validate_zero_file_intersection(tasks)
        self.assertFalse(ok)
        self.assertEqual(len(errors), 1)

    def test_sequential_tasks_ignore_file_overlap(self):
        """Các tác vụ tuần tự (không có nhãn is_parallel=True) được phép thao tác cùng file."""
        tasks = [
            {
                "task_id": "T006",
                "is_parallel": False,
                "target_files": [".agents/hooks.json"]
            },
            {
                "task_id": "T008",
                "is_parallel": False,
                "target_files": [".agents/hooks.json"]
            }
        ]
        ok, errors = validate_zero_file_intersection(tasks)
        self.assertTrue(ok)
        self.assertEqual(len(errors), 0)


class TestBlastRadiusIntegrity(unittest.TestCase):
    """Kiểm thử giới hạn bán kính tác động Blast Radius <= 3 files vật lý."""

    def test_blast_radius_single_file_pass(self):
        """Tác vụ tác động 1 tệp tin hợp lệ."""
        ok, err = validate_blast_radius([".agents/scripts/guards/dispatcher.py"])
        self.assertTrue(ok)
        self.assertIsNone(err)

    def test_blast_radius_three_files_pass(self):
        """Tác vụ tác động tối đa 3 tệp tin hợp lệ."""
        files = [
            "src/file1.ts",
            "src/file2.ts",
            "src/file3.ts"
        ]
        ok, err = validate_blast_radius(files)
        self.assertTrue(ok)
        self.assertIsNone(err)

    def test_blast_radius_four_files_fails(self):
        """Tác vụ tác động 4 tệp tin vi phạm giới hạn <= 3 phải bị TỪ CHỐI."""
        files = [
            "src/file1.ts",
            "src/file2.ts",
            "src/file3.ts",
            "src/file4.ts"
        ]
        ok, err = validate_blast_radius(files)
        self.assertFalse(ok)
        self.assertIn("vượt quá giới hạn cho phép", err)
        self.assertIn("Khai báo 4 tệp", err)

    def test_blast_radius_empty_fails(self):
        """Tác vụ khai báo rỗng 0 tệp tin phải bị TỪ CHỐI."""
        ok, err = validate_blast_radius([])
        self.assertFalse(ok)
        self.assertIn("Bán kính tác động rỗng", err)


class TestScopeBoundaryEnforcement(unittest.TestCase):
    """Kiểm thử thực thi ranh giới allowed_files và forbidden_files."""

    def setUp(self):
        self.allowed = [
            ".agents/scripts/guards/tests/test_isolation.py"
        ]
        self.forbidden = [
            "src/**",
            "specs/**"
        ]

    def test_allowed_file_modification_pass(self):
        """Chỉnh sửa đúng tệp nằm trong danh sách cho phép phải PASS."""
        modified = [".agents/scripts/guards/tests/test_isolation.py"]
        ok, violations = validate_scope_boundaries(modified, self.allowed, self.forbidden)
        self.assertTrue(ok)
        self.assertEqual(len(violations), 0)

    def test_unauthorized_file_modification_rejected(self):
        """Chỉnh sửa tệp ngoài danh sách allowed_files phải bị PHÁT HIỆN."""
        modified = [".agents/scripts/guards/dispatcher.py"]
        ok, violations = validate_scope_boundaries(modified, self.allowed, self.forbidden)
        self.assertFalse(ok)
        self.assertTrue(any("Vượt ngoài phạm vi ủy quyền" in v for v in violations))

    def test_forbidden_src_file_modification_rejected(self):
        """Chỉnh sửa tệp trong vùng cấm src/** phải bị CHẶN NGAY."""
        modified = ["src/components/button.tsx"]
        ok, violations = validate_scope_boundaries(modified, self.allowed, self.forbidden)
        self.assertFalse(ok)
        self.assertTrue(any("Xâm phạm vùng cấm" in v for v in violations))

    def test_forbidden_specs_file_modification_rejected(self):
        """Chỉnh sửa tệp trong vùng cấm specs/** phải bị CHẶN NGAY."""
        modified = ["specs/003-harness-doc-formatting/spec.md"]
        ok, violations = validate_scope_boundaries(modified, self.allowed, self.forbidden)
        self.assertFalse(ok)
        self.assertTrue(any("Xâm phạm vùng cấm" in v for v in violations))

    def test_multiple_violations_reported_accurately(self):
        """Nhiều vi phạm đồng thời phải được tổng hợp báo cáo đầy đủ."""
        modified = [
            "src/index.ts",
            "specs/tasks.md",
            "random/unauthorized.txt"
        ]
        ok, violations = validate_scope_boundaries(modified, self.allowed, self.forbidden)
        self.assertFalse(ok)
        self.assertGreaterEqual(len(violations), 3)


class TestDelegationManifestIsolation(unittest.TestCase):
    """Kiểm thử cấu trúc Pure Data Manifest cho ủy thác liên tác tử (<task_delegation>)."""

    def test_valid_delegation_manifest_parsed_correctly(self):
        """Manifest ủy thác hợp lệ phải được trích xuất chính xác các trường."""
        raw = """<task_delegation>
target_subagent: surgical-implementer
task_id: "T018"
spec_path: "specs/003-harness-doc-formatting/spec.md"
allowed_files: [".agents/scripts/guards/tests/test_isolation.py"]
forbidden_files: ["src/**", "specs/**"]
test_command: "python -m unittest .agents/scripts/guards/tests/test_isolation.py"
</task_delegation>"""

        data = parse_delegation_manifest(raw)
        self.assertEqual(data.get("target_subagent"), "surgical-implementer")
        self.assertEqual(data.get("task_id"), "T018")
        self.assertEqual(data.get("spec_path"), "specs/003-harness-doc-formatting/spec.md")
        self.assertEqual(data.get("allowed_files"), [".agents/scripts/guards/tests/test_isolation.py"])
        self.assertEqual(data.get("forbidden_files"), ["src/**", "specs/**"])
        self.assertEqual(data.get("test_command"), "python -m unittest .agents/scripts/guards/tests/test_isolation.py")

    def test_concurrent_delegations_disjoint_allowed_files_pass(self):
        """Hai lời gọi invoke_subagent chạy song song với allowed_files tách rời phải PASS."""
        delegation_a = """<task_delegation>
target_subagent: surgical-implementer
task_id: "T018"
allowed_files: [".agents/scripts/guards/tests/test_isolation.py"]
</task_delegation>"""

        delegation_b = """<task_delegation>
target_subagent: surgical-implementer
task_id: "T020"
allowed_files: ["Docs/AGENTS_ANALYSTS/harness-architecture-evaluation/01-doc.md"]
</task_delegation>"""

        data_a = parse_delegation_manifest(delegation_a)
        data_b = parse_delegation_manifest(delegation_b)

        conflicts = calculate_intersection(data_a.get("allowed_files", []), data_b.get("allowed_files", []))
        self.assertEqual(len(conflicts), 0)

    def test_concurrent_delegations_colliding_allowed_files_rejected(self):
        """Hai lời gọi invoke_subagent song song có giao thoa tệp allowed_files phải bị PHÁT HIỆN."""
        delegation_a = """<task_delegation>
target_subagent: surgical-implementer
task_id: "T003"
allowed_files: [".agents/scripts/guards/dispatcher.py"]
</task_delegation>"""

        delegation_b = """<task_delegation>
target_subagent: surgical-implementer
task_id: "T004"
allowed_files: [".agents/scripts/guards/dispatcher.py"]
</task_delegation>"""

        data_a = parse_delegation_manifest(delegation_a)
        data_b = parse_delegation_manifest(delegation_b)

        conflicts = calculate_intersection(data_a.get("allowed_files", []), data_b.get("allowed_files", []))
        self.assertGreater(len(conflicts), 0)


class TestWorktreeAndWorkspaceIsolation(unittest.TestCase):
    """Kiểm thử bảo vệ ranh giới vật lý Workspace và ngăn chặn Path Traversal."""

    def setUp(self):
        self.workspace_dir = os.path.abspath("C:/temp/subagent_worktree")

    def test_relative_path_inside_workspace_allowed(self):
        """Đường dẫn con hợp lệ bên trong thư mục workspace được chấp nhận."""
        rel_path = ".agents/scripts/guards/tests/test_isolation.py"
        ok, err = validate_workspace_path(rel_path, self.workspace_dir)
        self.assertTrue(ok)
        self.assertIsNone(err)

    def test_path_traversal_parent_escape_rejected(self):
        """Đường dẫn dùng ../ để thoát ra thư mục cha của workspace phải bị CHẶN."""
        escape_path = "../../Windows/System32/drivers/etc/hosts"
        ok, err = validate_workspace_path(escape_path, self.workspace_dir)
        self.assertFalse(ok)
        self.assertIn("Path traversal breach", err)

    def test_absolute_path_outside_workspace_rejected(self):
        """Đường dẫn tuyệt đối trỏ sang ổ đĩa hoặc thư mục khác phải bị CHẶN."""
        outside_path = "D:/OtherProject/src/index.ts"
        ok, err = validate_workspace_path(outside_path, self.workspace_dir)
        self.assertFalse(ok)
        self.assertIn("Path traversal breach", err)

    def test_subagent_branch_naming_convention(self):
        """Định dạng tên nhánh Git của subagent phải tuân thủ chuẩn cách ly."""
        valid_branches = [
            "subagent-Surgical-Implementer-T018-surgical-implementer-659b06c9",
            "subagent-Spec-Analyst-Planner-spec-analyst-planner-9102a183",
            "subagent/T018"
        ]
        invalid_branches = [
            "main",
            "master",
            "feature/my-test",
            "quick-fix"
        ]

        pattern = re.compile(r"^(subagent-.*|subagent/T\d{3}.*)$")

        for b in valid_branches:
            self.assertTrue(pattern.match(b), f"Branch {b} should be valid subagent branch")

        for b in invalid_branches:
            self.assertFalse(pattern.match(b), f"Branch {b} should NOT be valid subagent branch")


class TestCompletionPayloadIsolation(unittest.TestCase):
    """Kiểm thử đối chiếu blast_radius_files trong kết quả bàn giao SubagentCompletionPayload."""

    def test_completion_payload_blast_radius_within_allowed(self):
        """Báo cáo hoàn thành với blast_radius_files nằm trọn vẹn trong allowed_files phải PASS."""
        allowed = [".agents/scripts/guards/tests/test_isolation.py"]
        forbidden = ["src/**", "specs/**"]

        payload = {
            "status": "SUCCESS",
            "task_id": "T018",
            "test_exit_code": 0,
            "passed_assertions": 15,
            "blast_radius_files": [".agents/scripts/guards/tests/test_isolation.py"]
        }

        # 1. Thẩm định kích thước blast radius
        br_ok, br_err = validate_blast_radius(payload["blast_radius_files"])
        self.assertTrue(br_ok)

        # 2. Thẩm định phạm vi allowed/forbidden
        scope_ok, violations = validate_scope_boundaries(
            payload["blast_radius_files"], allowed, forbidden
        )
        self.assertTrue(scope_ok)
        self.assertEqual(len(violations), 0)

    def test_completion_payload_blast_radius_exceeding_max_rejected(self):
        """Báo cáo hoàn thành có blast_radius_files vượt quá 3 tệp phải bị TỪ CHỐI."""
        payload_files = ["f1.py", "f2.py", "f3.py", "f4.py"]
        br_ok, br_err = validate_blast_radius(payload_files)
        self.assertFalse(br_ok)
        self.assertIn("vượt quá giới hạn cho phép", br_err)

    def test_completion_payload_touching_forbidden_files_rejected(self):
        """Báo cáo hoàn thành có blast_radius_files chạm vào vùng cấm phải bị CHẶN NGAY."""
        allowed = [".agents/scripts/guards/tests/test_isolation.py", "src/core.ts"]
        forbidden = ["src/**"]

        # Dù khai báo trong allowed nhưng dính forbidden thì vẫn vi phạm
        payload_files = ["src/core.ts"]
        scope_ok, violations = validate_scope_boundaries(payload_files, allowed, forbidden)
        self.assertFalse(scope_ok)
        self.assertTrue(any("Xâm phạm vùng cấm" in v for v in violations))


class TestTasksIntegrityParser(unittest.TestCase):
    """Kiểm thử trình phân tích và thẩm định Zero File Intersection trên nội dung tasks.md mẫu."""

    def test_parse_and_verify_valid_parallel_tasks(self):
        """Thẩm định danh sách tác vụ chuẩn AI-First có gắn nhãn [P] phân tách tuyệt đối."""
        sample_tasks_md = """
# Tasks: Feature Sample

## Phase 3: User Story 1
- [ ] T001 Khởi tạo thư mục trong .agents/scripts/guards/tests/fixtures/
- [ ] T002 [P] Thiết lập runner trong .agents/scripts/guards/tests/run_guard_tests.py

## Phase 4: User Story 2
- [ ] T009 [P] Viết unit test trong .agents/skills/ai-first-doc-formatter/tests/test_verify_format.py
- [ ] T010 [P] Cập nhật L0 System Instructions tại .agents/agents/spec-analyst-planner.md
- [ ] T011 Chuẩn hóa cơ chế báo lỗi trong .agents/skills/ai-first-doc-formatter/scripts/verify-ai-first-format.py
- [ ] T012 [P] Đồng bộ hóa cẩm nang tại .agents/skills/ai-first-doc-formatter/SKILL.md
"""
        tasks = parse_tasks_markdown(sample_tasks_md)
        self.assertEqual(len(tasks), 6)

        # Kiểm tra tác vụ T009, T010, T012 trong Phase 4
        phase4_parallel = [t for t in tasks if t["task_id"] in ["T009", "T010", "T012"]]
        self.assertTrue(all(t["is_parallel"] for t in phase4_parallel))

        ok, errors = validate_zero_file_intersection(phase4_parallel)
        self.assertTrue(ok)
        self.assertEqual(len(errors), 0)

    def test_detect_colliding_parallel_tasks_in_markdown(self):
        """Phát hiện lỗi định dạng tasks.md khi hai tác vụ song song vô tình cùng sửa một tệp."""
        sample_tasks_bad_md = """
## Phase Bad
- [ ] T001 [P] Sửa đổi router trong .agents/scripts/guards/dispatcher.py
- [ ] T002 [P] Tối ưu hóa hook trong .agents/scripts/guards/dispatcher.py
"""
        tasks = parse_tasks_markdown(sample_tasks_bad_md)
        ok, errors = validate_zero_file_intersection(tasks)
        self.assertFalse(ok)
        self.assertEqual(len(errors), 1)
        self.assertIn("Xung đột giao thoa tệp", errors[0])


if __name__ == "__main__":
    unittest.main()
