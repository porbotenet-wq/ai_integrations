import { useDocuments } from '@/shared/api';
import { formatDateShort } from '@/shared/lib/format';
import { FileText, Download, User, FolderOpen, Filter } from 'lucide-react';
import { useState } from 'react';

interface Props {
  objectId: number;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  пто: 'ПТО',
  проектный: 'Проектный',
  снабжение: 'Снабжение',
  геодезия: 'Геодезия',
  от: 'Охрана труда',
  фотофиксация: 'Фотофиксация',
  kmd: 'КМД',
  act: 'Акты',
  contract: 'Договоры',
};

const DOC_TYPE_ICONS: Record<string, string> = {
  пто: '📋',
  проектный: '📐',
  снабжение: '📦',
  геодезия: '📍',
  от: '🦺',
  фотофиксация: '📷',
  kmd: '📐',
  act: '📄',
  contract: '📝',
};

export function DocumentsTab({ objectId }: Props) {
  const { data: docs, isLoading } = useDocuments(objectId);
  const [filterType, setFilterType] = useState<string>('');

  if (isLoading) return <DocsSkeleton />;
  if (!docs || docs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-tg-hint">
        <FolderOpen size={36} className="mb-2 opacity-40" />
        <span className="text-sm">Документы не загружены</span>
      </div>
    );
  }

  const types = [...new Set(docs.map((d) => d.doc_type || d.category).filter(Boolean))];
  const filtered = filterType
    ? docs.filter((d) => (d.doc_type || d.category) === filterType)
    : docs;

  // Group by type
  const grouped: Record<string, typeof docs> = {};
  for (const doc of filtered) {
    const key = doc.doc_type || doc.category || 'other';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(doc);
  }

  return (
    <div className="space-y-3">
      {/* Filter chips */}
      {types.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          <Filter size={14} className="text-tg-hint flex-shrink-0" />
          <button
            onClick={() => setFilterType('')}
            className={`text-xs px-2.5 py-1.5 rounded-full whitespace-nowrap transition-colors
              ${!filterType ? 'bg-tg-button text-tg-button-text' : 'bg-tg-section-bg text-tg-hint'}`}
          >
            Все ({docs.length})
          </button>
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t === filterType ? '' : t)}
              className={`text-xs px-2.5 py-1.5 rounded-full whitespace-nowrap transition-colors
                ${t === filterType ? 'bg-tg-button text-tg-button-text' : 'bg-tg-section-bg text-tg-hint'}`}
            >
              {DOC_TYPE_LABELS[t] || t}
            </button>
          ))}
        </div>
      )}

      {/* Document groups */}
      {Object.entries(grouped).map(([type, items]) => (
        <div key={type}>
          <div className="section-header mt-0">
            {DOC_TYPE_ICONS[type] || '📄'} {DOC_TYPE_LABELS[type] || type} ({items.length})
          </div>
          <div className="space-y-1.5">
            {items.map((doc) => (
              <DocCard key={doc.id} doc={doc} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DocCard({ doc }: { doc: any }) {
  return (
    <div className="card flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-tg-section-bg flex items-center justify-center flex-shrink-0">
        <FileText size={18} className="text-tg-hint" />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-tg-text truncate">{doc.title}</h4>
        <div className="flex items-center gap-2 mt-0.5 text-2xs text-tg-hint">
          {doc.uploaded_by && (
            <span className="flex items-center gap-0.5">
              <User size={10} /> {doc.uploaded_by}
            </span>
          )}
          {doc.created_at && (
            <span>{formatDateShort(doc.created_at)}</span>
          )}
          {doc.version && doc.version > 1 && (
            <span className="badge-blue">v{doc.version}</span>
          )}
        </div>
      </div>
      {doc.file_url && (
        <a
          href={doc.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 text-tg-link touch-target"
          onClick={(e) => e.stopPropagation()}
        >
          <Download size={16} />
        </a>
      )}
    </div>
  );
}

function DocsSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4].map((i) => <div key={i} className="card h-16 skeleton" />)}
    </div>
  );
}
