#!/usr/bin/env python3
"""
Complete Q&A Pipeline - Search + Build Prompt + Generate Answer
"""
import sys
import json
import warnings
from search import search_documents
from prompt_template import build_prompt
from generate import generate_answer

warnings.filterwarnings("ignore")


def ask_question(question: str, top_k: int = 5, temperature: float = 0.1, verbose: bool = True):
    """
    Returns:
        (answer: str | None, sources: list[dict])
    Sources are the exact chunks fed to the LLM (same retrieval pass).
    """
    if verbose:
        print("=" * 60, file=sys.stderr)
        print(f"Question: {question}", file=sys.stderr)
        print("=" * 60, file=sys.stderr)

    # 1. Retrieve chunks (single retrieval for both prompt and sources)
    try:
        results = search_documents(question, top_k=top_k)
    except Exception as e:
        if verbose:
            print(f"Search failed with error: {e}", file=sys.stderr)
        results = []

    # 2. Build prompt
    if results:
        if verbose:
            print(f"\n[1] Found {len(results)} relevant chunks. Building prompt...", file=sys.stderr)
        prompt = build_prompt(question, results)
    else:
        if verbose:
            print("\n[1] No relevant content found in vector DB. Using raw question...", file=sys.stderr)
        prompt = question

    if verbose:
        print("\n[2] Generating answer from LLM...", file=sys.stderr)

    # 3. Call the LLM
    answer = generate_answer(prompt, temperature=temperature)

    if verbose:
        if answer:
            print("\n[3] Answer generated successfully.", file=sys.stderr)
        else:
            print("\n[3] Failed to generate answer from LLM.", file=sys.stderr)

    return answer, results


def _serialize_sources(results):
    """Convert raw LanceDB rows into a compact, JSON-safe list."""
    out = []
    for r in results or []:
        text = r.get("text") or ""
        out.append({
            "document_name": r.get("document_name", "Unknown"),
            "page": r.get("page", 0),
            "text": text[:200] + ("..." if len(text) > 200 else ""),
            "score": float(r.get("score", r.get("_distance", 0.0)) or 0.0),
        })
    return out


if __name__ == "__main__":
    is_api_call = not sys.stdin.isatty()

    if len(sys.argv) > 1:
        question = sys.argv[1]
    else:
        question = sys.stdin.read().strip()
        if not question and not is_api_call:
            question = input("Enter your question: ").strip()
        if not question:
            question = "What is this document about?"

    if is_api_call:
        # Redirect stdout -> stderr while running so library logs don't pollute JSON
        old_stdout = sys.stdout
        sys.stdout = sys.stderr

        try:
            answer, results = ask_question(question, top_k=5, temperature=0.1, verbose=False)
        except Exception:
            answer, results = None, []

        sys.stdout = old_stdout

        payload = {
            "success": bool(answer and answer.strip()),
            "answer": answer if (answer and answer.strip())
                      else "Failed to generate answer. Please verify vector DB index or llama-server status.",
            "sources": _serialize_sources(results),
        }
        print(json.dumps(payload, ensure_ascii=False))
    else:
        answer, _ = ask_question(question, top_k=5, temperature=0.1, verbose=True)
        if answer:
            print("\n" + "=" * 60)
            print("ANSWER:")
            print("=" * 60)
            print(answer)