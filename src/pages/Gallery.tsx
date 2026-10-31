import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api';
import Pager from '../components/Pager';
import AttachmentViewer from '../components/AttachmentViewer';
import { usePersistedFilters } from '../hooks/usePersistedFilters';
import { fileKind, fileUrl, fmtShortTime, fmtSize, KIND_ICON } from '../lib/format';

const PAGE_SIZE = 60;
const KINDS = [
  { key: '', label: 'All' },
  { key: 'image', label: 'Images' },
  { key: 'pdf', label: 'PDFs' },
  { key: 'video', label: 'Video' },
  { key: 'audio', label: 'Audio' },
  { key: 'text', label: 'Text' },
];
const DEFAULTS = { searchInput: '', q: '', kind: '' };

export default function Gallery() {
  const [filters, setFilters] = usePersistedFilters('filters:gallery', DEFAULTS);
  const [rows, setRows] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [linked, setLinked] = useState<any[] | null>(null);

  useEffect(() => {
    setLoading(true); setError('');
    const p = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), sort: 'imported_at', order: 'desc' });
    if (filters.q) p.set('q', filters.q);
    if (filters.kind) p.set('mime_type', filters.kind);
    apiFetch(`/api/attachments?${p}`)
      .then(d => { setRows(d.attachments || []); setTotal(d.total || 0); setTotalPages(d.totalPages || 1); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [page, filters.q, filters.kind]);

  const open = (a: any) => {
    setSelected(a); setLinked(null);
    apiFetch(`/api/attachments/${a.record_id}`)
      .then(d => setLinked(d.linked_messages || []))
      .catch(() => setLinked([]));
  };

  return (
    <div className={`browse ${selected ? 'has-panel' : ''}`}>
      <div className="browse-list">
        <h1 className="page-title">Attachments</h1>
        <div className="browse-filters">
          <div className="search-row">
            <input placeholder="Search file names and summaries" value={filters.searchInput}
              onChange={e => setFilters({ searchInput: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') { setFilters({ q: filters.searchInput.trim() }); setPage(1); } }} />
            <button onClick={() => { setFilters({ q: filters.searchInput.trim() }); setPage(1); }}>Search</button>
          </div>
          <div className="chip-row">
            {KINDS.map(k => (
              <button key={k.key} className={`chip ${filters.kind === k.key ? 'active' : ''}`}
                onClick={() => { setFilters({ kind: k.key }); setPage(1); }}>{k.label}</button>
            ))}
          </div>
        </div>
        {error && <div className="error-box">{error}</div>}
        <p className="muted small" style={{ margin: '6px 0' }}>{loading ? 'Loading…' : `${total.toLocaleString()} file${total === 1 ? '' : 's'}`}</p>

        <div className="gallery">
          {rows.map(a => {
            const kind = fileKind(a.mime_type, a.original_file_name);
            return (
              <button key={a.record_id} className={`tile ${selected?.record_id === a.record_id ? 'selected' : ''}`} onClick={() => open(a)}
                title={a.original_file_name || ''}>
                <div className="tile-thumb">
                  {kind === 'image'
                    ? <img src={fileUrl(a.record_id, { max_dimension: 320 })} alt="" loading="lazy" />
                    : kind === 'pdf'
                      ? <img src={fileUrl(a.record_id, { format: 'page', page: 1, max_dimension: 320 })} alt="" loading="lazy"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      : <span className="tile-icon">{KIND_ICON[kind]}</span>}
                </div>
                <div className="tile-name ellipsis">{a.original_file_name || 'Untitled'}</div>
                <div className="tile-meta muted">{fmtSize(a.size_bytes)} · {fmtShortTime(a.imported_at)}</div>
              </button>
            );
          })}
        </div>
        <Pager page={page} totalPages={totalPages} setPage={setPage} />
      </div>

      {selected && (
        <aside className="record-panel">
          <div className="record-head">
            <div className="record-title ellipsis">{selected.original_file_name || 'Untitled file'}</div>
            <button className="icon-btn" onClick={() => setSelected(null)} title="Close">✕</button>
          </div>
          <div className="record-body">
            <AttachmentViewer recordId={selected.record_id} mimeType={selected.mime_type} fileName={selected.original_file_name}
              sizeBytes={selected.size_bytes} summary={selected.summary_text} />
            <h4 className="section-h">Found in</h4>
            {linked === null ? <p className="muted small">Loading…</p>
              : linked.length === 0 ? <p className="muted small">Not linked to any message.</p>
              : linked.map((l: any) => (
                <Link key={l.message_record_id} className="linked-msg" to={`/memory/browse?record=${l.message_record_id}`}>
                  <div className="convo-meta"><span className="source-badge">{l.source_name || '—'}</span> <strong>{l.sender || 'Unknown'}</strong> <span className="muted">{fmtShortTime(l.timestamp)}</span></div>
                  <div className="convo-text">{(l.content || '').slice(0, 200) || '(no text)'}</div>
                </Link>
              ))}
          </div>
        </aside>
      )}
    </div>
  );
}
