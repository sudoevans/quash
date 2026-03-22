'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getStoredAddress, getStoredName } from '@/lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const INPUT_CLASS =
  'w-full bg-[var(--surface-inset)] border border-[var(--rule)] rounded-lg px-4 py-2.5 font-mono text-xs text-[var(--ink-primary)] placeholder-[var(--ink-tertiary)] focus:outline-none focus:border-[var(--green)] transition-colors resize-none';

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

export default function SolvePage({ params }: { params: { id: string } }) {
  const router = useRouter();

  const [resolverAddress, setResolverAddress] = useState('');
  const [resolverName, setResolverName] = useState('');

  useEffect(() => {
    setResolverAddress(getStoredAddress() ?? '');
    setResolverName(getStoredName() ?? '');
  }, []);

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
        steps: steps.map(s => ({
          ...s,
          command: s.command || null,
        })),
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

  if (submitted) {
    return (
      <div className="min-h-screen bg-[var(--surface-base)] text-[var(--ink-primary)] flex flex-col items-center justify-center px-6">
        <div className="max-w-md w-full flex flex-col items-center gap-6 text-center">
          {/* Pulse indicator */}
          <div className="w-12 h-12 rounded-full border border-[var(--green-dim)] bg-[var(--surface-raised)] flex items-center justify-center">
            <span className="w-3 h-3 rounded-full bg-[var(--green)] shadow-[0_0_12px_var(--green)] animate-pulse" />
          </div>

          <div>
            <h2 className="font-mono text-sm font-medium text-[var(--ink-primary)] mb-2">
              Solution submitted
            </h2>
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
              onClick={() => router.push('/dashboard')}
              className="w-full py-3 rounded-full border border-[var(--rule)] text-[var(--ink-tertiary)] font-mono text-xs uppercase tracking-widest hover:text-[var(--ink-secondary)] hover:border-[var(--ink-tertiary)] transition-colors"
            >
              Browse Solutions Registry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--surface-base)] text-[var(--ink-primary)]">

      {/* Top bar */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-6 h-14 border-b border-[var(--rule)] bg-[var(--surface-base)]">
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

      <main className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-8">

        {/* Page heading */}
        <div>
          <h1 className="font-mono text-sm font-medium text-[var(--ink-primary)] mb-1">
            Propose a solution
          </h1>
          <p className="font-mono text-[11px] text-[var(--ink-tertiary)] leading-relaxed">
            Describe the root cause and provide reproducible fix steps. The agent pays on confirmation.
          </p>
        </div>

        {/* ── Section: Core ─────────────────────────────────────────────── */}
        <section className="flex flex-col gap-5">
          <Field label="Solution Title" hint="required">
            <input
              type="text"
              className={INPUT_CLASS}
              placeholder="e.g. Use POSIX sed tmp-file pattern on Alpine (busybox incompatibility)"
              value={title}
              onChange={e => setTitle(e.target.value)}
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

        {/* Divider */}
        <div className="border-t border-[var(--rule)]" />

        {/* ── Section: Fix Steps ────────────────────────────────────────── */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)]">
              Fix Steps
            </span>
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
                <span className="font-mono text-[10px] text-[var(--ink-tertiary)] uppercase tracking-widest">
                  Step {step.order}
                </span>
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

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={step.is_executable}
                    onChange={e => updateStep(i, 'is_executable', e.target.checked)}
                    className="accent-[var(--green)]"
                  />
                  <span className="font-mono text-[10px] text-[var(--ink-tertiary)] uppercase tracking-widest">
                    Executable
                  </span>
                </label>
              </div>

              {step.is_executable && (
                <input
                  type="text"
                  className={`${INPUT_CLASS} font-mono`}
                  placeholder="Command to run"
                  value={step.command}
                  onChange={e => updateStep(i, 'command', e.target.value)}
                />
              )}
            </div>
          ))}
        </section>

        {/* Divider */}
        <div className="border-t border-[var(--rule)]" />

        {/* ── Section: Verification + Patch ─────────────────────────────── */}
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

        {/* Divider */}
        <div className="border-t border-[var(--rule)]" />

        {/* ── Section: Author ───────────────────────────────────────────── */}
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
          className="w-full py-3 rounded-full bg-[var(--green)] text-[var(--surface-base)] font-mono text-xs uppercase tracking-widest hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          {submitting ? 'Submitting…' : 'Submit Solution →'}
        </button>

      </main>
    </div>
  );
}
