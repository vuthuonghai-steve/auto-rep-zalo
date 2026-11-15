#!/usr/bin/env python3
# .agents/skills/ai-first-doc-formatter/tests/test_verify_format.py
"""
Bộ kiểm thử đơn vị cơ học nhị phân (Automated Unit Tests) cho verify-ai-first-format.py.
Kiểm chứng 5 quy tắc chuẩn hóa AI-First Triad:
1. Macro XML Tags Balance: đầy đủ và cân bằng <instructions>, <context>, <output_contract>.
2. YAML Nesting Depth: độ sâu lồng YAML <= 3 cấp (thụt lề <= 6 khoảng trắng).
3. Anti Micro-tagging: số lượng thẻ XML phân biệt <= 12 thẻ.
4. Link Hygiene: không chứa backtick trong link label, không chứa đường dẫn tuyệt đối cục bộ.
5. Negative Space Requirement: tối thiểu 3 mệnh đề phủ định (must_not, CẤM, MUST NOT).
6. Tích hợp CLI Runner và mã thoát nhị phân (Exit Code 0/1).
7. Độ trễ kiểm định siêu tốc (< 50ms).
"""

import os
import sys
import time
import tempfile
import subprocess
import unittest
import importlib.util

# Tải module verify-ai-first-format.py (tên file chứa dấu gạch ngang)
SCRIPTS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "scripts"))
SCRIPT_PATH = os.path.join(SCRIPTS_DIR, "verify-ai-first-format.py")
spec = importlib.util.spec_from_file_location("verify_ai_first_format", SCRIPT_PATH)
verify_module = importlib.util.module_from_spec(spec)
sys.modules["verify_ai_first_format"] = verify_module
spec.loader.exec_module(verify_module)

verify_ai_first_format = verify_module.verify_ai_first_format

VALID_TRIAD_TEMPLATE = """<instructions>
```yaml
document_metadata:
  title: "Valid Document"
  version: "1.0.0"
negative_space:
  - must_not: "CẤM phỏng đoán yêu cầu."
  - must_not: "CẤM đưa mock vào production."
  - must_not: "CẤM nuốt ngoại lệ âm thầm."
```
</instructions>

<context>
# Architecture Context
Tài liệu tham chiếu [hướng dẫn](docs/guide.md).
</context>

<output_contract>
```yaml
verification:
  exit_code: 0
```
</output_contract>
"""


class TestMacroXmlTagsBalance(unittest.TestCase):
    """Kiểm thử quy tắc 1: Cân bằng và hiện diện của 3 thẻ Macro XML."""

    def test_valid_macro_xml_tags(self):
        """Tài liệu chứa đủ 3 cặp thẻ macro hợp lệ."""
        passed, errors = verify_ai_first_format(VALID_TRIAD_TEMPLATE)
        self.assertTrue(passed, f"Kỳ vọng hợp lệ nhưng gặp lỗi: {errors}")
        self.assertEqual(len(errors), 0)

    def test_missing_instructions_tag(self):
        """Thiếu thẻ <instructions> phải phát hiện lỗi."""
        content = VALID_TRIAD_TEMPLATE.replace("<instructions>", "").replace("</instructions>", "")
        passed, errors = verify_ai_first_format(content)
        self.assertFalse(passed)
        self.assertTrue(any("Missing required macro XML tag <instructions>" in e for e in errors))

    def test_missing_context_tag(self):
        """Thiếu thẻ <context> phải phát hiện lỗi."""
        content = VALID_TRIAD_TEMPLATE.replace("<context>", "").replace("</context>", "")
        passed, errors = verify_ai_first_format(content)
        self.assertFalse(passed)
        self.assertTrue(any("Missing required macro XML tag <context>" in e for e in errors))

    def test_missing_output_contract_tag(self):
        """Thiếu thẻ <output_contract> phải phát hiện lỗi."""
        content = VALID_TRIAD_TEMPLATE.replace("<output_contract>", "").replace("</output_contract>", "")
        passed, errors = verify_ai_first_format(content)
        self.assertFalse(passed)
        self.assertTrue(any("Missing required macro XML tag <output_contract>" in e for e in errors))

    def test_unbalanced_macro_tag_open_without_close(self):
        """Thẻ mở không có thẻ đóng tương ứng phải báo lỗi unbalanced."""
        content = VALID_TRIAD_TEMPLATE.replace("</context>", "")
        passed, errors = verify_ai_first_format(content)
        self.assertFalse(passed)
        self.assertTrue(any("Unbalanced macro XML tag <context>" in e for e in errors))

    def test_macro_tags_with_attributes_supported(self):
        """Thẻ macro có thuộc tính như <instructions version=\"1.0\"> vẫn được nhận diện."""
        content = VALID_TRIAD_TEMPLATE.replace("<instructions>", '<instructions version="1.0" format="ai-first">')
        passed, errors = verify_ai_first_format(content)
        self.assertTrue(passed, f"Lỗi không mong muốn: {errors}")


class TestYamlNestingDepth(unittest.TestCase):
    """Kiểm thử quy tắc 2: Độ sâu lồng YAML <= 3 cấp (thụt lề <= 6 khoảng trắng)."""

    def test_valid_yaml_indentation_within_limit(self):
        """YAML có thụt lề 2, 4, 6 khoảng trắng hợp lệ."""
        content = VALID_TRIAD_TEMPLATE.replace(
            'version: "1.0.0"',
            'level_1:\n    level_2:\n      level_3: "value"'
        )
        passed, errors = verify_ai_first_format(content)
        self.assertTrue(passed, f"Thụt lề 6 spaces hợp lệ nhưng báo lỗi: {errors}")

    def test_exceeded_yaml_indentation_in_fenced_block(self):
        """YAML trong khối fenced code có thụt lề 8 khoảng trắng (> 6) phải báo lỗi."""
        invalid_yaml = (
            "```yaml\n"
            "root:\n"
            "  level1:\n"
            "    level2:\n"
            "      level3:\n"
            "        level4: \"too deep\"\n"
            "```"
        )
        content = VALID_TRIAD_TEMPLATE.replace("```yaml\nverification:\n  exit_code: 0\n```", invalid_yaml)
        passed, errors = verify_ai_first_format(content)
        self.assertFalse(passed)
        self.assertTrue(any("YAML nesting exceeds 3 levels" in e for e in errors))
        self.assertTrue(any("8 leading spaces" in e for e in errors))

    def test_frontmatter_yaml_nesting_check(self):
        """YAML frontmatter ở đầu tệp (---) cũng được kiểm tra độ thụt lề."""
        content = "---\nmeta:\n  sub:\n    deep:\n        invalid_level: 1\n---\n" + VALID_TRIAD_TEMPLATE
        passed, errors = verify_ai_first_format(content)
        self.assertFalse(passed)
        self.assertTrue(any("YAML nesting exceeds 3 levels" in e for e in errors))

    def test_fenced_yml_syntax_recognized(self):
        """Khối mã ```yml cũng được nhận diện và kiểm định."""
        invalid_yml = (
            "```yml\n"
            "config:\n"
            "        too_deep_field: true\n"
            "```"
        )
        content = VALID_TRIAD_TEMPLATE.replace("```yaml\nverification:\n  exit_code: 0\n```", invalid_yml)
        passed, errors = verify_ai_first_format(content)
        self.assertFalse(passed)
        self.assertTrue(any("YAML nesting exceeds 3 levels" in e for e in errors))

    def test_yaml_comments_and_blank_lines_ignored(self):
        """Dòng trống hoặc dòng chú thích (#) thụt lề sâu không bị tính là vi phạm."""
        content = VALID_TRIAD_TEMPLATE.replace(
            'version: "1.0.0"',
            'version: "1.0.0"\n        # chú thích thụt lề 8 khoảng trắng\n        '
        )
        passed, errors = verify_ai_first_format(content)
        self.assertTrue(passed, f"Chú thích thụt lề sâu không được báo lỗi: {errors}")


class TestAntiMicroTagging(unittest.TestCase):
    """Kiểm thử quy tắc 3: Giới hạn số lượng thẻ XML phân biệt <= 12."""

    def test_allowed_distinct_tags_count(self):
        """Tài liệu có dưới hoặc bằng 12 thẻ XML phân biệt là hợp lệ."""
        content = (
            VALID_TRIAD_TEMPLATE
            + "\n<context_anchor></context_anchor>"
            + "\n<llm_directives></llm_directives>"
            + "\n<gate_rule></gate_rule>"
            + "\n<checkpoint></checkpoint>"
        )
        passed, errors = verify_ai_first_format(content)
        self.assertTrue(passed, f"7 thẻ XML phân biệt hợp lệ nhưng báo lỗi: {errors}")

    def test_exceeded_distinct_tags_count(self):
        """Tài liệu chứa > 12 thẻ XML phân biệt bị coi là micro-tagging và báo lỗi."""
        extra_tags = "".join([f"\n<custom_tag_{i}>content</custom_tag_{i}>" for i in range(11)])
        content = VALID_TRIAD_TEMPLATE + extra_tags  # 3 macro tags + 11 custom = 14 tags
        passed, errors = verify_ai_first_format(content)
        self.assertFalse(passed)
        self.assertTrue(any("Micro-tagging detected" in e for e in errors))


class TestLinkHygiene(unittest.TestCase):
    """Kiểm thử quy tắc 4: An toàn liên kết Markdown và loại trừ đường dẫn tuyệt đối cục bộ."""

    def test_valid_relative_links(self):
        """Liên kết tương đối sạch đạt tiêu chuẩn."""
        content = VALID_TRIAD_TEMPLATE.replace(
            "[hướng dẫn](docs/guide.md)",
            "[hướng dẫn](docs/guide.md#L10) và [kế hoạch](specs/001/plan.md)"
        )
        passed, errors = verify_ai_first_format(content)
        self.assertTrue(passed, f"Lỗi không mong muốn: {errors}")

    def test_corrupted_link_with_backticks_in_label(self):
        """Liên kết chứa dấu backtick trong nhãn [`file.md`](...) bị từ chối."""
        content = VALID_TRIAD_TEMPLATE.replace(
            "[hướng dẫn](docs/guide.md)",
            "[`guide.md`](docs/guide.md)"
        )
        passed, errors = verify_ai_first_format(content)
        self.assertFalse(passed)
        self.assertTrue(any("Corrupted markdown link with backtick" in e for e in errors))

    def test_windows_local_absolute_path_rejected(self):
        """Đường dẫn tuyệt đối Windows (C:\\...) bị từ chối."""
        content = VALID_TRIAD_TEMPLATE.replace(
            "docs/guide.md",
            "C:\\Users\\ADMIN\\Documents\\workspace\\Sales\\guide.md"
        )
        passed, errors = verify_ai_first_format(content)
        self.assertFalse(passed)
        self.assertTrue(any("Forbidden local absolute paths found" in e for e in errors))

    def test_unix_local_absolute_paths_rejected(self):
        """Đường dẫn tuyệt đối Linux/macOS (/home/..., /Users/...) bị từ chối."""
        for path in ["/home/developer/project/file.md", "/Users/john/workspace/doc.md"]:
            content = VALID_TRIAD_TEMPLATE.replace("docs/guide.md", path)
            passed, errors = verify_ai_first_format(content)
            self.assertFalse(passed, f"Đường dẫn {path} phải bị từ chối")
            self.assertTrue(any("Forbidden local absolute paths found" in e for e in errors))


class TestNegativeSpaceConstraints(unittest.TestCase):
    """Kiểm thử quy tắc 5: Tối thiểu 3 ràng buộc phủ định (Negative Space must_not >= 3)."""

    def test_sufficient_negative_space_yaml_keys(self):
        """Tài liệu chứa đủ 3 mệnh đề must_not trong YAML."""
        passed, errors = verify_ai_first_format(VALID_TRIAD_TEMPLATE)
        self.assertTrue(passed)

    def test_sufficient_negative_space_keywords(self):
        """Tài liệu chứa đủ 3 mệnh đề phủ định dạng từ khóa (CẤM, MUST NOT)."""
        content = VALID_TRIAD_TEMPLATE.replace(
            "- must_not: \"CẤM phỏng đoán yêu cầu.\"",
            "- rule: \"CẤM làm biến dạng AST.\""
        ).replace(
            "- must_not: \"CẤM đưa mock vào production.\"",
            "- rule: \"MUST NOT bypass gate.\""
        ).replace(
            "- must_not: \"CẤM nuốt ngoại lệ âm thầm.\"",
            "- rule: \"CẤM tạo dead code.\""
        )
        passed, errors = verify_ai_first_format(content)
        self.assertTrue(passed, f"Lỗi không mong muốn: {errors}")

    def test_insufficient_negative_space(self):
        """Tài liệu chỉ có 1 hoặc 2 mệnh đề phủ định bị báo lỗi."""
        content = VALID_TRIAD_TEMPLATE.replace(
            "- must_not: \"CẤM đưa mock vào production.\"",
            "# removed 1"
        ).replace(
            "- must_not: \"CẤM nuốt ngoại lệ âm thầm.\"",
            "# removed 2"
        )
        passed, errors = verify_ai_first_format(content)
        self.assertFalse(passed)
        self.assertTrue(any("Negative Space insufficient" in e for e in errors))


class TestCompleteAiFirstTriadDocument(unittest.TestCase):
    """Kiểm thử tích hợp trên toàn bộ cấu trúc tài liệu."""

    def test_fully_compliant_triad_document_passes(self):
        """Tài liệu thỏa mãn tất cả tiêu chí trả về (True, [])."""
        passed, errors = verify_ai_first_format(VALID_TRIAD_TEMPLATE)
        self.assertTrue(passed)
        self.assertEqual(errors, [])

    def test_multiple_simultaneous_violations_reported(self):
        """Tài liệu mắc nhiều lỗi cùng lúc phải báo cáo đầy đủ danh sách lỗi."""
        corrupt_doc = (
            "<context>\n"
            "```yaml\n"
            "deep:\n"
            "        exceeded: true\n"
            "```\n"
            "[`broken`](C:\\Users\\admin\\file.txt)\n"
            "</context>\n"
        )
        passed, errors = verify_ai_first_format(corrupt_doc)
        self.assertFalse(passed)
        # Kỳ vọng có lỗi thiếu macro tags, lỗi thụt lề, lỗi backtick link, lỗi absolute path, lỗi negative space
        self.assertGreaterEqual(len(errors), 4)


class TestCliRunnerIntegration(unittest.TestCase):
    """Kiểm thử giao diện dòng lệnh CLI và mã thoát nhị phân (Exit Code 0/1)."""

    def setUp(self):
        self.script_path = os.path.join(SCRIPTS_DIR, "verify-ai-first-format.py")
        self.assertTrue(os.path.exists(self.script_path), f"Không tìm thấy script tại {self.script_path}")

    def test_cli_exit_code_zero_on_valid_file(self):
        """CLI trả về Exit Code 0 trên tệp tài liệu hợp lệ."""
        with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False, encoding="utf-8") as f:
            f.write(VALID_TRIAD_TEMPLATE)
            temp_path = f.name

        try:
            res = subprocess.run([sys.executable, self.script_path, temp_path], capture_output=True, text=True)
            self.assertEqual(res.returncode, 0)
            self.assertIn("[PASS]", res.stdout)
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    def test_cli_exit_code_one_on_invalid_file(self):
        """CLI trả về Exit Code 1 trên tệp tài liệu vi phạm quy tắc."""
        invalid_content = "# Markdown không có macro XML\nNội dung thường"
        with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False, encoding="utf-8") as f:
            f.write(invalid_content)
            temp_path = f.name

        try:
            res = subprocess.run([sys.executable, self.script_path, temp_path], capture_output=True, text=True)
            self.assertEqual(res.returncode, 1)
            self.assertIn("[FAIL]", res.stdout)
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

    def test_cli_exit_code_one_on_missing_file(self):
        """CLI trả về Exit Code 1 khi tệp chỉ định không tồn tại."""
        res = subprocess.run([sys.executable, self.script_path, "non_existent_file_9999.md"], capture_output=True, text=True)
        self.assertEqual(res.returncode, 1)
        self.assertIn("File not found", res.stdout)

    def test_cli_exit_code_one_on_no_arguments(self):
        """CLI trả về Exit Code 1 khi không truyền tham số đường dẫn."""
        res = subprocess.run([sys.executable, self.script_path], capture_output=True, text=True)
        self.assertEqual(res.returncode, 1)
        self.assertIn("Usage:", res.stdout)

    def test_verification_latency_under_50ms(self):
        """Đo lường độ trễ: hàm kiểm định verify_ai_first_format phải hoàn tất dưới 50ms."""
        start_time = time.perf_counter()
        passed, errors = verify_ai_first_format(VALID_TRIAD_TEMPLATE)
        elapsed_ms = (time.perf_counter() - start_time) * 1000

        self.assertTrue(passed)
        self.assertLess(elapsed_ms, 50.0, f"Độ trễ {elapsed_ms:.2f}ms vượt quá ngưỡng cho phép 50ms")


if __name__ == "__main__":
    unittest.main()
