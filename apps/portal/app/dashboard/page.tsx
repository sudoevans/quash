'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Problem } from '@/lib/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const STACK_DOMAINS = [
  'shell','alpine','debian','ubuntu','docker','kubernetes',
  'node','python','go','rust','java','ruby','php',
  'react','vite','next','nuxt','svelte',
  'postgresql','mysql','sqlite','redis','mongodb',
  'github-actions','circleci','langchain','anthropic-api','openai-api',
];

// Mock Ledger Earnings to show embedded rather than a separate page
const MOCK_EARNINGS = [
  { id: 'sol_abc123', title: 'Use awk instead of sed on Alpine', uses: 312, rate: 0.87, earned: '7.49' },
  { id: 'sol_def456', title: 'Fix ESM/CJS interop in Vite 5 for legacy modules', uses: 89, rate: 0.74, earned: '2.13' },
  { id: 'sol_ghi789', title: 'Resolve ECONNREFUSED on Docker host networking (Linux)', uses: 47, rate: 0.91, earned: '1.12' },
];

export default function DashboardPage() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [activeProblem, setActiveProblem] = useState<Problem | null>(null);
  const [activeView, setActiveView] = useState<'dispatch' | 'ledger'>('dispatch');

  const fetchProblems = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/problems?status=open`);
      if (res.ok) {
        const data = await res.json();
        setProblems(data.problems ?? []);
      }
    } catch (e) {
      // Fallback
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProblems();
    const interval = setInterval(fetchProblems, 15000);
    return () => clearInterval(interval);
  }, [fetchProblems]);

  const handleClaim = async (id: string) => {
    try {
      await fetch(`${API_BASE}/problems/${id}/claim`, { method: 'POST' });
      await fetchProblems();
      if (activeProblem?.id === id) setActiveProblem(null);
    } catch {}
  };

  const toggleDomain = (d: string) =>
    setSelectedDomains(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);

  const filtered = problems.filter(p => {
    const matchesText = !filter || p.errorMessage.toLowerCase().includes(filter.toLowerCase());
    const matchesDomain = selectedDomains.length === 0 || (p.stack ?? []).some(s => selectedDomains.includes(s));
    return matchesText && matchesDomain;
  });

  const totalEarned = MOCK_EARNINGS.reduce((s, e) => s + parseFloat(e.earned), 0).toFixed(2);

  return (
    <div className="flex h-screen bg-[var(--surface-base)] text-[var(--ink-primary)] overflow-hidden font-serif selection:bg-[var(--green)] selection:text-[var(--ink-primary)]">
      
      {/* ─── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className="w-72 shrink-0 border-r border-[var(--rule)] p-6 flex flex-col gap-8 overflow-y-auto bg-[var(--surface-base)]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--ink-primary)]">Quash</h1>
          <p className="text-xs font-mono text-[var(--ink-secondary)] mt-1 uppercase tracking-widest">Resolver Terminal</p>
        </div>

        {/* Global Nav */}
        <nav className="flex flex-col gap-2">
          <button 
            onClick={() => setActiveView('dispatch')}
            className={`text-left text-sm px-4 py-3 rounded-none font-mono tracking-wide transition-colors ${
              activeView === 'dispatch' 
                ? 'bg-[var(--surface-inset)] text-[var(--green)] border-l-2 border-[var(--green)]' 
                : 'text-[var(--ink-secondary)] hover:bg-[var(--surface-raised)] hover:text-[var(--ink-primary)] border-l-2 border-transparent'
            }`}
          >
            Live Dispatch
          </button>
          <button 
            onClick={() => setActiveView('ledger')}
            className={`text-left text-sm px-4 py-3 rounded-none font-mono tracking-wide transition-colors ${
              activeView === 'ledger' 
                ? 'bg-[var(--surface-inset)] text-[var(--green)] border-l-2 border-[var(--green)]' 
                : 'text-[var(--ink-secondary)] hover:bg-[var(--surface-raised)] hover:text-[var(--ink-primary)] border-l-2 border-transparent'
            }`}
          >
            Earnings Ledger
          </button>
        </nav>

        {/* Domain filter overrides */}
        <div className="mt-4">
          <p className="font-mono text-[10px] text-[var(--ink-tertiary)] uppercase tracking-[0.15em] mb-4">Competency Vectors</p>
          <div className="flex flex-wrap gap-2">
            {STACK_DOMAINS.slice(0, 12).map(d => (
              <button
                key={d}
                onClick={() => toggleDomain(d)}
                className={`text-left text-xs px-2.5 py-1.5 transition-colors font-mono ${
                  selectedDomains.includes(d)
                    ? 'bg-[var(--green)] text-[var(--surface-base)] border border-[var(--green)]'
                    : 'text-[var(--ink-secondary)] bg-[var(--surface-inset)] border border-[var(--rule)] hover:border-[var(--ink-secondary)]'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* User Mini-Ledger Card */}
        <div className="mt-auto bg-[var(--surface-raised)] border border-[var(--rule)] p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--ink-tertiary)] mb-1">Available Balance</p>
          <p className="text-2xl font-serif text-[var(--green)]">{totalEarned} <span className="text-sm text-[var(--ink-secondary)]">USDCx</span></p>
          <button className="w-full mt-4 bg-[var(--surface-inset)] text-[var(--ink-primary)] border border-[var(--rule)] px-4 py-2 font-mono text-xs uppercase hover:bg-[var(--ink-primary)] hover:text-[var(--surface-base)] transition-colors">
            Withdraw
          </button>
        </div>
      </aside>

      {/* ─── Main Content ──────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[var(--surface-base)]">
        
        {/* Topbar */}
        <header className="flex items-center justify-between gap-3 p-6 border-b border-[var(--rule)]">
          <div className="flex items-center gap-3 w-1/2">
            <span className="font-mono text-xs text-[var(--ink-tertiary)]">/</span>
            <input
              type="text"
              placeholder="Filter errors by keyword or signature..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="flex-1 bg-transparent border-none text-sm font-mono text-[var(--ink-primary)] placeholder-[var(--ink-tertiary)] focus:outline-none focus:ring-0"
            />
          </div>
          <div className="flex items-center gap-3 px-4 py-2 border border-[var(--rule)] bg-[var(--surface-inset)]">
            <span className="w-2 h-2 rounded-full bg-[var(--green)] animate-pulse" />
            <span className="font-mono text-xs text-[var(--ink-secondary)] uppercase tracking-widest">Connection Stable</span>
          </div>
        </header>

        {activeView === 'dispatch' ? (
          <div className="flex-1 flex overflow-hidden">
            {/* Queue List */}
            <div className="w-1/2 md:w-5/12 border-r border-[var(--rule)] overflow-y-auto flex flex-col">
              <div className="p-4 border-b border-[var(--rule)] bg-[var(--surface-raised)] sticky top-0">
                <p className="font-mono text-xs text-[var(--ink-tertiary)] uppercase tracking-[0.1em]">Signal Queue ({filtered.length})</p>
              </div>
              
              {loading ? (
                <div className="p-8 text-center font-mono tracking-widest text-[var(--ink-tertiary)] opacity-50 uppercase text-xs">
                  Scanning for anomalies...
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center font-mono text-xs text-[var(--ink-tertiary)]">
                  Zero anomalies detected in specified vectors.
                </div>
              ) : (
                <div className="flex flex-col">
                  {filtered.map(p => (
                    <button 
                      key={p.id} 
                      onClick={() => setActiveProblem(p)}
                      className={`text-left p-6 border-b border-[var(--rule)] transition-colors ${
                        activeProblem?.id === p.id 
                          ? 'bg-[var(--surface-inset)] border-l-4 border-l-[var(--green)]' 
                          : 'bg-transparent border-l-4 border-l-transparent hover:bg-[var(--surface-raised)]'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-mono text-xs text-[var(--green)]">{p.id.split('-')[0]}</span>
                        <span className="font-mono text-xs text-[var(--ink-tertiary)]">{p.bountyAmount || 'Open'} USDCx</span>
                      </div>
                      <p className="font-mono text-sm line-clamp-2 text-[var(--ink-primary)] mb-3">{p.errorMessage}</p>
                      
                      {p.stack && (
                        <div className="flex gap-2 flex-wrap">
                          {p.stack.slice(0,3).map(s => (
                            <span key={s} className="px-2 py-0.5 bg-[var(--surface-raised)] text-[var(--ink-secondary)] text-[10px] font-mono uppercase border border-[var(--rule)]">
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Active Problem Detail */}
            <div className="flex-1 bg-[var(--surface-inset)] overflow-y-auto relative">
              {activeProblem ? (
                <div className="p-10 max-w-3xl animate-fade-in">
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <p className="font-mono text-xs text-[var(--ink-tertiary)] uppercase tracking-widest mb-2">Target Acquired</p>
                      <h2 className="text-3xl font-serif text-[var(--ink-primary)]">{activeProblem.id}</h2>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-serif text-[var(--green)]">{activeProblem.bountyAmount || '--'}</p>
                      <p className="font-mono text-[10px] text-[var(--ink-secondary)] uppercase">Reward (USDCx)</p>
                    </div>
                  </div>

                  {/* Terminal output mockup for the error */}
                  <div className="mb-10 bg-[var(--surface-base)] border border-[var(--rule)] p-6 font-mono text-sm text-[var(--ink-secondary)] leading-relaxed overflow-x-auto">
                    <p className="text-[var(--ink-primary)] mb-4">{activeProblem.errorMessage}</p>
                    <p className="text-[var(--ink-tertiary)] opacity-70">
                      &gt; Process exited with code 1<br/>
                      &gt; Stack trace localized to 3 files.<br/>
                      &gt; Agent halted execution. Requesting human override.
                    </p>
                  </div>

                  <div className="flex gap-4">
                    <button 
                      onClick={() => handleClaim(activeProblem.id)}
                      className="bg-[var(--green)] text-[var(--surface-base)] font-mono text-sm uppercase px-8 py-4 font-bold tracking-widest hover:bg-[var(--ink-primary)] transition-colors"
                    >
                      Resolve & Claim
                    </button>
                    <button 
                      onClick={() => setActiveProblem(null)}
                      className="bg-transparent text-[var(--ink-primary)] border border-[var(--rule)] font-mono text-sm uppercase px-8 py-4 tracking-widest hover:bg-[var(--surface-raised)] transition-colors"
                    >
                      Skip Signal
                    </button>
                  </div>

                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center opacity-30">
                  <p className="text-6xl font-serif mb-4 text-[var(--ink-tertiary)]">&not;</p>
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-[var(--ink-tertiary)]">Awaiting Selection</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Ledger View */
          <div className="flex-1 overflow-y-auto p-12 lg:px-24">
            <h2 className="text-4xl font-serif text-[var(--ink-primary)] mb-2">Ledger</h2>
            <p className="font-mono text-sm text-[var(--ink-secondary)] mb-12">Passive recursive yield from global library reads.</p>

            <table className="w-full text-left font-mono">
              <thead>
                <tr className="border-b border-[var(--rule)] text-[var(--ink-tertiary)] text-xs uppercase tracking-widest">
                  <th className="font-normal py-4 px-2">Solution Print</th>
                  <th className="font-normal py-4 px-2">Global Uses</th>
                  <th className="font-normal py-4 px-2 text-right">Yield (USDCx)</th>
                </tr>
              </thead>
              <tbody>
                {MOCK_EARNINGS.map(e => (
                  <tr key={e.id} className="border-b border-[var(--rule)] hover:bg-[var(--surface-inset)] transition-colors">
                    <td className="py-5 px-2 text-sm text-[var(--ink-primary)] truncate max-w-md">{e.title}</td>
                    <td className="py-5 px-2 text-sm text-[var(--ink-secondary)]">{e.uses}</td>
                    <td className="py-5 px-2 text-sm text-[var(--green)] text-right">+{e.earned}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
