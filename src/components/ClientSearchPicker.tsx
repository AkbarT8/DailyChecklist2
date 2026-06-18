import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';

export interface ClientOption {
  id: string;
  full_name: string;
  company_name?: string;
  email?: string;
  registration_status?: string;
}

export function ClientSearchPicker({
  clients,
  value,
  onChange,
  required,
}: {
  clients: ClientOption[];
  value: string;
  onChange: (id: string) => void;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = clients.find(c => c.id === value);

  const filtered = clients.filter(c => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [c.full_name, c.company_name, c.email]
      .some(f => f?.toLowerCase().includes(q));
  });

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
        Select client {required && <span className="text-red-500">*</span>}
      </label>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm rounded-xl border bg-white text-left
          ${open ? 'border-papco-navy ring-2 ring-papco-navy/20' : 'border-gray-200'}`}
      >
        <span className={selected ? 'text-gray-800 font-medium truncate' : 'text-gray-400'}>
          {selected
            ? `${selected.full_name}${selected.company_name ? ` · ${selected.company_name}` : ''}`
            : 'Search by client name…'}
        </span>
        <ChevronDown size={16} className={`text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Type client name, company, email…"
                autoFocus
                className="w-full pl-8 pr-8 py-2 text-sm rounded-lg border border-gray-200 outline-none focus:border-papco-navy"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-sm text-gray-400 text-center">No clients found</li>
            ) : (
              filtered.map(c => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => { onChange(c.id); setOpen(false); setQuery(''); }}
                    className={`w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 transition-colors
                      ${value === c.id ? 'bg-papco-navy/5 text-papco-navy font-semibold' : 'text-gray-700'}`}
                  >
                    <p className="font-medium">{c.full_name}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {c.company_name || '—'} · {c.registration_status || '—'}
                    </p>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
