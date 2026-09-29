#!/usr/bin/env python3
"""
HTTP API Server - 使用您现有的 ask.py
"""
import sys
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
from ask import ask_question
from vector_store import VectorStore  # ✅ 添加：初始化向量存储
import logging

# 减少日志输出
logging.basicConfig(level=logging.WARNING)

app = Flask(__name__)
CORS(app)  # 允许跨域

# ✅ 应用启动时初始化向量存储，确保表存在
try:
    store = VectorStore()
    print(f"✅ Vector store initialized, table: {store.table_name}", file=sys.stderr)
except Exception as e:
    print(f"⚠️  Vector store init warning: {e}", file=sys.stderr)


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'service': 'python-rag'})


@app.route('/ask', methods=['POST'])
def handle_ask():
    """调用您现有的 ask_question 函数"""
    try:
        data = request.get_json()
        
        if not data or 'question' not in data:
            return jsonify({
                'success': False, 
                'error': 'Missing question'
            }), 400
        
        question = data['question'].strip()
        if not question:
            return jsonify({
                'success': False, 
                'error': 'Empty question'
            }), 400
        
        # 调用您现有的 ask_question
        # verbose=False 避免日志污染
        answer, _ = ask_question(
            question=question,
            top_k=5,
            temperature=0.1,
            verbose=False
        )
        
        if answer:
            return jsonify({
                'success': True,
                'answer': answer
            })
        else:
            return jsonify({
                'success': False,
                'error': 'No answer generated'
            }), 500
            
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


if __name__ == '__main__':
    port = 5001
    print(f"🚀 Python API running on http://localhost:{port}")
    print(f"📋 Health: http://localhost:{port}/health")
    print(f"💬 Ask: http://localhost:{port}/ask")
    app.run(host='0.0.0.0', port=port, debug=False, threaded=True)