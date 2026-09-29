# backend/parser/generate.py
#!/usr/bin/env python3
"""
Generate Function - Call llama-server API with prompt
"""
import requests
import json
import sys
from typing import Optional


class LLMGenerator:
    def __init__(self, api_url: str = "http://localhost:8080/v1/chat/completions"):
        self.api_url = api_url

    def generate(self, prompt: str, temperature: float = 0.3, max_tokens: int = 512) -> Optional[str]:
        headers = {"Content-Type": "application/json"}

        # 确保针对 llama-server 的 OpenAI 兼容接口构建正确格式
        payload = {
            "messages": [
                {"role": "user", "content": prompt}
            ],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": False
        }

        try:
            # 日志重定向到 stderr，避免污染 Node.js 读取的 stdout
            print("⏳ Sending request to llama-server...", file=sys.stderr)
            response = requests.post(
                self.api_url,
                headers=headers,
                json=payload,
                timeout=180
            )
            response.raise_for_status()

            result = response.json()
            choices = result.get("choices", [])
            if choices and len(choices) > 0:
                answer = choices[0].get("message", {}).get("content", "")
                return answer.strip()
            return None

        except requests.exceptions.ConnectionError:
            print("Error: Cannot connect to llama-server at http://localhost:8080", file=sys.stderr)
            return None
        except requests.exceptions.Timeout:
            print("Error: llama-server request timed out (180s)", file=sys.stderr)
            return None
        except Exception as e:
            print(f"Error calling llama-server: {e}", file=sys.stderr)
            return None


def generate_answer(prompt: str, temperature: float = 0.3) -> Optional[str]:
    generator = LLMGenerator()
    return generator.generate(prompt, temperature=temperature)


if __name__ == "__main__":
    test_prompt = "Hello, who are you?"
    answer = generate_answer(test_prompt)
    if answer:
        print(f"Answer: {answer}")
    else:
        print("Failed to get answer.")