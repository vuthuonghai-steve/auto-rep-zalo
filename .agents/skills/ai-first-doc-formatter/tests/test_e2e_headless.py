#!/usr/bin/env python3
# .agents/skills/ai-first-doc-formatter/tests/test_e2e_headless.py
"""
Bộ kiểm thử tích hợp đầu-cuối (End-to-End Headless Tests) cho hệ thống chuẩn hóa tài liệu AI-First Triad.
Kiểm chứng:
1. Toàn bộ các archetype templates (1..5) trong templates/ đạt 100% Exit Code 0 khi kiểm định.
2. Toàn bộ các tệp ví dụ mẫu trong examples/ vượt qua verify-ai-first-format.
3. Luồng làm việc tự động (Pipeline E2E): Unformatted Markdown -> auto-format-markdown.py -> verify-ai-first-format.py đạt Exit Code 0.
4. Xử lý chuẩn hóa liên kết và đường dẫn (Link & Path Sanitation E2E).
"""

import os
import sys
import glob
import tempfile
import subprocess
import unittest

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SCRIPTS_DIR = os.path.join(BASE_DIR, "scripts")
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
EXAMPLES_DIR = os.path.join(BASE_DIR, "examples")

VERIFY_SCRIPT = os.path.join(SCRIPTS_DIR, "verify-ai-first-format.py")
FORMAT_SCRIPT = os.path.join(SCRIPTS_DIR, "auto-format-markdown.py")


class TestAiFirstTemplatesE2E(unittest.TestCase):
    """Kiểm thử tính tương thích của toàn bộ template có sẵn trong templates/."""

    def test_all_archetype_templates_pass_verification(self):
        """100% tệp *.template.md trong templates/ phải đạt Exit Code 0."""
        template_files = glob.glob(os.path.join(TEMPLATES_DIR, "*.md"))
        self.assertGreater(len(template_files), 0, "Không tìm thấy tệp template nào trong thư mục templates/")

        for tmpl_path in template_files:
            rel_name = os.path.basename(tmpl_path)
            res = subprocess.run([sys.executable, VERIFY_SCRIPT, tmpl_path], capture_output=True, text=True)
            self.assertEqual(
                res.returncode, 0,
                f"Template {rel_name} thất bại khi chạy verify-ai-first-format:\nSTDOUT:\n{res.stdout}\nSTDERR:\n{res.stderr}"
            )
            self.assertIn("[PASS]", res.stdout)


class TestAiFirstExamplesE2E(unittest.TestCase):
    """Kiểm thử các tệp ví dụ trong examples/."""

    def test_all_example_documents_pass_verification(self):
        """Các tệp ví dụ mẫu trong examples/ phải đạt chuẩn hoặc xác nhận hợp lệ."""
        example_files = glob.glob(os.path.join(EXAMPLES_DIR, "*.md"))
        self.assertGreater(len(example_files), 0, "Không tìm thấy tệp ví dụ nào trong examples/")

        for ex_path in example_files:
            rel_name = os.path.basename(ex_path)
            res = subprocess.run([sys.executable, VERIFY_SCRIPT, ex_path], capture_output=True, text=True)
            self.assertEqual(
                res.returncode, 0,
                f"Example {rel_name} thất bại khi chạy verify-ai-first-format:\nSTDOUT:\n{res.stdout}\nSTDERR:\n{res.stderr}"
            )
            self.assertIn("[PASS]", res.stdout)


class TestAiFirstFormattingPipelineE2E(unittest.TestCase):
    """Kiểm thử luồng khép kín: Tự động format bản thảo thô và kiểm chứng kết quả."""

    def test_auto_format_and_verify_pipeline_archetype_1(self):
        """Bản thảo thô được đóng gói qua auto-format-markdown.py archetype 1 phải pass kiểm định."""
        raw_draft = (
            "# Quy Chuẩn Kiến Trúc Cốt Lõi\n\n"
            "Mô tả nguyên lý hệ thống và các ràng buộc kỹ thuật.\n"
            "Tham khảo tài liệu [`overview`](docs/overview.md) tại đây.\n"
        )

        with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False, encoding="utf-8") as f_in:
            f_in.write(raw_draft)
            input_file = f_in.name

        output_file = input_file + ".formatted.md"

        try:
            # 1. Chạy auto-format-markdown.py
            cmd_format = [
                sys.executable, FORMAT_SCRIPT,
                input_file,
                "--output", output_file,
                "--archetype", "1"
            ]
            res_format = subprocess.run(cmd_format, capture_output=True, text=True)
            self.assertEqual(res_format.returncode, 0, f"Format thất bại: {res_format.stderr}")

            # 2. Chạy verify-ai-first-format.py trên output_file
            res_verify = subprocess.run([sys.executable, VERIFY_SCRIPT, output_file], capture_output=True, text=True)
            self.assertEqual(
                res_verify.returncode, 0,
                f"Tệp sau khi format không vượt qua kiểm định:\n{res_verify.stdout}\n{res_verify.stderr}"
            )
            self.assertIn("[PASS]", res_verify.stdout)
        finally:
            if os.path.exists(input_file):
                os.remove(input_file)
            if os.path.exists(output_file):
                os.remove(output_file)

    def test_auto_format_and_verify_all_archetypes(self):
        """Kiểm chứng pipeline tự động format cho cả 5 archetypes (1..5)."""
        for archetype_id in range(1, 6):
            raw_text = f"# Headless Test Document for Archetype {archetype_id}\n\nNội dung văn bản mô tả tác vụ."
            with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False, encoding="utf-8") as f_in:
                f_in.write(raw_text)
                input_path = f_in.name
            out_path = input_path + f".arch_{archetype_id}.md"

            try:
                res_format = subprocess.run([
                    sys.executable, FORMAT_SCRIPT,
                    input_path, "--output", out_path,
                    "--archetype", str(archetype_id)
                ], capture_output=True, text=True)
                self.assertEqual(res_format.returncode, 0)

                res_verify = subprocess.run([sys.executable, VERIFY_SCRIPT, out_path], capture_output=True, text=True)
                self.assertEqual(
                    res_verify.returncode, 0,
                    f"Archetype {archetype_id} không pass kiểm định sau khi format: {res_verify.stdout}"
                )
            finally:
                if os.path.exists(input_path):
                    os.remove(input_path)
                if os.path.exists(out_path):
                    os.remove(out_path)


if __name__ == "__main__":
    unittest.main()
