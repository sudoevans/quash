'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveSession } from '@/lib/auth';
import { request } from '@stacks/connect';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://quash.fly.dev';

const INPUT_CLASS =
  'w-full bg-[var(--surface-inset)] border border-[var(--rule)] rounded-lg px-4 py-2.5 font-mono text-xs text-[var(--ink-primary)] placeholder-[var(--ink-tertiary)] focus:outline-none focus:border-[var(--green)] transition-colors';

function Spinner() {
  return (
    <span className="inline-block w-3.5 h-3.5 rounded-full border-[1.5px] border-current border-t-transparent animate-spin" />
  );
}

export default function OnboardPage() {
  const router = useRouter();

  // Profile fields (new users)
  const [name, setName]     = useState('');
  const [github, setGithub] = useState('');
  const [email, setEmail]   = useState('');

  // Flow state: 'connect' | 'returning' | 'new-profile' | 'new-wallet'
  const [flow, setFlow] = useState<'connect' | 'returning' | 'new-profile' | 'new-wallet'>('connect');

  const [address, setAddress]       = useState('');
  const [returningName, setReturningName] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError]           = useState('');

  async function connectWallet() {
    setConnecting(true);
    setError('');
    try {
      const result = await request('stx_getAddresses');
      const addresses: any[] = (result as any)?.addresses ?? [];
      const stxAddr = addresses.find(
        (a: any) => a.symbol === 'STX' || a.type === 'p2pkh' || a.type?.includes('stacks')
      );
      const addr = stxAddr?.address ?? addresses[0]?.address;
      if (!addr) throw new Error('No Stacks address returned from wallet.');

      setAddress(addr);

      // Check if already registered
      const me = await fetch(`${API_BASE}/auth/me?address=${addr}`);
      if (me.ok) {
        const data = await me.json();
        setReturningName(data.name ?? '');
        saveSession(addr, data.name ?? addr);
        setFlow('returning');
      } else {
        setFlow('new-profile');
      }
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

  const shortAddr = address ? `${address.slice(0, 8)}…${address.slice(-6)}` : '';

  return (
    <div className="min-h-screen bg-[var(--surface-base)] text-[var(--ink-primary)] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">

        {/* Brand */}
        <div className="text-center mb-10">
          <div className="font-mono text-sm tracking-tight text-[var(--ink-primary)] mb-1">Quash</div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)]">
            Expert Onboarding
          </p>
        </div>

        {/* ── Connect wallet (initial state) ───────────────────────── */}
        {flow === 'connect' && (
          <div className="flex flex-col gap-5">
            <div>
              <h1 className="font-mono text-xs font-medium text-[var(--ink-primary)] mb-1">Connect your wallet</h1>
              <p className="font-mono text-[11px] text-[var(--ink-tertiary)] leading-relaxed">
                Your Stacks address is your identity on Quash. Earnings and solutions are linked to it on-chain.
              </p>
            </div>
            <button
              onClick={connectWallet}
              disabled={connecting}
              className="w-full py-3 rounded-full border border-[var(--rule)] text-[var(--ink-primary)] font-mono text-xs uppercase tracking-widest hover:border-[var(--green)] hover:text-[var(--green)] disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {connecting ? <><Spinner /><span>Checking…</span></> : 'Connect Wallet (Leather / Xverse)'}
            </button>
            {error && (
              <div className="rounded-lg border border-[var(--danger-dim)] bg-[var(--surface-inset)] px-4 py-3">
                <p className="font-mono text-[11px] text-[var(--danger)]">{error}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Returning user ───────────────────────────────────────── */}
        {flow === 'returning' && (
          <div className="flex flex-col gap-5">
            <div className="rounded-lg border border-[var(--green-dim)] bg-[var(--surface-raised)] p-6 text-center">
              <span className="w-2 h-2 rounded-full bg-[var(--green)] shadow-[0_0_8px_var(--green)] inline-block mb-4" />
              <h1 className="font-mono text-sm font-medium text-[var(--ink-primary)] mb-1">
                Welcome back{returningName ? `, ${returningName}` : ''}
              </h1>
              <p className="font-mono text-[10px] text-[var(--ink-tertiary)]">{shortAddr}</p>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="w-full py-3 rounded-full bg-[var(--green)] text-[var(--surface-base)] font-mono text-xs uppercase tracking-widest hover:opacity-90 transition-opacity"
            >
              Continue to Dashboard →
            </button>
            <button
              onClick={() => { setFlow('connect'); setAddress(''); setError(''); }}
              className="w-full font-mono text-[10px] text-[var(--ink-tertiary)] hover:text-[var(--ink-secondary)] transition-colors"
            >
              Use a different wallet
            </button>
          </div>
        )}

        {/* ── New user: profile form ───────────────────────────────── */}
        {flow === 'new-profile' && (
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
            {error && (
              <div className="rounded-lg border border-[var(--danger-dim)] bg-[var(--surface-inset)] px-4 py-3">
                <p className="font-mono text-[11px] text-[var(--danger)]">{error}</p>
              </div>
            )}
            <button
              onClick={completeSetup}
              disabled={!name.trim() || completing}
              className="w-full py-3 rounded-full bg-[var(--green)] text-[var(--surface-base)] font-mono text-xs uppercase tracking-widest hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
            >
              {completing ? <><Spinner /><span>Setting up…</span></> : 'Complete Setup →'}
            </button>
            <button
              onClick={() => { setFlow('connect'); setAddress(''); setError(''); }}
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
