# Verity — independent verification for coding agents

**Oversee the agents you're not watching.**

When your agent stops, a model *that didn't write the code* judges the change against
your team's standard — quality, security, and whether it did what was actually asked.
It passes, or it's blocked with file-and-line findings, and the agent self-heals.

The review runs out-of-band in its own context window, so it does not spend your agent's
tokens. Its findings do enter your agent's context.

```
/plugin marketplace add codacy/verity
/plugin install verity@verity
```

Then, in your project:

```
/verity:init
```

*Works on macOS, Linux and Windows*

---

## Skills

Ten, namespaced under `/verity:`.

| Skill | What it does |
|---|---|
| `/verity:init` | Set Verity up here: asks about sign-in, repository rules and telemetry, then installs and signs you in |
| `/verity:setup` | Project-specific rules a lookup cannot produce (optional, later) |
| `/verity:analyze` | Review the current change on demand — a second opinion, any time |
| `/verity:status` | Standard version, last run, quality trend, pending items |
| `/verity:learn` | What Verity has learned about this project |
| `/verity:memory` | Browse and extend the project knowledge graph |
| `/verity:reflect` | Capture a learning at the end of a task |
| `/verity:insights` | Quality metrics and Standard evolution suggestions |
| `/verity:feedback` | Send feedback to the Verity team |
| `/verity:prove` | Check a small, risky piece of code with a formal model, then replay any counterexample on the real code |

`analyze`, `status`, `learn`, `memory`, `reflect` and `prove` are also offered to Claude
directly, so it can reach for them without being asked. `init`, `setup`, `insights` and
`feedback` are yours alone — they have side effects you should time yourself, and
Claude is never offered them.

The whole plugin adds about 900 tokens to a session. Check for yourself with
`claude plugin details verity`.

## What runs on your machine, and when

Six hooks, all running the Verity CLI locally. Some of them also call the network. See
[What Verity sends, and where](#what-verity-sends-and-where).

| Hook | Runs |
|---|---|
| `SessionStart` | Snapshots the working tree, so the review can tell your changes from what was already there. When you are signed in, it also downloads the knowledge graph in the background. From CLI 0.35.5, while the formal check is on, it starts the Lean download once on a machine that never tried |
| `UserPromptSubmit` | Records the task you asked for, so the review can judge against your intent. When you are signed in, it also sends the prompt to the Verity service |
| `PreToolUse` (Bash) | The git-moment gate. See below |
| `Stop` | **The review.** Analyzes what changed this turn |
| `PostCompact` | Restores what the conversation lost to compaction. Local only |
| `SessionEnd` | Preserves continuity across `/clear`. When you are signed in, it can also send a session summary |

### The git-moment gate

Verity can also review at `git commit` and `git push`, and block the command if the
change fails.

A project gates nothing until setup runs. For a new project, `/verity:init` turns on
review at each turn, commit and push, and a formal check at push. It does not ask about
these. For a project that already has settings, it keeps them. The formal check is the
exception: from CLI 0.35.5 it is on by default in every project, also one set up before,
unless someone turned it off with `verity config formal off`.

To change them, ask Claude, or run:

```bash
verity config moments turn,commit,push   # any of the three, or: none
verity config moments                    # read it back
verity config formal off                 # stop the formal check at push
```

## What Verity sends, and where

This section comes from an audit of the hooks, `scripts/verity.mjs`, the skills and
`@codacy/verity-cli` 0.35.3, in November 2026, re-run on the CLI that this plugin version
pins. It lists every destination that the audit found. The audit ran the six hooks in
each mode with a network trace.

### What happens in each mode

| Mode | What the hooks do | Sent to the Verity service | Sent elsewhere |
|---|---|---|---|
| **Not set up** (no `.verity/` directory) | Each hook starts, finds no `.verity/`, and stops. Nothing is written to the project. You and Claude are told to run `/verity:init`. | Nothing | Nothing, except the self-heal install below |
| **Set up, not signed in** (a `.verity/` directory, no Verity token) | The Stop hook runs a local Trivy scan. There is no AI review and no history. | Nothing | The first table below |
| **Signed in** (a `.verity/` directory and a Verity token) | Full review at the moments that are on. | The second table below | Both tables below |

In the second mode, your code, file paths and prompts stay on the machine. Two kinds of
traffic leave it, both in the first table below: downloads, and the package names and
versions that the malicious-package check sends to `api.osv.dev`.

**A clone can count as set up.** Since CLI 0.35.4, git ignores everything in `.verity/`.
A repository set up before that can still commit `.verity/standard.yaml`, and then each
clone has a `.verity/` directory. On a signed-in machine with the plugin, that clone sends
its prompts and turn reviews to the Verity service with no `/verity:init`.
`verity standard untrack` stops committing the file.

There is one exception to the second mode. A machine with an anonymous token from an
older CLI still sends review content to the Verity service. Unless a plan limit refuses
the run, the service also sends it to the model provider, and it keeps only counters for
those review runs. New installs cannot get this token. Run `verity login` to replace it.

### With or without a sign-in

| Destination | When | What is sent |
|---|---|---|
| `github.com` (`codacy/verity`) | Plugin install and update. Claude Code does this. | A git request. No project data. |
| `registry.npmjs.org` | Plugin install and update. Claude Code runs `npm ci --ignore-scripts` in the plugin folder. | npm requests for `@codacy/verity-cli` and its pinned dependencies (164 packages). No project data. |
| `registry.npmjs.org` | Self-heal, only when no CLI is found. See [npm installs](#npm-installs-and-the-fallback-order). | npm requests for the pinned CLI. No project data. |
| `github.com`, `release-assets.githubusercontent.com` | First static analysis on a machine with no Trivy. `verity init` also starts this in the background. | A download of the Trivy binary. No project data. |
| `mirror.gcr.io`, then `ghcr.io` if the first fails | When Trivy's vulnerability database is out of date. | A download of the database. No project data. |
| `api.osv.dev` (OSV.dev, a vulnerability database that Google runs) | Each scan that includes a changed package manifest or lockfile, signed in or not. This is the check for known malicious packages, which OpenSSF lists as `MAL-` advisories. No setting turns it off. | The ecosystem, name and version of each package in those files, including the names of private packages. No code, no file paths, no registry URLs and no account. |
| `releases.lean-lang.org`, which redirects to `github.com` and `release-assets.githubusercontent.com` | `verity init` in a new project, in the background. From CLI 0.35.5, also the first session start on a machine that never tried, while the formal check is on. SessionStart resumes a download that stopped. `verity lean install` also does this. `VERITY_NO_LEAN=1` stops it. It does not start in CI or with less than 3.75 GB free. | A download of Lean 4, about 800 MB. No project data. |

Static analysis sends one thing from your project: the package list above, to
`api.osv.dev`. Verity runs Trivy with `TRIVY_DISABLE_TELEMETRY` and `TRIVY_OFFLINE_SCAN`,
and `@codacy/analysis-cli` with `CODACY_DISABLE_UPDATE_CHECK`. So a scan makes no call to
`check.trivy.dev`, no Maven lookup and no update check. The OSV request comes from
Codacy's Trivy adapter, not from Trivy, so these settings do not stop it.
Offline, Trivy resolves a `pom.xml` only from what the file and the local Maven cache
hold, so it can miss a vulnerability in a Maven dependency it would have fetched.

### Only after a sign-in

The Verity service is `server.verity.md`, which runs on Supabase. Credentials written
before CLI 0.35.4 name its older address, `ofcamwrjwrkazqvdchko.supabase.co`, which
reaches the same service. Requests carry your Verity token, the CLI version and the git remote URL with any embedded
credentials removed.

| Destination | When | What is sent |
|---|---|---|
| `github.com`, `api.github.com` | `/verity:init` or `verity login`, from the CLI. | The GitHub device flow, and your GitHub token to check that the repository is visible. A lookup of the repository owner's name has no token. |
| Verity service | `/verity:init`, `/verity:setup`, `verity login`. | Your GitHub token once, to check write access. The service does not store it. Init step names and results, the CLI version and the day. `.verity/standard.yaml`. |
| Verity service | `/verity:init`, `/verity:setup`, `verity standard generate`, only if you agree. | A repository profile that you can read first at `.verity/repo-profile.json`: languages, frameworks, dependency names, folder names, up to 500 commit subjects with their paths, and agent docs such as `CLAUDE.md` without code blocks. |
| Verity service | SessionStart, not after a compaction. | No project data. It downloads the knowledge graph and the organization's knowledge. |
| Verity service | UserPromptSubmit. | The first 4,000 characters of your prompt, a hash of the prompt and the session ID. The service sends the prompt to OpenAI to classify the task. `verity config moments none` does not stop this. |
| Verity service | Stop. | See [the turn review](#what-the-turn-review-sends). |
| Verity service | PreToolUse, at `git commit`, `git push` and `gh pr create`. | See [the commit and push review](#what-the-commit-and-push-review-sends). |
| Verity service | SessionEnd. | A session summary with counts and file paths, when there is something to record. |
| Verity service | First review in a checkout with no knowledge graph. | A project overview, the README introduction and sections of `CLAUDE.md`. The service keeps these as knowledge nodes. |
| Verity service | `/verity:analyze`. | The files that the skill names, with the same size limits, the intent that you state, spec documents, plans and Trivy findings. |
| Verity service | `/verity:status`, `/verity:learn`, `/verity:memory`, `/verity:insights`. | Reads send no project data. Writes send the text that you add. |
| Verity service | `/verity:reflect`. | The text of the lesson, its kind and the file globs it names. With no text, it asks the service to extract lessons, and sends the task's stored prompts and agent replies, up to 500 KB. |
| Verity service | `/verity:feedback`. | Your message word for word, the session ID and the model name. For feedback on a finding: the run ID, the pattern ID, the action and your reason. |
| Verity service | `/verity:prove`, and each push when the formal check is on. | Excerpts of candidate files, 6 KB each, with your hint. Then the source of the functions it models. It refuses a file shaped like a secret, even one that you name. Lean runs on your machine. |
| Verity service | Claude Code sends this telemetry, only if you opt in at `/verity:init` or with `verity telemetry install`. | Token counts, cost, model, session ID, tool, skill and MCP server names, durations, OS, architecture, terminal type, and the repository owner, name and URL. Prompts arrive as `<REDACTED>`. No code. Claude Code also sends your email and account IDs, and the service removes them on receipt. The setting is in `~/.claude/settings.json`, so it covers each Claude Code session on the machine that runs in a Verity project. `verity telemetry uninstall` stops it. |
| `api.openai.com` (OpenAI) | The Verity service calls it. This is the default model provider. | Code, prompts and the other content in this table that a review needs. Each model request sets `store: false`. |
| OpenAI containers | The Verity service creates them, to replay a formal counterexample on the real code, and at push if a Standard turns on `git_moment_agent_container`. | The source that the check needs. `store: false` does not apply to a container. |
| `generativelanguage.googleapis.com` (Google) | The Verity service calls it if OpenAI fails with an error other than an unreadable reply. A project cannot turn this off. A Standard can also select it with `ai_provider: gemini`. | The full review prompt, which includes code and your prompt. |
| `api.github.com` | The Verity service calls it at sign-in. | Your GitHub token, to read your identity and which repositories you can write to. |
| GitHub, through the `gh` command | Stop, on an autonomous run with no prompt (`VERITY_AUTONOMOUS`, `CI` or `GITHUB_ACTIONS` set), when the branch or a commit names an issue. | `gh issue view <n>` with your own `gh` sign-in. The first 4,000 characters of the issue body and its title then go to the Verity service as the goal. |

#### What the turn review sends

- The full content of changed files that the agent wrote: up to 40 files, 50 KB each, 190 KB in total. If the transcript cannot show what the agent wrote, this covers all changed files.
- Diffs against the last review, which can include removed lines.
- The full content of files that the agent read: up to 10 files, 10 KB each, 24 KB in total. This step does not ask git, so a git-ignored file that the agent read can go out.
- Both file lists keep only the file types that the review recognizes. A git-ignored file stays out of the changed-file list.
- **Files shaped like secrets never go out**: `.env` and `.envrc` files; keys and keystores such as `.pem`, `.key`, `.p8`, `.p12` and `id_rsa`; any file named `credentials`, `secret` or `secrets`, whatever its extension, such as `credentials.json`, `secrets.yaml` and `secrets.ts`; `.npmrc` and similar tool credentials; Terraform `.tfvars` and `.tfstate`; service-account JSON and `kubeconfig`; and files under `.ssh/`, `.aws/`, `.gnupg/`, `.docker/` and `.kube/`. Their paths do. Trivy scans every one of them on your machine for secrets.
- A `.verityignore` path stays out of both file lists, unless that turn changed `.verityignore`. It does not cover spec documents or plans.
- Up to 10 of your recent prompts, 2,000 characters each, and the goal from earlier turns.
- The agent's last reply: up to 8 KB, or 32 KB in plan mode.
- The first 80 characters of up to 10 shell commands, which can hold a secret that you typed inline. Full paths of files read and edited, search patterns, task names, and tool names and counts.
- Recent commit subjects, spec documents such as `CLAUDE.md` and `spec/*.md`, and Trivy findings.
- Knowledge-graph hashes, and the full text of knowledge nodes that you edited.
- Your 3 newest Claude Code plans, from `.claude/plans/` and `~/.claude/plans/`. **A plan in your home directory can belong to another project.**
- Lines from other files that use the changed code: up to 24 KB.

Tool output and the text inside Edit tool calls did not appear in the audit.

#### What the commit and push review sends

- The full content of **every staged or pushed file**: up to 120 files, 96 KB each, 570 KB in total. `.verityignore` does not apply to these files.
- **Files shaped like secrets never go out**, as in the turn review. Their paths do, and Trivy scans them on your machine, so a staged secret that Trivy recognizes can still block the commit.
- The diff, commit messages and Trivy findings.
- Excerpts from other files that call or write the changed code: up to 32 KB.
- The reviewing model can also ask the CLI to read other tracked files, search, list files, and run `git log`, `git blame`, `git show` and `git diff`. Each answer is at most 16,000 characters. These tools refuse paths shaped like secrets, such as `.env` and key files.

### Other addresses in the CLI

The CLI prints links to `verity.md`. It does not call that host. Opening a report link
sends a view token to it from your browser.

These settings change the destinations above. None of them is on by default:

- `VERITY_SERVICE_URL`, `verity config service-url`, or a `URL:` line in the repository's `VERITY.md` when nothing else names a service.
- `VERITY_PROVE_DIRECT=1` with `OPENAI_API_KEY` calls `api.openai.com` directly with your key. This is for development.
- `verity prove candidates --rank jev` with `TYPESAFE_API_KEY` calls `api.typesafe.ai`. This is an untested development option.

### What is stored, and for how long

The service does not write diffs, file contents, tool output or the whole conversation
to its database. It holds them in memory for the review and sends them to the model
provider. The data below does persist.

| What | Kept |
|---|---|
| Findings: title, description and suggested fix. The model writes these, and they **can quote your code**. | No automatic deletion |
| Your prompt, up to 4,000 characters | Cleared after 30 days |
| Task labels and summaries. A summary can be the first 500 characters of your prompt. | No automatic deletion |
| The model's assessment, goal, intent rationale, pending items and design decisions | No automatic deletion |
| The agent's text when it disputes a finding, up to 1,000 characters | No automatic deletion |
| Knowledge nodes, lessons and reflections, up to 8 KB each | No automatic deletion |
| Metadata: file paths, git remote, gate decisions, scores, session IDs, file hashes | No automatic deletion |
| Standard versions: the content of `.verity/standard.yaml` | No automatic deletion |
| Account: email, GitHub login and ID, repositories you can write to, and your Verity token as a SHA-256 hash | No automatic deletion |
| Your IP address at sign-in, for rate limits | No automatic deletion |
| `/verity:feedback` text, up to 5,000 characters | No automatic deletion |
| Telemetry: metric points | Deleted after 14 days |
| Telemetry: spans | Deleted after 30 days |
| Telemetry: raw batches as received | Deleted after 7 days |
| Telemetry: daily totals | No automatic deletion |
| Counters for anonymous runs | Deleted after 30 days |
| Init step records | Deleted after 180 days |

The CLI has no command that deletes this data. Server logs do not record request
bodies, but an error from a model provider can appear in them. No code sets a log
retention period.

OpenAI and Google handle what they receive under their own API terms. This README
does not describe their retention.

### What is written to your repository

After `/verity:init`, git sees these files. You decide whether to commit them:

- `.gitignore`: a block that ignores everything in `.verity/`.
- `CLAUDE.md`: a block of about 110 lines between markers. Verity can rewrite this block later. Your text outside it stays.
- `VERITY.md`: a summary of the project's Standard.

These files stay in `.verity/`, and git ignores them:

- `standard.yaml`: this machine's copy of the Standard. The Standard itself is on the service.
- `memory/`: the knowledge graph as Markdown, which the service sends. `verity memory track` lets you commit it instead.
- `.snapshot/`: copies of the files that were reviewed, which can include a secret that was flagged.
- `.baseline/`, `.conversation-buffer`, `.task-context/` and session files: the working-tree snapshot, your recent prompts and the agent's replies.
- `.logs/`, `.cache/`, `config.json`, `setup.json`, `static-analysis.json` and `repo-profile.json`.

An npm install with `verity init` also writes `.claude/settings.json` and
`.claude/skills/`. With the plugin, init removes those.

Outside the repository, Verity writes to `~/.verity/` (credentials, session memory, Lean,
organization knowledge), to `~/.codacy/` (Trivy, its database, logs) and to the
plugin data folder. `@codacy/analysis-cli` writes its update-check state under
`~/.config/configstore/`. Telemetry, if you turn it on, writes to `~/.claude/settings.json`.

### npm installs and the fallback order

Each hook runs `scripts/verity.mjs`, which uses the first CLI it finds:

1. `VERITY_CLI_PATH`, if you set it.
2. `node_modules` in the plugin folder. Claude Code fills it with `npm ci --ignore-scripts` at install and at each version change.
3. `node_modules` in the plugin data folder, which step 5 fills.
4. A `verity` binary on your `PATH`. This is a separate install, so its version can differ from the plugin's pin. Run `verity --version` to check it.
5. The self-heal, at SessionStart only: `npm install --prefix <plugin data folder> --no-audit --no-fund @codacy/verity-cli@<pinned version>`. It runs at most once per plugin version and can run in a project that is not set up. **It does not pass `--ignore-scripts`.**

If all five fail, the hooks exit 0 and the session runs with no review.

## The CLI

The plugin carries [`@codacy/verity-cli`](https://www.npmjs.com/package/@codacy/verity-cli)
as a pinned dependency. Claude Code installs it when you install the plugin and reinstalls
it whenever the plugin updates. Verity downloads Trivy on first use and, for the formal
check, Lean. See [What Verity sends, and where](#what-verity-sends-and-where).

A global install still works and is what you want for CI, where there is no plugin:

```bash
npm install -g @codacy/verity-cli && verity init
```

If you have both, the plugin's pinned copy is the one the hooks use, and the plugin
owns the wiring — `verity init` will detect it and remove any duplicate hooks, so a
turn is never reviewed twice.

### Staying up to date

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

### Removing it

```bash
claude plugin uninstall verity@verity -s user
```

Use `-s project` or `-s local` if you installed it at that scope. Each scope is a
separate install, so removing one leaves the others in place — `/plugin` →
**Installed** lists what is still there.

Your project keeps its `.verity/` directory, its Standard and the block in `CLAUDE.md`.
To gate with the npm CLI instead, run `verity init` and it will wire this project's own
hooks again.

These also stay: `~/.verity/` (with Lean, about 2.7 GB), `~/.codacy/`, and your stored
data on the service. If you turned telemetry on, run `verity telemetry uninstall` before
you remove the plugin. It removes the settings from `~/.claude/settings.json`.

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
