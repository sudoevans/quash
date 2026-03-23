'use client';

import { useState, useEffect } from 'react';
import { Problem, Urgency, URGENCY_CONFIG } from '@/lib/types';

function Countdown({ expiresAt }: { expiresAt: string }) {
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    const calc = () => Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
    setSecs(calc());
    const t = setInterval(() => setSecs(calc()), 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const isUrgent = secs < 300;

  return (
    <span className={`font-mono text-sm font-bold tabular-nums ${isUrgent ? 'text-[var(--danger)]' : 'text-slate-300'}`}>
      {h > 0 ? `${h}h ` : ''}{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  );
}

export default function BountyCard({ problem, onClaim }: { problem: Problem; onClaim: (id: string) => void }) {
  const cfg = URGENCY_CONFIG[problem.urgency as Urgency] ?? URGENCY_CONFIG.standard;

  return (
    <div className={`relative rounded-xl border p-5 flex flex-col gap-3 transition-all hover:scale-[1.01] hover:shadow-lg hover:shadow-indigo-500/10 ${cfg.bg}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{cfg.emoji}</span>
          <span className={`text-xs font-semibold uppercase tracking-widest ${cfg.color}`}>{cfg.label}</span>
          <span className="text-xs text-slate-500">· {cfg.window}</span>
        </div>
        <Countdown expiresAt={problem.expiresAt} />
      </div>

      {/* Error */}
      <div>
        <span className="text-xs text-slate-500 uppercase tracking-wider">{problem.errorType}</span>
        <p className="mt-1 text-sm font-mono text-slate-200 line-clamp-2">{problem.errorMessage}</p>
      </div>

      {/* Stack tags */}
      {problem.stack && problem.stack.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {problem.stack.map(tag => (
            <span key={tag} className="px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-400 text-xs font-mono">{tag}</span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-1">
        <div className="flex flex-col">
          <span className="text-xs text-slate-500">Bounty</span>
          <span className="text-base font-bold text-emerald-400">{problem.bountyAmount ?? '—'} <span className="text-xs font-normal text-slate-400">USDCx</span></span>
        </div>
        <button
          onClick={() => onClaim(problem.id)}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-md shadow-indigo-900/40"
        >
          Claim Bounty
        </button>
      </div>
    </div>
  );
}
