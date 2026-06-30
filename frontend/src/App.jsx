import { useState } from 'react';
import './App.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return url; }
}

function StampFilter() {
  // Subtle SVG roughen filter so the stamp doesn't look like a clean vector box.
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }}>
      <filter id="stamp-roughen">
        <feTurbulence type="fractalNoise" baseFrequency="0.015 0.04" numOctaves="2" seed="7" result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" />
      </filter>
    </svg>
  );
}

function Trail({ entries, loading }) {
  if (!entries.length && !loading) return null;
  return (
    <div className="trail">
      <div className="trail-heading">Field notes</div>
      {entries.map((t, i) => (
        <div className="trail-entry" key={i} style={{ animationDelay: `${i * 0.05}s` }}>
          <span className="tick">{String(i + 1).padStart(2, '0')}</span>
          <span className="txt">{t}</span>
        </div>
      ))}
      {loading && (
        <div className="spinner-line" style={{ marginTop: 12 }}>
          <span className="spinner-dot" /><span className="spinner-dot" /><span className="spinner-dot" />
          working the case…
        </div>
      )}
    </div>
  );
}

function Verdict({ decision, analysis }) {
  if (!decision) return null;
  const isInvest = decision.verdict === 'INVEST';
  return (
    <div className="verdict-section">
      <div className="stamp-wrap">
        <span className={`stamp ${isInvest ? 'invest' : 'pass'}`}>{decision.verdict}</span>
      </div>
      <p className="thesis">“{decision.oneLineThesis}”</p>
      <div className="confidence-line">Confidence: {decision.confidence}</div>

      {analysis && (
        <>
          <div className="summary-block">
            <span className="label">Business summary</span>
            {analysis.businessSummary}
            <div>
              <span className="data-quality-flag">data quality: {analysis.dataQuality}</span>
            </div>
          </div>

          <div className="findings">
            <div className="finding-card strengths">
              <h3>Strengths</h3>
              <ul>{analysis.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
            <div className="finding-card risks">
              <h3>Risks</h3>
              <ul>{analysis.risks.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
          </div>

          <div className="summary-block">
            <span className="label">Financial signal</span>
            {analysis.financialSignal}
          </div>
        </>
      )}

      <div className="reasoning-list">
        <span className="label">Reasoning</span>
        <ol>{decision.reasoning.map((r, i) => <li key={i}>{r}</li>)}</ol>
      </div>
    </div>
  );
}

function Sources({ sources }) {
  if (!sources || (!sources.news?.length && !sources.financial?.length)) return null;
  const all = [...(sources.news || []), ...(sources.financial || [])];
  return (
    <div className="sources">
      <h4>Sources consulted ({all.length})</h4>
      <ul>
        {all.map((s, i) => (
          <li key={i}>
            <a href={s.url} target="_blank" rel="noreferrer">{s.title || s.url}</a>
            <span className="src-domain">{domainOf(s.url)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function App() {
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [trail, setTrail] = useState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function runResearch(e) {
    e.preventDefault();
    if (!companyName.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setTrail([`Opening a file on "${companyName.trim()}".`]);

    try {
      const res = await fetch(`${API_BASE}/api/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: companyName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');

      setTrail(data.trail || []);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <StampFilter />
      <header className="letterhead">
        <h1>Case File: Investment Research</h1>
        <span className="file-no">Altuni AI Labs — Research Desk</span>
      </header>

      <form className="intake" onSubmit={runResearch}>
        <label htmlFor="company">Subject company</label>
        <div className="intake-row">
          <input
            id="company"
            type="text"
            placeholder="e.g. Zomato, Stripe, Tata Motors…"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            disabled={loading}
          />
          <button type="submit" disabled={loading || !companyName.trim()}>
            {loading ? 'Investigating…' : 'Open Case'}
          </button>
        </div>
        {error && <div className="error-note">Case closed early — {error}</div>}
      </form>

      <Trail entries={trail} loading={loading} />

      {result && (
        <>
          <Verdict decision={result.decision} analysis={result.analysis} />
          <Sources sources={result.sources} />
        </>
      )}
    </div>
  );
}
