'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from '@/lib/theme';
import { useBrand } from '@/lib/brand';
import { useCurrentUser, userCanAccess } from '@/lib/auth/use-auth';
import { createClient } from '@/lib/supabase/client';
import { QuickLogModal } from './QuickLogModal';
import { formatDate } from '@/lib/utils';
import { Zap, Search, Sun, Moon, FileText, Users, Briefcase, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

// ── Search result types ────────────────────────────────────────
interface SearchResult {
  id: string;
  type: 'client' | 'document' | 'lead';
  title: string;
  sub: string;
  href: string;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  client:   <Users size={13} />,
  document: <FileText size={13} />,
  lead:     <Briefcase size={13} />,
};
const TYPE_COLOR: Record<string, string> = {
  client:   'var(--accent-blue)',
  document: 'var(--accent-violet)',
  lead:     'var(--accent-green)',
};

export function TopBar()): JSX.Element {
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [query, setQuery]               = useState('');
  const [results, setResults]           = useState<SearchResult[]>([]);
  const [searching, setSearching]       = useState(false);
  const [showResults, setShowResults]   = useState(false);
  const [focused, setFocused]           = useState(false);
  const searchRef   = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { theme, toggleTheme } = useTheme();
  const { mode }               = useBrand();
  const { user: currentUser }  = useCurrentUser();
  const supabaseRef            = useRef(createClient());
  const supabase               = supabaseRef.current;
  const router                 = useRouter();
  const today                  = formatDate(new Date(), 'EEEE, dd MMMM');

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Keyboard shortcut: Cmd/Ctrl+K to focus search
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      if (e.key === 'Escape') {
        setShowResults(false);
        setQuery('');
        inputRef.current?.blur();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  const runSearch = useCallback(async (q: string) => {
    if (!currentUser || q.trim().length < 2) { setResults([]); setShowResults(false); return; }
    setSearching(true);
    const term = q.trim().toLowerCase();
    const base = `/dashboard/${mode}`;

    // Only query tables the current user can actually navigate to.
    // userCanAccess mirrors proxy.ts logic — superadmin sees everything,
    // admin sees only their allowed sections.
    const canClients    = userCanAccess(currentUser, mode, 'clients');
    const canPaperwork  = userCanAccess(currentUser, mode, 'paperwork');
    const canBDPipeline = userCanAccess(currentUser, mode, 'bd-pipeline');
    // Personal Outreach lives at /social
    const canSocial     = userCanAccess(currentUser, mode, 'social');

    // Fire only the queries the user is allowed to see — skip the rest entirely
    const queries = await Promise.all([
      canClients
        ? supabase.from('clients').select('id, name, company, current_stage')
            .eq('user_id', currentUser.ownerId).eq('mode', mode)
            .ilike('name', `%${term}%`).limit(4)
        : Promise.resolve({ data: null }),
      canPaperwork
        ? supabase.from('documents').select('id, title, type, status')
            .eq('user_id', currentUser.ownerId).eq('mode', mode)
            .ilike('title', `%${term}%`).limit(4)
        : Promise.resolve({ data: null }),
      (canBDPipeline || canSocial)
        ? supabase.from('leads').select('id, company, contact_name, stage')
            .eq('user_id', currentUser.ownerId).eq('mode', mode)
            .or(`company.ilike.%${term}%,contact_name.ilike.%${term}%`).limit(3)
        : Promise.resolve({ data: null }),
    ]);

    const [{ data: clients }, { data: docs }, { data: leads }] = queries;

    // Leads live on different pages depending on mode:
    //   agency  → /bd-pipeline
    //   personal → /social
    const leadsHref = mode === 'agency' ? `${base}/bd-pipeline` : `${base}/social`;

    const res: SearchResult[] = [
      ...(clients || []).map(c => ({
        id: c.id, type: 'client' as const,
        title: c.name,
        sub: c.company ? `${c.company} · ${c.current_stage?.replace(/_/g, ' ')}` : c.current_stage?.replace(/_/g, ' ') || '',
        href: `${base}/clients`,
      })),
      ...(docs || []).map(d => ({
        id: d.id, type: 'document' as const,
        title: d.title || 'Untitled',
        sub: `${d.type} · ${d.status}`,
        href: `${base}/paperwork`,
      })),
      ...(leads || []).map(l => ({
        id: l.id, type: 'lead' as const,
        title: l.company || l.contact_name || 'Lead',
        sub: `${l.contact_name || ''} · ${l.stage?.replace(/_/g, ' ')}`,
        href: leadsHref,
      })),
    ];

    setResults(res);
    setShowResults(res.length > 0);
    setSearching(false);
  }, [currentUser, mode, supabase]);

  function handleQueryChange(val: string) {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 2) { setResults([]); setShowResults(false); return; }
    debounceRef.current = setTimeout(() => runSearch(val), 280);
  }

  function handleResultClick(result: SearchResult) {
    router.push(result.href);
    setQuery('');
    setResults([]);
    setShowResults(false);
  }

  function handleClear() {
    setQuery('');
    setResults([]);
    setShowResults(false);
    inputRef.current?.focus();
  }

  return (
    <>
      <header style={{
        display: 'flex', alignItems: 'center', gap: 12,
        height: 'var(--topbar-height)',
        padding: '0 32px',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        position: 'sticky', top: 0, zIndex: 50,
        flexShrink: 0,
      }}>
        {/* Date */}
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', whiteSpace: 'nowrap' }}>
          {today}
        </span>

        {/* Search */}
        <div ref={searchRef} style={{ flex: 1, maxWidth: 420, position: 'relative', marginLeft: 4 }}>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => handleQueryChange(e.target.value)}
              onFocus={() => { setFocused(true); if (results.length > 0) setShowResults(true); }}
              onBlur={() => setFocused(false)}
              placeholder="Search clients, documents, leads..."
              style={{
                width: '100%', padding: '7px 32px 7px 30px',
                background: 'var(--bg-hover)',
                border: `1px solid ${focused ? 'var(--border-default)' : 'transparent'}`,
                borderRadius: 'var(--radius-md)',
                fontSize: 12, fontFamily: 'var(--font-body)',
                color: 'var(--text-primary)', outline: 'none',
                transition: 'border-color 150ms',
                boxSizing: 'border-box',
              }}
            />
            {/* Clear or shortcut hint */}
            {query ? (
              <button onClick={handleClear}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', padding: 2, transition: 'color 150ms' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)'; }}>
                <X size={12} />
              </button>
            ) : (
              <span style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 4, padding: '1px 5px', pointerEvents: 'none' }}>
                ⌘K
              </span>
            )}
          </div>

          {/* Results dropdown */}
          {showResults && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
              background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-elevated)',
              overflow: 'hidden', zIndex: 200,
            }}>
              {results.length === 0 && searching && (
                <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)' }}>Searching...</div>
              )}
              {results.length === 0 && !searching && (
                <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)' }}>No results found for "{query}"</div>
              )}
              {results.length > 0 && (() => {
                const grouped: Record<string, SearchResult[]> = {};
                results.forEach(r => { if (!grouped[r.type]) grouped[r.type] = []; grouped[r.type].push(r); });
                return Object.entries(grouped).map(([type, items]) => (
                  <div key={type}>
                    <div style={{ padding: '8px 16px 4px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)' }}>
                      {type === 'client' ? 'Clients' : type === 'document' ? 'Documents' : 'Leads'}
                    </div>
                    {items.map(result => (
                      <button key={result.id} onClick={() => handleResultClick(result)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 150ms' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                        <div style={{ width: 26, height: 26, borderRadius: 'var(--radius-sm)', background: `${TYPE_COLOR[type]}18`, color: TYPE_COLOR[type], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {TYPE_ICON[type]}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{result.title}</p>
                          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>{result.sub}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ));
              })()}
              <div style={{ padding: '6px 16px 10px', fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', borderTop: '1px solid var(--border-subtle)' }}>
                ↩ to navigate · Esc to close
              </div>
            </div>
          )}
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Theme toggle */}
        <button onClick={toggleTheme} title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', background: 'var(--bg-hover)', color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0, transition: 'color 150ms, border-color 150ms' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}>
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        {/* Quick Log */}
        <button onClick={() => setQuickLogOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: 'var(--accent-blue)', border: 'none', borderRadius: 'var(--radius-md)', color: '#fff', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap', transition: 'opacity 150ms' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.88'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}>
          <Zap size={13} /> Quick Log
        </button>
      </header>

      <QuickLogModal open={quickLogOpen} onClose={() => setQuickLogOpen(false)} />
    </>
  );
}
