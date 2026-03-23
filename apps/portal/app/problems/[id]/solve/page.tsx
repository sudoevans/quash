'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getStoredAddress, getStoredName } from '@/lib/auth';
import { URGENCY_CONFIG, type Urgency } from '@/lib/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const INPUT_CLASS =
  'w-full bg-[var(--surface-inset)] border border-[var(--rule)] rounded-lg px-4 py-2.5 font-mono text-xs text-[var(--ink-primary)] placeholder-[var(--ink-tertiary)] focus:outline-none focus:border-[var(--green)] transition-colors resize-none';

const URGENCY_DOT: Record<Urgency, string> = {
  critical: '#ef4444',
  urgent:   '#f97316',
  standard: '#eab308',
  deep:     '#60a5fa',
};

// ─── Spinner ─────────────────────────────────────────────────────────────────

function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block rounded-full border-[1.5px] border-current border-t-transparent animate-spin ${className}`}
    />
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({ label, hint, children, className = '' }: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-baseline justify-between">
        <label className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)]">
          {label}
        </label>
        {hint && <span className="font-mono text-[10px] text-[var(--ink-tertiary)] opacity-60">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Problem Panel ────────────────────────────────────────────────────────────

interface ProblemData {
  id: string;
  status: string;
  urgency: Urgency;
  errorType: string;
  errorMessage: string;
  bountyAmount: string | null;
  agentId: string | null;
  environment: any;
  createdAt: string;
  expiresAt: string;
  solveDeadline: string | null;
}

function ProblemPanel({ problem }: { problem: ProblemData }) {
  const expiry = timeLeft(problem.expiresAt);
  const deadline = problem.solveDeadline ? timeLeft(problem.solveDeadline) : null;
  const cfg = URGENCY_CONFIG[problem.urgency];
  const env = problem.environment;
  const envTags: string[] = [];
  if (env?.os?.distro) envTags.push(env.os.distro);
  if (env?.runtime?.name) envTags.push(`${env.runtime.name}${env.runtime.version ? ` ${env.runtime.version}` : ''}`);
  if (env?.language) envTags.push(env.language);

  return (
    <div className="flex flex-col gap-6 px-6 py-8">

      {/* Urgency + bounty header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--rule)] font-mono text-[10px] uppercase tracking-widest text-[var(--ink-secondary)]">
            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: URGENCY_DOT[problem.urgency] }} />
            {cfg.label}
          </span>
        </div>
        {problem.bountyAmount && (
          <div className="text-right flex-shrink-0">
            <div className="font-mono text-2xl text-[var(--green)] leading-none">${problem.bountyAmount}</div>
            <div className="font-mono text-[10px] text-[var(--ink-tertiary)] mt-0.5 uppercase tracking-widest">reward</div>
          </div>
        )}
      </div>

      {/* Error type */}
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)] mb-1.5">Error Type</p>
        <h2 className="font-mono text-sm font-medium text-[var(--ink-primary)] leading-snug">{problem.errorType}</h2>
      </div>

      {/* Error message */}
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)] mb-1.5">Message</p>
        <pre className="bg-[var(--surface-inset)] border border-[var(--rule)] rounded-lg p-3 font-mono text-[11px] text-[var(--ink-secondary)] leading-relaxed overflow-x-auto whitespace-pre-wrap break-words max-h-52 overflow-y-auto">
          {problem.errorMessage}
        </pre>
      </div>

      {/* Environment tags */}
      {envTags.length > 0 && (
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)] mb-1.5">Environment</p>
          <div className="flex flex-wrap gap-1.5">
            {envTags.map(tag => (
              <span key={tag} className="font-mono text-[10px] px-2.5 py-1 rounded-full border border-[var(--rule)] text-[var(--ink-secondary)]">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Timing */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] text-[var(--ink-tertiary)]">Posted</span>
          <span className="font-mono text-[10px] text-[var(--ink-secondary)]">{timeAgo(problem.createdAt)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] text-[var(--ink-tertiary)]">Bounty expires</span>
          <span
            className="font-mono text-[10px]"
            style={{ color: expiry.urgent ? '#ef4444' : 'var(--ink-secondary)' }}
          >
            {expiry.label}
          </span>
        </div>
        {deadline && (
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-[var(--ink-tertiary)]">Solve deadline</span>
            <span
              className="font-mono text-[10px]"
              style={{ color: deadline.urgent ? '#ef4444' : 'var(--ink-secondary)' }}
            >
              {deadline.label}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] text-[var(--ink-tertiary)]">Solve window</span>
          <span className="font-mono text-[10px] text-[var(--ink-secondary)]">{cfg.window}</span>
        </div>
      </div>

      {/* Problem ID */}
      <div className="pt-2 border-t border-[var(--rule)]">
        <p className="font-mono text-[10px] text-[var(--ink-tertiary)]">
          ID <span className="text-[var(--ink-secondary)] ml-1">{problem.id.slice(0, 16)}…</span>
        </p>
      </div>

    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SolvePage({ params }: { params: { id: string } }) {
  const router = useRouter();

  const [resolverAddress, setResolverAddress] = useState('');
  const [resolverName, setResolverName] = useState('');
  const [problem, setProblem] = useState<ProblemData | null>(null);
  const [problemLoading, setProblemLoading] = useState(true);

  useEffect(() => {
    setResolverAddress(getStoredAddress() ?? '');
    setResolverName(getStoredName() ?? '');
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/problems/${params.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => data && setProblem(data))
      .catch(() => {})
      .finally(() => setProblemLoading(false));
  }, [params.id]);

  const [title, setTitle] = useState('');
  const [explanation, setExplanation] = useState('');
  const [codePatch, setCodePatch] = useState('');
  const [verifyCmd, setVerifyCmd] = useState('');
  const [verifyOutput, setVerifyOutput] = useState('');
  const [authorEnv, setAuthorEnv] = useState('');
  const [steps, setSteps] = useState([
    { order: 1, instruction: '', is_executable: false, command: '' },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [solutionId, setSolutionId] = useState('');
  const [error, setError] = useState('');

  function addStep() {
    setSteps(s => [...s, { order: s.length + 1, instruction: '', is_executable: false, command: '' }]);
  }

  function removeStep(i: number) {
    setSteps(s => s.filter((_, idx) => idx !== i).map((step, idx) => ({ ...step, order: idx + 1 })));
  }

  function updateStep(i: number, field: string, value: string | boolean) {
    setSteps(s => s.map((step, idx) => idx === i ? { ...step, [field]: value } : step));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError('');
    try {
      const body = {
        title,
        explanation,
        steps: steps.map(s => ({ ...s, command: s.command || null })),
        code_patch: codePatch || undefined,
        verification_command: verifyCmd || undefined,
        verification_expected_output: verifyOutput || undefined,
        author_confirmed_env: authorEnv || undefined,
        resolver_address: resolverAddress || undefined,
        resolver_name: resolverName || undefined,
      };

      const res = await fetch(`${API_BASE}/problems/${params.id}/solve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
      }

      const data = await res.json();
      setSolutionId(data.solution_id ?? '');
      setSubmitted(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = title.trim().length > 0 && explanation.trim().length > 0 && !submitting;

  // ── Success screen ──────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-[var(--surface-base)] text-[var(--ink-primary)] flex flex-col items-center justify-center px-6">
        <div className="max-w-md w-full flex flex-col items-center gap-6 text-center">
          <div className="w-12 h-12 rounded-full border border-[var(--green-dim)] bg-[var(--surface-raised)] flex items-center justify-center">
            <span className="w-3 h-3 rounded-full bg-[var(--green)]" />
          </div>
          <div>
            <h2 className="font-mono text-sm font-medium text-[var(--ink-primary)] mb-2">Solution submitted</h2>
            <p className="font-mono text-xs text-[var(--ink-tertiary)] leading-relaxed">
              The agent has been notified and can now unlock your fix via payment.
              Your reward will be credited once confirmed.
            </p>
          </div>
          {solutionId && (
            <div className="w-full bg-[var(--surface-inset)] border border-[var(--rule)] rounded-lg px-4 py-3 text-left">
              <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)] mb-1">Solution ID</p>
              <p className="font-mono text-xs text-[var(--ink-secondary)]">{solutionId}</p>
            </div>
          )}
          <div className="flex flex-col gap-3 w-full">
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full py-3 rounded-full bg-[var(--green)] text-[var(--surface-base)] font-mono text-xs uppercase tracking-widest hover:opacity-90 transition-opacity"
            >
              View Dashboard →
            </button>
            <button
              onClick={() => router.push('/dashboard?tab=solutions')}
              className="w-full py-3 rounded-full border border-[var(--rule)] text-[var(--ink-tertiary)] font-mono text-xs uppercase tracking-widest hover:text-[var(--ink-secondary)] hover:border-[var(--ink-tertiary)] transition-colors"
            >
              Browse Solutions Registry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main layout ─────────────────────────────────────────────────────────────
  return (
    <div className="h-screen bg-[var(--surface-base)] text-[var(--ink-primary)] flex flex-col overflow-hidden">

      {/* Header */}
      <header className="flex-shrink-0 flex items-center justify-between px-6 h-14 border-b border-[var(--rule)] bg-[var(--surface-base)] z-10">
        <Link
          href="/dashboard"
          className="font-mono text-xs text-[var(--ink-tertiary)] hover:text-[var(--ink-secondary)] transition-colors"
        >
          ← Dashboard
        </Link>
        <span className="font-mono text-xs uppercase tracking-widest text-[var(--ink-tertiary)]">
          Write Solution
        </span>
        <span className="font-mono text-[10px] text-[var(--ink-tertiary)] bg-[var(--surface-inset)] px-2.5 py-1 rounded-full border border-[var(--rule)]">
          #{params.id.slice(0, 8)}
        </span>
      </header>

      {/* Two-pane body */}
      <div className="flex flex-1 min-h-0">

        {/* ── Left: Problem panel ─────────────────────────────────────────── */}
        <aside className="w-[360px] flex-shrink-0 border-r border-[var(--rule)] overflow-y-auto bg-[var(--surface-raised)]">
          {problemLoading ? (
            <div className="flex items-center justify-center h-full gap-2 text-[var(--ink-tertiary)]">
              <Spinner className="w-3.5 h-3.5" />
              <span className="font-mono text-xs">Loading problem…</span>
            </div>
          ) : problem ? (
            <ProblemPanel problem={problem} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-2 px-6 text-center">
              <p className="font-mono text-xs text-[var(--ink-tertiary)]">Problem not found.</p>
            </div>
          )}
        </aside>

        {/* ── Right: Solution form ────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-xl mx-auto px-8 py-8 flex flex-col gap-7">

            {/* Heading */}
            <div>
              <h1 className="font-mono text-sm font-medium text-[var(--ink-primary)] mb-1">Propose a solution</h1>
              <p className="font-mono text-[11px] text-[var(--ink-tertiary)] leading-relaxed">
                Describe the root cause and provide reproducible fix steps. The agent pays on confirmation.
              </p>
            </div>

            {/* ── Core ──────────────────────────────────────────────────────── */}
            <section className="flex flex-col gap-5">
              <Field label="Solution Title" hint="required">
                <input
                  type="text"
                  className={INPUT_CLASS}
                  placeholder="e.g. Use POSIX sed tmp-file pattern on Alpine (busybox incompatibility)"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  autoFocus
                />
              </Field>

              <Field label="Root Cause Explanation" hint="required">
                <textarea
                  rows={5}
                  className={INPUT_CLASS}
                  placeholder="Explain why this error occurs and why your fix works. Be specific about the version or environment constraint."
                  value={explanation}
                  onChange={e => setExplanation(e.target.value)}
                />
              </Field>
            </section>

            <div className="border-t border-[var(--rule)]" />

            {/* ── Fix Steps ─────────────────────────────────────────────────── */}
            <section className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)]">Fix Steps</span>
                <button
                  onClick={addStep}
                  className="font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-full border border-[var(--rule)] text-[var(--ink-tertiary)] hover:text-[var(--ink-secondary)] hover:border-[var(--ink-tertiary)] transition-colors"
                >
                  + Add Step
                </button>
              </div>

              {steps.map((step, i) => (
                <div key={i} className="rounded-lg border border-[var(--rule)] bg-[var(--surface-raised)] p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-[var(--ink-tertiary)] uppercase tracking-widest">Step {step.order}</span>
                    {steps.length > 1 && (
                      <button
                        onClick={() => removeStep(i)}
                        className="font-mono text-[10px] text-[var(--ink-tertiary)] hover:text-[#ef4444] transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    className={INPUT_CLASS}
                    placeholder="Instruction — e.g. Replace sed -i with tmp-file pattern"
                    value={step.instruction}
                    onChange={e => updateStep(i, 'instruction', e.target.value)}
                  />
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={step.is_executable}
                      onChange={e => updateStep(i, 'is_executable', e.target.checked)}
                      className="accent-[var(--green)]"
                    />
                    <span className="font-mono text-[10px] text-[var(--ink-tertiary)] uppercase tracking-widest">Executable</span>
                  </label>
                  {step.is_executable && (
                    <input
                      type="text"
                      className={INPUT_CLASS}
                      placeholder="Command to run"
                      value={step.command}
                      onChange={e => updateStep(i, 'command', e.target.value)}
                    />
                  )}
                </div>
              ))}
            </section>

            <div className="border-t border-[var(--rule)]" />

            {/* ── Verification + Patch ──────────────────────────────────────── */}
            <section className="flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Verification Command" hint="optional">
                  <input
                    type="text"
                    className={INPUT_CLASS}
                    placeholder="grep -q 'KEY' file && echo OK"
                    value={verifyCmd}
                    onChange={e => setVerifyCmd(e.target.value)}
                  />
                </Field>
                <Field label="Expected Output" hint="optional">
                  <input
                    type="text"
                    className={INPUT_CLASS}
                    placeholder="OK"
                    value={verifyOutput}
                    onChange={e => setVerifyOutput(e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Unified Diff Patch" hint="optional — git diff format">
                <textarea
                  rows={7}
                  className={`${INPUT_CLASS} font-mono leading-relaxed`}
                  placeholder={`--- a/scripts/build.sh\n+++ b/scripts/build.sh\n@@ -12,3 +12,3 @@\n-sed -i.bak 's/FOO/BAR/' file\n+sed 's/FOO/BAR/' file > file.tmp && mv file.tmp file`}
                  value={codePatch}
                  onChange={e => setCodePatch(e.target.value)}
                />
              </Field>
            </section>

            <div className="border-t border-[var(--rule)]" />

            {/* ── Author ────────────────────────────────────────────────────── */}
            <section className="flex flex-col gap-5">
              <Field label="Confirmed Environment" hint="optional but recommended">
                <input
                  type="text"
                  className={INPUT_CLASS}
                  placeholder="alpine:3.18 · busybox 1.36 · node:18 · 2026-03-22"
                  value={authorEnv}
                  onChange={e => setAuthorEnv(e.target.value)}
                />
              </Field>

              {resolverAddress && (
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)]">
                    Submitting as
                  </label>
                  <a
                    href={`https://explorer.hiro.so/address/${resolverAddress}?chain=testnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-[var(--ink-secondary)] hover:text-[var(--green)] transition-colors"
                  >
                    {resolverAddress} ↗
                  </a>
                </div>
              )}
            </section>

            {/* Error */}
            {error && (
              <div className="rounded-lg border border-[#3a1a1a] bg-[var(--surface-inset)] px-4 py-3">
                <p className="font-mono text-xs text-[#ef4444]">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full py-3 rounded-full bg-[var(--green)] text-[var(--surface-base)] font-mono text-xs uppercase tracking-widest hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Spinner className="w-3.5 h-3.5" />
                  <span>Submitting…</span>
                </>
              ) : (
                'Submit Solution →'
              )}
            </button>

          </div>
        </main>
      </div>
    </div>
  );
}
