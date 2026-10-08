---
description: >-
  Set Verity up in this project: ask the setup questions in the session, run the
  deterministic install with those answers, sign in, and repair a project the Claude
  Code plugin has just been added to. Use right after installing the Verity plugin,
  or when Verity says this project is not set up.
disable-model-invocation: true
---
# /verity:init — set Verity up in this project

You are running, inside this session, the same setup `verity init` runs at a
terminal: the same questions, the same install, the same sign-in. The only
difference is who asks. At a terminal the CLI prompts; here **you** ask, and pass
the answers down as flags.

**Why this skill exists.** Claude Code has no post-install hook and a plugin
cannot invoke a skill, so installing Verity repairs nothing: it cannot remove a
project's superseded skills, stand down duplicate hooks, or derive a Standard.
All of that needs a command someone runs — this one.

**`verity init` prompts on a terminal, and you are not one.** Run with `--yes`
alone it takes the unattended answer to every question: stop-only review (no
commit or push gate), no telemetry, no sign-in, nothing untracked. Every one of
those is a decision that belongs to the user, so every one is asked here.

Run every `verity` command below the way this session's context says (the
plugin's own copy), not with plain `verity`, whenever the context names one.

---

## Step 0: Read where the project stands — before asking anything

```bash
verity doctor --json
```

From that one report:

- **`blocked` is true** → show the `prerequisites[].remedy` lines and stop.
  Nothing below can work.
- **`hooks.versions.skew` is set** → tell the user first, in one line, with
  `hooks.versions.skew.remedy`. An older CLI cannot take the answers, so they
  should hear it now, not after answering.
- **`answers`** holds what a previous run recorded (`intensity`, `moments`,
  `telemetry`). On a re-run those are the defaults — pre-select them. The shipped
  defaults are only for a project with nothing recorded.
- **`telemetry.enabled`** decides whether the telemetry question is asked at all.
- **`memory.trackedFiles > 0` and `memory.optedOut` is false** → the graph
  question applies.
- **`trackedState.files > 0`** → the committed-state question applies.

## Step 1: Ask — once, in one prompt

Use `AskUserQuestion` with every question that applies **in a single call**, in
this order. It takes at most four; if more apply, put the rest in ONE follow-up
call. Do not ask one at a time, and do not ask in prose unless `AskUserQuestion`
is unavailable (then ask in prose and **wait** — never choose for the user).

**1 — "When should Verity review your code?"** (multi-select, always asked)

| Option | Description |
|---|---|
| `After every turn (always on with the plugin, for now)` | Reviews what the agent just wrote, as you work. Fast feedback, never blocks a commit. Under the Claude Code plugin it cannot be turned off yet. |
| `Before commit` | Reviews the staged diff and blocks the commit on a failing review. |
| `Before push / PR` | Reviews the commits about to be pushed and blocks on a failing review. |

Pre-select the recorded moments, or **After every turn** on a first run, and do
not call it "recommended": under the plugin it runs whatever the answer. Say
plainly in the question text that choosing only the first means **git commits
and pushes are not gated**.

**2 — "How deeply should Verity review?"** (single-select, always asked)

| Option | Description |
|---|---|
| `Balanced (recommended)` | Security + quality, about 8s per review. |
| `Lightweight` | Critical security only, about 3s. |
| `Thorough` | All tools, all rules, about 15s. |

**3 — "Send cost & usage telemetry to Verity?"** (single-select; **only when
`telemetry.enabled` is false**)

| Option | Description |
|---|---|
| `Yes, enable it` | Powers the /usage dashboard. Sends Claude Code's own OpenTelemetry metrics and traces: model names, token counts, cost, session ids. Not your prompts, code, or tool input/output. |
| `No` | /usage stays empty. Enable later with `verity telemetry install`. |

**4 — "Sign in to Verity now?"** (single-select, always asked)

| Option | Description |
|---|---|
| `Sign in now (recommended)` | One GitHub login covers every repository you can write to, for 90 days. Needed for run history, cloud memory and the dashboard. If you are already signed in this just confirms it. |
| `Skip for now` | The gate still reviews your code locally; nothing is saved. Sign in later with `/verity:init` or `verity login`. |

If asked, explain: the GitHub token is used once to check which repositories they
can write to, then discarded; signing in does not give Verity access to their
code, which is analyzed in memory and never stored.

**5 — "Stop tracking Verity's knowledge graph in git?"** (only when the graph
question applies; say how many files)

| Option | Description |
|---|---|
| `Yes, untrack it (recommended)` | Files stay on disk; their removal from the index is staged for you to commit. Generated notes stop appearing in every diff and PR. |
| `No, not now` | Nothing changes. `verity memory track` records it as deliberate. |

**6 — "Untrack committed Verity state?"** (only when `trackedState.files > 0`;
say how many files)

| Option | Description |
|---|---|
| `Yes, untrack it (recommended)` | Machine-local files that should never have been committed — they can include copies of flagged secrets. Files stay on disk; the removal is staged. |
| `No, not now` | Nothing changes. |

## Step 2: Run the install with those answers

One command, no prompts, nothing silently defaulted:

```bash
verity init --yes --no-setup \
  --moments <stop[,pre-commit][,pre-push] | none> \
  --intensity <balanced|lightweight|thorough> \
  [--telemetry on|off] [--untrack-memory] [--untrack-state]
```

- Pass `--telemetry` only when question 3 was asked. Omitting it leaves the
  recorded choice alone.
- Pass `--untrack-memory` / `--untrack-state` only on a yes.
- Pass `stop` only if they ticked it. Under the plugin the Stop review runs either
  way and `verity init` says so.
- An unrecognised value is refused rather than dropped, so a typo cannot quietly
  remove a gate. If init exits non-zero, show its error and stop.

This is idempotent and does the whole install: removes the project's own
`.claude/skills/verity-*` copies that the plugin supersedes, stands down duplicate
`.claude/settings.json` hooks, adopts the team's Standard from the service or
derives one from the codebase, heals a stale analysis config, and records the
plugin version — which is what stops Verity asking at every session start.

Init runs before sign-in, so on a first run it says it skipped authentication and
that telemetry needs a token. That is expected — Step 3 handles both. Do not
repeat those lines to the user as problems.

## Step 3: Sign in — here, in two halves

Skip this step if they chose **Skip for now**; say the gate runs locally and how
to sign in later.

`verity login` on its own prints a code and then blocks until it is approved, and
you would only see the code after it ended. So it is split:

```bash
verity login --start
```

It prints one JSON object on stdout:

- **`"status": "logged_in"`** → they already are. Say so and go to Step 4.
- **`"status": "pending"`** → show the user `verification_uri` and `user_code`
  exactly as given, and ask them to approve it in their browser and tell you when
  they have. Wait for their reply. Do not run anything in the meantime.
- **`"status": "failed"`** → show the error, and tell them to run `verity login`
  in their own terminal later. Go to Step 4.

When they say it is approved (or ask you to check):

```bash
verity login --finish
```

Give the tool call at least a 150-second timeout; it waits up to 100 seconds.

- **exit 0, `"status": "logged_in"`** → report the lines it printed about the
  account and whether this repository is covered, word for word where it names a
  link to grant the Verity GitHub App.
- **exit 2, `"status": "pending"`** → not approved yet. Show the code again, wait
  for them, and run `--finish` again.
- **exit 1** → `denied`, `expired`, `service_changed`, `no_pending` or `failed`.
  Show the error. For `expired` or `no_pending`, offer to start again with
  `--start`.

If they change their mind while a code is pending, run `verity login --cancel`.

⚠ Never run plain `verity login` from here, and never tell a user whose Step 0
reported a version skew to run it in a terminal until they have fixed the skew —
the old global CLI can sign the machine in to a different server, and the plugin
follows that sign-in.

## Step 4: Finish telemetry, if it waited on sign-in

If they said yes to telemetry and init reported it needs a token, and Step 3
signed them in:

```bash
verity telemetry install
```

It takes effect on their next Claude Code session.

## Step 5: Report what happened

```bash
verity doctor --json
```

Summarise from this report, not from memory of what you ran:

- what init removed (superseded skills, duplicate hooks) — those skill
  directories are usually committed, so the deletions show in `git status` and
  are the user's to commit;
- whether the Standard was **adopted** from the service or **derived** from the
  codebase (init's output says which);
- the moments and intensity now in effect, and who wires the hooks
  (`hooks.source`);
- anything untracked, and that the staged removal is theirs to commit;
- sign-in and telemetry state;
- each line of `next`, if any.

Then offer `/verity:setup` for the part a lookup cannot produce — project-specific
`custom_patterns` such as *"every route under `api/` uses the auth middleware"* —
and say it is optional: the gate is already running.

---

## What NOT to do here

- **Do not wire hooks or edit `.gitignore` yourself.** `verity init` owns that.
  Doing it here is how the two flows drifted apart before.
- **Do not synthesize a Standard by hand.** The CLI derives it in seconds from
  the same catalogue you would be reading.
- **Do not answer a question for the user**, including by leaving a flag off
  because it seemed obvious. An omitted question is an unattended answer.
- **Do not run plain `verity login`.** Step 3.
