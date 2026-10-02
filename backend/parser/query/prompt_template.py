#!/usr/bin/env python3
"""
Prompt Template - Combine retrieved content with user question
"""
from typing import List, Dict


class PromptBuilder:
    def __init__(self):
        self.system_prompt = "You are a helpful assistant. Answer questions based on the provided context."
    
    def build(self, question: str, retrieved_content: List[Dict]) -> str:
        """Combine context and question into a prompt"""
        context_parts = []
        
        # 构建包含文档名的上下文
        for i, item in enumerate(retrieved_content, 1):
            text = item.get('text', '')
            document = item.get('document_name', 'Unknown Document')
            page = item.get('page', 'N/A')
            context_parts.append(f"=== Document {i}: {document} ===")
            context_parts.append(f"Page: {page}")
            context_parts.append(f"Content: {text[:500]}...")
            context_parts.append("")
        
        context = "\n".join(context_parts)
        
        prompt = f"""{self.system_prompt}

---

**Provided Document Content:**

{context}

---

**User Question:**
{question}

---

**Instructions (strictly follow):**
1. Answer based ONLY on the provided document content
2. If the document doesn't contain the answer, say "No enough information"
3. **Must explicitly cite the document filename**, format: According to "Employee_Handbook.pdf"...
4. **DO NOT use vague references** like "Document 1", "文档1" - use the full filename
5. Answer should be clear and concise
6. Answer in the same language as the question

**Answer:**"""
        
        return prompt


def build_prompt(question: str, retrieved_content: List[Dict]) -> str:
    builder = PromptBuilder()
    return builder.build(question, retrieved_content)