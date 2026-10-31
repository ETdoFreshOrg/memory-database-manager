import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api';
import { fmtShortTime, fmtTime } from '../lib/format';

/** Every source with its message count, newest message and ingestor status, each linking into Browse. */
export default function Sources() {
  const [sources, setSources] = useState<any[]>([]);
  const [fresh, setFresh] = useState<Record<string, any>>({});
  const [ingestors, setIngestors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    apiFetch('/api/sources?with_counts=true')
      .then(d => setSources(d.sources || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
    // Freshness is a separate, optional call so a problem there never hides the list.
    apiFetch('/api/memory/sources')
      .then(d => {
        const map: Record<string, any> = {};
        (d.sources || []).forEach((s: any) => { map[s.name] = s; });
        setFresh(map);
        setIngestors(d.ingestors || []);
      })
      .catch(() => {});
  }, []);

  const sorted = [...sources].sort((a, b) => (b.message_count ?? 0) - (a.message_count ?? 0) || a.name.localeCompare(b.name));
  const total = sources.reduce((n, s) => n + (s.message_count || 0), 0);
  const withErrors = ingestors.filter(i => i.error_message);

  return (
    <div>
      <h1 className="page-title">📡 Sources</h1>
      {error && <div className="error-box">{error}</div>}
      {!loading && !error && (
        <p className="muted small" style={{ marginTop: -8 }}>
          {sources.length} sources{total ? ` · ${total.toLocaleString()} messages` : ''}. Click a source to browse its messages.
        </p>
      )}

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table>
          <thead><tr>
            <th>Source</th><th style={{ textAlign: 'right' }}>Messages</th><th>Newest message</th><th>Last ingested</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: '#888' }}>Loading…</td></tr>
              : sorted.length === 0 ? <tr><td colSpan={4} style={{ padding: 20, textAlign: 'center', color: '#888' }}>No sources.</td></tr>
              : sorted.map(s => {
                const f = fresh[s.name];
                return (
                  <tr key={s.id}>
                    <td><Link to={`/memory/browse?source=${encodeURIComponent(s.name)}`}>{s.name}</Link></td>
                    <td style={{ textAlign: 'right' }}>{s.message_count === undefined ? '—' : Number(s.message_count).toLocaleString()}</td>
                    <td title={fmtTime(f?.latest_message_at || f?.latest_transaction_date)}>
                      {f?.latest_message_at ? fmtShortTime(f.latest_message_at) : f?.latest_transaction_date ? `${f.latest_transaction_date} (transactions)` : '—'}
                    </td>
                    <td title={fmtTime(f?.latest_message_ingested_at)}>{f?.latest_message_ingested_at ? fmtShortTime(f.latest_message_ingested_at) : '—'}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {ingestors.length > 0 && (
        <>
          <h4 className="section-h">Ingestor status{withErrors.length ? ` · ${withErrors.length} with errors` : ''}</h4>
          <div className="card" style={{ padding: 0, overflow: 'auto' }}>
            <table>
              <thead><tr><th>Source</th><th>Job</th><th>Last run</th><th>Newest record</th><th>Status</th></tr></thead>
              <tbody>
                {ingestors.map((i: any) => (
                  <tr key={`${i.source}:${i.key}`}>
                    <td>{i.source || '—'}</td>
                    <td className="small">{i.key}</td>
                    <td title={fmtTime(i.last_run_at)}>{i.last_run_at ? fmtShortTime(i.last_run_at) : '—'}</td>
                    <td title={fmtTime(i.last_record_date)}>{i.last_record_date ? fmtShortTime(i.last_record_date) : '—'}</td>
                    <td className="small" style={{ color: i.error_message ? '#ef9a9a' : '#81c784', maxWidth: 360, wordBreak: 'break-word' }}>
                      {i.error_message || 'ok'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
