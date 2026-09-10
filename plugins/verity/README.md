# Verity — independent verification for coding agents

**Oversee the agents you're not watching.**

When your agent stops, a model *that didn't write the code* judges the change against
your team's standard — quality, security, and whether it did what was actually asked.
It passes, or it's blocked with file-and-line findings, and the agent self-heals.

It runs out-of-band in its own context window, so it never spends your agent's tokens.

```
/plugin marketplace add codacy/verity
/plugin install verity@verity
```

Then, in your project:

```
/verity:setup
```

*Free in beta · no credit card · macOS only for now*

---

## Skills

Eight, namespaced under `/verity:`.

| Skill | What it does |
|---|---|
| `/verity:setup` | Configure Verity here: Standard, analysis tools, login |
| `/verity:analyze` | Review the current change on demand — a second opinion, any time |
| `/verity:status` | Standard version, last run, quality trend, pending items |
| `/verity:learn` | What Verity has learned about this project |
| `/verity:memory` | Browse and extend the project knowledge graph |
| `/verity:reflect` | Capture a learning at the end of a task |
| `/verity:insights` | Quality metrics and Standard evolution suggestions |
| `/verity:feedback` | Send feedback to the Verity team |

`analyze`, `status`, `learn`, `memory` and `reflect` are also offered to Claude
directly, so it can reach for them without being asked. `setup`, `insights` and
`feedback` are yours alone — they have side effects you should time yourself, and
Claude is never offered them.

The whole plugin adds about 500 tokens to a session. Check for yourself with
`claude plugin details verity`.

## What runs on your machine, and when

Six hooks, all running the Verity CLI locally.

| Hook | Runs |
|---|---|
| `SessionStart` | Snapshots the working tree, so the review can tell your changes from what was already there |
| `UserPromptSubmit` | Records the task you asked for, so the review can judge against your intent |
| `PreToolUse` (Bash) | The git-moment gate. **Off by default** — see below |
| `Stop` | **The review.** Analyzes what changed this turn |
| `PostCompact` | Restores what the conversation lost to compaction |
| `SessionEnd` | Preserves continuity across `/clear` |

### The git-moment gate

Verity can also review at `git commit` and `git push`, blocking the command if the
change fails. **It gates nothing until you ask it to** — a gate that blocks commits
on an install that never requested it is worse than no gate.

`/verity:setup` asks. Or set it directly:

```bash
verity config git-moments commit,push   # or: commit · push · none
verity config git-moments               # read it back
```

## Until you run setup

The plugin works anonymously on install, and a project that has never been set up is
left alone entirely — no state written, nothing reviewed. Claude is told, so it can
offer to run `/verity:setup` for you.

Once set up but not logged in, the gate runs locally and reports findings; nothing is
uploaded and no history is kept.

## Your code is never stored

The diff is analyzed in memory and deleted. Only metadata persists: findings, gate
decisions, run history, and the project knowledge you can read yourself at any time
with `/verity:learn`. Tokens are SHA-256 hashed; every project is row-level isolated.

## The CLI

The plugin carries [`@codacy/verity-cli`](https://www.npmjs.com/package/@codacy/verity-cli)
as a pinned dependency, so **you don't need to install anything else**. Claude Code
installs it when you install the plugin and reinstalls it whenever the plugin updates.

A global install still works and is what you want for CI, where there is no plugin:

```bash
npm install -g @codacy/verity-cli && verity init
```

If you have both, the plugin's pinned copy is the one the hooks use, and the plugin
owns the wiring — `verity init` will detect it and remove any duplicate hooks, so a
turn is never reviewed twice.

### Staying up to date

Claude Code disables auto-update for third-party marketplaces by default. Turn it on
in `/plugin` → **Marketplaces** → `codacy` → **Enable auto-update**, or:

```
/plugin update verity@verity
```

### If the gate goes quiet

The hooks never block your session when something is wrong with Verity itself — a
missing or broken CLI degrades to no gate, not to a broken agent. If reviews stop
appearing, check `/plugin` → **Errors**, and look for `[verity-plugin]` lines.

## Links

- [verity.md](https://verity.md) — dashboard, run history, docs
- [See a live Verity report](https://verity.md/demo)
- [Talk to us on Slack](https://start-chat.com/slack/codacy/C1rsa5)
- [Issues](https://github.com/codacy/verity/issues)

Built by [Codacy](https://codacy.com). Licensed under [Apache-2.0](./LICENSE).
