'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { URGENCY_CONFIG, type Problem, type Urgency } from '@/lib/types';
import { getStoredAddress, shortAddress, clearSession } from '@/lib/auth';
import { disconnect } from '@stacks/connect';

function Spinner() {
  return (
    <span className="inline-block w-3.5 h-3.5 rounded-full border-[1.5px] border-current border-t-transparent animate-spin" />
  );
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

// CSS-safe urgency dot colors (decorative only — not in design token set)
const URGENCY_DOT: Record<Urgency, string> = {
  critical: '#ef4444',
  urgent:   '#f97316',
  standard: '#eab308',
  deep:     '#60a5fa',
};

type SortKey = 'newest' | 'highest' | 'expiring';
type TabView = 'problems' | 'earnings' | 'solutions';

interface EarningRow {
  solution_id: string;
  title: string;
  problem_signatures: string[];
  affected_stacks: string[];
  success_rate: number;
  total_uses: number;
  paid_unlocks: number;
  pending_unlocks: number;
  price_usdc: string;
  earned_usdc: string;
  pending_usdc: string;
  created_at: string;
}

interface SolutionEntry {
  solution_id: string;
  title: string;
  author: string;
  problem_signatures: string[];
  affected_stacks: string[];
  success_rate: number;
  total_uses: number;
  price_usdc: string;
  created_at: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function timeLeft(iso: string) {
  const diff = Math.floor((new Date(iso).getTime() - Date.now()) / 1000);
  if (diff <= 0) return { label: 'Expired', urgent: true };
  if (diff < 300) return { label: `${Math.floor(diff / 60)}m ${diff % 60}s`, urgent: true };
  if (diff < 3600) return { label: `${Math.floor(diff / 60)}m`, urgent: false };
  return { label: `${Math.floor(diff / 3600)}h`, urgent: false };
}

function sortProblems(list: Problem[], key: SortKey): Problem[] {
  return [...list].sort((a, b) => {
    if (key === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (key === 'highest') return parseFloat(b.bountyAmount ?? '0') - parseFloat(a.bountyAmount ?? '0');
    if (key === 'expiring') return new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime();
    return 0;
  });
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function UrgencyPill({ urgency }: { urgency: Urgency }) {
  const cfg = URGENCY_CONFIG[urgency];
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-[var(--rule)] font-mono text-[10px] uppercase tracking-widest text-[var(--ink-secondary)]">
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: URGENCY_DOT[urgency] }} />
      {cfg.label}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    paid:     'text-[var(--green)] border-[var(--green-dim)]',
    pending:  'text-[var(--ink-secondary)] border-[var(--rule)]',
    disputed: 'text-[#ef4444] border-[#3a1a1a]',
  };
  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full border font-mono text-[10px] uppercase tracking-widest ${styles[status] ?? styles.pending}`}>
      {status}
    </span>
  );
}

function EmptyDetail() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
      <div className="w-10 h-10 rounded-full border border-[var(--rule)] flex items-center justify-center">
        <span className="font-mono text-[var(--ink-tertiary)] text-lg leading-none">↖</span>
      </div>
      <p className="font-mono text-[10px] text-[var(--ink-tertiary)] uppercase tracking-widest">
        Select a problem to see details
      </p>
    </div>
  );
}

function EmptyList() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-2 text-center px-8">
      <p className="text-sm text-[var(--ink-secondary)]">No open problems right now.</p>
      <p className="font-mono text-[11px] text-[var(--ink-tertiary)]">
        Check back in a moment — agents post errors continuously.
      </p>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();

  const [walletAddress, setWalletAddress] = useState('');
  const [stxPrice, setStxPrice] = useState<number | null>(null);

  useEffect(() => {
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=blockstack&vs_currencies=usd')
      .then(r => r.json())
      .then(d => { if (d?.blockstack?.usd) setStxPrice(d.blockstack.usd); })
      .catch(() => {});
  }, []);

  const [tab, setTab] = useState<TabView>('problems');
  const [problems, setProblems] = useState<Problem[]>([]);
  const [selected, setSelected] = useState<Problem | null>(null);
  const [search, setSearch] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<Urgency | 'all'>('all');
  const [sort, setSort] = useState<SortKey>('newest');
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

  // Auth guard — redirect to onboard if no wallet
  useEffect(() => {
    const addr = getStoredAddress();
    if (!addr) {
      router.replace('/onboard');
    } else {
      setWalletAddress(addr);
    }
  }, [router]);

  function handleDisconnect() {
    try { disconnect(); } catch { /* wallet may already be disconnected */ }
    clearSession();
    router.replace('/onboard');
  }

  // Earnings state
  const [earningsRows, setEarningsRows] = useState<EarningRow[]>([]);
  const [earningsTotals, setEarningsTotals] = useState({ earned: '0.0000', pending: '0.0000', uses: 0 });
  const [earningsLoading, setEarningsLoading] = useState(false);

  const fetchEarnings = useCallback(async (address: string) => {
    if (!address) return;
    setEarningsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/solutions/earnings?stacksAddress=${encodeURIComponent(address)}`);
      if (res.ok) {
        const data = await res.json();
        setEarningsRows(data.solutions ?? []);
        setEarningsTotals({ earned: data.total_earned_usdc ?? '0.0000', pending: data.total_pending_usdc ?? '0.0000', uses: data.total_uses ?? 0 });
      }
    } catch {
      // silently fail
    } finally {
      setEarningsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'earnings' && walletAddress) fetchEarnings(walletAddress);
  }, [tab, walletAddress, fetchEarnings]);

  // Solutions registry state
  const [solutions, setSolutions] = useState<SolutionEntry[]>([]);
  const [solutionSearch, setSolutionSearch] = useState('');
  const [solutionsLoading, setSolutionsLoading] = useState(false);
  const [expandedSolution, setExpandedSolution] = useState<string | null>(null);

  const fetchSolutions = useCallback(async (q?: string) => {
    setSolutionsLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (q) params.set('q', q);
      const res = await fetch(`${API_BASE}/solutions?${params}`);
      if (res.ok) {
        const data = await res.json();
        setSolutions(data.results ?? []);
      }
    } catch {
      // silently fail
    } finally {
      setSolutionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'solutions') fetchSolutions(solutionSearch || undefined);
  }, [tab, fetchSolutions, solutionSearch]);

  const fetchProblems = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/problems?status=open&limit=100`);
      if (res.ok) {
        const data = await res.json();
        setProblems(data.problems ?? []);
      }
    } catch {
      // silently fail — list stays as-is
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProblems();
    const interval = setInterval(fetchProblems, 15_000);
    return () => clearInterval(interval);
  }, [fetchProblems]);

  const filtered = sortProblems(
    problems.filter(p => {
      const matchesSearch =
        !search ||
        p.errorType.toLowerCase().includes(search.toLowerCase()) ||
        p.errorMessage.toLowerCase().includes(search.toLowerCase());
      const matchesUrgency = urgencyFilter === 'all' || p.urgency === urgencyFilter;
      return matchesSearch && matchesUrgency;
    }),
    sort,
  );

  async function handleClaim(problem: Problem) {
    setClaiming(true);
    try {
      await fetch(`${API_BASE}/problems/${problem.id}/claim`, { method: 'POST' });
    } catch {
      // proceed anyway — navigate to solve page regardless
    } finally {
      setClaiming(false);
      router.push(`/problems/${problem.id}/solve`);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--surface-base)] text-[var(--ink-primary)] flex flex-col">

      {/* ── TopBar ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 h-14 border-b border-[var(--rule)] bg-[var(--surface-base)]">
        <span className="font-mono text-sm tracking-tight text-[var(--ink-primary)]">Quash</span>

        <nav className="flex items-center gap-1 p-1 rounded-full border border-[var(--rule)] bg-[var(--surface-inset)]">
          {(['problems', 'solutions', 'earnings'] as TabView[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-full font-mono text-[11px] uppercase tracking-widest transition-colors ${
                tab === t
                  ? 'bg-[var(--surface-raised)] text-[var(--ink-primary)]'
                  : 'text-[var(--ink-tertiary)] hover:text-[var(--ink-secondary)]'
              }`}
            >
              {t}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {walletAddress && (
            <a
              href={`https://explorer.hiro.so/address/${walletAddress}?chain=testnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[11px] text-[var(--ink-secondary)] px-3 py-1.5 rounded-full border border-[var(--rule)] bg-[var(--surface-inset)] hover:text-[var(--green)] hover:border-[var(--green-dim)] transition-colors"
            >
              {shortAddress(walletAddress)}
            </a>
          )}
          <button
            onClick={handleDisconnect}
            className="font-mono text-[11px] uppercase tracking-widest px-4 py-1.5 rounded-full border border-[var(--rule)] text-[var(--ink-tertiary)] hover:text-[#ef4444] hover:border-[#ef4444]/40 transition-colors"
          >
            Disconnect
          </button>
        </div>
      </header>

      {/* ── Problems Tab ───────────────────────────────────────────────── */}
      {tab === 'problems' && (
        <div className="flex flex-col flex-1 overflow-hidden">

          {/* FilterBar */}
          <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b border-[var(--rule)]">
            <div className="relative flex-1 min-w-[180px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-tertiary)] text-sm select-none">⌕</span>
              <input
                type="text"
                placeholder="Search errors..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-4 py-2 rounded-lg bg-[var(--surface-inset)] border border-[var(--rule)] font-mono text-xs text-[var(--ink-primary)] placeholder-[var(--ink-tertiary)] focus:outline-none focus:border-[var(--green)] transition-colors"
              />
            </div>

            <div className="flex items-center gap-1">
              {(['all', 'critical', 'urgent', 'standard', 'deep'] as const).map(u => (
                <button
                  key={u}
                  onClick={() => setUrgencyFilter(u)}
                  className={`px-3 py-1.5 rounded-full font-mono text-[10px] uppercase tracking-widest transition-colors border ${
                    urgencyFilter === u
                      ? 'bg-[var(--surface-raised)] border-[var(--ink-tertiary)] text-[var(--ink-primary)]'
                      : 'border-transparent text-[var(--ink-tertiary)] hover:text-[var(--ink-secondary)]'
                  }`}
                >
                  {u === 'all' ? 'All' : URGENCY_CONFIG[u].label}
                </button>
              ))}
            </div>

            <select
              value={sort}
              onChange={e => setSort(e.target.value as SortKey)}
              className="font-mono text-xs text-[var(--ink-secondary)] bg-[var(--surface-inset)] border border-[var(--rule)] rounded-lg px-3 py-2 focus:outline-none focus:border-[var(--green)] transition-colors"
            >
              <option value="newest">Newest</option>
              <option value="highest">Highest Reward</option>
              <option value="expiring">Expiring Soon</option>
            </select>
          </div>

          {/* Two-pane */}
          <div className="flex flex-1 min-h-0">

            {/* Problem list */}
            <div className="w-2/5 border-r border-[var(--rule)] overflow-y-auto flex flex-col">
              <div className="sticky top-0 px-6 py-3 border-b border-[var(--rule)] bg-[var(--surface-base)] flex items-center justify-between z-10">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)]">
                  Open Problems
                </span>
                <span className="font-mono text-[10px] text-[var(--ink-tertiary)] bg-[var(--surface-inset)] px-2 py-0.5 rounded-full border border-[var(--rule)]">
                  {loading ? '…' : filtered.length}
                </span>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <span className="font-mono text-xs text-[var(--ink-tertiary)]">Loading…</span>
                </div>
              ) : filtered.length === 0 ? (
                <EmptyList />
              ) : (
                <ul>
                  {filtered.map(problem => {
                    const expiry = timeLeft(problem.expiresAt);
                    const isActive = selected?.id === problem.id;
                    return (
                      <li
                        key={problem.id}
                        onClick={() => setSelected(problem)}
                        className={`flex items-start gap-3 px-5 py-4 border-b border-[var(--rule)] cursor-pointer transition-colors border-l-2 ${
                          isActive
                            ? 'bg-[var(--surface-raised)] border-l-[var(--green)]'
                            : 'border-l-transparent hover:bg-[var(--surface-raised)]'
                        }`}
                      >
                        <div
                          className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: URGENCY_DOT[problem.urgency] }}
                        />

                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-xs font-medium text-[var(--ink-primary)] truncate">
                            {problem.errorType}
                          </p>
                          <p className="font-mono text-[11px] text-[var(--ink-tertiary)] mt-0.5 line-clamp-2 leading-relaxed">
                            {problem.errorMessage}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="font-mono text-[10px] text-[var(--ink-tertiary)]">
                              {timeAgo(problem.createdAt)}
                            </span>
                            <span className="text-[var(--rule)]">·</span>
                            <span
                              className="font-mono text-[10px]"
                              style={{ color: expiry.urgent ? '#ef4444' : 'var(--ink-tertiary)' }}
                            >
                              exp {expiry.label}
                            </span>
                          </div>
                        </div>

                        {problem.bountyAmount && (
                          <span className="flex-shrink-0 font-mono text-[10px] text-[var(--green)] px-2 py-1 rounded-full border border-[var(--green-dim)] bg-[var(--surface-inset)] whitespace-nowrap">
                            {problem.bountyAmount} STX
                            {stxPrice ? ` · $${(parseFloat(problem.bountyAmount) * stxPrice).toFixed(2)}` : ''}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Detail panel */}
            <div className="flex-1 overflow-y-auto">
              {selected ? (
                <div className="p-8 max-w-xl">

                  {/* Header */}
                  <div className="flex items-start justify-between gap-6 mb-6">
                    <div className="min-w-0">
                      <h2 className="font-mono text-sm font-medium text-[var(--ink-primary)] mb-2">
                        {selected.errorType}
                      </h2>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[10px] text-[var(--ink-tertiary)]">
                          #{selected.id.slice(0, 8)}
                        </span>
                        <span className="text-[var(--rule)]">·</span>
                        <UrgencyPill urgency={selected.urgency} />
                        <span className="text-[var(--rule)]">·</span>
                        <span className="font-mono text-[10px] text-[var(--ink-tertiary)]">
                          {URGENCY_CONFIG[selected.urgency].window} window
                        </span>
                      </div>
                    </div>

                    {selected.bountyAmount && (
                      <div className="flex-shrink-0 text-right">
                        <div className="font-mono text-2xl text-[var(--green)] leading-none">
                          {selected.bountyAmount} <span className="text-sm">STX</span>
                        </div>
                        {stxPrice && (
                          <div className="font-mono text-[10px] text-[var(--ink-tertiary)] mt-0.5">
                            ≈ ${(parseFloat(selected.bountyAmount) * stxPrice).toFixed(2)} USD
                          </div>
                        )}
                        <div className="font-mono text-[10px] text-[var(--ink-tertiary)] mt-0.5 uppercase tracking-widest">
                          reward
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Error block */}
                  <div className="mb-6">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)] mb-2">
                      Error
                    </p>
                    <pre className="bg-[var(--surface-inset)] border border-[var(--rule)] rounded-lg p-4 font-mono text-xs text-[var(--ink-secondary)] leading-relaxed overflow-x-auto whitespace-pre-wrap break-words">
                      {selected.errorMessage}
                    </pre>
                  </div>

                  {/* Environment tags */}
                  {selected.stack && selected.stack.length > 0 && (
                    <div className="mb-6">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)] mb-2">
                        Environment
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {selected.stack.map(tag => (
                          <span
                            key={tag}
                            className="font-mono text-[10px] px-2.5 py-1 rounded-full border border-[var(--rule)] text-[var(--ink-secondary)]"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Timing */}
                  <div className="mb-8">
                    {(() => {
                      const expiry = timeLeft(selected.expiresAt);
                      return (
                        <p className="font-mono text-[11px] text-[var(--ink-tertiary)]">
                          Posted {timeAgo(selected.createdAt)}
                          <span className="mx-2 text-[var(--rule)]">·</span>
                          <span style={{ color: expiry.urgent ? '#ef4444' : 'inherit' }}>
                            Expires in {expiry.label}
                          </span>
                        </p>
                      );
                    })()}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => handleClaim(selected)}
                      disabled={claiming}
                      className="w-full py-3 rounded-full bg-[var(--green)] text-[var(--surface-base)] font-mono text-xs uppercase tracking-widest hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
                    >
                      {claiming ? <><Spinner /><span>Claiming…</span></> : 'Claim & Solve →'}
                    </button>
                    <button
                      onClick={() => setSelected(null)}
                      className="w-full py-3 rounded-full border border-[var(--rule)] text-[var(--ink-tertiary)] font-mono text-xs uppercase tracking-widest hover:text-[var(--ink-secondary)] hover:border-[var(--ink-tertiary)] transition-colors"
                    >
                      Pass
                    </button>
                  </div>
                </div>
              ) : (
                <EmptyDetail />
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Solutions Registry Tab ─────────────────────────────────────── */}
      {tab === 'solutions' && (
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Registry header + search */}
          <div className="flex items-center gap-4 px-6 py-4 border-b border-[var(--rule)]">
            <div className="relative flex-1 max-w-md">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--ink-tertiary)] text-sm select-none">⌕</span>
              <input
                type="text"
                placeholder="Search solutions..."
                value={solutionSearch}
                onChange={e => setSolutionSearch(e.target.value)}
                className="w-full pl-8 pr-4 py-2 rounded-lg bg-[var(--surface-inset)] border border-[var(--rule)] font-mono text-xs text-[var(--ink-primary)] placeholder-[var(--ink-tertiary)] focus:outline-none focus:border-[var(--green)] transition-colors"
              />
            </div>
            <span className="font-mono text-[10px] text-[var(--ink-tertiary)] uppercase tracking-widest">
              Solution Registry
            </span>
            <span className="font-mono text-[10px] text-[var(--ink-tertiary)] bg-[var(--surface-inset)] px-2 py-0.5 rounded-full border border-[var(--rule)]">
              {solutionsLoading ? '…' : solutions.length}
            </span>
          </div>

          {/* Solutions list */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {solutionsLoading ? (
              <div className="flex items-center justify-center py-16">
                <span className="font-mono text-xs text-[var(--ink-tertiary)]">Loading…</span>
              </div>
            ) : solutions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-2 text-center">
                <p className="text-sm text-[var(--ink-secondary)]">No solutions in the registry yet.</p>
                <p className="font-mono text-[11px] text-[var(--ink-tertiary)]">
                  Claim a problem from the Problems tab and submit your fix.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-w-4xl">
                {solutions.map(sol => {
                  const isExpanded = expandedSolution === sol.solution_id;
                  return (
                    <div
                      key={sol.solution_id}
                      className="rounded-lg border border-[var(--rule)] bg-[var(--surface-raised)] overflow-hidden"
                    >
                      {/* Row */}
                      <button
                        onClick={() => setExpandedSolution(isExpanded ? null : sol.solution_id)}
                        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-[var(--surface-inset)] transition-colors"
                      >
                        {/* Title + author */}
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-xs font-medium text-[var(--ink-primary)] truncate">
                            {sol.title}
                          </p>
                          <p className="font-mono text-[10px] text-[var(--ink-tertiary)] mt-0.5">
                            by {sol.author}
                          </p>
                        </div>

                        {/* Stack tags */}
                        <div className="hidden md:flex items-center gap-1.5 flex-wrap max-w-[200px]">
                          {sol.affected_stacks.slice(0, 3).map(tag => (
                            <span key={tag} className="font-mono text-[10px] px-2 py-0.5 rounded-full border border-[var(--rule)] text-[var(--ink-tertiary)]">
                              {tag}
                            </span>
                          ))}
                        </div>

                        {/* Stats */}
                        <div className="hidden md:flex items-center gap-4 flex-shrink-0">
                          <div className="text-right">
                            <div className="font-mono text-xs text-[var(--ink-primary)]">
                              {(sol.success_rate * 100).toFixed(0)}%
                            </div>
                            <div className="font-mono text-[10px] text-[var(--ink-tertiary)]">success</div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono text-xs text-[var(--ink-primary)]">{sol.total_uses}</div>
                            <div className="font-mono text-[10px] text-[var(--ink-tertiary)]">uses</div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono text-xs text-[var(--green)]">{sol.price_usdc} STX</div>
                            <div className="font-mono text-[10px] text-[var(--ink-tertiary)]">price</div>
                          </div>
                        </div>

                        <span className="font-mono text-[10px] text-[var(--ink-tertiary)] flex-shrink-0">
                          {isExpanded ? '▲' : '▼'}
                        </span>
                      </button>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="border-t border-[var(--rule)] px-5 py-4 space-y-3">
                          <div className="flex flex-wrap gap-2">
                            <div>
                              <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)] mb-1.5">Signatures</p>
                              <div className="flex flex-wrap gap-1.5">
                                {sol.problem_signatures.map(sig => (
                                  <span key={sig} className="font-mono text-[10px] px-2 py-0.5 rounded-full border border-[var(--rule)] text-[var(--ink-secondary)]">
                                    {sig}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-6 text-[10px] font-mono text-[var(--ink-tertiary)]">
                            <span>ID: <span className="text-[var(--ink-secondary)]">{sol.solution_id}</span></span>
                            <span>Added: <span className="text-[var(--ink-secondary)]">{new Date(sol.created_at).toLocaleDateString()}</span></span>
                          </div>
                          <p className="font-mono text-[10px] text-[var(--ink-tertiary)]">
                            Full solution unlocked via <span className="text-[var(--green)]">POST /solve</span> with payment.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Earnings Tab ───────────────────────────────────────────────── */}
      {tab === 'earnings' && (
        <div className="flex-1 overflow-y-auto px-8 py-8 max-w-4xl w-full mx-auto">

          {/* Wallet identity header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)] mb-1">Resolver Identity</p>
              {walletAddress ? (
                <a
                  href={`https://explorer.hiro.so/address/${walletAddress}?chain=testnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-[var(--ink-secondary)] hover:text-[var(--green)] transition-colors"
                >
                  {walletAddress} ↗
                </a>
              ) : (
                <p className="font-mono text-xs text-[var(--ink-tertiary)]">No wallet connected</p>
              )}
            </div>
            <button
              onClick={() => fetchEarnings(walletAddress)}
              disabled={!walletAddress || earningsLoading}
              className="px-4 py-2 rounded-full border border-[var(--rule)] font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)] hover:text-[var(--ink-secondary)] hover:border-[var(--ink-tertiary)] disabled:opacity-40 transition-colors flex items-center gap-1.5"
            >
              {earningsLoading ? <><Spinner /><span>Loading…</span></> : 'Refresh'}
            </button>
          </div>

          {/* Stat chips */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="rounded-lg border border-[var(--green-dim)] bg-[var(--surface-raised)] px-5 py-4">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)] mb-2">Confirmed Earnings</div>
              <div className="font-mono text-xl text-[var(--green)]">{earningsTotals.earned} <span className="text-sm">STX</span></div>
              {stxPrice && parseFloat(earningsTotals.earned) > 0 && (
                <div className="font-mono text-[10px] text-[var(--ink-tertiary)] mt-0.5">
                  ≈ ${(parseFloat(earningsTotals.earned) * stxPrice).toFixed(2)} USD
                </div>
              )}
            </div>
            <div className="rounded-lg border border-[#3a2a00] bg-[var(--surface-raised)] px-5 py-4">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)] mb-2">Pending Payment</div>
              <div className="font-mono text-xl" style={{ color: '#eab308' }}>{earningsTotals.pending} <span className="text-sm">STX</span></div>
              {stxPrice && parseFloat(earningsTotals.pending) > 0 && (
                <div className="font-mono text-[10px] text-[var(--ink-tertiary)] mt-0.5">
                  ≈ ${(parseFloat(earningsTotals.pending) * stxPrice).toFixed(2)} USD · awaiting agent
                </div>
              )}
              {(!stxPrice || parseFloat(earningsTotals.pending) === 0) && (
                <div className="font-mono text-[10px] text-[var(--ink-tertiary)] mt-0.5">awaiting agent payment</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 mb-6">
            <span className="font-mono text-[10px] text-[var(--ink-tertiary)]">
              {earningsRows.length} solution{earningsRows.length !== 1 ? 's' : ''} published
            </span>
          </div>

          {/* Solutions table */}
          {!walletAddress ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <p className="font-mono text-xs text-[var(--ink-tertiary)]">Connect a wallet to view your earnings.</p>
            </div>
          ) : earningsLoading ? (
            <div className="flex items-center justify-center py-16">
              <span className="font-mono text-xs text-[var(--ink-tertiary)]">Loading…</span>
            </div>
          ) : earningsRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <p className="text-sm text-[var(--ink-secondary)]">No solutions found for this address.</p>
              <p className="font-mono text-[11px] text-[var(--ink-tertiary)]">Claim a problem and submit a fix to start earning.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-[var(--rule)] overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--rule)] bg-[var(--surface-inset)]">
                    {['Title', 'Price', 'Pending', 'Earned'].map(col => (
                      <th key={col} className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)]">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {earningsRows.map(row => (
                    <tr key={row.solution_id} className="border-b border-[var(--rule)] last:border-b-0 hover:bg-[var(--surface-raised)] transition-colors">
                      <td className="px-5 py-4 font-mono text-xs text-[var(--ink-primary)] max-w-[260px]">
                        <p className="truncate">{row.title}</p>
                        <p className="text-[10px] text-[var(--ink-tertiary)] mt-0.5">{row.solution_id.slice(0, 12)}…</p>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-[var(--ink-secondary)] whitespace-nowrap">
                        {row.price_usdc} STX
                      </td>
                      <td className="px-5 py-4">
                        {row.pending_unlocks > 0 ? (
                          <div>
                            <span className="font-mono text-xs" style={{ color: '#eab308' }}>
                              {row.pending_usdc} STX
                            </span>
                            {stxPrice && parseFloat(row.pending_usdc) > 0 && (
                              <div className="font-mono text-[10px] text-[var(--ink-tertiary)]">
                                ≈ ${(parseFloat(row.pending_usdc) * stxPrice).toFixed(2)}
                              </div>
                            )}
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#eab308' }} />
                              <span className="font-mono text-[10px] text-[var(--ink-tertiary)]">
                                {row.pending_unlocks} awaiting payment
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="font-mono text-[10px] text-[var(--ink-tertiary)]">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {parseFloat(row.earned_usdc) > 0 ? (
                          <div>
                            <span className="font-mono text-xs text-[var(--green)]">{row.earned_usdc} STX</span>
                            {stxPrice && (
                              <div className="font-mono text-[10px] text-[var(--ink-tertiary)]">
                                ≈ ${(parseFloat(row.earned_usdc) * stxPrice).toFixed(2)}
                              </div>
                            )}
                            <div className="font-mono text-[10px] text-[var(--ink-tertiary)] mt-0.5">
                              {row.paid_unlocks} confirmed
                            </div>
                          </div>
                        ) : (
                          <span className="font-mono text-[10px] text-[var(--ink-tertiary)]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
