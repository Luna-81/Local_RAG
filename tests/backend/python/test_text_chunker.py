import unittest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "backend" / "parser"))

from core.text_chunker import TextChunker


class TextChunkerTests(unittest.TestCase):
    def test_rejects_invalid_chunk_boundaries(self):
        for chunk_size, overlap in ((0, 0), (-1, 0), (10, -1), (10, 10), (10, 11)):
            with self.subTest(chunk_size=chunk_size, overlap=overlap):
                with self.assertRaises(ValueError):
                    TextChunker(chunk_size, overlap)

    def test_empty_input_returns_no_chunks(self):
        chunker = TextChunker(chunk_size=20, overlap=2)

        self.assertEqual(chunker.chunk_text(""), [])
        self.assertEqual(chunker.chunk_text("   \n\n  "), [])

    def test_fixed_chunks_include_expected_overlap_and_metadata(self):
        chunker = TextChunker(chunk_size=12, overlap=3)

        chunks = chunker.chunk_text("abcdefghijklmnopqrstuvwxyz1234", method="fixed")

        self.assertEqual(
            [chunk["text"] for chunk in chunks],
            ["abcdefghijkl", "jklmnopqrstu", "stuvwxyz1234"],
        )
        self.assertEqual([chunk["chunk_index"] for chunk in chunks], [0, 1, 2])
        self.assertTrue(all(chunk["total_chunks"] == 3 for chunk in chunks))

    def test_unknown_chunking_method_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "Unsupported chunking method"):
            TextChunker().chunk_text("content", method="unknown")


if __name__ == "__main__":
    unittest.main()
