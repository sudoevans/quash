'use client';

import { useState } from 'react';

const MOCK_EARNINGS = [
  { id: 'sol_abc123', title: 'Use awk instead of sed on Alpine', uses: 312, rate: 0.87, earned: '7.49', pending: '0.21' },
  { id: 'sol_def456', title: 'Fix ESM/CJS interop in Vite 5 for legacy modules', uses: 89, rate: 0.74, earned: '2.13', pending: '0.06' },
  { id: 'sol_ghi789', title: 'Resolve ECONNREFUSED on Docker host networking (Linux)', uses: 47, rate: 0.91, earned: '1.12', pending: '0.03' },
];

export default function EarningsPage() {
  const totalEarned = MOCK_EARNINGS.reduce((s, e) => s + parseFloat(e.earned), 0).toFixed(2);
  const totalPending = MOCK_EARNINGS.reduce((s, e) => s + parseFloat(e.pending), 0).toFixed(2);

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-100 p-6">
      <div className="max-w-4xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <a href="/" className="text-xs text-indigo-400 hover:text-indigo-300">← Live Feed</a>
            <h1 className="text-2xl font-bold mt-1">Earnings</h1>
          </div>
          <button className="px-4 py-2 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-sm font-semibold hover:bg-emerald-600/30 transition-colors">
            Withdraw to Wallet
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Total Earned" value={`${totalEarned} USDCx`} sub="All time" color="text-emerald-400" />
          <StatCard label="Pending Release" value={`${totalPending} USDCx`} sub="Awaiting agent confirmation" color="text-yellow-400" />
          <StatCard label="Solutions Published" value={String(MOCK_EARNINGS.length)} sub="Active in the store" color="text-indigo-400" />
        </div>

        {/* Solutions table */}
        <div className="rounded-xl border border-slate-800 overflow-hidden">
          <div className="bg-slate-900/60 px-5 py-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-300">Your Solutions</h2>
            <span className="text-xs text-slate-500">80% of each sale goes to you</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wider">
                <th className="text-left px-5 py-3">Solution</th>
                <th className="px-5 py-3">Uses</th>
                <th className="px-5 py-3">Success Rate</th>
                <th className="px-5 py-3 text-right">Earned (USDCx)</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_EARNINGS.map(e => (
                <tr key={e.id} className="border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-3 text-slate-200 max-w-xs truncate">{e.title}</td>
                  <td className="px-5 py-3 text-center text-slate-400">{e.uses.toLocaleString()}</td>
                  <td className="px-5 py-3 text-center">
                    <span className={`font-semibold ${e.rate >= 0.8 ? 'text-emerald-400' : e.rate >= 0.6 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {(e.rate * 100).toFixed(0)}%
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-mono font-semibold text-emerald-400">{e.earned}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-5 flex flex-col gap-1">
      <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500">{sub}</p>
    </div>
  );
}
