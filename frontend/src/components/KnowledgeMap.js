// src/components/KnowledgeMap.js
import React, { useEffect, useState } from 'react';
import { getKnowledgeMapApi, buildKnowledgeMapApi } from '../api/knowledgeApi';
import '../css/KnowledgeMap.css';

const W = 720, H = 460, PAD = 44;

const KnowledgeMap = ({ docName, kbId }) => {
  const [data, setData]         = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    setSelected(null);
    setError('');
    setData(null);
    if (!docName || !kbId) return;

    getKnowledgeMapApi(docName, kbId)
      .then(r => setData(r))
      .catch(e => setError(e.response?.data?.message || 'Failed to load map.'));
  }, [docName, kbId]);

  const handleBuild = async () => {
    setLoading(true);
    setSelected(null);
    setError('');
    try {
      const r = await buildKnowledgeMapApi(docName, kbId);
      setData(r);
    } catch (e) {
      setError(e.response?.data?.message || 'Generation failed.');
    } finally {
      setLoading(false);
    }
  };

  const toXY = (x, y) => [PAD + x * (W - 2 * PAD), H - PAD - y * (H - 2 * PAD)];
  const hasData = data?.clusters?.length > 0;
  const active  = selected != null ? data.clusters.find(c => c.id === selected) : null;

  return (
    <div className="km-wrap">
      <div className="km-toolbar">
        <h3>Knowledge Map · {docName}</h3>
        <button onClick={handleBuild} disabled={loading}>
          {loading ? 'Generating… (1–5 min)' : hasData ? 'Regenerate' : 'Generate Knowledge Map'}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {!hasData && !loading && !error && (
        <p className="km-hint">No map yet. Click the button above to generate.</p>
      )}
      {loading && <p className="km-hint">Dimensionality reduction + clustering + LLM extraction…</p>}

      {hasData && (
        <div className="km-body">
          <svg viewBox={`0 0 ${W} ${H}`} className="km-svg">
            {data.points.map((p, i) => {
              const [cx, cy] = toXY(p.x, p.y);
              const on = selected === p.cluster;
              return (
                <circle key={i} cx={cx} cy={cy} r={on ? 3.5 : 2.5}
                        fill={on ? '#1d4ed8' : '#cbd5e1'}
                        opacity={selected == null || on ? 1 : 0.3} />
              );
            })}
            {data.clusters.map(c => {
              const [cx, cy] = toXY(c.x, c.y);
              const on = selected === c.id;
              return (
                <g key={c.id} className="km-node"
                   onClick={() => setSelected(on ? null : c.id)}>
                  <circle cx={cx} cy={cy} r={on ? 13 : 10}
                          fill={on ? '#1d4ed8' : '#60a5fa'}
                          stroke="#fff" strokeWidth={2} />
                  <text x={cx} y={cy + 4} textAnchor="middle"
                        fontSize="11" fill="#fff" pointerEvents="none">
                    {c.chunk_count}
                  </text>
                </g>
              );
            })}
          </svg>

          <div className="km-detail">
            {!active && <p className="km-hint">Click a dot to see its knowledge point.</p>}
            {active && (
              <div className="km-card">
                <h4>{active.label}</h4>
                <p>{active.content || '(No content extracted)'}</p>
                <div className="km-meta">
                  {active.chunk_count} chunks · pages {active.pages.join(', ')}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeMap;