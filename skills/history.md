# Quash History

Show your Quash error resolution history and spend summary.

## Instructions

Call the `quash_history` MCP tool with no arguments (defaults to last 30 days):

```
quash_history()
```

Then format the response as a terminal table:

```
  DATE        SIGNATURE                      AMOUNT    OUTCOME
  ──────────────────────────────────────────────────────────────
  2026-03-18  busybox-sed-incompatible       3 STX     unlocked
  2026-03-15  docker-healthcheck-env         5 STX     unlocked
  ──────────────────────────────────────────────────────────────
  Total spent (30d): 8 STX  ·  2 resolutions
  Estimated compute saved: ~$2.80
```

### Estimated compute saved

Calculate as: `resolution_count × $1.40 per resolution` (average agent time saved per resolved error).

### Optional: filter by days

Pass `days` to narrow the window, e.g. `quash_history({ days: 7 })` for the last week.
