# Codacy plugins for Claude Code

```
/plugin marketplace add codacy/verity
/plugin install verity@codacy
```

| Plugin | What it does |
|---|---|
| [**verity**](./plugins/verity) | An independent quality gate for AI-generated code. A different model reviews what your agent just wrote, against your project's standard, before it lands. |

Verity is built by [Codacy](https://codacy.com). The service it talks to lives at
[verity.md](https://verity.md); the plugin and the CLI it carries are open source under
[Apache-2.0](./plugins/verity/LICENSE).

---

### This repository is generated

It is published from Verity's source repository on each release. Open issues and pull
requests here — they reach the same team — but note that changes are made upstream, so a
PR against these files will be re-applied by hand rather than merged.

### Keeping up to date

Claude Code disables auto-update for third-party marketplaces by default. Turn it on in
`/plugin` → **Marketplaces** → `codacy` → **Enable auto-update**, or update when you feel
like it:

```
/plugin update verity@codacy
```
