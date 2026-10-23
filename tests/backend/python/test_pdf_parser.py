import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "backend" / "parser"))

from core.pdf_parser import PDFParser


class PdfParserTests(unittest.TestCase):
    def test_missing_file_is_reported_before_reader_initialization(self):
        with patch("core.pdf_parser.os.path.exists", return_value=False):
            with self.assertRaisesRegex(FileNotFoundError, "missing.pdf"):
                PDFParser("missing.pdf")

    def test_page_extraction_preserves_other_pages_when_one_page_fails(self):
        first_page = Mock()
        first_page.extract_text.return_value = "  First page  "
        failing_page = Mock()
        failing_page.extract_text.side_effect = RuntimeError("damaged page")
        parser = PDFParser.__new__(PDFParser)
        parser.reader = Mock(pages=[first_page, failing_page])

        pages = parser.extract_pages()

        self.assertEqual(pages[0], {"page": 1, "text": "First page", "has_text": True})
        self.assertEqual(pages[1]["page"], 2)
        self.assertEqual(pages[1]["text"], "")
        self.assertFalse(pages[1]["has_text"])
        self.assertIn("damaged page", pages[1]["error"])

    def test_metadata_defaults_when_pdf_has_no_metadata(self):
        parser = PDFParser.__new__(PDFParser)
        parser.reader = Mock(metadata=None)

        metadata = parser.get_metadata()

        self.assertEqual(metadata["title"], "")
        self.assertEqual(metadata["author"], "")
        self.assertEqual(metadata["creation_date"], "")


if __name__ == "__main__":
    unittest.main()
