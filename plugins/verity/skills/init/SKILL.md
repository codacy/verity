---
description: >-
  Set Verity up in this project: ask the two setup questions, run the deterministic
  install, and repair a project the Claude Code plugin has just been added to. Use
  right after installing the Verity plugin, or when Verity says this project is not
  set up.
disable-model-invocation: true
---
# /verity:init — set Verity up in this project

You are running the setup a plugin install cannot do for itself.

**Why this skill exists.** Claude Code has no post-install hook and a plugin
cannot invoke a skill, so installing Verity repairs nothing: it cannot remove a
project's superseded skills, stand down duplicate hooks, or derive a Standard.
All of that needs a command someone runs — this one.

**`verity init` prompts on a terminal, and you are not one.** That is the whole
problem this skill solves. Left to itself the CLI would take `--yes` and silently
choose **stop-only** review — no pre-commit gate, no pre-push gate — for every
plugin user, which is exactly the outcome we treat as a serious bug when it
happens by accident. So **you** ask, in the session, where the user actually is.

---

## Step 0: Check the CLI before asking anything

If this session's context says the `verity` on PATH is a different version from
the plugin's, **tell the user that first**, in one line, before the questions —
with the `npm install -g` command the context gives. Finding out after they have
answered is the failure this step exists to prevent: an older CLI cannot take the
answers.

Then run every command below the way the context says (the plugin's own copy),
not with plain `verity`.

## Step 1: Ask both questions in ONE prompt

Use `AskUserQuestion` with **both** questions in a single call. Do not ask them
one at a time, and do not ask them in prose — this is the only interruption the
setup gets, so spend it once.

**Question 1 — "When should Verity review your code?"** (multi-select)

| Option | Description |
|---|---|
| `After every turn (always on with the plugin, for now)` | Reviews what the agent just wrote, as you work. Fast feedback, never blocks a commit. Under the Claude Code plugin it cannot be turned off yet. |
| `Before commit` | Reviews the staged diff and blocks the commit on a failing review. |
| `Before push / PR` | Reviews the commits about to be pushed and blocks on a failing review. |

Pre-select **After every turn**, and do not call it "recommended": under the
plugin it runs whatever the answer, and a user who unticks it should not find
that out afterwards. Say plainly in the question text that choosing only the
first means **git commits and pushes are not gated**.

**Question 2 — "How deeply should Verity review?"** (single-select)

| Option | Description |
|---|---|
| `Balanced (recommended)` | Security + quality, about 8s per review. |
| `Lightweight` | Critical security only, about 3s. |
| `Thorough` | All tools, all rules, about 15s. |

## Step 2: Run the install with those answers

Map the answers to flags and run it — one command, no prompts, nothing silently
defaulted:

```bash
verity init --yes --no-setup --moments <stop[,pre-commit][,pre-push]> --intensity <balanced|lightweight|thorough>
```

`--moments none` is the deliberate way to gate nothing; an unrecognised value is
refused rather than dropped, so a typo cannot quietly remove a gate.

Pass `stop` only if they ticked it. Under the plugin the Stop review runs either
way and `verity init` says so; recording their real answer is what lets it be
honoured once Stop can be turned off.

This is idempotent and does the whole job: removes the project's own
`.claude/skills/verity-*` copies that the plugin supersedes (they are why the
slash-command list shows every skill twice), stands down duplicate
`.claude/settings.json` hooks so a turn is reviewed once, derives the Standard
and the analysis config if there is none, heals a stale one, and records the
plugin version — which is what stops Verity asking at every session start.

Report what it removed. Those skill directories are usually committed, so the
deletions will show in `git status` and are the user's to commit.

## Step 3: Tell the user to sign in — in their own terminal

**Do not run `verity login` yourself.** It is a GitHub device flow: it prints a
code, waits for the user to approve it in a browser, and blocks until they do.
Started from a tool call it just hangs, and the user never sees the code.

Say this, and stop:

> Verity is set up. One more step, in your own terminal — not here:
>
> ```
> verity login
> ```
>
> It prints a code and a link; approve it in your browser. One login covers every
> repository you can write to, for 90 days. Without it the gate still reviews
> your code — it just records nothing, so there is no history, no cloud memory
> and no dashboard.

If `verity status` already reports an account, skip this step and say so.

If Step 0 found a version mismatch, the `verity` in their terminal is the old
global one, not the plugin's: tell them to update it first (the `npm install -g`
command from Step 0), then log in. An older or experimental build can sign the
machine in to a different server, and the plugin follows that sign-in.

## Step 4: Offer the part a lookup cannot produce

The Standard `init` derives covers the research-backed patterns for the
languages and tools it found. What it deliberately leaves empty is
`custom_patterns` — rules like *"every route under `api/` uses the auth
middleware"*, which need something to read the code for intent.

Offer `/verity:setup` for that, and say it is optional: the gate is already
running.

---

## What NOT to do here

- **Do not wire hooks or edit `.gitignore` yourself.** `verity init` owns that.
  Doing it here is how the two flows drifted apart before — the skill reconciled
  hooks init had just installed and silently removed them.
- **Do not synthesize a Standard by hand.** The CLI derives it in about two
  seconds from the same catalogue you would be reading.
- **Do not run `verity login`.** Step 3.
