# Verity — a quality gate for AI-generated code

Verity reviews what your coding agent just wrote, using a **different model**, against
**your project's standard**, before the work lands.

A model reviewing its own output shares its own blind spots. Verity's review runs
independently: your agent writes, Verity's reviewer reads. It sees the change, the task
the agent was given, your project's accumulated knowledge, and the output of real static
analysis tools — then decides whether the work is ready.

```
/plugin marketplace add codacy/verity
/plugin install verity@codacy
```

Then, in your project:

```
/verity:setup
```

---

## What you get

| | |
|---|---|
| **A review at the end of every turn** | When your agent stops, Verity reviews what it changed and reports what it found. It can ask the agent to fix things before you ever see them. |
| **Your standard, not a generic one** | `/verity:setup` writes a project Standard — the rules that matter here — and Verity judges against that. |
| **Static analysis as evidence, AI as judge** | Linters and scanners supply signals. The reviewer weighs them in context, so you get findings instead of noise. |
| **Memory that compounds** | Decisions, patterns and gotchas accumulate in `.verity/memory/` and feed back into later reviews. |

## Skills

Eight commands, namespaced under `/verity:`.

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

`analyze`, `status`, `learn`, `memory` and `reflect` are also available to Claude
directly, so it can reach for them without being asked. `setup`, `insights` and
`feedback` are yours to invoke — they have side effects you should time yourself.

## What runs on your machine, and when

The plugin registers five hooks. All of them run the Verity CLI locally.

| Hook | Runs |
|---|---|
| `SessionStart` | Snapshots the working tree, so the review can tell your changes from what was already there |
| `UserPromptSubmit` | Records the task you asked for, so the review can judge against your intent |
| `Stop` | **The review.** Analyzes what changed this turn |
| `PostCompact` | Restores what the conversation lost to compaction |
| `SessionEnd` | Preserves continuity across `/clear` |

## What leaves your machine

**Your code is never stored.** Files in a change are sent for analysis, held in memory
for the duration of the request, and discarded. What persists on the service is metadata:
findings, gate decisions, run history, and the project knowledge you can read yourself at
any time with `/verity:learn`.

Until you run `/verity:setup` and log in, the plugin works anonymously: the gate runs
locally and reports findings, but nothing is uploaded and no history is kept.

## The CLI

The plugin carries the [`@codacy/verity-cli`](https://www.npmjs.com/package/@codacy/verity-cli)
engine as a pinned dependency, so **you do not need to install anything else**. Claude Code
installs it when you install the plugin, and reinstalls the new version whenever the plugin
updates.

A separate global `npm install -g @codacy/verity-cli` still works and is what you want for
CI, where there is no plugin. If you have both, the plugin's pinned copy is the one the
hooks use.

### Staying up to date

Claude Code disables auto-update for third-party marketplaces by default. To get new
Verity versions automatically, run `/plugin`, open **Marketplaces**, select `codacy`, and
choose **Enable auto-update**. Otherwise, update on your own schedule:

```
/plugin update verity@codacy
```

### If the gate goes quiet

The hooks never block your session when something is wrong with Verity itself — a missing
or broken CLI degrades to no gate, not to a broken agent. If reviews stop appearing, check
`/plugin` → **Errors**, and look for `[verity-plugin]` lines in your terminal.

## Links

- [verity.md](https://verity.md) — dashboard, run history, docs
- [Issues](https://github.com/codacy/verity/issues)
- Verity is built by [Codacy](https://codacy.com)

Licensed under [Apache-2.0](./LICENSE).
