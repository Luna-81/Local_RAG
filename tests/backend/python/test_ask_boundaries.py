import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "backend" / "parser"))

import ask


class AskBoundaryTests(unittest.TestCase):
    def test_empty_retrieval_does_not_call_answer_generator(self):
        with (
            patch.object(ask, "search_documents", return_value=[]),
            patch.object(ask, "generate_answer") as generate_answer,
        ):
            answer, sources = ask.ask_question("unmatched question", verbose=False)

        self.assertIn("couldn't find relevant information", answer)
        self.assertEqual(sources, [])
        generate_answer.assert_not_called()

    def test_search_failure_returns_error_without_calling_generator(self):
        with (
            patch.object(ask, "search_documents", side_effect=RuntimeError("offline")),
            patch.object(ask, "generate_answer") as generate_answer,
        ):
            answer, sources = ask.ask_question("question", verbose=False)

        self.assertIn("couldn't search", answer)
        self.assertEqual(sources, [])
        generate_answer.assert_not_called()


if __name__ == "__main__":
    unittest.main()
