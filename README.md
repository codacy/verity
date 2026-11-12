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

*Works on macOS, Linux and Windows*

---

Verity is a peer to your coding agents. It enforces your team's standards, blocks
agents when it has to, and compounds knowledge and cost telemetry across your fleet.

The review runs **out-of-band**, on a stop hook, in its own context window, so it does
not spend your agent's tokens. Its findings do enter your agent's context.

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

Every decision, gotcha and integration is captured as Markdown in `.verity/memory/`,
plus a navigable graph of how they connect. The service keeps the graph and git ignores
the local copy by default. Editable and fed forward — so every agent and session starts
smarter than the last.

## Cost in view

Spend and usage tracked at the harness, if you opt in: per model, per session, per run,
down to a fleet cost tree across every agent. Scaling agents never means losing the bill.

## What the plugin installs

Ten skills under `/verity:` and six hooks. Details, including exactly what runs, what
it sends and where, are in [`plugins/verity/README.md`](./plugins/verity/README.md).

| Skill | |
|---|---|
| `/verity:init` | Set Verity up here: asks about sign-in, repository rules and telemetry, then installs and signs you in |
| `/verity:setup` | Project-specific rules a lookup cannot produce (optional, later) |
| `/verity:analyze` | Review the current change on demand |
| `/verity:status` | Standard version, last run, trend, pending items |
| `/verity:learn` | What Verity has learned about this project |
| `/verity:memory` | Browse and extend the knowledge graph |
| `/verity:reflect` | Capture a learning at the end of a task |
| `/verity:insights` | Quality metrics and Standard evolution |
| `/verity:feedback` | Send feedback to the Verity team |
| `/verity:prove` | Check a small, risky piece of code with a formal model, then replay any counterexample on the real code |

The plugin carries the [`@codacy/verity-cli`](https://www.npmjs.com/package/@codacy/verity-cli)
engine as a pinned dependency. Claude Code installs it with the plugin and updates it
with the plugin. Verity downloads Trivy on first use and, for the formal check, Lean
(about 800 MB).

Prefer npm, or need it in CI where there's no plugin?

```bash
npm install -g @codacy/verity-cli && verity init
```

## What Verity sends and stores

**Read [What Verity sends, and where](./plugins/verity/README.md#what-verity-sends-and-where)
before you install.** It lists every destination, what each one receives, and in which mode.

In short:

- **Not set up:** the hooks start and stop. Nothing is sent and nothing is written.
- **Set up, not signed in:** a local Trivy scan runs. Your code, file paths and prompts stay on the machine. When a change touches a package manifest or lockfile, the names and versions of its packages go to `api.osv.dev` (OSV.dev, which Google runs), to check for known malicious packages. The other traffic is downloads: Trivy from `github.com` and `release-assets.githubusercontent.com`, and its database from `mirror.gcr.io`, or `ghcr.io` if that fails. Init also downloads Lean from `releases.lean-lang.org`. From CLI 0.35.5, the first session start on a machine that never tried does too, while the formal check is on.
- **Signed in:** changed files, your prompts and related context go to the Verity service, on Supabase, and to OpenAI. If OpenAI fails, they go to Google. A clone of a repository that still commits `.verity/standard.yaml` counts as set up. Files shaped like secrets, such as `.env` and keys, never go out.

The service does not write diffs or file contents to its database. It does keep findings,
which can quote your code, and other data listed in that section. Your prompt text is
cleared after 30 days. Tokens are SHA-256 hashed, data is encrypted in transit and at
rest, and every project is row-level isolated.

Each run is a timestamped, versioned record: SOC 2 evidence that maps to
ISO/IEC 42001, NIST AI RMF, and EU AI Act Article 12.

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
in `/plugin` → **Marketplaces** → `verity` → **Enable auto-update**. Claude Code then
checks for a new version shortly after each session starts and tells you when one is
ready; run `/reload-plugins` to switch to it without restarting.

To update on demand instead, from your shell:

```bash
claude plugin update verity@verity
```

Then run `/reload-plugins` in any open session, or restart Claude Code. There is no
`/plugin update` slash command — updates come from auto-update or from that shell
command.

## Removing it

```bash
claude plugin uninstall verity@verity -s user
```

Use `-s project` or `-s local` if you installed it at that scope. Each scope is a
separate install, so removing one leaves the others in place — `/plugin` →
**Installed** lists what is still there.

Your project keeps its `.verity/` directory, its Standard and the block in `CLAUDE.md`.
To gate with the npm CLI instead, run `verity init` and it will wire this project's own
hooks again. If you turned telemetry on, run `verity telemetry uninstall` before you
remove the plugin.

---

<div align="center">

**This repository is generated.** It's published from Verity's source repository on
each release — issues and PRs here reach the same team, but changes are made upstream
and re-applied by hand rather than merged.

Built by [Codacy](https://codacy.com) · [Apache-2.0](./plugins/verity/LICENSE)

</div>
