---
description: >-
  Configure Verity for this project: create or update the project Standard and
  authenticate. Static analysis is Trivy only and needs no setup. Use when setting Verity up
  for the first time, or when the user asks to change quality rules or severity thresholds.
disable-model-invocation: true
---
# /verity:setup — Configure Verity for this project

You are finishing Verity's setup: the half that needs a model.

**`verity init` already ran the deterministic half** — prerequisites, the skills,
the Claude Code hooks (reconciled to the moments in force), `.gitignore`, the
CLAUDE.md instructions, the optional GitHub login, and the Standard. It recorded
the answers in `.verity/setup.json`. It does not start this skill: the user runs
it, to add or change project rules.

So: **do not re-ask what init asked, and do not re-write what init wrote.** Wiring
hooks or a `.gitignore` block here is how the two flows drifted apart before — the
skill reconciled hooks init had just installed, silently removing them.

⚠ **`verity init` NOW DERIVES THE STANDARD BY ITSELF**, so in most projects there
is nothing here left to do — the languages, the quality dimensions, the security
patterns and `VERITY.md` are all lookups over this same catalogue, and the CLI
does them in about two seconds (`verity standard synthesize`). Static analysis is
Trivy only and needs no configuration. Step 1 will tell
you when that has already happened.

**You are here for the part a lookup cannot produce:** project-specific patterns —
"every route under `api/` uses the auth middleware", "RLS policies on all Supabase
tables". When the user agreed, init already asked the Verity service to write
some (`created_by: verity-generate`). That service saw a profile of the
repository but never its code, so its rules can name the wrong scope or a rule
the code does not follow. You can read the code: check each existing
`custom_patterns` entry against it, fix or remove the wrong ones, and add what
is missing. Without that agreement, `custom_patterns` is empty.

**What is yours when there is no Standard at all** (Step 1 says so, or `--force`):
1. Read the codebase and understand it (Step 2).
2. Synthesize `.verity/standard.yaml` from what you found (Step 4).
3. Upload it, seed the knowledge base, write `VERITY.md` (Steps 7–8).

**Reference files** (bundled alongside this skill, at `${CLAUDE_SKILL_DIR}`):
- `patterns-reference.yaml` — Research-backed patterns catalog (quality, security, language-specific)
- `standard-template.yaml` — YAML skeleton for the Standard

---

## Step 1: Confirm the deterministic phase ran

```bash
verity doctor --json
```

One read gives you prerequisites, which phase is done, the user's recorded
answers, the hook wiring, and a `next` list.

### 1a. If the project is not set up at all, that is init's job, not yours

⚠ **If `phases.init.done` is false, stop and say so — naming the command that
exists on THIS install:**

- **`hooks.source` is `"plugin"`** → `/verity:init`, which the plugin provides.
- **otherwise (npm install)** → `verity init`, run in a terminal. Do **not** send
  an npm user to `/verity:init`: it is a plugin skill, and on that path it does
  not exist. A remedy that names a command the user does not have is worse than
  no remedy — they cannot tell whether they are stuck or broken.

**Do not run `verity init` from this skill.** That flow asks the user its
questions (sign-in, and what to do about the Standard) before it changes
anything, and running it here takes the answers away from them — silently
choosing the defaults: review at turn, commit and push, and formal verification
at push. One skill owns setup, and it is not this one.

Branch on the same `doctor` output:

- **`phases.init.done` is false** → setup has not run here. Point the user at the
  command their install actually has (see 1a) and stop. That is the one place the
  setup questions get asked.
- **`blocked` is true** → a required prerequisite is missing. Show the
  `prerequisites[].remedy` lines and stop; nothing below can work.
- **`artifacts.standard` is true and `phases.setup.done` is true** → the
  project already has a Standard, derived or adopted. Your job is the part the CLI
  leaves empty: propose 2–5 `custom_patterns` from the codebase, show them, and on
  the user's agreement add them to `.verity/standard.yaml` and run
  `verity standard push`. Do NOT rewrite the rest of the Standard — `standard push`
  auto-versions, so a full re-synthesis lands as the version everybody is then
  held to.
- **`artifacts.verityMd` is true and the user did not pass `--force`** → already
  configured. Say "Already configured. Run `/verity:setup --force` to
  reconfigure." and stop.
- A **warn**-status prerequisite (Claude Code, `@codacy/analysis-cli`) is not
  fatal. Mention it once — a missing analysis CLI means no static findings — and
  continue.

Then get the git remote: `git remote get-url origin`. If there is none, ask the
user for a project identifier to use instead.

---

## Step 2: Analyze the codebase

Detect the following by reading project files:

**Languages** — count files by extension:
```bash
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.py" -o -name "*.go" -o -name "*.java" -o -name "*.kt" -o -name "*.rb" -o -name "*.rs" -o -name "*.c" -o -name "*.cpp" \) -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" -not -path "*/vendor/*" | sed 's/.*\.//' | sort | uniq -c | sort -rn
```

**Frameworks** — check config files and dependencies:
- Read `package.json` → check `dependencies` and `devDependencies` for React, Express, Next.js, Vue, Angular, Fastify, NestJS, etc.
- Read `pyproject.toml` or `requirements.txt` → check for Django, Flask, FastAPI, etc.
- Read `go.mod` → check for gin, echo, fiber, etc.
- Read `pom.xml` or `build.gradle` → check for Spring, etc.

**Architecture** — check for markers:
- `lerna.json`, `pnpm-workspace.yaml`, `nx.json`, `turbo.json` → monorepo
- Multiple `go.mod` or multiple `package.json` → monorepo
- `services/` or `packages/` directories → monorepo or microservices
- Single root → monolith

**Context** — read for additional insight:
- `README.md` — project description, purpose
- `CLAUDE.md` — existing agent instructions
- Recent `git log --oneline -10` — commit patterns

Record all findings. You will use them in the next steps.

---

## Step 3: Read the choices already made

From the `verity doctor --json` output in Step 1:

| Field | What it is | Where you use it |
|---|---|---|
| `answers.moments` | `stop`, `pre-commit`, `pre-push` | Nothing to do — the hooks are already wired to exactly this |
| `answers.telemetry` | `enabled` \| `declined` \| `deferred` | Nothing to do — mention `deferred` once (see below) |

**Do not ask these again.** They were asked on init's terminal, and the machine
state already reflects them.

If `answers.telemetry` is `deferred`, the user asked for cost & usage telemetry
before a token existed. Say so once, and that `verity login` followed by
`verity telemetry install` finishes it. Do not run either — logging in is the
user's decision to make at a terminal.

---

## Step 4: Synthesize the Standard

Read `${CLAUDE_SKILL_DIR}/patterns-reference.yaml` and `${CLAUDE_SKILL_DIR}/standard-template.yaml`.

Generate `.verity/standard.yaml` by filling in the template:

1. **knowledge_spec**: Fill from Step 2 findings (project_name from git remote or directory, languages, frameworks, architecture, build_system, test_framework).

2. **quality_dimensions**: Keep all 4. Adjust thresholds if the existing codebase diverges significantly (e.g., if average file length is 500, set threshold to 400 instead of 300). Add language-specific type_safety signals from the patterns reference.

3. **security_patterns**: Keep all 7. Static analysis is Trivy only, so `enforced_by` lists Trivy where the patterns reference says Trivy enforces the pattern (secrets, dependency verification) and is `[]` everywhere else.

4. **custom_patterns**: Synthesize 2-5 project-specific patterns by analyzing:
   - Project structure (e.g., "all files in `api/` use auth middleware")
   - README/docs stated conventions
   - Existing code patterns (e.g., "RLS policies on all Supabase tables")
   - Each pattern needs: id, description, severity, rationale

5. **process_constraints**: Keep `self_healing_limit: 2`. Leave the knowledge-system flags (`compound_enabled`, `memory_graph_enabled`, `memory_graph_budget_tokens`, `knowledge_injection_budget_tokens`, `finding_autosuppress_threshold`) and intent thresholds (`intent_fail_threshold`, `intent_warn_threshold`) at their template defaults — they're surfaced so users can tune later, not so you pick new values during setup.

6. **tool_configuration**: `{ Trivy: { enabled: true } }`. There is nothing else to choose.

Write the file to `.verity/standard.yaml`. Show the user a summary:
> **Standard synthesized:**
> - Languages: typescript, python
> - Quality dimensions: 4 (comprehensibility, modularity, type_safety, test_adequacy)
> - Security patterns: 7 (3 critical, 4 high)
> - Custom patterns: 3 (auth-middleware, rls-policy, error-boundary)
> - Static analysis: Trivy

Ask for confirmation before proceeding.

---

## Step 5: Static analysis — nothing to configure

Static analysis is Trivy only, and Verity configures and runs it itself from
`.verity/static-analysis.json`. **Do not write `.codacy/codacy.config.json`, an
ESLint config or any pattern list.** The project's `.codacy/` files belong to the
project and to Codacy's own tooling, and the gate does not read them.

---

## Step 6: Check authentication

Login happens in `verity init` (an optional, skippable step), **not** here. This
step only checks whether it happened, and branches the rest of setup.

```bash
verity auth verify
```

- **Token valid** (prints the project name): continue to Step 7 — the Standard,
  config, and knowledge base will upload.
- **Not authenticated / no token**: the user skipped login in `verity init` (or
  lacks write access). Verity runs in **local-only mode** — the gate still runs
  and surfaces findings, but nothing uploads and no history is stored. **Skip
  Step 7** (it requires a token) and continue to Step 8. Tell them they can
  authenticate anytime with:

  ```bash
  verity login         # one GitHub login covers every repo you can write to
  ```

  Then re-run `/verity:setup --force` to upload what was generated locally.

**If the user asks what signing in does or why it matters:**
- It confirms they have **write access to this repository** — the GitHub token is
  used **once** for that check, then discarded. Verity never stores it.
- It does **not** give Verity access to their code. Code checked by the gate is
  analyzed **in memory and discarded**.
- It is **required to store and access run history** (past results, trends,
  shareable reports).
- Login is **provider-gated** (GitHub today) via a GitHub App **device flow**
  ("open https://github.com/login/device and enter code WXYZ-1234"). The App
  requests only read-only permissions (Metadata + Email addresses).
- **One login covers every repository** the user can write to. Re-running
  `verity login` is also how newly-granted repos are picked up and how an expired
  verification is restored. If login reports this repository is **not covered**,
  the Verity GitHub App has not been granted access to it — grant it, then re-run
  `verity login`.

The token and service_url live in the single global file `~/.verity/credentials`
— nothing secret is written into the repo.

---

## Step 7: Upload the Standard

> **Skip this entire step if the user is not authenticated** (Step 6 reported
> local-only mode). These commands require a token and will fail without one. The
> `.verity/standard.yaml` you generated locally is pushed automatically the next
> time the user signs in.

### Upload the Standard

The `verity` CLI handles YAML→JSON conversion automatically:

```bash
verity standard push
```

This reads `.verity/standard.yaml`, converts it to JSON, and uploads it. Verify the output shows `version: 1`.

### Seed the knowledge base

```bash
verity memory seed
```

This derives a small set of descriptive memory nodes from what you already analyzed in Steps 2–4: a `domain/project-overview.md` from `knowledge_spec`, one `integrations/{framework}.md` per detected framework, a `domain/project-purpose.md` from the README's first paragraph if present, and sections of `CLAUDE.md` split into the appropriate domains if the file exists. Nodes are marked `source: extractor`, `created_by: seed`, so the user can tell them apart from reflections they author later. The command is idempotent — re-running is a no-op unless `--force` is passed. Tell the user how many were seeded (the command prints the count) and point them at `/knowledge` on the dashboard to review.

---

## Step 8: Generate VERITY.md file

Create `VERITY.md` at the project root with this content:

```markdown
# VERITY.md — Quality Gate

> This project uses [Verity](https://verity.md) to enforce quality and security standards on AI-generated code.

**URL:** ${SERVICE_URL}
**Project:** ${PROJECT_ID}
**Standard:** v1

## Quality Dimensions
- Comprehensibility (file length, complexity, naming)
- Modularity (separation of concerns, shallow abstractions)
- Type Safety (strict types, explicit returns)
- Test Adequacy (coverage, test quality)

## Security Patterns
- No hardcoded secrets (CWE-798)
- Input sanitization (CWE-20)
- Parameterized queries (CWE-89)
- Dependency verification (CWE-1395)
- No unsafe deserialization (CWE-502)
- Access control checks (CWE-639)
- Config file integrity (CWE-15)

## How It Works
Every time the coding agent stops, the Verity hook:
1. Runs static analysis via @codacy/analysis-cli
2. Sends results + code to the Verity service
3. Gemini independently reviews the code
4. Returns PASS / WARN / FAIL with actionable findings
```

---

## Step 9: Offer a `.verityignore` (optional)

Only if the codebase analysis in Step 2 found committed generated output —
`dist/`, `build/`, vendored bundles, generated API clients, large fixture
corpora. Do NOT create the file speculatively; an empty or guessed ruleset is
worse than none.

Ask the user first, naming the specific directories you found. If they agree,
write `.verityignore` at the repo root, gitignore syntax, and **commit it** — it
is a shared team decision, not machine-local state, so it does NOT go in
`.gitignore`.

```
# Generated — reviewing it grades a generator, not a person.
src/generated/**
dist/

# …but keep this one in scope.
!dist/entry.js
```

Rules, in the order they matter:

- **Last match wins.** A later `!` line re-includes what an earlier line
  excluded. Order is load-bearing.
- A pattern with **no slash** matches at any depth (`*.min.js`). One **with** a
  slash is anchored to the repo root (`src/generated/**`).
- `**`, `*`, `/` and `**/*` on their own are **refused** — they exclude the whole
  repository, which is turning the product off rather than scoping it.

Two things to tell the user, because both surprise people:

1. **It cannot hide a finding you just created.** Any turn that changes
   `.verityignore` has its rules suspended entirely, and the edit is always
   reviewed. A rule takes effect from the next turn onward.
2. **A pattern that covers a secret is warned about, not refused** — `config/**`
   also hides `config/.env`. Verity says so at push time and again on any run
   where it actually excludes one. Add a `!` rule if that is not what was meant.

Excluded files are still named in every run's coverage ledger, and the share of
changed files they cover is reported — an ignore file is never silent.

---

## Step 10: Show summary

Report both halves, so the user sees one flow rather than two:

```
=== Verity setup complete ===

Project:      ${PROJECT_NAME}
Languages:    ${LANGUAGES}
Frameworks:   ${FRAMEWORKS}
Architecture: ${ARCHITECTURE}

This step wrote:
  .verity/standard.yaml        — Standard v1 (4 quality, 7 security, N custom patterns)
  VERITY.md                    — project quality overview
  .verityignore                — only if you created one in Step 9

Already in place from verity init:
  Hooks:      ${MOMENTS}        (+ intent, baseline, compact, session-end)
  Telemetry:  ${TELEMETRY_STATUS}
  Uploads:    ${authenticated ? "on — runs & memory sync to Verity" : "off — local-only mode"}

Next: the gate now runs at the moments you chose. You should see the first
analysis below.
```

Run `verity doctor` if anything above looks wrong — it reports the real state of
every part of the install.
