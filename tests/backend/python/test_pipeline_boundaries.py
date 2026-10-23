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

    def test_encoding_failure_does_not_insert_partial_records(self):
        pipeline = PDFPipeline.__new__(PDFPipeline)
        pipeline.original_name = "source.pdf"
        pipeline.chunk_method = "fixed"
        pipeline.chunker = Mock()
        pipeline.chunker.chunk_text.return_value = [
            {"text": "content", "char_count": 7, "word_count": 1}
        ]
        pipeline.encoder = Mock()
        pipeline.encoder.encode.side_effect = RuntimeError("model unavailable")
        pipeline.store = Mock()

        with (
            patch.object(
                PDFPipeline,
                "_extract_document",
                return_value=("content", [{"page": 1, "text": "content"}], {}),
            ),
            self.assertRaisesRegex(RuntimeError, "model unavailable"),
        ):
            pipeline.process("source.pdf")

        pipeline.store.insert.assert_not_called()

    def test_page_assignment_handles_empty_documents_and_spreads_chunks(self):
        pipeline = PDFPipeline.__new__(PDFPipeline)
        self.assertEqual(
            pipeline._get_page_for_chunk({"total_chunks": 1}, [], chunk_index=0), 0
        )

        pages = [{"page": 1}, {"page": 2}, {"page": 3}]
        chunk = {"total_chunks": 4}
        self.assertEqual(pipeline._get_page_for_chunk(chunk, pages, 0), 1)
        self.assertEqual(pipeline._get_page_for_chunk(chunk, pages, 2), 2)
        self.assertEqual(pipeline._get_page_for_chunk(chunk, pages, 3), 3)


if __name__ == "__main__":
    unittest.main()
