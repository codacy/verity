---
description: >-
  Formally verify a small, risky piece of code with a Lean 4 model written by the
  Verity service: rank candidates from git history and the user's hint, CONFIRM with
  the user which code to model, have the service generate the model, check it locally
  with `verity prove check`, and replay any counterexample on the real code before
  calling it a bug. Use when the user asks to verify, prove, or model-check code, or
  asks "can this race / double run / fail open?". Anything typed after /verity:prove
  is the user's hint: the file, function, or worry to check.
---
# /verity:prove — Formal verification of small pieces of code

**The words after `/verity:prove` are the hint.** `/verity:prove` alone means "find me
something worth checking"; `/verity:prove can the Stripe webhook double-charge on a
redelivered event?` names the target and the worry. Carry it through every step as
`$ARGUMENTS`.

Verity keeps **Lean 4 models of the riskiest code**, not of the codebase: a few dozen
lines that abstract ONE function and check a few properties by exhaustive bounded
search. When a property fails you get the **shortest sequence of actions** that breaks
it — a hypothesis to replay on the real code.

**The service does the work; you orchestrate and present.** Ranking, writing the model
and replaying its counterexample all run on the Verity service through the CLI. You
do not search the codebase by hand, read the Lean library, or write Lean yourself
unless a step below says so. Each step is one command; read its output, decide, move on.
Lean runs on this machine only because the user asked for it; nothing here blocks a
commit or a push.

## The flow

### 1. Candidates — one command

```bash
verity prove candidates --limit 8 --json              # no hint
verity prove candidates --hint - --json <<'VERITY_EOF_<random>'
<the hint>
VERITY_EOF_<random>
```

The hint is the user's words, so it goes through the quoted heredoc (`-` means
stdin), never inside `"…"` on the command line, where a `"`, a backtick or `$(…)`
in it would run in the shell. The quotes around the first `VERITY_EOF_<random>`
stop the shell expanding anything. Replace `<random>` with 8 random letters and
digits that you pick for this call, the same at both ends. Text written before you
picked them cannot contain the line that ends the heredoc, so it cannot end it early.

The hint **widens the pool** (files it names by path or content come first) and the
service ranks it, naming a symbol and the properties worth checking per file. Do not
search for the code yourself: if the ranker's list does not contain what the user
meant, say so and ask them for the file or function. A named file or function in the
hint skips ranking: go straight to step 2 with it.

### 2. Confirm with the user — always

**Do not generate a model until the user has said which code.** Present at most three
candidates in one short message: file, the symbol the ranker named, the first property
it suggested, the reason. Ask. Their answer is the scope; do not widen it. If the hint
is a worry in the user's words, it becomes an `intent` property — that needs no further
confirmation, they just gave it.

A hint that names the code, or a candidate the user saw in an earlier session, is
**not** a confirmation of the exact symbol and property. Still ask, in one line:
"I'll model `<file>#<symbol>` for `<property>` — go ahead?" It costs the user one word.

### 3. Set up once per repo

```bash
verity prove init
```

If Lean is missing, say what will be installed and where before running
`verity lean install` (official release, ≈800 MB download, 2.7 GB on disk, into
`~/.verity/lean`). Everything else needs only `verity login`.

### 4. Generate the model — one command

```bash
verity prove generate src/pay.ts#charge --hint - <<'VERITY_EOF_<random>'
<the hint>
VERITY_EOF_<random>
# a region:
verity prove generate src/handler.ts --lines 120-180 --hint - <<'VERITY_EOF_<random>'
<the hint>
VERITY_EOF_<random>
```

Leave out `--hint -` and the heredoc when there is no hint. Pick new letters for
`<random>` on each call.

The service writes the model, the linter fences it, this machine elaborates it, with
up to **3** rounds on compiler errors — all inside the command. It prints the check:
per property `✓ holds to bound k`, `✗ COUNTEREXAMPLE` with the trace, or `? inconclusive`.
Only if it ends with "no model elaborated" do you write one by hand from
`.verity/proofs/Models/README.md` (one symbol, ≤ ~120 lines, `#eval Verity.model …`
header, one `#eval Verity.check …` per property, tagged `.structural` or `.intent` with
`source :=`); check it with `verity prove check <Name>`.

### 5. Replay before you call it a bug — one command

```bash
verity prove replay <Name>                 # every counterexample
verity prove replay <Name> --property P2   # one
```

The service replays the trace on the real code in a network-less container and accepts
an answer only when code ran, the real function's lines appear verbatim in the harness,
and the harness itself printed `REPLAY_RESULT=reproduced`. A model's counterexamples
replay in parallel, so the command takes about as long as one replay (~30 s). **Run it
in the foreground and wait for it**: do not background it, do other work, or report
before every verdict is in. Read the verdict:

- **REPRODUCED** — the real code does this. **This is final: do not replay by hand
  as well.** Report it as a bug (step 6).
- **DIVERGED** — the model is wrong about the code. Revise it **at most twice** with
  the revise command below, each time saying what the replay showed, then replay
  again. After two divergences, report "no faithful model found for `<symbol>`" —
  that is a valid result, not a bug.
- **UNVERIFIED / UNREPLAYABLE** — not evidence either way. Only now replay by hand:
  a throwaway harness in a scratch directory that loads the real module and stubs only
  I/O boundaries **in memory**. Never edit the user's source files, and never read from
  or write to the user's databases, services or local stacks to do this — ask first if
  a stub cannot be faithful.

The revise command. The note goes through the heredoc, as the hint does:

```bash
verity prove generate <target> --revise <Name> --note - <<'VERITY_EOF_<random>'
<what the replay showed>
VERITY_EOF_<random>
```

Never weaken or delete a property to get green; never add one to make something fail.

### 6. Report, in a few lines

What was modelled, what was checked to what bound, what was refuted and whether it
replayed, and what remains `intent` awaiting the user's confirmation. **Never offer to
commit the model** — `.verity/proofs/` is machine-local and ignores itself. What reaches
the team is the bug report and, when asked, the fix. Then record the outcome:

```bash
verity reflect --user-input - --kind gotcha <<'VERITY_EOF_<random>'
Modelled runSeed (cli/src/lib/seed-runner.ts): P1 at-most-once refuted in 2 steps, replayed — guard checks a path the server never writes.
VERITY_EOF_<random>
```

The abstracted file's content leaves the machine for the Verity service and its
replay container; only git-tracked files are ever read.

## Do not

- Search the codebase yourself before the ranker has answered, or instead of asking the user.
- Model code the user did not confirm.
- Write Lean by hand while `verity prove generate` can still try.
- Replay by hand after a REPRODUCED verdict, or present a model-only counterexample as a bug.
- Background `verity prove replay`, or report before its verdicts are in.
- Write to the user's databases or local services, even throwaway rows.
- Put `sorry` in a model, weaken a property to get green, or touch source files.
- Run Lean from a hook, or install anything silently.
- Commit, stage, or un-ignore anything under `.verity/proofs/`.
