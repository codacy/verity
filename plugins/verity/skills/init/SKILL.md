---
description: >-
  Set Verity up in this project: ask the setup questions in the session (sign in,
  and the Standard: use the team's, or write project rules from a repo profile),
  sign in, and run the install with those answers. Use right after installing the Verity plugin, or when
  Verity says this project is not set up.
disable-model-invocation: true
---
# /verity:init — set Verity up in this project

You run, inside this session, the same setup that `verity init` runs at a
terminal. At a terminal the CLI asks about sign-in and about the Standard. Here
**you** ask, and pass the answers to the CLI as flags.

**Why this skill exists.** Claude Code has no post-install hook, and a plugin
cannot start a skill. So installing Verity does not set up the project. That needs
a command, and this skill runs it.

**`verity init --yes` asks nothing.** Without these flags it skips sign-in, uses
the team's Standard if there is one, and sends no profile. These are the user's
decisions, so ask them here.

When this session's context names the plugin's own copy of the CLI, run every
`verity` command below with that copy, not with plain `verity`.

---

## Step 0: Read where the project stands

```bash
verity doctor --json
```

Use this one report:

- **`blocked` is true** → show the `prerequisites[].remedy` lines and stop.
- **`hooks.versions.skew` is set** → tell the user first, in one line, with
  `hooks.versions.skew.remedy`.
- **`artifacts.standard` or `artifacts.legacyStandard` is true** → this project
  already has a Standard file here. `legacyStandard` is an old GATE.md Standard at
  `.gate/standard.yaml`: init moves it to `.verity/` first. Do not ask question 2,
  and init sends no profile. The file is this machine's working copy of the
  team's Standard: init keeps it when it is the team's or the team has none yet
  (then it shares it), and writes the team's here when the two differ (the file
  is kept as a copy, `.verity/standard.<time>.yaml`). Reviews read the Standard
  on the service either way.
- **`standard.tracked` is true** → `.verity/standard.yaml` is tracked in git, from
  an install older than 0.36.0. Question 3b applies.

When both are false, also run:

```bash
verity standard history
```

- **It lists versions** → the team already has a Standard on the service.
  Question 2 is **2a**.
- **It prints "No Standard versions found."** → question 2 is **2b**.
- **It fails** (for example, not signed in) → question 2 is **2b** for now.
  Step 2 checks again after sign-in.

Then check whether the service writes project rules for this project:

```bash
verity standard generate --status
```

It prints one word, and sends nothing:

- **`on`** or **`unknown`** → ask 2b, and offer "Create a new one from a repo
  profile" in 2a.
- **`off`** or **`unsupported`** → the service would not use a profile. Do not
  ask 2b, and do not offer "Create a new one from a repo profile" in 2a.
  Pass `--profile skip`.
- **It fails** (not signed in) → decide as for `unknown`. Step 2 runs it again
  after sign-in.
- **`memory.trackedFiles > 0` and `memory.optedOut` is false** → question 3 applies.
- **`trackedState.files > 0`** → question 4 applies.
- **`telemetry.enabled` is false and `answers.telemetry` is not `declined`** →
  question 5 applies. An earlier "no" is an answer: do not ask again.

## Step 1: Ask, once, in one prompt

Use `AskUserQuestion` with every question that applies, **in one call**. Do not
ask one at a time. If `AskUserQuestion` is not available, ask in prose and wait for
the answer. Never choose for the user.

**1 — "Sign in to Verity now?"** (always)

| Option | Description |
|---|---|
| `Sign in now (recommended)` | One GitHub sign-in covers every repository on this machine, for 90 days. AI review needs it. If you are signed in already, this only confirms it. |
| `Skip for now` | Only the local security scan runs. Nothing is saved. Sign in later with `/verity:init` or `verity login`. |

If the user asks: the GitHub token is used once to check which repositories they
can write to, then discarded. Signing in does not give Verity access to the
contents of their repositories.

**2a — "Your team already has a Standard for this repository. Use it, or create a new one?"**
(only when `verity standard history` lists versions; name the latest version and who pushed it)

| Option | Description |
|---|---|
| `Use it (recommended)` | Reviews use the same rules as everyone else on the project. Nothing is sent. |
| `Create a new one from a repo profile` | The new Standard becomes the next version for the whole team. Verity sends the repo profile that 2b describes, and writes project rules from it. |
| `Create a new one with the built-in rules` | The new Standard becomes the next version for the whole team. It has the built-in rules only. Nothing is sent. |

**2b — "Let Verity write review rules for this repository?"** (only when
`artifacts.standard` and `artifacts.legacyStandard` are both false, 2a does not
apply, and the status is `on` or `unknown`)

| Option | Description |
|---|---|
| `Yes, send the profile (recommended)` | Verity sends a profile of this repository to the Verity service: languages, frameworks and dependency names; folder names, 3 levels deep; the subjects of recent commits and the paths each one changed; the agent docs (CLAUDE.md, AGENTS.md, and those of sub-projects) without their code blocks, or the rule sections of README.md when there are none. This step sends no source code, diffs or author names. Verity does not store the profile. Later, each review sends the code that changed. |
| `No, use the built-in rules` | The Standard has the built-in rules only. Add project rules later with `verity standard generate`. |

Say in the question text that the profile needs sign-in. If the user skips
sign-in, question 2b has no effect.

**3 — "Stop tracking Verity's knowledge graph in git?"** (only when it applies;
say how many files)

| Option | Description |
|---|---|
| `Yes, untrack it (recommended)` | The files stay on disk. Their removal from the index is staged for you to commit. Generated notes stop appearing in every diff. |
| `No, not now` | Nothing changes. `verity memory track` records it as deliberate. |

**3b — "Stop tracking `.verity/standard.yaml` in git?"** (only when
`standard.tracked` is true)

| Option | Description |
|---|---|
| `Yes, untrack it (recommended)` | Verity keeps the Standard on the service and writes the file on each machine (`verity init`, `verity standard pull`). The file stays on disk here; its removal from the index is staged for you to commit. Teammates lose the file on their next pull and get it back with `verity standard pull`. Reviews are not affected: they read the service. |
| `No, not now` | Nothing changes. `verity doctor` keeps reporting it; `verity standard untrack` does it later. |

**4 — "Untrack committed Verity state?"** (only when `trackedState.files > 0`;
say how many files)

| Option | Description |
|---|---|
| `Yes, untrack it (recommended)` | These files are machine-local and can include copies of flagged secrets. The files stay on disk, and the removal is staged. |
| `No, not now` | Nothing changes. |

**5 — "Send Claude Code cost and usage from this machine to Verity?"** (only
when it applies)

| Option | Description |
|---|---|
| `Yes (recommended)` | Token counts, cost, models, tool names and the repository name, from every Claude Code session on this machine. No prompts, no code, no file contents. It needs sign-in. See it on the /usage page. Turn it off any time: `verity telemetry uninstall`. |
| `No` | Nothing changes, and init does not ask again. Turn it on later: `verity telemetry install`. |

Say that the scope is the whole machine: Claude Code takes these settings only
from user settings, never from one project.

Do not ask when Verity reviews. All three moments are on by default: each turn,
each commit and each push. Step 4 tells the user how to change them.

## Step 2: Sign in first, in two halves

Skip this step if the user chose **Skip for now**.

⚠ **Sign in BEFORE the install.** Init needs the sign-in to use the team's
Standard, to write project rules, and to share the Standard. Run the other way
round, the Standard stays on this machine, and every review fails with
`STANDARD_NOT_FOUND`.

`verity login` waits until the code is approved, and you would see the code only
after it ends. So use the two halves:

```bash
verity login --start
```

It prints one JSON object on stdout:

- **`"status": "logged_in"`** → the user is signed in. Say so and go to Step 3.
- **`"status": "pending"`** → show `verification_uri` and `user_code` exactly as
  given. Ask the user to approve it in the browser and to tell you when they have.
  Wait for the reply. Run nothing in the meantime.
- **`"status": "failed"`** → show the error. Tell the user to run `verity login`
  in a terminal later. Go to Step 3.

**After a new sign-in, check the Standard again.** If Step 0 could not run
`verity standard history` (it failed) and `artifacts.standard` and
`artifacts.legacyStandard` are both false, run it
now. If it lists versions, ask question 2a now, in its own prompt. Its answer
replaces the answer to 2b. Also run `verity standard generate --status` again.
If it prints `off` or `unsupported`, the answer to 2b has no effect: pass
`--profile skip`.

When the user says it is approved, or asks you to check:

```bash
verity login --finish
```

Give this tool call a timeout of at least 150 seconds. It waits up to 100 seconds.

- **exit 0, `"status": "logged_in"`** → report the lines it printed about the
  account and this repository's coverage. Give any link to the Verity GitHub App
  word for word. Then go to Step 3.
- **exit 2, `"status": "pending"`** → not approved yet. Show the code again, wait
  for the user, and run `--finish` again.
- **exit 1** → `denied`, `expired`, `service_changed`, `no_pending` or `failed`.
  Show the error. For `expired` or `no_pending`, offer to start again with `--start`.

If the user changes their mind while a code is pending, run `verity login --cancel`.

⚠ Never run plain `verity login` here. If Step 0 reported a version skew, do not
tell the user to run it in a terminal until they fix the skew: the old global CLI
can sign the machine in to a different server, and the plugin follows that sign-in.

## Step 3: Run the install with the answers

One command. It asks nothing:

```bash
verity init --yes [--standard <use|new>] --profile <send|skip> [--telemetry <on|off>] [--untrack-memory] [--untrack-standard] [--untrack-state]
```

- Question 2a: `Use it` → `--standard use`. `Create a new one from a repo
  profile` → `--standard new --profile send`. `Create a new one with the
  built-in rules` → `--standard new --profile skip`.
- Question 2b: `--profile send` only when the user said yes and signed in.
  Otherwise `--profile skip`.
- When question 2 was not asked, leave `--standard` and `--profile` off.
- `--untrack-memory`, `--untrack-standard` and `--untrack-state` only on a yes.
- Question 5: `--telemetry on` on a yes, `--telemetry off` on a no. When it was
  not asked, leave `--telemetry` off.
- Do not pass `--moments`. Without it, init keeps the moments the project has,
  or turns on all three for a new project.
- If init exits non-zero, show its error and stop.

Init is idempotent. It removes the project's own `.claude/skills/verity-*` copies
that the plugin replaces, removes duplicate `.claude/settings.json` hooks, keeps
or adopts or writes the Standard, and records the plugin version. That record
stops Verity asking at every session start.

With `--profile send`, init prints the rules that Verity wrote. Each rule has an
id, one sentence, where it applies and why. Show them to the user as printed.
When init prints the "too little history" line, tell the user that the built-in
rules apply.

## Step 4: Report what happened

```bash
verity doctor --json
```

Summarise from this report and from init's output, not from memory:

- the Standard: **kept**, **adopted** from the team (when the file here differed,
  say that the old file is kept as a copy and where), **written** from the
  profile (with its rules), or built from the catalogue. When it is a new one
  that replaced the team's, say which version it replaced;
- the moments in effect. Say: "Verity reviews every turn, every commit and every
  push. To change it, run `verity config moments`, or just ask me.";
- what init removed (superseded skills, duplicate hooks). Those skill folders are
  usually committed, so the deletions show in `git status` and are the user's to
  commit;
- anything untracked, and that the staged removal is the user's to commit;
- sign-in state;
- formal verification, when init printed "Formal verification at push: on". Say
  it as a fact, in init's words: at a push, Verity checks a small model of the
  riskiest changed function and replays any counterexample on the real code;
  that function's source is sent to Verity; only a reproduced bug blocks; turn
  it off with `verity config formal off`. It is a default, like the moments. Do
  not suggest turning it off, and do not connect it to the user's answers to
  other questions;
- when init printed that the kept Standard has no project rules yet, that line
  and its command (`verity standard generate`);
- each line of `next`, if any.

---

## What NOT to do here

- **Do not wire hooks or edit `.gitignore` yourself.** `verity init` owns that.
- **Do not write a Standard by hand.** Init gets it from the team, from the
  profile, or from the catalogue.
- **Do not answer a question for the user**, and do not leave a flag off because
  it seems obvious. An omitted answer is an unattended one.
- **Do not run plain `verity login`.** See Step 2.
- **Do not advise turning off a default** (the moments, formal verification)
  unless the user asks. Say what it does and how to change it.
