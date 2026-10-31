import React, { useEffect, useState } from 'react';
import { fileKind, fileUrl, fmtSize, KIND_ICON } from '../lib/format';

interface Props {
  recordId: string;
  mimeType?: string | null;
  fileName?: string | null;
  sizeBytes?: number | string | null;
  summary?: string | null;
  compact?: boolean;
}

const TEXT_LIMIT = 200_000;

/** One attachment shown in place: images inline, PDFs page by page, text as text, plus open and download. */
export default function AttachmentViewer({ recordId, mimeType, fileName, sizeBytes, summary, compact }: Props) {
  const kind = fileKind(mimeType, fileName);
  const original = fileUrl(recordId);
  const [failed, setFailed] = useState(false);

  return (
    <div className="att-viewer">
      <div className="att-viewer-head">
        <span className="att-name" title={fileName || recordId}>{KIND_ICON[kind]} {fileName || 'Untitled file'}</span>
        <span className="muted small">{mimeType || 'unknown type'} · {fmtSize(sizeBytes)}</span>
        <span className="att-actions">
          <a href={original} target="_blank" rel="noopener noreferrer">Open original ↗</a>
          <a href={original} download={fileName || undefined}>Download</a>
        </span>
      </div>

      {summary && <p className="att-summary">{summary}</p>}

      {failed ? (
        <div className="att-empty">Couldn't load a preview. The original may still open with the links above.</div>
      ) : kind === 'image' ? (
        <a href={original} target="_blank" rel="noopener noreferrer">
          <img className="att-image" src={fileUrl(recordId, { max_dimension: compact ? 640 : 1400 })} alt={fileName || ''}
            loading="lazy" onError={() => setFailed(true)} />
        </a>
      ) : kind === 'video' ? (
        <video className="att-media" controls preload="metadata" src={original} onError={() => setFailed(true)} />
      ) : kind === 'audio' ? (
        <audio controls preload="metadata" src={original} style={{ width: '100%' }} onError={() => setFailed(true)} />
      ) : kind === 'pdf' ? (
        <PdfPages recordId={recordId} />
      ) : kind === 'text' ? (
        <TextPreview url={original} />
      ) : (
        <div className="att-empty">No preview for this kind of file. Use Download to get the original.</div>
      )}
    </div>
  );
}

/** Renders a PDF one page at a time as images from the API (works for scanned PDFs too). */
function PdfPages({ recordId }: { recordId: string }) {
  const [page, setPage] = useState(1);
  const [count, setCount] = useState<number | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    let objectUrl: string | null = null;
    setError('');
    fetch(fileUrl(recordId, { format: 'page', page, max_dimension: 1400 }))
      .then(async res => {
        const pc = Number(res.headers.get('X-Page-Count'));
        if (alive && pc) setCount(pc);
        if (!res.ok) throw new Error(res.status === 404 ? 'Page not found' : `Couldn't render page (HTTP ${res.status})`);
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (alive) setSrc(objectUrl);
      })
      .catch(e => { if (alive) { setSrc(null); setError(e.message); } });
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [recordId, page]);

  return (
    <div>
      <div className="pdf-nav">
        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>◀</button>
        <span className="small">Page {page}{count ? ` of ${count}` : ''}</span>
        <button onClick={() => setPage(p => p + 1)} disabled={count !== null && page >= count}>▶</button>
      </div>
      {error ? <div className="att-empty">{error}</div>
        : src ? <img className="att-image pdf-page" src={src} alt={`Page ${page}`} />
        : <div className="att-empty">Loading page…</div>}
    </div>
  );
}

function TextPreview({ url }: { url: string }) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    fetch(url)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
      .then(t => { if (alive) setText(t); })
      .catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [url]);
  if (error) return <div className="att-empty">Couldn't load text ({error})</div>;
  if (text === null) return <div className="att-empty">Loading…</div>;
  return (
    <pre className="att-text">
      {text.length > TEXT_LIMIT ? text.slice(0, TEXT_LIMIT) + `\n\n… ${(text.length - TEXT_LIMIT).toLocaleString()} more characters. Download for the full file.` : text}
    </pre>
  );
}
