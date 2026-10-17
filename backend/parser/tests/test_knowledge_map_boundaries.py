import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import knowledge_map


class KnowledgeMapBoundaryTests(unittest.TestCase):
    def test_empty_document_returns_empty_map(self):
        with patch.object(
            knowledge_map,
            "load_chunks",
            return_value=([], np.zeros((0, 0), dtype="float32")),
        ):
            self.assertEqual(
                knowledge_map.build_map("empty.pdf"),
                {"doc_name": "empty.pdf", "points": [], "clusters": []},
            )

    def test_single_chunk_builds_one_cluster(self):
        chunks = [{"id": "chunk-1", "text": "A single extracted passage.", "page": 1}]
        vectors = np.array([[1.0, 0.0, 0.0]], dtype="float32")

        with (
            patch.object(knowledge_map, "load_chunks", return_value=(chunks, vectors)),
            patch.object(
                knowledge_map, "generate_answer", return_value='{"label": "Topic"}'
            ),
        ):
            result = knowledge_map.build_map("single.pdf")

        self.assertEqual(len(result["points"]), 1)
        self.assertEqual(len(result["clusters"]), 1)
        self.assertEqual(result["clusters"][0]["chunk_ids"], ["chunk-1"])


if __name__ == "__main__":
    unittest.main()
