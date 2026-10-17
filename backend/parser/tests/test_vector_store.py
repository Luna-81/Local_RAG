import json
import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.vector_store import VectorStore


class VectorStoreTests(unittest.TestCase):
    def test_prepare_records_serializes_metadata_and_vectors(self):
        records = [{"metadata": {"page": 2}, "vector": np.array([0.25, 0.75])}]

        prepared = VectorStore._prepare_records(records)

        self.assertEqual(len(prepared[0]["id"]), 36)
        self.assertEqual(json.loads(prepared[0]["metadata"]), {"page": 2})
        self.assertEqual(prepared[0]["vector"], [0.25, 0.75])

    def test_prepare_records_preserves_existing_ids_and_empty_input(self):
        record = {"id": "existing-id", "text": "passage"}

        self.assertEqual(VectorStore._prepare_records([record]), [record])
        self.assertEqual(VectorStore._prepare_records([]), [])


if __name__ == "__main__":
    unittest.main()
