import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "backend" / "parser"))

from core.pipeline import PDFPipeline


class PipelineBoundaryTests(unittest.TestCase):
    def test_rejects_pdf_without_extractable_text_before_encoding(self):
        pipeline = PDFPipeline.__new__(PDFPipeline)
        pipeline.original_name = None
        pdf_parser = Mock()
        pdf_parser.extract_pages.return_value = [
            {"page": 1, "text": "", "has_text": False}
        ]

        with patch("core.pipeline.PDFParser", return_value=pdf_parser):
            with self.assertRaisesRegex(ValueError, "no extractable text"):
                pipeline.process("image-only.pdf")


if __name__ == "__main__":
    unittest.main()
