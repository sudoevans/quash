'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef } from 'react';

type Toast = { id: number; message: string; sub?: string; type: 'success' | 'error' | 'excited' };

// ─── Terminal Demo ─────────────────────────────────────────────────────────────

const THINKING_WORDS = [
  'Contemplating…','Searching…','Forging…','Stirring…','Shaping…',
  'Spinning…','Summoning…','Tuning…','Shimmying…','Discombobulating…',
  'Flibbertigibbeting…','Rummaging…','Deliberating…','Cross-referencing…',
];

type TermLine  = { cls: string; text: string; d: number };
type TermPhase = { thinkingMs: number; lines: TermLine[] };
type TermStep  = { label: string; prompt: string; phases: TermPhase[] };

const TERMINAL_STEPS: TermStep[] = [
  {
    label: 'Search',
    prompt: 'agent hit an unrecoverable error after 7 retries — quash hook fires',
    phases: [
      { thinkingMs: 1800, lines: [
        { cls:'err',    text:'✗  sed: 1: build/index.html: extra characters at end of b command', d:0   },
        { cls:'err',    text:'✗  sed: cant read /dev/stdin: No such file or directory',            d:160 },
        { cls:'err',    text:'✗  Process exited with code 1  (attempt 7/7)',                       d:320 },
        { cls:'gap',    text:'', d:380 },
        { cls:'bullet', text:'quash on-error hook intercepted',                                    d:460 },
        { cls:'sub',    text:'stack fingerprint: alpine · busybox · shell · twenty-crm',           d:580 },
        { cls:'gap',    text:'', d:640 },
        { cls:'bullet', text:'Searching solution store…',                                          d:720 },
        { cls:'sub',    text:'GET /solutions/search?q=sed+alpine+busybox&stack=alpine,shell',      d:860 },
      ]},
      { thinkingMs: 1400, lines: [
        { cls:'ok',     text:'←  200 OK  ·  2 results  ·  18ms',                                  d:0   },
        { cls:'gap',    text:'', d:60  },
        { cls:'bullet', text:'[1]  Use awk instead of sed on Alpine',                              d:140 },
        { cls:'sub',    text:'success_rate: 87%  ·  uses: 312  ·  price: $0.03 USDCx',            d:260 },
        { cls:'bullet', text:'[2]  Install gnu-sed via apk on Alpine',                             d:380 },
        { cls:'sub',    text:'success_rate: 74%  ·  uses: 89   ·  price: $0.03 USDCx',            d:500 },
        { cls:'gap',    text:'', d:560 },
        { cls:'dim',    text:'→  selecting [1]  highest success rate  →  proceeding to unlock',   d:640 },
      ]},
    ],
  },
  {
    label: 'Unlock',
    prompt: 'unlocking solution via x402 — agent pays, server delivers in one HTTP round-trip',
    phases: [
      { thinkingMs: 1600, lines: [
        { cls:'bullet', text:'POST /solve  →  probing payment terms',                              d:0   },
        { cls:'gap',    text:'', d:60  },
        { cls:'pay',    text:'←  402 Payment Required',                                            d:200 },
        { cls:'mid',    text:'    solution_id :  sol_abc123',                                      d:320 },
        { cls:'mid',    text:'    price       :  0.03 USDCx',                                      d:400 },
        { cls:'mid',    text:'    payTo       :  SP2X4BQVBT…',                                     d:480 },
        { cls:'mid',    text:'    network     :  stacks:mainnet',                                   d:560 },
        { cls:'mid',    text:'    expires_at  :  1711234567',                                       d:640 },
        { cls:'gap',    text:'', d:700 },
        { cls:'dim',    text:'price ≤ autoApproveUnder ($0.05)  →  auto-approving',                d:780 },
      ]},
      { thinkingMs: 2200, lines: [
        { cls:'bullet', text:'Broadcasting USDCx transfer on Stacks mainnet…',                     d:0   },
        { cls:'sub',    text:'signing tx with agent wallet  0xd4f2…',                              d:160 },
        { cls:'sub',    text:'submitting to mempool…',                                             d:420 },
        { cls:'sub',    text:'waiting for confirmation…',                                          d:800 },
        { cls:'ok',     text:'✓  tx confirmed  ·  0x7f3a9c…d21c  ·  block #192847  ·  3.1s',     d:1800},
        { cls:'gap',    text:'', d:1880},
        { cls:'bullet', text:'POST /solve  X-Payment: {txid, wallet, solution_id}',               d:1960},
        { cls:'ok',     text:'✓  200 OK  ·  solution payload delivered',                          d:2400},
      ]},
    ],
  },
  {
    label: 'Live Bounty',
    prompt: 'no match in store — agent posts a live bounty and waits for an expert',
    phases: [
      { thinkingMs: 1500, lines: [
        { cls:'bullet', text:'No solution found in store',                                         d:0   },
        { cls:'sub',    text:'0 results for this error fingerprint',                               d:140 },
        { cls:'gap',    text:'', d:200 },
        { cls:'bullet', text:'Posting live bounty…',                                               d:280 },
        { cls:'mid',    text:'  POST /problems',                                                   d:400 },
        { cls:'mid',    text:'  {  bounty: "0.05 USDCx",  urgency: "urgent"  }',                 d:480 },
        { cls:'sub',    text:'locking funds in Clarity escrow contract…',                          d:620 },
      ]},
      { thinkingMs: 1200, lines: [
        { cls:'ok',     text:'✓  202 Accepted  ·  bounty_id: lq_xyz789',                          d:0   },
        { cls:'sub',    text:'bounty_locked: true  ·  escrow on Stacks',                          d:140 },
        { cls:'sub',    text:'estimated_response: 5–15 min',                                      d:240 },
        { cls:'gap',    text:'', d:300 },
        { cls:'dim',    text:'agent continues other work  ·  polling every 30s',                  d:380 },
        { cls:'gap',    text:'', d:440 },
        { cls:'bullet', text:'Poll  GET /problems/lq_xyz789/status',                              d:520 },
        { cls:'sub',    text:'{ status: "open" }  ·  waiting for claim',                         d:900 },
        { cls:'bullet', text:'Poll  GET /problems/lq_xyz789/status  [+4 min]',                    d:1400},
        { cls:'sub',    text:'{ status: "claimed" }  ·  expert working on it',                   d:1800},
        { cls:'bullet', text:'Poll  GET /problems/lq_xyz789/status  [+8 min]',                    d:2300},
        { cls:'ok',     text:'✓  { status: "solution_ready" }  ·  pay to unlock →',             d:2700},
      ]},
    ],
  },
  {
    label: 'Solved',
    prompt: 'solution applied — build passes — outcome reported — expert earns forever',
    phases: [
      { thinkingMs: 1600, lines: [
        { cls:'bullet', text:'Solution unlocked  ·  applying patch',                              d:0   },
        { cls:'gap',    text:'', d:60  },
        { cls:'white',  text:'title:         Use awk instead of sed on Alpine',                   d:140 },
        { cls:'white',  text:'success_rate:  87%  ·  applies_to: busybox sed on Alpine Linux',    d:260 },
        { cls:'gap',    text:'', d:320 },
        { cls:'mid',    text:'step 1  →  confirm busybox sed:  sed --version',                   d:420 },
        { cls:'mid',    text:'step 2  →  replace sed -i block with awk equivalent',              d:540 },
        { cls:'mid',    text:'step 3  →  npm run build',                                         d:660 },
        { cls:'gap',    text:'', d:720 },
        { cls:'bullet', text:'Patching inject-runtime-env.sh…',                                  d:800 },
        { cls:'sub',    text:'replaced 3 sed calls with awk equivalents',                        d:940 },
      ]},
      { thinkingMs: 1800, lines: [
        { cls:'bullet', text:'Running build…',                                                    d:0   },
        { cls:'sub',    text:'npm run build',                                                     d:120 },
        { cls:'ok',     text:'✓  build succeeded  ·  3.2s',                                      d:1100},
        { cls:'ok',     text:'✓  REACT_APP_SERVER_BASE_URL injected correctly',                  d:1300},
        { cls:'gap',    text:'', d:1380},
        { cls:'bullet', text:'Reporting outcome to Quash…',                                       d:1460},
        { cls:'sub',    text:'POST /feedback  { outcome: "resolved", exit_code: 0 }',            d:1600},
        { cls:'ok',     text:'✓  recorded  ·  author score updated  ·  solution re-indexed',    d:2000},
        { cls:'gap',    text:'', d:2080},
        { cls:'dim',    text:'total cost: $0.03 USDCx  ·  7 failed retries avoided',            d:2160},
        { cls:'ok',     text:'✓  solution now earns the expert 80% on every future match',      d:2340},
      ]},
    ],
  },
];

const TERM_COLOR: Record<string, string> = {
  dim:    '#555350', mid:   '#8a8780', white: '#d4d0c8',
  pay:    '#c8883a', ok:    '#4a9968', err:   '#a04040',
  bullet: '#d4d0c8', sub:   '#8a8780',
};
const MONO = '"DM Mono","Courier New",monospace';
const LINE_BASE = `font-family:${MONO};font-size:12.5px;line-height:1.7;display:block;margin-bottom:1px;`;

function appendTermLine(parent: HTMLElement, cls: string, text: string) {
  const el = document.createElement('span');
  if (cls === 'gap') {
    el.style.cssText = 'display:block;height:10px;';
    parent.appendChild(el);
    return;
  }
  const color = TERM_COLOR[cls] ?? '#8a8780';
  const extra = cls === 'sub' ? 'padding-left:18px;' : '';
  el.style.cssText = `${LINE_BASE}color:${color};${extra}opacity:0;transform:translateY(2px);transition:opacity 0.15s,transform 0.15s;`;
  if (cls === 'bullet') {
    el.innerHTML = `<span style="color:#8a8780;font-size:10px;vertical-align:middle;position:relative;top:-1px;">● </span>${text}`;
  } else if (cls === 'sub') {
    el.innerHTML = `<span style="color:#555350;font-size:11px;">L </span>${text}`;
  } else {
    el.textContent = text;
  }
  parent.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'none'; });
}

function runTermPhases(
  phases: TermPhase[], phaseIdx: number,
  thinkWrap: HTMLElement, outputWrap: HTMLElement, body: HTMLElement,
  pushTimer: (id: ReturnType<typeof setTimeout>) => void,
  wordTimerRef: { current: ReturnType<typeof setInterval> | null },
  phaseTimerRef: { current: ReturnType<typeof setTimeout> | null },
) {
  if (phaseIdx >= phases.length) return;
  const phase = phases[phaseIdx];

  const thinkEl = document.createElement('div');
  thinkEl.style.cssText = 'display:flex;align-items:center;gap:9px;margin-bottom:4px;';
  const wordId = `tw-${phaseIdx}-${Date.now()}`;
  thinkEl.innerHTML = `<span style="color:#c87941;font-size:15px;line-height:1;animation:quash-th-pulse 0.9s ease-in-out infinite alternate;">+</span><span id="${wordId}" style="font-family:${MONO};color:#c87941;font-size:13px;font-style:italic;">Contemplating…</span>`;
  thinkWrap.appendChild(thinkEl);

  let wi = 0;
  wordTimerRef.current = setInterval(() => {
    const wEl = document.getElementById(wordId);
    if (wEl) wEl.textContent = THINKING_WORDS[wi = (wi + 1) % THINKING_WORDS.length];
  }, 850);

  phaseTimerRef.current = setTimeout(() => {
    clearInterval(wordTimerRef.current!); wordTimerRef.current = null;
    thinkEl.style.display = 'none';

    phase.lines.forEach(line => {
      const t = setTimeout(() => {
        appendTermLine(outputWrap, line.cls, line.text);
        body.scrollTop = body.scrollHeight;
      }, line.d);
      pushTimer(t);
    });

    const lastD = phase.lines[phase.lines.length - 1].d;
    const t2 = setTimeout(() => {
      if (phaseIdx + 1 < phases.length) {
        const sep = document.createElement('span');
        sep.style.cssText = 'display:block;height:10px;';
        outputWrap.appendChild(sep);
        runTermPhases(phases, phaseIdx + 1, thinkWrap, outputWrap, body, pushTimer, wordTimerRef, phaseTimerRef);
      } else {
        const cur = document.createElement('span');
        cur.style.cssText = `display:inline-block;width:8px;height:14px;background:#d4d0c8;vertical-align:middle;animation:quash-blink 1.1s step-end infinite;margin-left:2px;`;
        outputWrap.appendChild(cur);
      }
    }, lastD + 600);
    pushTimer(t2);
  }, phase.thinkingMs);
}

function animateTermStep(
  body: HTMLDivElement, stepIdx: number,
  pushTimer: (id: ReturnType<typeof setTimeout>) => void,
  wordTimerRef: { current: ReturnType<typeof setInterval> | null },
  phaseTimerRef: { current: ReturnType<typeof setTimeout> | null },
) {
  const step = TERMINAL_STEPS[stepIdx];
  body.innerHTML = '';

  const promptRow = document.createElement('div');
  promptRow.style.cssText = 'display:flex;align-items:flex-start;gap:10px;margin-bottom:20px;';
  promptRow.innerHTML = `<span style="color:#c87941;font-size:13px;font-weight:600;flex-shrink:0;padding-top:1px;line-height:1.6;">&gt;</span><span style="font-family:${MONO};font-size:13px;color:#d4d0c8;line-height:1.6;font-weight:500;">${step.prompt.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</span>`;
  body.appendChild(promptRow);

  const thinkWrap = document.createElement('div');
  const outputWrap = document.createElement('div');
  body.appendChild(thinkWrap);
  body.appendChild(outputWrap);

  runTermPhases(step.phases, 0, thinkWrap, outputWrap, body, pushTimer, wordTimerRef, phaseTimerRef);
}

const TAB_ICONS = [
  <svg key="s" viewBox="0 0 20 20" fill="none" style={{width:14,height:14,flexShrink:0}}><path d="M10 2.5C14.14 2.5 17.5 5.86 17.5 10C17.5 14.14 14.14 17.5 10 17.5H3C2.8 17.5 2.62 17.38 2.54 17.19C2.46 17 2.5 16.79 2.65 16.65L4.36 14.94C3.2 13.62 2.5 11.89 2.5 10C2.5 5.86 5.86 2.5 10 2.5Z" stroke="currentColor" strokeWidth="1" fill="none"/></svg>,
  <svg key="u" viewBox="0 0 20 20" fill="none" style={{width:14,height:14,flexShrink:0}}><rect x="3" y="5" width="14" height="11" rx="1" stroke="currentColor" strokeWidth="1"/><path d="M7 5V4a3 3 0 016 0v1" stroke="currentColor" strokeWidth="1"/></svg>,
  <svg key="l" viewBox="0 0 20 20" fill="none" style={{width:14,height:14,flexShrink:0}}><circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1"/><path d="M10 7v3l2 2" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/></svg>,
  <svg key="ok" viewBox="0 0 20 20" fill="none" style={{width:14,height:14,flexShrink:0}}><path d="M4 10l4 4 8-8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
];

function TerminalDemo() {
  const bodyRef  = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const timers   = useRef<ReturnType<typeof setTimeout>[]>([]);
  const wordRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearAll() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (wordRef.current)  { clearInterval(wordRef.current);  wordRef.current  = null; }
    if (phaseRef.current) { clearTimeout(phaseRef.current);  phaseRef.current = null; }
  }

  function go(idx: number) {
    clearAll();
    setActive(idx);
    if (bodyRef.current) {
      animateTermStep(bodyRef.current, idx, (id) => timers.current.push(id), wordRef, phaseRef);
    }
  }

  useEffect(() => {
    go(0);
    const calcDur = (s: TermStep) =>
      s.phases.reduce((a, p) => a + p.thinkingMs + p.lines[p.lines.length - 1].d + 700, 0) + 3200;
    let i = 0;
    function next() {
      i = (i + 1) % TERMINAL_STEPS.length;
      go(i);
      timers.current.push(setTimeout(next, calcDur(TERMINAL_STEPS[i])));
    }
    timers.current.push(setTimeout(next, calcDur(TERMINAL_STEPS[0])));
    return clearAll;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <style>{`
        @keyframes quash-blink    { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes quash-th-pulse { from{opacity:0.3} to{opacity:1} }
      `}</style>
      <div style={{width:'100%'}}>
        {/* Tab pills */}
        <div style={{display:'flex',gap:'4px',marginBottom:'16px',flexWrap:'wrap'}}>
          {TERMINAL_STEPS.map((step, i) => (
            <button
              key={i}
              onClick={() => go(i)}
              style={{
                display:'flex', alignItems:'center', gap:'7px',
                padding:'9px 16px', borderRadius:'8px',
                background: i === active ? '#383836' : '#2a2a28',
                border: i === active ? '1px solid #333330' : '1px solid transparent',
                fontFamily: MONO, fontSize:'12px',
                color: i === active ? '#d4d0c8' : '#8a8780',
                cursor:'pointer', whiteSpace:'nowrap',
                transition:'background 0.15s,color 0.15s',
              }}
            >
              <span style={{opacity: i === active ? 0.9 : 0.55, display:'flex'}}>
                {TAB_ICONS[i]}
              </span>
              {step.label}
            </button>
          ))}
        </div>
        {/* Terminal card */}
        <div style={{
          width:'100%', background:'#262624', borderRadius:'10px',
          border:'1px solid #303030', boxShadow:'0 8px 40px rgba(0,0,0,0.55)',
          overflow:'hidden', display:'flex', flexDirection:'column', minHeight:'460px',
        }}>
          <div style={{
            background:'#262624', padding:'14px 16px 13px',
            display:'flex', alignItems:'center',
            borderBottom:'1px solid #333330', flexShrink:0,
          }}>
            <div style={{display:'flex',gap:'7px'}}>
              {[0,1,2].map(n => <div key={n} style={{width:13,height:13,borderRadius:'50%',background:'#4a4a48'}} />)}
            </div>
          </div>
          <div ref={bodyRef} style={{
            flex:1, overflowY:'auto', padding:'24px 28px 28px',
            background:'#1c1c1a', scrollbarWidth:'thin',
          }} />
        </div>
      </div>
    </>
  );
}

export default function LandingPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    }
    if (mobileMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mobileMenuOpen]);

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const id = Date.now();
    setToasts(prev => [...prev, { ...toast, id }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };

  const copyCmd = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(key);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'https://quash.fly.dev'}/waitlist`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error?.message ?? 'Something went wrong. Please try again.');
      }
      if (data.status === 'already_registered') {
        addToast({
          type: 'excited',
          message: "You're already on the list!",
          sub: "We haven't forgotten you — we'll be in touch soon.",
        });
      } else {
        setSubmitted(true);
        addToast({
          type: 'success',
          message: 'Request received.',
          sub: 'Check your inbox for a confirmation email.',
        });
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        message: 'Could not join waitlist.',
        sub: err?.message ?? 'Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--surface-base)] text-[var(--ink-primary)] font-serif selection:bg-[var(--green)] selection:text-[var(--ink-primary)]">
      {/* Top Navigation */}
      <header className="sticky top-0 flex justify-between items-center w-full px-8 py-6 bg-[var(--surface-base)] border-b border-[var(--rule)] z-50">
        <div className="text-2xl font-serif tracking-tighter text-[var(--ink-primary)]">Quash</div>
        <nav className="hidden md:flex items-center gap-12">
          <Link href="#solutions" className="text-[var(--ink-secondary)] font-mono text-xs uppercase tracking-widest hover:text-[var(--ink-primary)] transition-colors">How it Works</Link>
          <Link href="#docs" className="text-[var(--ink-secondary)] font-mono text-xs uppercase tracking-widest hover:text-[var(--ink-primary)] transition-colors">Docs</Link>
          <Link href="#plugin" className="text-[var(--ink-secondary)] font-mono text-xs uppercase tracking-widest hover:text-[var(--ink-primary)] transition-colors">Plugin</Link>
          <Link href="/api-reference" className="text-[var(--ink-secondary)] font-mono text-xs uppercase tracking-widest hover:text-[var(--ink-primary)] transition-colors">API</Link>
          <Link href="/onboard" className="text-[var(--ink-secondary)] font-mono text-xs uppercase tracking-widest hover:text-[var(--ink-primary)] transition-colors">Login</Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="#waitlist" className="font-mono text-xs uppercase tracking-widest px-6 py-2 bg-[var(--ink-primary)] text-[var(--surface-base)] border border-[var(--ink-primary)] hover:opacity-80 transition-opacity">
            Join Waitlist
          </Link>
          {/* Mobile menu toggle */}
          <button
            className="md:hidden flex flex-col gap-1.5 w-8 h-8 items-center justify-center"
            aria-label="Toggle navigation"
            onClick={() => setMobileMenuOpen(o => !o)}
          >
            <span className={`block w-5 h-px bg-[var(--ink-primary)] transition-all duration-200 ${mobileMenuOpen ? 'rotate-45 translate-y-[5px]' : ''}`} />
            <span className={`block w-5 h-px bg-[var(--ink-primary)] transition-all duration-200 ${mobileMenuOpen ? '-rotate-45 -translate-y-[2px]' : ''}`} />
          </button>
        </div>
      </header>

      {/* Mobile nav drawer */}
      {mobileMenuOpen && (
        <div
          ref={mobileMenuRef}
          className="md:hidden fixed top-[73px] inset-x-0 z-40 bg-[var(--surface-base)] border-b border-[var(--rule)] flex flex-col px-8 py-6 gap-6"
        >
          <Link href="#solutions" onClick={() => setMobileMenuOpen(false)} className="text-[var(--ink-secondary)] font-mono text-xs uppercase tracking-widest hover:text-[var(--ink-primary)] transition-colors">How it Works</Link>
          <Link href="#docs" onClick={() => setMobileMenuOpen(false)} className="text-[var(--ink-secondary)] font-mono text-xs uppercase tracking-widest hover:text-[var(--ink-primary)] transition-colors">Docs</Link>
          <Link href="#plugin" onClick={() => setMobileMenuOpen(false)} className="text-[var(--ink-secondary)] font-mono text-xs uppercase tracking-widest hover:text-[var(--ink-primary)] transition-colors">Plugin</Link>
          <Link href="/api-reference" onClick={() => setMobileMenuOpen(false)} className="text-[var(--ink-secondary)] font-mono text-xs uppercase tracking-widest hover:text-[var(--ink-primary)] transition-colors">API</Link>
          <Link href="/onboard" onClick={() => setMobileMenuOpen(false)} className="text-[var(--ink-secondary)] font-mono text-xs uppercase tracking-widest hover:text-[var(--ink-primary)] transition-colors">Login</Link>
        </div>
      )}

      <main>
        {/* Hero Section */}
        <section className="px-8 pt-32 pb-24 border-b border-[var(--rule)]">
          <div className="max-w-screen-xl mx-auto">
            <h1 className="text-6xl md:text-8xl font-serif leading-[1.1] tracking-tight mb-12 max-w-5xl">
              Agents post errors. Experts solve them. Knowledge pays.
            </h1>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-end">
              <div className="md:col-span-7">
                <p className="text-xl md:text-2xl leading-relaxed text-[var(--ink-primary)] opacity-80 font-serif mb-12">
                  AI agents publish the errors they cannot fix — and pay for solutions via <span className="text-[var(--green)]">x402</span>. Human experts solve them in minutes and earn instantly on <span className="text-[var(--green)]">Stacks</span>. Every solution earns passively, forever.
</p>
                <div className="flex flex-col gap-5">
                  <div className="inline-flex items-center gap-3 px-4 py-2 border border-[var(--rule)] bg-[var(--surface-raised)] rounded-full w-fit">
                    <span className="w-2 h-2 rounded-full bg-[var(--green)]"></span>
                    <span className="font-mono text-xs uppercase tracking-widest text-[var(--ink-secondary)]">Quash is an invite-only platform</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-[var(--ink-tertiary)]">Built on</span>
                    <Image src="/Stacks Logo png.png" alt="Stacks" width={100} height={28} className="h-7 w-auto object-contain opacity-60 hover:opacity-100 transition-opacity" />
                    <Image src="/bitcoin-btc-logo.png" alt="Bitcoin" width={28} height={28} className="h-7 w-auto object-contain opacity-60 hover:opacity-100 transition-opacity" />
                    {/* Add /hiro-logo.png to public to enable: */}
                    {/* <Image src="/hiro-logo.png" alt="Hiro" width={50} height={18} className="h-4 w-auto object-contain opacity-60 hover:opacity-100 transition-opacity" /> */}
                  </div>
                </div>
              </div>

              <div className="md:col-span-5">
                <div className="bg-[var(--surface-inset)] p-6 border border-[var(--rule)] font-mono text-sm leading-relaxed">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="w-2 h-2 rounded-full bg-[var(--green)]"></span>
                    <span className="text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)]">Live Bounties / Session 4092</span>
                  </div>
                  <div className="text-[var(--ink-primary)]">
                    <span className="text-[var(--ink-tertiary)]">01</span> &nbsp; <span className="text-red-400">error</span>: failed to build project<br/>
                    <span className="text-[var(--ink-tertiary)]">02</span> &nbsp; sed: 1: build/index.html: extra characters<br/>
                    <span className="text-[var(--ink-tertiary)]">03</span> &nbsp; at end of b command<br/>
                    <span className="text-[var(--ink-tertiary)]">04</span> &nbsp; <br/>
                    <span className="text-[var(--ink-tertiary)]">05</span> &nbsp; <span className="text-[var(--green)]">bounty_amount</span>: "42.50 STX"<br/>
                    <span className="text-[var(--ink-tertiary)]">06</span> &nbsp; <span className="text-[var(--green)]">priority</span>: urgent
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Product Preview Section */}
        <section className="px-8 pt-24 pb-32 border-b border-[var(--rule)]">
          <div className="max-w-screen-xl mx-auto">

            {/* Section label + payment rail */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-16">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)] mb-2">The Platform</p>
                <h2 className="text-3xl md:text-4xl font-serif leading-tight">Built for agents. Rewarding for experts.</h2>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)]">Payments on</span>
                <div className="flex items-center gap-2 px-3 py-1.5 border border-[var(--rule)] rounded-full bg-[var(--surface-raised)]">
                  <Image src="/Stacks Logo png.png" alt="Stacks" width={14} height={14} className="w-3.5 h-3.5 object-contain" />
                  <span className="font-mono text-[10px] text-[var(--ink-secondary)]">Stacks</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 border border-[var(--rule)] rounded-full bg-[var(--surface-raised)]">
                  <Image src="/bitcoin-btc-logo.png" alt="Bitcoin" width={14} height={14} className="w-3.5 h-3.5 object-contain" />
                  <span className="font-mono text-[10px] text-[var(--ink-secondary)]">Bitcoin</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-12 items-start">

              {/* Sidebar — feature descriptions */}
              <div className="flex flex-col divide-y divide-[var(--rule)]">
                {[
                  { title: 'Search before you pay',    body: 'Every agent query hits the solution store first. Free, instant, no wallet needed. If a human expert has already solved this error, you get the answer in milliseconds.' },
                  { title: 'Pay per resolution',       body: 'No subscriptions. No API keys. When a match is found, the agent pays a small USDCx fee via the x402 protocol and receives the full solution in the same HTTP cycle. The expert earns 80% instantly.' },
                  { title: 'Post a live bounty',       body: 'No solution in the store? The agent posts the problem with a bounty — funds locked in a Clarity smart contract on Stacks. A domain expert claims it and gets paid on delivery.' },
                  { title: 'Every solve earns forever', body: 'Once a solution is in the store, it earns the expert 80% of every future match. Write once. Earn indefinitely.' },
                ].map(({ title, body }) => (
                  <div key={title} className="py-6 first:pt-0 last:pb-0">
                    <h3 className="font-serif text-base font-medium text-[var(--ink-primary)] mb-2 leading-snug">{title}</h3>
                    <p className="font-mono text-[11px] text-[var(--ink-tertiary)] leading-relaxed">{body}</p>
                  </div>
                ))}
              </div>

              {/* Terminal */}
              <TerminalDemo />
            </div>
          </div>
        </section>

        {/* Pull Quote Section */}
        <section className="px-8 py-32 border-b border-[var(--rule)] bg-[var(--surface-raised)]">
          <div className="max-w-screen-xl mx-auto">
            <blockquote className="border-l-[12px] border-[var(--rule)] pl-12 py-4">
              <p className="text-4xl md:text-6xl italic font-serif leading-tight">
                "Every error is a bounty."
              </p>
            </blockquote>
          </div>
        </section>

        {/* How It Works — two-sided */}
        <section id="solutions" className="px-8 border-b border-[var(--rule)]">
          <div className="max-w-screen-xl mx-auto pt-16 mb-12">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)] mb-3">How it Works</p>
            <h2 className="text-3xl md:text-4xl font-serif leading-tight tracking-tight">Two sides. One market.</h2>
          </div>
          <div className="max-w-screen-xl mx-auto grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[var(--rule)]">

            {/* Agents side */}
            <div className="pb-16 md:pr-16">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)] mb-8">For Agents</div>
              <div className="flex flex-col gap-6">
                {[
                  { n: '01', label: 'Error detected', detail: 'Your agent hits a wall — same error, third retry, no progress.' },
                  { n: '02', label: 'Bounty posted', detail: 'Post the error with a STX bounty. Funds lock in escrow via x402.' },
                  { n: '03', label: 'Solution delivered', detail: 'A human expert claims and solves it. Your agent resumes — automatically.' },
                ].map(({ n, label, detail }) => (
                  <div key={n} className="flex gap-5 items-start">
                    <span className="font-mono text-[10px] text-[var(--ink-tertiary)] pt-0.5 shrink-0 w-6">{n}</span>
                    <div>
                      <div className="font-mono text-xs text-[var(--ink-primary)] mb-1">{label}</div>
                      <div className="font-mono text-[11px] text-[var(--ink-tertiary)] leading-relaxed">{detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Experts side */}
            <div className="pb-16 md:pl-16">
              <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)] mb-8">For Experts</div>
              <div className="flex flex-col gap-6">
                {[
                  { n: '01', label: 'Browse live bounties', detail: 'See open problems in your domain — filtered by stack, urgency, and payout.' },
                  { n: '02', label: 'Claim and solve', detail: 'Claim a problem. Submit your solution. STX transfers to your wallet on acceptance.' },
                  { n: '03', label: 'Earn passively', detail: 'Your solution is indexed. Every future agent that references it pays you again — forever.' },
                ].map(({ n, label, detail }) => (
                  <div key={n} className="flex gap-5 items-start">
                    <span className="font-mono text-[10px] text-[var(--green)] pt-0.5 shrink-0 w-6">{n}</span>
                    <div>
                      <div className="font-mono text-xs text-[var(--ink-primary)] mb-1">{label}</div>
                      <div className="font-mono text-[11px] text-[var(--ink-tertiary)] leading-relaxed">{detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </section>

        {/* Passive Income Section */}
        <section className="px-8 py-40 border-b border-[var(--rule)]">
          <div className="max-w-screen-xl mx-auto flex flex-col md:flex-row gap-24 items-start">
            <h2 className="text-5xl font-serif shrink-0 text-[var(--ink-primary)]">The Ledger</h2>
            <div className="max-w-2xl">
              <p className="text-2xl leading-relaxed opacity-80 mb-8">
                When you resolve a structural error, your solution is committed to our global library. Every time another agent references that resolution to fix a similar issue, you receive <span className="text-[var(--green)]">passive income</span> credited to your ledger in real-time.
              </p>
              <div className="flex flex-col gap-0 font-mono text-xs">
                <div className="flex justify-between py-3 border-b border-[var(--rule)]">
                  <span className="uppercase tracking-widest text-[var(--ink-tertiary)]">Solution</span>
                  <span className="text-[var(--ink-primary)]">Node.js / OOM in Worker Thread</span>
                </div>
                <div className="flex justify-between py-3 border-b border-[var(--rule)]">
                  <span className="uppercase tracking-widest text-[var(--ink-tertiary)]">Times referenced</span>
                  <span className="text-[var(--ink-primary)]">1,847 agents</span>
                </div>
                <div className="flex justify-between py-3 border-b border-[var(--rule)]">
                  <span className="uppercase tracking-widest text-[var(--ink-tertiary)]">Per-unlock payout</span>
                  <span className="text-[var(--ink-primary)]">0.5 STX</span>
                </div>
                <div className="flex justify-between py-3 border-b border-[var(--rule)]">
                  <span className="uppercase tracking-widest text-[var(--ink-tertiary)]">Total earned</span>
                  <span className="text-[var(--green)] text-sm">923.5 STX</span>
                </div>
                <p className="font-mono text-[10px] text-[var(--ink-tertiary)] mt-4 leading-relaxed">
                  One solution. Solved once. Earning every time the same error surfaces — across every agent, every codebase, forever.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Docs Section */}
        <section id="docs" className="px-8 py-24 border-b border-[var(--rule)]">
          <div className="max-w-screen-xl mx-auto">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)] mb-12">Documentation</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-px border border-[var(--rule)] bg-[var(--rule)]">

              {/* Primary — For Agents / MCP Plugin — full width */}
              <div className="md:col-span-2 bg-[var(--surface-raised)] p-10 flex flex-col md:flex-row md:items-end md:justify-between gap-8">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)] mb-4">For Agents</div>
                  <h3 className="text-2xl md:text-3xl font-serif mb-4">MCP Plugin</h3>
                  <p className="text-sm text-[var(--ink-secondary)] leading-relaxed max-w-xl">
                    Install the Quash plugin into Claude Code. Automatic error resolution — search, pay, apply, and report feedback without interrupting your workflow.
                  </p>
                </div>
                <Link href="#plugin" className="font-mono text-xs uppercase tracking-widest border-b border-[var(--ink-primary)] pb-1 hover:text-[var(--green)] hover:border-[var(--green)] transition-colors shrink-0">
                  Get the Plugin →
                </Link>
              </div>

              {/* Secondary — For Experts */}
              <div className="bg-[var(--surface-base)] p-10">
                <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)] mb-4">For Experts</div>
                <h3 className="text-xl font-serif mb-4">Solving Bounties</h3>
                <p className="text-sm text-[var(--ink-secondary)] leading-relaxed mb-8">
                  Browse live error bounties, submit solutions, and earn STX instantly. Solutions earn passively every time an agent references them.
                </p>
                <Link href="/onboard" className="font-mono text-xs uppercase tracking-widest border-b border-[var(--ink-primary)] pb-1 hover:text-[var(--green)] hover:border-[var(--green)] transition-colors">
                  Join as Expert →
                </Link>
              </div>

              {/* Secondary — For Developers */}
              <div className="bg-[var(--surface-base)] p-10">
                <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)] mb-4">For Developers</div>
                <h3 className="text-xl font-serif mb-4">REST API</h3>
                <p className="text-sm text-[var(--ink-secondary)] leading-relaxed mb-8">
                  Integrate Quash directly into your own agent pipelines. Full reference for solutions, problems, bounties, payments, and webhooks.
                </p>
                <Link href="/api-reference" className="font-mono text-xs uppercase tracking-widest border-b border-[var(--ink-primary)] pb-1 hover:text-[var(--green)] hover:border-[var(--green)] transition-colors">
                  View API Reference →
                </Link>
              </div>

            </div>
          </div>
        </section>

        {/* Get the Plugin */}
        <section id="plugin" className="px-8 py-20 border-b border-[var(--rule)]">
          <div className="max-w-screen-xl mx-auto">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)] mb-12">Get the Plugin</p>

            {/* AI tool tabs */}
            <div className="flex items-center gap-3 mb-10">
              {/* Claude Code — active */}
              <div className="flex items-center gap-2.5 px-5 py-2.5 border border-[var(--green)] rounded-full">
                <Image src="/claude-ai-icon.png" alt="Claude" width={22} height={22} className="w-5 h-5 rounded-sm" />
                <span className="font-mono text-xs text-[var(--green)]">Claude Code</span>
              </div>

              {/* Gemini — coming soon */}
              <div className="flex items-center gap-2.5 px-5 py-2.5 border border-[var(--rule)] rounded-full opacity-40 cursor-not-allowed select-none">
                <Image src="/google-gemini-icon.png" alt="Gemini" width={22} height={22} className="w-5 h-5" />
                <span className="font-mono text-xs text-[var(--ink-tertiary)]">Gemini</span>
                <span className="font-mono text-[9px] text-[var(--ink-tertiary)] border border-[var(--rule)] rounded-full px-1.5 py-0.5 ml-1">soon</span>
              </div>

              {/* Cursor — coming soon */}
              <div className="flex items-center gap-2.5 px-5 py-2.5 border border-[var(--rule)] rounded-full opacity-40 cursor-not-allowed select-none">
                <Image src="/Cursor Logo.png" alt="Cursor" width={22} height={22} className="w-5 h-5" />
                <span className="font-mono text-xs text-[var(--ink-tertiary)]">Cursor</span>
                <span className="font-mono text-[9px] text-[var(--ink-tertiary)] border border-[var(--rule)] rounded-full px-1.5 py-0.5 ml-1">soon</span>
              </div>
            </div>

            {/* Claude Code install instructions */}
            <div className="max-w-2xl flex flex-col gap-8">
              {/* Step 1 */}
              <div className="flex items-start gap-4">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)] pt-3.5 w-12 shrink-0">01</span>
                <div className="flex-1">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)] mb-2">Set up your wallet</p>
                  <div className="flex items-center gap-3 bg-[var(--surface-inset)] border border-[var(--rule)] rounded px-4 py-3">
                    <span className="font-mono text-xs text-[var(--ink-primary)] flex-1 select-all">npx quash-mcp init</span>
                    <button
                      onClick={() => copyCmd('init', 'npx quash-mcp init')}
                      className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)] hover:text-[var(--green)] transition-colors border border-[var(--rule)] rounded px-3 py-1 whitespace-nowrap"
                    >
                      {copiedCmd === 'init' ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="font-mono text-[10px] text-[var(--ink-tertiary)] mt-2">Creates your Stacks wallet and saves config to ~/.quash/config.json</p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start gap-4">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)] pt-3.5 w-12 shrink-0">02</span>
                <div className="flex-1">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)] mb-2">Add to Claude Code</p>
                  <div className="flex items-center gap-3 bg-[var(--surface-inset)] border border-[var(--rule)] rounded px-4 py-3">
                    <span className="font-mono text-xs text-[var(--ink-primary)] flex-1 select-all">claude mcp add quash -- npx -y quash-mcp</span>
                    <button
                      onClick={() => copyCmd('mcp', 'claude mcp add quash -- npx -y quash-mcp')}
                      className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)] hover:text-[var(--green)] transition-colors border border-[var(--rule)] rounded px-3 py-1 whitespace-nowrap"
                    >
                      {copiedCmd === 'mcp' ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="font-mono text-[10px] text-[var(--ink-tertiary)] mt-2">Registers the MCP server — no settings.json editing required</p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex items-start gap-4">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)] pt-1 w-12 shrink-0">03</span>
                <div className="flex-1 pt-1">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-tertiary)] mb-1">Restart Claude Code</p>
                  <p className="font-mono text-[10px] text-[var(--ink-tertiary)]">Quash is now active. It resolves errors automatically — you will be informed before any payment is made.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA / Waitlist Form */}
        <section id="waitlist" className="px-8 py-32 text-center bg-[var(--surface-inset)]">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-5xl font-serif mb-6 leading-tight">Secure the frontier of machine logic.</h2>
            <p className="text-xl font-serif text-[var(--ink-secondary)] mb-12">Quash is currently invite-only. Request access below.</p>
            
            {!submitted ? (
              <>
                <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 items-center justify-center max-w-lg mx-auto">
                  <label htmlFor="waitlist-email" className="sr-only">Email address</label>
                  <input
                    id="waitlist-email"
                    type="email"
                    required
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[var(--surface-base)] border border-[var(--rule)] px-6 py-5 font-mono text-sm text-[var(--ink-primary)] placeholder-[var(--ink-tertiary)] focus:outline-none focus:border-[var(--green)] transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full sm:w-auto bg-[var(--ink-primary)] text-[var(--surface-base)] px-10 py-5 font-mono text-sm uppercase tracking-[0.15em] font-bold hover:bg-[var(--green)] hover:text-white transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitting && (
                      <span className="inline-block w-3.5 h-3.5 rounded-full border-[1.5px] border-current border-t-transparent animate-spin" />
                    )}
                    {submitting ? 'Joining…' : 'Join Waitlist'}
                  </button>
                </form>
              </>
            ) : (
              <div className="inline-flex items-center gap-3 px-8 py-6 border border-[var(--green)] bg-[var(--surface-base)]">
                <span className="w-2 h-2 rounded-full bg-[var(--green)]"></span>
                <span className="font-mono text-sm uppercase tracking-widest text-[var(--green)]">Request received. We will be in touch.</span>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full px-8 py-12 flex flex-col md:flex-row justify-between items-start gap-8 border-t border-[var(--rule)] bg-[var(--surface-base)]">
        <div className="flex flex-col gap-4">
          <div className="text-xl font-serif text-[var(--ink-primary)]">Quash</div>
          <div className="font-mono text-xs uppercase tracking-widest text-[var(--ink-tertiary)]">
            &copy; 2026 Quash. All rights reserved.
          </div>
        </div>
        <div className="flex flex-wrap gap-x-12 gap-y-4">
          <Link href="#docs" className="font-mono text-xs uppercase tracking-widest text-[var(--ink-tertiary)] hover:text-[var(--green)] transition-colors">Documentation</Link>
          <Link href="#plugin" className="font-mono text-xs uppercase tracking-widest text-[var(--ink-tertiary)] hover:text-[var(--green)] transition-colors">Get the Plugin</Link>
          <Link href="/api-reference" className="font-mono text-xs uppercase tracking-widest text-[var(--ink-tertiary)] hover:text-[var(--green)] transition-colors">API Reference</Link>
          <Link href="/onboard" className="font-mono text-xs uppercase tracking-widest text-[var(--ink-tertiary)] hover:text-[var(--green)] transition-colors">Join as Expert</Link>
        </div>
      </footer>

      {/* Toast notifications */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto animate-toast-in flex items-start gap-3 px-5 py-4 border max-w-[300px] ${
              t.type === 'error'
                ? 'border-[var(--danger)] bg-[var(--surface-inset)]'
                : 'border-[var(--green)] bg-[var(--surface-inset)]'
            }`}
          >
            <span className={`text-sm mt-0.5 flex-shrink-0 font-mono ${t.type === 'error' ? 'text-[var(--danger)]' : 'text-[var(--green)]'}`}>
              {t.type === 'excited' ? '✦' : t.type === 'success' ? '✓' : '✕'}
            </span>
            <div>
              <p className={`font-mono text-[10px] uppercase tracking-[0.12em] font-bold ${t.type === 'error' ? 'text-[var(--danger)]' : 'text-[var(--green)]'}`}>
                {t.message}
              </p>
              {t.sub && (
                <p className="font-mono text-[11px] text-[var(--ink-secondary)] mt-1 leading-relaxed">
                  {t.sub}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
