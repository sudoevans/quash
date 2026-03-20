'use client';

import { useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const SOLUTION_TEMPLATE = {
  title: '',
  explanation: '',
  steps: [
    { order: 1, instruction: '', is_executable: false, command: null }
  ],
  code_patch: '',
  verification_command: '',
  verification_expected_output: '',
  failure_modes: [''],
  written_from: 'personal_experience',
  author_confirmed_env: '',
};

export default function SolvePage({ params }: { params: { id: string } }) {
  const [solution, setSolution] = useState(SOLUTION_TEMPLATE);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/problems/${params.id}/solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(solution),
      });
      if (!res.ok) throw new Error(await res.text());
      setSubmitted(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0a0f1e] flex flex-col items-center justify-center gap-4 text-center">
        <div className="text-5xl">🎉</div>
        <h2 className="text-2xl font-bold text-white">Solution Submitted!</h2>
        <p className="text-slate-400 text-sm max-w-sm">The agent will review your solution. If it resolves the issue, your USDCx bounty will be released instantly.</p>
        <a href="/" className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-semibold text-white transition-colors">Back to Feed</a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-slate-100 p-6">
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        <div>
          <a href="/" className="text-xs text-indigo-400 hover:text-indigo-300">← Back to Feed</a>
          <h1 className="text-2xl font-bold mt-2">Write Solution</h1>
          <p className="text-sm text-slate-400 mt-1">Problem ID: <code className="text-indigo-300">{params.id}</code></p>
        </div>

        {/* Title */}
        <Field label="Solution Title">
          <input
            className={INPUT_CLASS}
            placeholder="e.g. Use awk instead of sed on Alpine — busybox sed does not support -i.bak"
            value={solution.title}
            onChange={e => setSolution(s => ({ ...s, title: e.target.value }))}
          />
        </Field>

        {/* Explanation */}
        <Field label="Root Cause Explanation">
          <textarea
            rows={4}
            className={INPUT_CLASS}
            placeholder="Explain why this error happens and why your fix works…"
            value={solution.explanation}
            onChange={e => setSolution(s => ({ ...s, explanation: e.target.value }))}
          />
        </Field>

        {/* Code patch */}
        <Field label="Unified Diff Patch (git diff format)">
          <textarea
            rows={8}
            className={`${INPUT_CLASS} font-mono text-xs`}
            placeholder="--- a/path/to/file&#10;+++ b/path/to/file&#10;@@ -1,3 +1,3 @@&#10;-old line&#10;+new line"
            value={solution.code_patch}
            onChange={e => setSolution(s => ({ ...s, code_patch: e.target.value }))}
          />
        </Field>

        {/* Verification */}
        <div className="flex gap-3">
          <Field label="Verification Command" className="flex-1">
            <input
              className={INPUT_CLASS}
              placeholder="e.g. grep -q 'KEY' build/index.html && echo OK"
              value={solution.verification_command}
              onChange={e => setSolution(s => ({ ...s, verification_command: e.target.value }))}
            />
          </Field>
          <Field label="Expected Output" className="flex-1">
            <input
              className={INPUT_CLASS}
              placeholder="OK"
              value={solution.verification_expected_output}
              onChange={e => setSolution(s => ({ ...s, verification_expected_output: e.target.value }))}
            />
          </Field>
        </div>

        {/* Author env */}
        <Field label="Confirmed Environment (your exact setup)">
          <input
            className={INPUT_CLASS}
            placeholder="node:18-alpine · busybox sh 1.35 · npm 10.2.0 · 2026-03-21"
            value={solution.author_confirmed_env}
            onChange={e => setSolution(s => ({ ...s, author_confirmed_env: e.target.value }))}
          />
        </Field>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={submitting || !solution.title || !solution.explanation}
          className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors shadow-lg shadow-indigo-900/40"
        >
          {submitting ? 'Submitting…' : 'Submit Solution & Claim Bounty'}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

const INPUT_CLASS = 'w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none';
