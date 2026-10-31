import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiFetch } from '../api';
import RecordPanel, { RecordRow } from '../components/RecordPanel';
import Pager from '../components/Pager';
import { usePersistedFilters } from '../hooks/usePersistedFilters';
import { fmtShortTime, UUID_RE } from '../lib/format';

const PAGE_SIZE = 50;
const DEFAULTS = { searchInput: '', q: '', source: '', sender: '', after: '', before: '', hasAttachments: false };

export default function Browse() {
  const [filters, setFilters, resetFilters, isDirty] = usePersistedFilters('filters:browse', DEFAULTS);
  const [params, setParams] = useSearchParams();
  const [sources, setSources] = useState<any[]>([]);
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<RecordRow | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedId = params.get('record');

  useEffect(() => {
    apiFetch('/api/sources').then(d => setSources(d.sources || [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true); setError('');
    const p = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), sort: 'timestamp', order: 'desc' });
    if (filters.q) p.set('q', filters.q);
    if (filters.source) p.set('source', filters.source);
    if (filters.sender) p.set('sender', filters.sender);
    if (filters.after) p.set('after', filters.after);
    if (filters.before) p.set('before', `${filters.before}T23:59:59.999`);
    if (filters.hasAttachments) p.set('has_attachments', 'true');
    apiFetch(`/api/messages?${p}`)
      .then(d => { setRows(d.messages || []); setTotal(d.total || 0); setTotalPages(d.totalPages || 1); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [page, filters.q, filters.source, filters.sender, filters.after, filters.before, filters.hasAttachments]);

  // Keep the side panel in step with ?record=<id>, loading the record itself when it isn't on this page.
  useEffect(() => {
    if (!selectedId || !UUID_RE.test(selectedId)) { setSelected(null); return; }
    const inList = rows.find(r => r.record_id === selectedId);
    if (inList) { setSelected(inList); return; }
    if (selected?.record_id === selectedId) return;
    apiFetch(`/api/memory/records/${selectedId}`)
      .then(d => setSelected({ ...d.record, source_name: d.record.source, attachment_count: d.attachments?.length }))
      .catch(() => setSelected(null));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, rows]);

  const select = (recordId: string | null) => {
    const next = new URLSearchParams(params);
    if (recordId) next.set('record', recordId); else next.delete('record');
    setParams(next, { replace: false });
  };

  // Up and down arrows move through the list when no field has focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(tag) || !rows.length) return;
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Escape') return;
      e.preventDefault();
      if (e.key === 'Escape') { select(null); return; }
      const idx = rows.findIndex(r => r.record_id === selectedId);
      const nextIdx = e.key === 'ArrowDown' ? Math.min(rows.length - 1, idx + 1) : Math.max(0, idx - 1);
      select(rows[nextIdx].record_id);
      listRef.current?.querySelector(`[data-id="${rows[nextIdx].record_id}"]`)?.scrollIntoView({ block: 'nearest' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, selectedId, params]);

  const set = (u: Partial<typeof DEFAULTS>) => { setFilters(u); setPage(1); };
  const doSearch = () => set({ q: filters.searchInput.trim() });

  return (
    <div className={`browse ${selected ? 'has-panel' : ''}`}>
      <div className="browse-list">
        <h1 className="page-title">Browse</h1>
        <div className="browse-filters">
          <div className="search-row">
            <input placeholder="Search messages" value={filters.searchInput}
              onChange={e => setFilters({ searchInput: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') doSearch(); }} />
            <button onClick={doSearch}>Search</button>
          </div>
          <div className="filter-row">
            <select value={filters.source} onChange={e => set({ source: e.target.value })}>
              <option value="">All sources</option>
              {sources.map((s: any) => <option key={s.id ?? s.name} value={s.name}>{s.name}</option>)}
            </select>
            <input placeholder="Sender" value={filters.sender} onChange={e => set({ sender: e.target.value })} style={{ width: 130 }} />
            <input type="date" value={filters.after} onChange={e => set({ after: e.target.value })} title="From" />
            <input type="date" value={filters.before} onChange={e => set({ before: e.target.value })} title="To" />
            <label className="check">
              <input type="checkbox" checked={!!filters.hasAttachments} onChange={e => set({ hasAttachments: e.target.checked })} />
              Has attachments
            </label>
            {isDirty && <button className="link-btn" onClick={() => { resetFilters(); setPage(1); }}>Reset</button>}
          </div>
        </div>

        {error && <div className="error-box">{error}</div>}
        <p className="muted small" style={{ margin: '6px 0' }}>
          {loading ? 'Loading…' : `${total.toLocaleString()} message${total === 1 ? '' : 's'}`}{filters.q ? ` matching “${filters.q}”` : ''}
        </p>

        <div className="msg-list" ref={listRef}>
          {!loading && rows.length === 0 && <p className="muted" style={{ padding: 16 }}>No messages found.</p>}
          {rows.map(m => (
            <div key={m.record_id || (m as any).id} data-id={m.record_id}
              className={`msg-row ${m.record_id === selectedId ? 'selected' : ''}`} onClick={() => select(m.record_id)}>
              <div className="msg-row-top">
                <span className="source-badge">{m.source_name || '—'}</span>
                <span className="msg-sender ellipsis">{m.sender || 'Unknown'}</span>
                <span className="msg-flags">
                  {!!m.attachment_count && <span title="Attachments">📎 {m.attachment_count}</span>}
                  {(m.version_count ?? 0) > 1 && <span title="Versions">🕘 {m.version_count}</span>}
                </span>
                <span className="muted small msg-time">{fmtShortTime(m.timestamp)}</span>
              </div>
              <div className="msg-snippet">{(m.content || '').replace(/\s+/g, ' ').slice(0, 220) || <span className="muted">(empty)</span>}</div>
            </div>
          ))}
        </div>
        <Pager page={page} totalPages={totalPages} setPage={setPage} />
      </div>

      {selected && (
        <RecordPanel record={selected} onSelectRecord={id => select(id)} onClose={() => select(null)} />
      )}
    </div>
  );
}
