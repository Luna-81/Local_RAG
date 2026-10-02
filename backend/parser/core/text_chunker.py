#!/usr/bin/env python3
"""
Text Chunker - Split text into chunks with overlap
"""
import re
from typing import List, Dict


class TextChunker:
    def __init__(self, chunk_size: int = 500, overlap: int = 50):
        self.chunk_size = chunk_size
        self.overlap = overlap
    
    def chunk_by_paragraph(self, text: str) -> List[str]:
        if not text:
            return []
        
        paragraphs = text.split('\n\n')
        chunks = []
        current_chunk = ""
        
        for para in paragraphs:
            if not para.strip():
                continue
                
            if len(current_chunk) + len(para) <= self.chunk_size:
                current_chunk += para + "\n\n"
            else:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                
                if len(para) > self.chunk_size:
                    sentences = re.split(r'[.?!;\n]', para)
                    temp_chunk = ""
                    for sent in sentences:
                        if not sent.strip():
                            continue
                        if len(temp_chunk) + len(sent) <= self.chunk_size:
                            temp_chunk += sent + ". "
                        else:
                            if temp_chunk:
                                chunks.append(temp_chunk.strip())
                            temp_chunk = sent + ". "
                    if temp_chunk:
                        current_chunk = temp_chunk
                    else:
                        current_chunk = ""
                else:
                    current_chunk = para + "\n\n"
        
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        return self._apply_overlap(chunks)
    
    def chunk_by_sentence(self, text: str) -> List[str]:
        if not text:
            return []
        
        sentences = re.split(r'(?<=[.?!;])\s+', text)
        sentences = [s.strip() for s in sentences if s.strip()]
        
        chunks = []
        current_chunk = ""
        
        for sent in sentences:
            if len(current_chunk) + len(sent) <= self.chunk_size:
                current_chunk += sent + " "
            else:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = sent + " "
        
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        return self._apply_overlap(chunks)
    
    def chunk_by_fixed_size(self, text: str) -> List[str]:
        if not text:
            return []
        
        chunks = []
        for i in range(0, len(text), self.chunk_size - self.overlap):
            chunk = text[i:i + self.chunk_size]
            if len(chunk) >= 10:
                chunks.append(chunk.strip())
        
        return chunks
    
    def _apply_overlap(self, chunks: List[str]) -> List[str]:
        if self.overlap <= 0 or len(chunks) <= 1:
            return chunks
        
        overlapped = []
        for i, chunk in enumerate(chunks):
            if i == 0:
                overlapped.append(chunk)
            else:
                prev_chunk = chunks[i-1]
                overlap_text = prev_chunk[-self.overlap:] if len(prev_chunk) > self.overlap else prev_chunk
                overlapped.append(overlap_text + chunk)
        
        return overlapped
    
    def chunk_text(self, text: str, method: str = "paragraph") -> List[Dict]:
        if method == "paragraph":
            chunks = self.chunk_by_paragraph(text)
        elif method == "sentence":
            chunks = self.chunk_by_sentence(text)
        else:
            chunks = self.chunk_by_fixed_size(text)
        
        result = []
        total = len(chunks)
        for i, chunk in enumerate(chunks):
            result.append({
                "text": chunk,
                "chunk_index": i,
                "total_chunks": total,
                "char_count": len(chunk),
                "word_count": len(chunk.split())
            })
        
        return result


def chunk_text(
    text: str, 
    chunk_size: int = 500, 
    overlap: int = 50,
    method: str = "paragraph"
) -> List[Dict]:
    chunker = TextChunker(chunk_size, overlap)
    return chunker.chunk_text(text, method)
    