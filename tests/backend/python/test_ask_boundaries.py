import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "backend" / "parser"))

import ask


class AskBoundaryTests(unittest.TestCase):
    def test_success_uses_one_retrieval_for_prompt_and_sources(self):
        retrieved = [
            {"document_name": "guide.pdf", "page": 2, "text": "Relevant passage"}
        ]
        with (
            patch.object(ask, "search_documents", return_value=retrieved) as search,
            patch.object(
                ask, "build_prompt", return_value="grounded prompt"
            ) as build_prompt,
            patch.object(
                ask, "generate_answer", return_value="grounded answer"
            ) as generate,
        ):
            answer, sources = ask.ask_question("question", verbose=False)

        search.assert_called_once_with("question", top_k=5)
        build_prompt.assert_called_once_with("question", retrieved)
        generate.assert_called_once_with("grounded prompt", temperature=0.1)
        self.assertEqual(answer, "grounded answer")
        self.assertIs(sources, retrieved)

    def test_empty_retrieval_does_not_call_answer_generator(self):
        with (
            patch.object(ask, "search_documents", return_value=[]),
            patch.object(ask, "generate_answer") as generate_answer,
        ):
            answer, sources = ask.ask_question("unmatched question", verbose=False)

        self.assertIn("couldn't find relevant information", answer)
        self.assertEqual(sources, [])
        generate_answer.assert_not_called()

    def test_source_serialization_truncates_text_and_normalizes_scores(self):
        serialized = ask._serialize_sources(
            [
                {
                    "document_name": "guide.pdf",
                    "page": 3,
                    "text": "x" * 205,
                    "_distance": 0.25,
                },
                {},
            ]
        )

        self.assertEqual(serialized[0]["document_name"], "guide.pdf")
        self.assertEqual(serialized[0]["page"], 3)
        self.assertEqual(serialized[0]["text"], "x" * 200 + "...")
        self.assertEqual(serialized[0]["score"], 0.25)
        self.assertEqual(
            serialized[1],
            {
                "document_name": "Unknown",
                "page": 0,
                "text": "",
                "score": 0.0,
            },
        )

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
