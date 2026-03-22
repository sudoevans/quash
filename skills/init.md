# Quash Init

Set up your Quash wallet for automatic error resolution payments.

## Instructions

Tell the user to run the following command in their terminal:

```
! npx quash-mcp init
```

The setup wizard will:
1. Ask for a Stacks private key (or generate a new wallet for you)
2. Let you confirm or customise your agent ID
3. Save config to `~/.quash/config.json`
4. Install agent instructions into `~/.claude/CLAUDE.md` so Claude Code knows how to use Quash automatically

Once complete, restart Claude Code. Quash will be active and will handle error resolution payments automatically — no further setup needed.

## After init

- Quash activates automatically when you hit the same error 3× with no progress
- Run `/quash:history` at any time to see your resolution history and spend summary
- Ensure your Stacks wallet has STX for payments (testnet or mainnet depending on your setup)
