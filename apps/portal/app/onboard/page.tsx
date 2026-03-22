'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveSession } from '@/lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const INPUT_CLASS =
  'w-full bg-[var(--surface-inset)] border border-[var(--rule)] rounded-lg px-4 py-2.5 font-mono text-xs text-[var(--ink-primary)] placeholder-[var(--ink-tertiary)] focus:outline-none focus:border-[var(--green)] transition-colors';

export default function OnboardPage() {
  const router = useRouter();

  // Step 1 fields
  const [name, setName]       = useState('');
  const [github, setGithub]   = useState('');
  const [email, setEmail]     = useState('');

  // Step state
  const [step, setStep]       = useState<1 | 2>(1);

  // Step 2 state
  const [address, setAddress] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError]     = useState('');

  async function connectWallet() {
    setConnecting(true);
    setError('');
    try {
      const { request } = await import('@stacks/connect');
      const result = await request('stx_getAddresses');
      const stxAddr = (result as any).addresses?.find(
        (a: any) => a.symbol === 'STX' || a.type === 'p2pkh' || a.type?.includes('stacks')
      );
      const addr = stxAddr?.address ?? (result as any).addresses?.[0]?.address;
      if (!addr) throw new Error('No Stacks address returned from wallet.');
      setAddress(addr);
    } catch (e: any) {
      setError(e?.message ?? 'Wallet connection failed. Make sure Leather or Xverse is installed.');
    } finally {
      setConnecting(false);
    }
  }

  async function completeSetup() {
    setCompleting(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/auth/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stacksAddress: address,
          name: name.trim(),
          githubHandle: github.trim() || undefined,
          email: email.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
      }
      saveSession(address, name.trim());
      router.push('/dashboard');
    } catch (e: any) {
      setError(e?.message ?? 'Setup failed. Please try again.');
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--surface-base)] text-[var(--ink-primary)] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">

        {/* Brand */}
        <div className="text-center mb-10">
          <div className="font-mono text-sm tracking-tight text-[var(--ink-primary)] mb-1">Quash</div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)]">
            Invite-only · Resolver Onboarding
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <span className={`font-mono text-[10px] ${step === 1 ? 'text-[var(--ink-primary)]' : 'text-[var(--ink-tertiary)]'}`}>
            1
          </span>
          <div className="flex items-center gap-1">
            <div className={`w-6 h-px ${step >= 1 ? 'bg-[var(--green)]' : 'bg-[var(--rule)]'}`} />
            <div className={`w-1.5 h-1.5 rounded-full ${step >= 2 ? 'bg-[var(--green)]' : 'bg-[var(--rule)]'}`} />
            <div className={`w-6 h-px ${step >= 2 ? 'bg-[var(--green)]' : 'bg-[var(--rule)]'}`} />
          </div>
          <span className={`font-mono text-[10px] ${step === 2 ? 'text-[var(--ink-primary)]' : 'text-[var(--ink-tertiary)]'}`}>
            2
          </span>
        </div>

        {/* ── Step 1: Profile ─────────────────────────────────────────── */}
        {step === 1 && (
          <div className="flex flex-col gap-5">
            <div>
              <h1 className="font-mono text-xs font-medium text-[var(--ink-primary)] mb-1">Your profile</h1>
              <p className="font-mono text-[11px] text-[var(--ink-tertiary)] leading-relaxed">
                Tell us who you are. This is how you appear to agents when you resolve their errors.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)]">
                  Full Name <span className="text-[var(--green)]">*</span>
                </label>
                <input
                  type="text"
                  className={INPUT_CLASS}
                  placeholder="Evans Kipchoge"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)]">
                  GitHub Handle <span className="opacity-40">optional</span>
                </label>
                <input
                  type="text"
                  className={INPUT_CLASS}
                  placeholder="@sudoevans"
                  value={github}
                  onChange={e => setGithub(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)]">
                  Email <span className="opacity-40">optional</span>
                </label>
                <input
                  type="email"
                  className={INPUT_CLASS}
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!name.trim()}
              className="w-full py-3 rounded-full bg-[var(--green)] text-[var(--surface-base)] font-mono text-xs uppercase tracking-widest hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              Continue →
            </button>
          </div>
        )}

        {/* ── Step 2: Wallet connect ───────────────────────────────────── */}
        {step === 2 && (
          <div className="flex flex-col gap-5">
            <div>
              <h1 className="font-mono text-xs font-medium text-[var(--ink-primary)] mb-1">Connect your wallet</h1>
              <p className="font-mono text-[11px] text-[var(--ink-tertiary)] leading-relaxed">
                Your Stacks address is your identity on Quash. Earnings and solutions are linked to it on-chain.
              </p>
            </div>

            {!address ? (
              <button
                onClick={connectWallet}
                disabled={connecting}
                className="w-full py-3 rounded-full border border-[var(--rule)] text-[var(--ink-primary)] font-mono text-xs uppercase tracking-widest hover:border-[var(--green)] hover:text-[var(--green)] disabled:opacity-50 transition-colors"
              >
                {connecting ? 'Opening wallet…' : 'Connect Wallet (Leather / Xverse)'}
              </button>
            ) : (
              <div className="rounded-lg border border-[var(--green-dim)] bg-[var(--surface-raised)] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2 h-2 rounded-full bg-[var(--green)] shadow-[0_0_8px_var(--green)]" />
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--green)]">Connected</span>
                </div>
                <p className="font-mono text-xs text-[var(--ink-primary)] break-all mb-1">{address}</p>
                <a
                  href={`https://explorer.hiro.so/address/${address}?chain=testnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[10px] text-[var(--ink-tertiary)] hover:text-[var(--green)] transition-colors"
                >
                  View on Hiro Explorer ↗
                </a>
                <button
                  onClick={() => setAddress('')}
                  className="block mt-2 font-mono text-[10px] text-[var(--ink-tertiary)] hover:text-[var(--ink-secondary)] transition-colors"
                >
                  Change wallet
                </button>
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-[#3a1a1a] bg-[var(--surface-inset)] px-4 py-3">
                <p className="font-mono text-[11px] text-[#ef4444]">{error}</p>
              </div>
            )}

            <button
              onClick={completeSetup}
              disabled={!address || completing}
              className="w-full py-3 rounded-full bg-[var(--green)] text-[var(--surface-base)] font-mono text-xs uppercase tracking-widest hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              {completing ? 'Setting up…' : 'Complete Setup →'}
            </button>

            <button
              onClick={() => { setStep(1); setError(''); }}
              className="w-full font-mono text-[10px] text-[var(--ink-tertiary)] hover:text-[var(--ink-secondary)] transition-colors"
            >
              ← Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
