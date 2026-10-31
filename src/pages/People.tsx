import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api';
import { usePersistedFilters } from '../hooks/usePersistedFilters';
import { fmtShortTime, fmtTime } from '../lib/format';

const FILTER_DEFAULTS = { searchInput: '', q: '', source: '' };

/**
 * People as they appear in the archive (everyone who sent a message), each linking to their messages in Browse.
 * Saved contacts from the people table show underneath when there are any.
 */
export default function People() {
  const [filters, setFilters] = usePersistedFilters('filters:people2', FILTER_DEFAULTS);
  const [senders, setSenders] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/api/sources').then(d => setSources(d.sources || [])).catch(() => {});
    apiFetch('/api/people').then(d => setContacts(d.people || [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true); setError('');
    const p = new URLSearchParams({ limit: '200' });
    if (filters.q) p.set('q', filters.q);
    if (filters.source) p.set('source', filters.source);
    apiFetch(`/api/people/senders?${p}`)
      .then(d => setSenders(d.senders || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [filters.q, filters.source]);

  const browseLink = (sender: string) => {
    const p = new URLSearchParams({ sender });
    if (filters.source) p.set('source', filters.source);
    return `/memory/browse?${p}`;
  };

  return (
    <div>
      <h1 className="page-title">👤 People</h1>
      <div className="filters-bar">
        <input placeholder="Search names" value={filters.searchInput} style={{ minWidth: 240 }}
          onChange={e => setFilters({ searchInput: e.target.value })}
          onKeyDown={e => { if (e.key === 'Enter') setFilters({ q: filters.searchInput.trim() }); }} />
        <button onClick={() => setFilters({ q: filters.searchInput.trim() })}>Search</button>
        <select value={filters.source} onChange={e => setFilters({ source: e.target.value })}>
          <option value="">All sources</option>
          {sources.map((s: any) => <option key={s.id ?? s.name} value={s.name}>{s.name}</option>)}
        </select>
        {(filters.q || filters.source) && <button className="link-btn" onClick={() => setFilters(FILTER_DEFAULTS)}>Reset</button>}
      </div>
      {error && <div className="error-box">{error}</div>}
      <p className="muted small">
        {loading ? 'Loading…' : `${senders.length.toLocaleString()} ${senders.length === 200 ? '(top 200) ' : ''}people who sent messages. Click a name to see their messages.`}
      </p>

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table>
          <thead><tr>
            <th>Name</th><th style={{ textAlign: 'right' }}>Messages</th><th>Sources</th><th>First seen</th><th>Last seen</th>
          </tr></thead>
          <tbody>
            {!loading && senders.length === 0
              ? <tr><td colSpan={5} style={{ padding: 20, textAlign: 'center', color: '#888' }}>No one found.</td></tr>
              : senders.map(s => (
                <tr key={s.sender}>
                  <td style={{ maxWidth: 320, wordBreak: 'break-word' }}><Link to={browseLink(s.sender)}>{s.sender}</Link></td>
                  <td style={{ textAlign: 'right' }}>{Number(s.message_count).toLocaleString()}</td>
                  <td>{(s.sources || []).map((n: string) => <span key={n} className="source-badge" style={{ marginRight: 4 }}>{n}</span>)}</td>
                  <td title={fmtTime(s.first_seen)} className="small">{fmtShortTime(s.first_seen)}</td>
                  <td title={fmtTime(s.last_seen)} className="small">{fmtShortTime(s.last_seen)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {contacts.length > 0 && (
        <>
          <h4 className="section-h">Saved contacts ({contacts.length})</h4>
          <div className="card" style={{ padding: 0, overflow: 'auto' }}>
            <table>
              <thead><tr><th>Name</th><th>Aliases</th><th>Relationships</th></tr></thead>
              <tbody>
                {contacts.map(p => (
                  <tr key={p.id}>
                    <td><Link to={browseLink(p.name)}>{p.name}</Link></td>
                    <td className="small">{Array.isArray(p.aliases) ? p.aliases.join(', ') : (p.aliases || '—')}</td>
                    <td className="small">{p.relationships ? JSON.stringify(p.relationships) : '—'}</td>
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
