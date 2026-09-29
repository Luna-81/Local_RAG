// backend/router/qaRouter.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const KnowledgeBaseModel = require('../models/KnowledgeBaseModel');

const parserDir = path.join(__dirname, '../parser');
const ASK_SCRIPT = path.join(parserDir, 'ask.py');

const venvPythonPath = path.resolve(__dirname, '../../venv/bin/python3');
const pythonExecutable = fs.existsSync(venvPythonPath) ? venvPythonPath : 'python3';

/**
 * POST /api/qa/ask
 * body: { question, kbId }
 * Both are required.
 *
 * Runs a single python process (ask.py) which:
 *   1. retrieves relevant chunks from the KB table
 *   2. builds the prompt
 *   3. calls the LLM
 *   4. returns { success, answer, sources } as JSON
 */
router.post('/ask', async (req, res) => {
    const { question, kbId } = req.body;

    if (!question || !question.trim()) {
        return res.status(400).json({ success: false, message: 'Question is required' });
    }
    if (!kbId) {
        return res.status(400).json({ success: false, message: 'kbId is required' });
    }

    const kb = KnowledgeBaseModel.findById(Number(kbId));
    if (!kb) {
        return res.status(404).json({ success: false, message: 'Knowledge base not found' });
    }
    const kbTable = kb.tableName;

    console.log(`[QA Router] KB=${kb.name} (${kbTable}) | Q="${question.substring(0, 50)}..."`);

    const askProcess = spawn(pythonExecutable, [ASK_SCRIPT, question], {
        cwd: parserDir,
        env: {
            ...process.env,
            PYTHONIOENCODING: 'utf-8',
            PYTHONUNBUFFERED: '1',
            PYTHONHASHSEED: '0',
            // Skip HuggingFace network checks on every spawn
            HF_HUB_OFFLINE: '1',
            TRANSFORMERS_OFFLINE: '1',
            KB_TABLE: kbTable,
        },
        stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    askProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        console.log('[Ask STDOUT]', chunk.trim());
    });

    askProcess.stderr.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        console.log('[Ask STDERR]', chunk.trim());
    });

    askProcess.on('error', (error) => {
        console.error('[Ask Process Error]:', error);
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: 'Failed to start AI inference process',
            });
        }
    });

    const timeout = setTimeout(() => {
        askProcess.kill();
        console.error('[Timeout] Ask process killed after 60s');
        if (!res.headersSent) {
            res.status(504).json({ success: false, message: 'Request timeout' });
        }
    }, 60000);

    askProcess.on('close', (code) => {
        clearTimeout(timeout);
        console.log(`[Ask Process] Closed with code ${code}`);

        if (code !== 0) {
            console.error('[Ask Process Error]', stderr || `Exit code: ${code}`);
            if (!res.headersSent) {
                return res.status(500).json({
                    success: false,
                    message: 'AI inference failed',
                    details: stderr || 'Unknown error',
                });
            }
            return;
        }

        try {
            // stdout should contain exactly one JSON line
            const jsonMatch = stdout.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.error('[JSON Parse Error] No JSON found in stdout');
                console.error('[Raw stdout]:', stdout);
                console.error('[stderr]:', stderr);
                if (!res.headersSent) {
                    return res.status(500).json({
                        success: false,
                        message: 'No valid JSON response from AI',
                        rawOutput: stdout.substring(0, 200),
                    });
                }
                return;
            }

            const data = JSON.parse(jsonMatch[0]);
            console.log('[Ask Success] Response parsed:', data.success ? 'OK' : 'Failed');

            let errorMsg = null;
            if (!data.success) {
                if (stderr.includes('llama-server')) {
                    errorMsg = 'LLM server not responding. Please check llama-server status.';
                } else if (stderr.includes('connection refused')) {
                    errorMsg = 'Cannot connect to LLM server.';
                } else {
                    errorMsg = 'No response generated. Please try rephrasing your question.';
                }
            }

            if (!res.headersSent) {
                return res.json({
                    success: true,
                    answer: data.answer || 'No response generated.',
                    sources: Array.isArray(data.sources) ? data.sources : [],
                    ...(errorMsg ? { warning: errorMsg } : {}),
                });
            }
        } catch (e) {
            console.error('[JSON Parse Exception]:', e.message);
            console.error('[Raw stdout]:', stdout);
            console.error('[stderr]:', stderr);
            if (!res.headersSent) {
                return res.status(500).json({
                    success: false,
                    message: 'Failed to parse AI response',
                    details: e.message,
                    rawOutput: stdout.substring(0, 200),
                });
            }
        }
    });

    // Feed the question via stdin (ask.py accepts argv[1] or stdin)
    askProcess.stdin.write(question + '\n');
    askProcess.stdin.end();
});

module.exports = router;