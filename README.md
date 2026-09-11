<div align="center">

# Verity

### Oversee the agents you're not watching.

**Independent verification for coding agents.**

[verity.md](https://verity.md) · [Live report](https://verity.md/demo) · [Slack](https://start-chat.com/slack/codacy/C1rsa5)

</div>

---

```
/plugin marketplace add codacy/verity
/plugin install verity@verity
```

Then, in your project: **`/verity:init`**

*Free in beta · no credit card · macOS only for now*

---

Verity is a peer to your coding agents. It enforces your team's standards, blocks
agents when it has to, and compounds knowledge and cost telemetry across your fleet.

It runs **out-of-band**, on a stop hook, in its own context window — so it never
spends your agent's tokens.

## The gate

**Quality, security & intent. Gated before commit.**

When an agent stops, a model *that didn't write the code* — backed by Codacy's
deterministic analysis CLI — judges the change against your standard. It passes, or
it's blocked with file-and-line findings and fixes, and the agent self-heals. Every
run is scored and tracked. Typically under 30 seconds; p50 under 15.

Three lenses on every change:

| | |
|---|---|
| **Security** | SAST, OWASP Top 10, leaked secrets, dependency risk |
| **Quality** | bugs, regressions, maintainability, type safety |
| **Intent** | did the code do what was actually asked? |

Intent is the one nothing else checks. Verity captures the original prompt and
specs and holds the delivered code against them, catching drift at the source.

## Why a different model

Because a model can't review its own work — and that's mechanical, not
philosophical. Models self-prefer (GPT-4 scored its own output 0.912, where 0.5 is
neutral), fold under pushback, and iterative self-fixing backfires: **+37.6% critical
vulnerabilities after five rounds**.

Verity's reviewer never wrote the code, so the verdict isn't graded by its author.

On a FAIL the agent reads the findings and self-heals, **capped at two iterations** —
fix-recheck hits diminishing returns after round two. Past the cap it defers to a
human. It interrupts you only when something is actually wrong.

## Memory that compounds

Every decision, gotcha and integration is captured as Markdown committed to your
repo, plus a navigable graph of how they connect. Editable, versioned, fed forward —
so every agent and session starts smarter than the last.

## Cost in view

Spend and usage tracked at the harness: per model, per session, per run, down to a
fleet cost tree across every agent. Scaling agents never means losing the bill.

## What the plugin installs

Eight skills under `/verity:` and six hooks. Details, including exactly what runs and
when, are in [`plugins/verity/README.md`](./plugins/verity/README.md).

| Skill | |
|---|---|
| `/verity:init` | Set Verity up here: asks how you want reviews to run, then installs |
| `/verity:setup` | Project-specific rules a lookup cannot produce (optional, later) |
| `/verity:analyze` | Review the current change on demand |
| `/verity:status` | Standard version, last run, trend, pending items |
| `/verity:learn` | What Verity has learned about this project |
| `/verity:memory` | Browse and extend the knowledge graph |
| `/verity:reflect` | Capture a learning at the end of a task |
| `/verity:insights` | Quality metrics and Standard evolution |
| `/verity:feedback` | Send feedback to the Verity team |

The plugin carries the [`@codacy/verity-cli`](https://www.npmjs.com/package/@codacy/verity-cli)
engine as a pinned dependency, so **there is nothing else to install**. Claude Code
installs it with the plugin and updates it with the plugin.

Prefer npm, or need it in CI where there's no plugin?

```bash
npm install -g @codacy/verity-cli && verity init
```

## Your code is never stored

The diff is analyzed in memory and deleted. Only metadata persists — findings,
scores, decisions. Tokens are SHA-256 hashed, data is encrypted in transit and at
rest, and every project is row-level isolated.

Each run is a timestamped, versioned record: SOC 2 evidence that maps to
ISO/IEC 42001, NIST AI RMF, and EU AI Act Article 12.

Two stages before anything reaches the service. A project that has **never been set
up** is left alone entirely — nothing written, nothing reviewed — and Claude is told,
so it can tell you to run `/verity:init`. A project that is **set up but not logged in** runs the
gate locally and reports findings; nothing is uploaded and no history is kept.

## Where it runs

| | |
|---|---|
| **Claude Code** | live — skills plus hooks |
| **CI/CD** | via the API |
| **OpenAI Codex** | soon |
| **GitHub Agentic Workflows** | soon |

A native gate is locked to one environment. Verity is portable: one Standard that
survives whichever agent wins, with cost and memory spanning your whole fleet.

## Staying up to date

Claude Code disables auto-update for third-party marketplaces by default. Turn it on
in `/plugin` → **Marketplaces** → `verity` → **Enable auto-update**, or update when
you feel like it:

```
/plugin update verity@verity
```

---

<div align="center">

**This repository is generated.** It's published from Verity's source repository on
each release — issues and PRs here reach the same team, but changes are made upstream
and re-applied by hand rather than merged.

Built by [Codacy](https://codacy.com) · [Apache-2.0](./plugins/verity/LICENSE)

</div>
