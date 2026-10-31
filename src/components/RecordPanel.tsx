import React, { useEffect, useState } from 'react';
import { apiFetch } from '../api';
import AttachmentViewer from './AttachmentViewer';
import { fmtTime, fmtShortTime } from '../lib/format';
import { diffLines, withContext } from '../lib/diff';

export interface RecordRow {
  record_id: string;
  source_name?: string;
  source?: string;
  sender?: string | null;
  recipient?: string | null;
  content?: string | null;
  timestamp?: string | null;
  metadata?: any;
  external_id?: string | null;
  version_count?: number;
  attachment_count?: number;
}

type Tab = 'message' | 'history' | 'attachments';

interface Props {
  record: RecordRow;
  onSelectRecord: (recordId: string) => void;
  onClose: () => void;
}

export default function RecordPanel({ record, onSelectRecord, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('message');
  const [attachments, setAttachments] = useState<any[] | null>(null);
  const [historyTotal, setHistoryTotal] = useState<number | null>(record.version_count ?? null);

  useEffect(() => {
    setAttachments(null);
    setHistoryTotal(record.version_count ?? null);
    apiFetch(`/api/messages/${record.record_id}/attachments`)
      .then(d => setAttachments(d.attachments || []))
      .catch(() => setAttachments([]));
  }, [record.record_id]);

  const attCount = attachments?.length ?? record.attachment_count;
  const source = record.source_name || record.source || '—';

  return (
    <aside className="record-panel">
      <div className="record-head">
        <div style={{ minWidth: 0 }}>
          <div className="record-title">
            <span className="source-badge">{source}</span>
            <span className="ellipsis">{record.sender || 'Unknown'}{record.recipient ? ` → ${record.recipient}` : ''}</span>
          </div>
          <div className="muted small">{fmtTime(record.timestamp)}</div>
        </div>
        <button className="icon-btn" onClick={onClose} title="Close">✕</button>
      </div>

      <div className="tabs">
        <button className={tab === 'message' ? 'tab active' : 'tab'} onClick={() => setTab('message')}>Message</button>
        <button className={tab === 'history' ? 'tab active' : 'tab'} onClick={() => setTab('history')}>
          History{historyTotal ? ` (${historyTotal})` : ''}
        </button>
        <button className={tab === 'attachments' ? 'tab active' : 'tab'} onClick={() => setTab('attachments')}>
          Attachments{attCount ? ` (${attCount})` : ''}
        </button>
      </div>

      <div className="record-body">
        {tab === 'message' && <MessageTab record={record} attachments={attachments} onSelectRecord={onSelectRecord} onShowAttachments={() => setTab('attachments')} />}
        {tab === 'history' && <HistoryTab recordId={record.record_id} onTotal={setHistoryTotal} />}
        {tab === 'attachments' && (
          attachments === null ? <p className="muted">Loading…</p>
            : attachments.length === 0 ? <p className="muted">No attachments on this message.</p>
            : attachments.map(a => (
              <AttachmentViewer key={a.attachment_record_id} recordId={a.attachment_record_id} mimeType={a.mime_type}
                fileName={a.original_file_name} sizeBytes={a.size_bytes} summary={a.summary_text} />
            ))
        )}
      </div>
    </aside>
  );
}

/* ── Message tab ─────────────────────────────────────────── */

function MessageTab({ record, attachments, onSelectRecord, onShowAttachments }: {
  record: RecordRow; attachments: any[] | null; onSelectRecord: (id: string) => void; onShowAttachments: () => void;
}) {
  const [context, setContext] = useState<any>(null);
  const [limit, setLimit] = useState(5);
  const [ctxError, setCtxError] = useState('');

  useEffect(() => {
    setCtxError('');
    apiFetch(`/api/memory/records/${record.record_id}/context?limit=${limit}&max_chars=20000`)
      .then(setContext)
      .catch(e => { setContext(null); setCtxError(e.message); });
  }, [record.record_id, limit]);

  const images = (attachments || []).filter(a => (a.mime_type || '').startsWith('image/'));
  const others = (attachments || []).length - images.length;
  const convo = context?.messages || [];

  return (
    <div>
      <div className="message-content">{record.content || <span className="muted">(empty)</span>}</div>

      {images.length > 0 && (
        <div className="thumb-row">
          {images.map(a => (
            <img key={a.attachment_record_id} src={`/api/attachments/${a.attachment_record_id}/file?max_dimension=320`}
              alt={a.original_file_name || ''} title={a.original_file_name || ''} onClick={onShowAttachments} loading="lazy" />
          ))}
        </div>
      )}
      {others > 0 && (
        <button className="link-btn" onClick={onShowAttachments}>📎 {others} more file{others === 1 ? '' : 's'}</button>
      )}

      <h4 className="section-h">Conversation</h4>
      {ctxError ? <p className="muted small">Couldn't load the conversation ({ctxError}).</p>
        : !context ? <p className="muted small">Loading…</p>
        : convo.length <= 1 ? <p className="muted small">{context.notice || 'No other messages in this conversation.'}</p>
        : (
          <div className="convo">
            {context.has_before && limit < 20 && <button className="link-btn" onClick={() => setLimit(20)}>Show earlier</button>}
            {convo.map((m: any) => (
              <div key={m.record_id} className={`convo-msg ${m.record_id === record.record_id ? 'center' : ''}`}
                onClick={() => m.record_id !== record.record_id && onSelectRecord(m.record_id)}>
                <div className="convo-meta"><strong>{m.sender || 'Unknown'}</strong> <span className="muted">{fmtShortTime(m.timestamp)}</span></div>
                <div className="convo-text">{(m.content || '').slice(0, 600)}{(m.content || '').length > 600 || m.truncated ? '…' : ''}</div>
              </div>
            ))}
            {context.has_after && limit < 20 && <button className="link-btn" onClick={() => setLimit(20)}>Show later</button>}
          </div>
        )}

      <details className="details-block">
        <summary>Details</summary>
        <div className="kv">
          <span>Record ID</span><code>{record.record_id}</code>
          <span>External ID</span><code>{record.external_id || '—'}</code>
          <span>Source</span><span>{record.source_name || record.source || '—'}</span>
          <span>Sender</span><span>{record.sender || '—'}</span>
          <span>Recipient</span><span>{record.recipient || '—'}</span>
          <span>Timestamp</span><span>{fmtTime(record.timestamp)}</span>
        </div>
        {record.metadata && Object.keys(record.metadata).length > 0 && (
          <pre className="json">{JSON.stringify(record.metadata, null, 2)}</pre>
        )}
      </details>
    </div>
  );
}

/* ── History tab ─────────────────────────────────────────── */

const HISTORY_PAGE = 50;
const COMPARED = ['sender', 'recipient', 'timestamp', 'external_id'] as const;

function HistoryTab({ recordId, onTotal }: { recordId: string; onTotal: (n: number) => void }) {
  const [versions, setVersions] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = (offset: number) => {
    setLoading(true); setError('');
    apiFetch(`/api/messages/${recordId}/history?order=desc&limit=${HISTORY_PAGE}&offset=${offset}`)
      .then(d => {
        setVersions(v => offset === 0 ? d.versions : [...v, ...d.versions]);
        setTotal(d.total); setHasMore(d.has_more); onTotal(d.total);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { setVersions([]); load(0); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [recordId]);

  if (error) return <div className="error-box">{error}</div>;
  if (!versions.length) return <p className="muted">{loading ? 'Loading…' : 'No history.'}</p>;

  return (
    <div className="timeline">
      <p className="muted small">{total.toLocaleString()} version{total === 1 ? '' : 's'}, newest first.</p>
      {versions.map((v, i) => {
        const older = versions[i + 1];
        const isFirst = !older && !hasMore;
        return <VersionCard key={v.id} version={v} older={older} isFirst={isFirst} number={total - i} defaultOpen={i === 0} />;
      })}
      {hasMore && <button onClick={() => load(versions.length)} disabled={loading}>{loading ? 'Loading…' : 'Load older versions'}</button>}
    </div>
  );
}

function VersionCard({ version, older, isFirst, number, defaultOpen }: { version: any; older?: any; isFirst: boolean; number: number; defaultOpen: boolean }) {
  const current = !version.effective_to && version.is_active !== false;
  const fieldChanges = older ? COMPARED.filter(k => String(version[k] ?? '') !== String(older[k] ?? '')) : [];
  const metaChanged = older && JSON.stringify(version.metadata ?? {}) !== JSON.stringify(older.metadata ?? {});
  const contentChanged = older && (version.content ?? '') !== (older.content ?? '');
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`version ${current ? 'current' : ''}`}>
      <div className="version-dot" />
      <div className="version-body">
        <div className="version-head">
          <strong>v{number}</strong>
          {current && <span className="pill green">current</span>}
          {version.is_active === false && <span className="pill red">removed</span>}
          <span className="muted small">{fmtTime(version.effective_from)}{version.effective_to ? ` → ${fmtTime(version.effective_to)}` : ''}</span>
        </div>
        <div className="change-list">
          {isFirst && <span className="pill">first version</span>}
          {!isFirst && !older && <span className="muted small">Load older versions to compare.</span>}
          {contentChanged && <span className="pill blue">content</span>}
          {fieldChanges.map(k => <span key={k} className="pill blue">{k.replace('_', ' ')}</span>)}
          {metaChanged && <span className="pill blue">metadata</span>}
          {older && !contentChanged && !fieldChanges.length && !metaChanged && <span className="muted small">No visible changes</span>}
        </div>
        {fieldChanges.map(k => (
          <div key={k} className="small field-change">
            <span className="muted">{k.replace('_', ' ')}:</span> <del>{String(older[k] ?? '—')}</del> → <ins>{String(version[k] ?? '—')}</ins>
          </div>
        ))}
        {(contentChanged || isFirst) && (
          <button className="link-btn" onClick={() => setOpen(o => !o)}>{open ? 'Hide' : isFirst ? 'Show content' : 'Show changes'}</button>
        )}
        {open && (isFirst || !older ? (
          <pre className="diff">{version.content || '(empty)'}</pre>
        ) : contentChanged ? <ContentDiff oldText={older.content || ''} newText={version.content || ''} /> : null)}
        {metaChanged && (
          <details className="details-block"><summary>Metadata</summary>
            <pre className="json">{JSON.stringify(version.metadata, null, 2)}</pre>
          </details>
        )}
      </div>
    </div>
  );
}

function ContentDiff({ oldText, newText }: { oldText: string; newText: string }) {
  const lines = diffLines(oldText, newText);
  if (!lines) {
    return <p className="muted small">Too large to compare here ({oldText.length.toLocaleString()} → {newText.length.toLocaleString()} characters).</p>;
  }
  return (
    <pre className="diff">
      {withContext(lines).map((l, i) => l.kind === 'skip'
        ? <div key={i} className="diff-skip">··· {l.count} unchanged line{l.count === 1 ? '' : 's'} ···</div>
        : <div key={i} className={`diff-${l.kind}`}>{l.kind === 'add' ? '+ ' : l.kind === 'del' ? '- ' : '  '}{l.text}</div>)}
    </pre>
  );
}
