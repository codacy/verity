---
description: >-
  View and manage the durable project knowledge Verity has accumulated — decisions, patterns,
  gotchas, and conventions extracted from past analysis runs. Use when the user asks what
  Verity has learned, or before changing an area of the code you do not know.
---
# /verity:learn — View and manage project knowledge

Project knowledge is durable insights extracted from analysis runs — decisions, patterns, gotchas, and conventions. When the memory graph is enabled (`memory_graph_enabled`), this skill delegates to the graph. Otherwise, it uses flat lessons.

## Graph mode (memory_graph_enabled = true)

When the memory graph is active, `/verity:learn` delegates to `/verity:memory`. Use these commands:

- **List nodes**: `ls .verity/memory/*/` or see `/verity:memory list`
- **Show a node**: `cat .verity/memory/<domain>/<slug>.md` or see `/verity:memory show <node_id>`
- **Walk the graph**: see `/verity:memory walk --files <files>`
- **Add knowledge**: see `/verity:memory add <kind> "<title>"`

For full documentation, use `/verity:memory`.

## Flat mode (memory_graph_enabled = false, default for existing projects)

### List lessons

```bash
curl -s -H "Authorization: Bearer $VERITY_TOKEN" \
  "$(verity config service-url)/compound/lessons" | jq '.lessons[] | {id, kind, title, confidence}'
```

### Add a lesson (user-authored)

```bash
curl -s -X POST -H "Authorization: Bearer $VERITY_TOKEN" \
  -H "Content-Type: application/json" \
  "$(verity config service-url)/compound/lessons" \
  -d @- <<'VERITY_EOF_<random>'
{
  "kind": "gotcha",
  "title": "RLS policies and cleanup cron are coupled",
  "body": "Changing RLS policies without updating the cleanup cron will break retention.",
  "file_globs": ["server/supabase/migrations/**"]
}
VERITY_EOF_<random>
```

The body is read from the quoted heredoc (`-d @-`), never from a `'…'` string on
the command line, where a quote or `$(…)` in the user's words would run in the
shell. Inside it is plain JSON: escape `"` as `\"` and `\` as `\\`.

Replace `<random>` with 8 random letters and digits that you pick for this call,
the same at both ends. Text written before you picked them cannot contain the
line that ends the heredoc, so it cannot end it early.

Valid kinds: `bug_pattern`, `architectural_decision`, `gotcha`, `preferred_convention`, `false_positive_rule`, `intent_template`.

### Archive a lesson

```bash
curl -s -X PATCH -H "Authorization: Bearer $VERITY_TOKEN" \
  -H "Content-Type: application/json" \
  "$(verity config service-url)/compound/lessons/<lesson-id>" \
  -d '{"status": "archived"}'
```

### Trigger extraction

```bash
curl -s -X POST -H "Authorization: Bearer $VERITY_TOKEN" \
  -H "Content-Type: application/json" \
  "$(verity config service-url)/compound/extract" \
  -d @- <<'VERITY_EOF_<random>'
{"task_id": "<task-uuid>"}
VERITY_EOF_<random>
```

## How it works

1. **Extraction**: When a task closes or reaches 5 runs, an LLM extracts 0-3 durable knowledge items.
2. **Injection**: On each analysis run, the most relevant knowledge is scored and injected into the reviewer prompt.
3. **Compounding**: Knowledge that proves useful gets higher confidence. Unused knowledge is eventually archived.
