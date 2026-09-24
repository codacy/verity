---
description: >-
  Capture a durable learning at the end of a task: draft a concrete, cited observation from
  what actually happened and record it straight into the project knowledge base. Use at natural
  task-completion moments, or when the user asks to record a lesson.
---
# /verity:reflect — Capture learnings after a task

At a natural task-completion moment, **the agent reflects and records** — draft a
concrete, cited observation from what actually happened, write it to the project
knowledge base, and say what you wrote. No question, no waiting.

This is the second half of the "reflection flip". Verity first stopped asking the
user to do the reflecting; it now also stops asking permission to keep it. The
human is a reader and editor of the record, not a gate in front of it.

## The flow

### 1. Draft

When a task is complete, draft **1–3** things genuinely worth remembering — a
**decision**, a **gotcha**, or a **pattern** — from what happened this task. Each
item must be **concrete and cited**: name the files, PR, commands, or
error-signatures it came from. **Skip entirely if nothing non-obvious happened**
— an empty reflection is better than a filler one.

That last rule is now the *only* filter. Nobody is going to catch a weak
reflection before it lands, so do not record one.

Pick the right `--kind` per item: `decision`, `gotcha`, `pattern`, `security`,
`quality`, `intent`, `domain`, `integration`.

**Citing the files is not decoration — it is what makes the reflection findable.**
Verity scopes a node to the paths named in its text, and retrieval seeds on that
scope. A reflection that names no file in this repo is recorded and then never
surfaces again, in any future review. So write `src/payments/retry.ts:88`, not
"the retry path".

### 2. Record it

```bash
verity reflect --user-input "<your draft>" --kind <kind>
```

That is the whole step. It never blocks, never prompts, and works the same in a
TTY, a hook, CI, or a cron run.

If the reflection genuinely cannot name its files in prose, scope it explicitly:

```bash
verity reflect --user-input "<your draft>" --kind <kind> --file-globs "src/auth/**"
```

The command warns when a reflection resolved to no files, so you will know when
this is needed rather than discovering it months later as a node nobody read.

**When the *user* authored the words** — they said "record this: …", or dictated
a lesson in their own terms — add `--confirmed`:

```bash
verity reflect --user-input "<what they said>" --kind <kind> --confirmed
```

This is not a formality. Without the flag a reflection is stored as
`source: agent` (confidence 0.7) — *Verity thought this, nobody checked it*. With
it, `source: user` at confidence 1.0 — *a person stands behind this*. The
dashboard, the retrieval ranking, and the next agent to read the node all rely on
the difference. Never pass `--confirmed` for your own draft, even a good one.

### 3. Tell the user, in one line

The command prints the node id, the local file path, and a dashboard link. Relay
it — one line, no ceremony:

> Recorded a gotcha about the Stripe retry path → `.verity/memory/gotchas/n104-stripe-idempotency-keys.md`

They did not agree to this in advance, so they need to know it happened and where
to go if it is wrong. Do not ask them to confirm it after the fact either — the
file is right there, and editing or deleting it is the correction.

### 4. Where it lands

Only Verity's own memory namespace — `.verity/memory/` (mirrored to the service).
Verity never writes a repo's own `agents/memory` or any other store. One node per
item, synced to disk immediately so it is readable and editable straight away.

## Auto-reflection (extract from task history)

Complementary to the above: trigger the server-side LLM extractor to mine the
current task's run history and produce 0–3 nodes. This is the same extraction
that runs automatically on task close and every 5 runs — use it to trigger
mid-task:

```bash
verity reflect
```

Use the draft flow above for the **compound moment** (a specific insight worth a
node); use auto-extract to harvest what the run history shows.

## When to reflect

At natural task-completion moments:

- After creating a PR
- When the user says "done", "ship it", or "that's it"
- When a task is explicitly closed

## Examples of good drafts

- "The Stripe retry logic needs idempotency keys or we double-charge — hit it in `payments/retry.ts:88`." → `gotchas/stripe-idempotency-keys.md`
- "We chose advisory locks over optimistic locking because Supabase supports them natively (see PR #214)." → `decisions/advisory-locks-for-versioning.md`
- "Don't touch the RLS policies without updating the cleanup cron — they're coupled (`migrations/0190`, `cron/cleanup.sql`)." → `gotchas/rls-cleanup-coupling.md`
