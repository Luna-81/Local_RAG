import io
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import run


class RunCliTests(unittest.TestCase):
    def test_main_parses_options_and_reports_success(self):
        with tempfile.NamedTemporaryFile(suffix=".PDF") as pdf_file:
            result = {
                "document_name": "fixture.pdf",
                "total_pages": 1,
                "total_chunks": 2,
                "records_inserted": 2,
                "vector_dim": 3,
                "text_length": 24,
            }
            with (
                patch.object(run, "process_pdf_file", return_value=result) as process,
                redirect_stdout(io.StringIO()),
            ):
                exit_code = run.main(
                    [pdf_file.name, "--chunk_size", "120", "--overlap", "20"]
                )

        self.assertEqual(exit_code, 0)
        self.assertEqual(process.call_args.kwargs["chunk_size"], 120)
        self.assertEqual(process.call_args.kwargs["overlap"], 20)

    def test_main_rejects_invalid_chunk_boundaries(self):
        with tempfile.NamedTemporaryFile(suffix=".pdf") as pdf_file:
            with self.assertRaises(SystemExit) as raised:
                run.main([pdf_file.name, "--chunk_size", "10", "--overlap", "10"])

        self.assertEqual(raised.exception.code, 2)


if __name__ == "__main__":
    unittest.main()
