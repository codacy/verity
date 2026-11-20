---
description: >-
  Browse, query, and extend the project knowledge graph at .verity/memory/ — typed nodes and
  edges covering decisions, patterns, security constraints, and gotchas. Use to pull prior
  context on files you are about to change, or when the user asks to record or inspect project
  knowledge.
---
# /verity:memory — Manage the project knowledge graph

The memory graph is a collection of markdown nodes at `.verity/memory/` organized into 8 domains. Each node has YAML frontmatter with typed edges that form a graph. The graph is the project's accumulated knowledge — decisions, patterns, gotchas, security constraints, and more.

## Commands

### List nodes

```bash
# List all active nodes
curl -s -H "Authorization: Bearer $VERITY_TOKEN" \
  "$(verity config service-url)/compound/memory/nodes" | jq '.nodes[] | {node_id, kind, title, confidence}'

# Filter by kind
curl -s -H "Authorization: Bearer $VERITY_TOKEN" \
  "$(verity config service-url)/compound/memory/nodes?kind=security" | jq '.nodes[]'
```

Or browse locally: `ls .verity/memory/*/`

### Show a node

```bash
curl -s -H "Authorization: Bearer $VERITY_TOKEN" \
  "$(verity config service-url)/compound/memory/nodes/<node_id>" | jq '.'
```

Or read directly: `cat .verity/memory/decisions/<slug>.md`

### Walk the graph

Find related knowledge by seeding from files you're working on:

```bash
curl -s -X POST -H "Authorization: Bearer $VERITY_TOKEN" \
  -H "Content-Type: application/json" \
  "$(verity config service-url)/compound/memory/walk" \
  -d @- <<'VERITY_EOF_<random>'
{"seed_files": ["src/auth/tokens.ts"], "max_hops": 2, "budget_tokens": 2000}
VERITY_EOF_<random>
```

### Add a node (user-authored)

User-authored nodes get `confidence: 1.0` and are never auto-archived:

```bash
curl -s -X POST -H "Authorization: Bearer $VERITY_TOKEN" \
  -H "Content-Type: application/json" \
  "$(verity config service-url)/compound/memory/nodes" \
  -d @- <<'VERITY_EOF_<random>'
{
  "kind": "gotcha",
  "title": "RLS policies and cleanup cron are coupled",
  "body": "Changing RLS policies without updating the cleanup cron will break retention.",
  "file_globs": ["server/supabase/migrations/**"],
  "domains": ["security", "database"]
}
VERITY_EOF_<random>
```

The body is read from the quoted heredoc (`-d @-`), never from a `'…'` or
`"…"` string on the command line, where a quote or `$(…)` in the user's words
would run in the shell. Inside the heredoc it is plain JSON: escape `"` as `\"`
and `\` as `\\` in the title and body, as JSON requires.

Replace `<random>` with 8 random letters and digits that you pick for this call,
the same at both ends. Text written before you picked them cannot contain the
line that ends the heredoc, so it cannot end it early.

Valid kinds: `decision`, `quality`, `security`, `intent`, `gotcha`, `pattern`, `domain`, `integration`.

Or create the markdown file directly at `.verity/memory/<domain>/<slug>.md` with proper frontmatter (see `.verity/memory/SCHEMA.md` for the template).

### Ask the graph a question

```bash
verity memory ask --json - <<'VERITY_EOF_<random>'
why do we check the Gateway at the API level and not just TCP?
VERITY_EOF_<random>
```

The command prints the matching nodes, best first, with their ids and paths.
It also quotes the sentences that answer the question, each with the id of its
node. It runs on the local files: nothing is sent, and no model writes the
answer. Read the nodes before you rely on a quote. `--full` prints whole bodies,
`--limit <n>` sets how many nodes come back, and `--all` includes archived nodes.
`verity memory recall` is the same command.

### Edit a node

```bash
# Change the files the node is about. Each glob must match a file in the repository.
verity memory edit <node-id> --file-globs scripts/verity.sh 'config/*.yaml'

# Replace the body
verity memory edit <node-id> --body - <<'VERITY_EOF_<random>'
<the new body>
VERITY_EOF_<random>

# Or edit .verity/memory/<domain>/<slug>.md by hand (the title too), then upload it as it is
verity memory edit <node-id>
```

The command uploads the node at once and reads it back from the service. It
fails if the service did not take the change. `--status active|archived|superseded`
changes only the status. If a teammate changed the node on the service since
your last pull, the command refuses and changes nothing: run `verity memory pull`
and edit again, or pass `--force` to overwrite their version. The source, author
and confidence of a node stay as the service recorded them.

### Delete a node

```bash
verity memory delete <node-id> --reason - <<'VERITY_EOF_<random>'
<why the node is wrong or no longer applies>
VERITY_EOF_<random>
```

The node is archived on the service for the whole team, and its file is removed
here. The text and the reason are kept on this machine in `.verity/.memory-trash/`.
`verity memory restore <node-id>` undoes it.

### Consolidate the graph

```bash
verity memory dream            # print the plan; changes nothing
verity memory dream --apply    # make the changes, and save a report in .verity/dreams/
verity memory dream --revert <dream-id>
verity memory dream --list
```

`dream` merges near-duplicate nodes of one kind into the strongest one, and the
strongest one takes over their file_globs. It also retires the nodes that the
graph marks as superseded, and it prunes empty placeholders. It never changes a
node with `source: user`. It lists for a person the pairs that only may be the
same, and the contradictions that nothing in the graph settles. Show the plan
to the user before you run `--apply`.

### Run lint

Check for orphan nodes, stale knowledge, missing backlinks, and contradictions:

```bash
curl -s -X POST -H "Authorization: Bearer $VERITY_TOKEN" \
  "$(verity config service-url)/compound/memory/lint"
```

Results appear in `.verity/memory/log.md` after the next sync.

## How the graph works

1. **Extraction**: When tasks close or reach 5 runs, an LLM extracts 0-3 knowledge nodes with typed edges.
2. **Sync**: On every analysis run, the CLI sends a manifest of local files. The server returns new nodes as `memory_writes[]` that the CLI applies locally.
3. **Injection**: The reviewer prompt receives a graph-walk neighborhood (2 hops from changed files, budget-capped at 2000 tokens).
4. **Linking**: Nodes connect opportunistically via shared file_globs, keyword overlap, and shared evidence runs.
5. **Lint**: Weekly checks for orphans, stale nodes, contradictions, and missing backlinks.

## Domains

| Directory | Purpose |
|-----------|---------|
| `decisions/` | Architectural choices (WHY is it this way?) |
| `quality/` | Quality patterns (WHAT does "good" mean here?) |
| `security/` | Security constraints (WHAT must be protected?) |
| `intent/` | Intent templates (WHAT does the user expect?) |
| `gotchas/` | Footguns and surprises (WHAT will trip you up?) |
| `patterns/` | Code conventions (HOW should it be done?) |
| `domain/` | Business logic concepts (WHAT does this mean?) |
| `integrations/` | External system knowledge (WHAT's around us?) |

## Obsidian compatibility

The `.verity/memory/` directory is designed to open directly in Obsidian, Foam, or Logseq. Nodes use `[[wikilink]]` syntax for cross-references.
