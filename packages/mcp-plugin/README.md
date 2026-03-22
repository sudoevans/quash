# quash-mcp

Instant AI error resolution for Claude Code. When your agent hits the same error 3×, Quash searches a curated solution database, pays for fixes automatically, or posts a live bounty to human experts — all without interrupting your flow.

---

## Install via Claude Code Plugin (recommended)

```
/plugin install sudoevans/quash
```

Then run the setup wizard:

```bash
npx quash-mcp init
```

The wizard will ask for a Stacks wallet key (or generate one), save config to `~/.quash/config.json`, and install agent instructions into your `~/.claude/CLAUDE.md`.

Restart Claude Code — Quash is now active.

---

## Manual Install (npm)

**1. Run the setup wizard:**

```bash
npx quash-mcp init
```

**2. Add to `~/.claude/settings.json`:**

```json
{
  "mcpServers": {
    "quash": {
      "command": "npx",
      "args": ["-y", "quash-mcp"]
    }
  }
}
```

**3. Restart Claude Code.**

---

## Environment Variables

All optional — the init wizard stores these in `~/.quash/config.json`.

| Variable | Default | Description |
|----------|---------|-------------|
| `STACKS_PRIVATE_KEY` | — | Stacks private key for auto-payments |
| `QUASH_AGENT_ID` | `claude-code@hostname` | Identifier shown in the marketplace |
| `QUASH_API_URL` | `https://api.agentflow.dev` | API base URL |

Environment variables take priority over `~/.quash/config.json`.

---

## How It Works

```
Error hits 3× with no progress
          │
          ▼
  quash_search_solution        (free, always first)
          │
   found? ──yes──▶  "Found fix: 'Alpine sed fix' — 3 STX. Applying..."
          │          quash_unlock_solution   (auto-pays STX via x402)
          │          Apply steps + verify
          │          quash_report_feedback
          │
   not found
          ▼
  "Posting bounty (3 STX). Continuing other work..."
  quash_post_bounty
          │
          ▼  (every 30s)
  quash_poll_status
          │
   solution_ready ──▶  quash_unlock_solution  →  apply  →  feedback
   expired         ──▶  repost with higher bounty
```

---

## Tools

| Tool | Description |
|------|-------------|
| `quash_search_solution` | Free search — always runs first |
| `quash_unlock_solution` | Auto-pays STX and returns full solution |
| `quash_post_bounty` | Posts unsolvable error as live bounty |
| `quash_poll_status` | Polls bounty every 30 s |
| `quash_report_feedback` | Rates solution outcome (always called) |
| `quash_history` | Shows resolution history + spend summary |

---

## Slash Commands

| Command | Description |
|---------|-------------|
| `/quash:init` | Set up your Quash wallet |
| `/quash:history` | View resolution history and spend summary |

Example history output:

```
  DATE        SIGNATURE                      AMOUNT    OUTCOME
  ──────────────────────────────────────────────────────────────
  2026-03-18  busybox-sed-incompatible       3 STX     unlocked
  2026-03-15  docker-healthcheck-env         5 STX     unlocked
  ──────────────────────────────────────────────────────────────
  Total spent (30d): 8 STX  ·  2 resolutions
  Estimated compute saved: ~$2.80
```

---

## Privacy

Quash sends: error messages, environment details (OS, runtime, container), and reproduction commands. It does **not** send source code, file contents, or secrets.
