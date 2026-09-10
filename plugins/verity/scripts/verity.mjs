#!/usr/bin/env node
/**
 * The one owner of "can Verity run right now, and if not, what does the user do
 * about it".
 *
 * Every hook in hooks.json goes through this script rather than naming a binary
 * directly. Six literal commands would each have to answer the same question and
 * would drift apart doing it — the same reason lib/git-frame.ts and
 * lib/may-block.ts exist in the CLI.
 *
 * Resolution order, first hit wins:
 *
 *   0. $VERITY_CLI_PATH        — explicit override. Dev seam (point it at your
 *                                working tree's cli/bin/verity.js) and the escape
 *                                hatch when someone needs a specific build.
 *   1. <plugin>/node_modules   — the normal path. Claude Code runs
 *                                `npm ci --ignore-scripts` here on install and on
 *                                every version bump, so this is also how the
 *                                plugin installs and updates the CLI at all.
 *   2. $CLAUDE_PLUGIN_DATA     — survives plugin updates; written by the self-heal
 *                                below when (1) failed.
 *   3. `verity` on PATH        — a pre-existing global install.
 *   4. self-heal               — install the pinned version into the data dir.
 *
 * Cases 0-2 `import()` the CLI into THIS process instead of spawning a child.
 * We are already a Node process; spawning a second one doubles cold start on
 * every hook invocation. Running in-process also preserves the hook contract for
 * free — exit codes (the git guard's exit 2 is what blocks a commit), stdout
 * (SessionStart stdout becomes agent context), and the piped stdin JSON are all
 * simply this process's.
 *
 * Nothing here ever throws or blocks. A hook that cannot find the CLI must let
 * the session continue; a quality gate that breaks the agent when it is
 * misconfigured is worse than no gate.
 */
import { existsSync } from 'node:fs'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'

// The plugin root from our own location — never from ${CLAUDE_PLUGIN_ROOT}
// substitution, which would be one more thing that can be wired wrong.
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const PLUGIN_ROOT = dirname(SCRIPT_DIR)

// Claude Code sets CLAUDE_PLUGIN_DATA for plugin subprocesses. The fallback is a
// path we own, so self-heal still has somewhere to write if it is ever absent.
const PLUGIN_DATA = process.env.CLAUDE_PLUGIN_DATA || join(homedir(), '.verity', 'plugin-cli')

const CLI_PACKAGE = '@codacy/verity-cli'
const CLI_ENTRY = join('node_modules', CLI_PACKAGE, 'bin', 'verity.js')

/**
 * Tell the CLI it is running as the plugin, and hand it the plugin's user
 * config.
 *
 * VERITY_PLUGIN_ROOT is the CLI's only exact answer to "was I launched by the
 * plugin?", which is what lets a project with BOTH the plugin's hooks and
 * `verity init`'s settings.json hooks gate each turn once instead of twice
 * (cli/src/lib/plugin-ownership.ts). Nothing else sets it.
 *
 * Claude Code exposes a plugin's userConfig to hook processes as
 * CLAUDE_PLUGIN_OPTION_<KEY>. Mapping service_url onto VERITY_SERVICE_URL —
 * which the CLI already treats as explicit user intent — is what makes the
 * manifest's setting reach the backend selection. Read in both cases because the
 * key's casing is not something we should be brittle about.
 */
async function exportPluginEnv() {
  process.env.VERITY_PLUGIN_ROOT = PLUGIN_ROOT
  try {
    const pkg = JSON.parse(await readFile(join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json'), 'utf-8'))
    if (pkg.version) process.env.VERITY_PLUGIN_VERSION = String(pkg.version)
  } catch {
    // Diagnostics only.
  }
  const serviceUrl =
    process.env.CLAUDE_PLUGIN_OPTION_SERVICE_URL || process.env.CLAUDE_PLUGIN_OPTION_service_url
  if (serviceUrl && !process.env.VERITY_SERVICE_URL) {
    process.env.VERITY_SERVICE_URL = serviceUrl
  }
}

/** One line to stderr. Hooks must never write noise to stdout — it becomes context. */
function warn(message) {
  process.stderr.write(`[verity-plugin] ${message}\n`)
}

/** The CLI version this plugin build pins, read from its own manifest. */
async function pinnedVersion() {
  try {
    const pkg = JSON.parse(await readFile(join(PLUGIN_ROOT, 'package.json'), 'utf-8'))
    return pkg.dependencies?.[CLI_PACKAGE] ?? 'latest'
  } catch {
    return 'latest'
  }
}

/**
 * Hand this process to the CLI bundle. argv is rewritten first because the
 * bundle parses it at import time. Returns false if the import failed so the
 * caller can try the next candidate — an install that is present but corrupt
 * (an interrupted `npm ci`, say) must not be a dead end.
 */
async function runInProcess(entry, args) {
  process.argv = [process.argv[0], entry, ...args]
  try {
    await import(pathToFileURL(entry).href)
    return true
  } catch (err) {
    warn(`could not load ${entry}: ${err?.message ?? err}`)
    return false
  }
}

/**
 * A global `verity` is a binary of unknown shape, so this one gets a child
 * process. Exits with the child's status on success; returns (falls through to
 * the next candidate) when the binary is absent or could not be spawned.
 */
function runGlobal(args) {
  const res = spawnSync('verity', args, { stdio: 'inherit' })
  if (res.error || res.status === null) return
  process.exit(res.status)
}

/**
 * Install the pinned CLI into the data directory, once.
 *
 * Only attempted from the SessionStart hook: it is the first hook of any session
 * and the one moment where a few seconds of delay is not felt mid-turn. A marker
 * file makes the attempt once per plugin version rather than once per session, so
 * a machine that is offline or behind a proxy retries on the next upgrade instead
 * of paying an npm timeout at the start of every session forever.
 */
async function selfHeal(version) {
  const marker = join(PLUGIN_DATA, `.install-attempted-${version}`)
  if (existsSync(marker)) return false
  try {
    await mkdir(PLUGIN_DATA, { recursive: true })
    await writeFile(marker, new Date().toISOString())
  } catch {
    return false
  }
  warn(`installing ${CLI_PACKAGE}@${version}…`)
  const res = spawnSync(
    'npm',
    ['install', '--prefix', PLUGIN_DATA, '--no-audit', '--no-fund', `${CLI_PACKAGE}@${version}`],
    { stdio: ['ignore', 'ignore', 'inherit'], timeout: 120_000 },
  )
  return res.status === 0 && existsSync(join(PLUGIN_DATA, CLI_ENTRY))
}

async function main() {
  const args = process.argv.slice(2)
  await exportPluginEnv()
  // "Is this project set up?" is NOT answered here. The resolver used to carry
  // a directory walk for it that stopped at the first `.git` — which in a linked
  // worktree is a FILE in the worktree root, so it never reached the main
  // checkout where the gitignored `.verity/` lives, and told the agent every
  // session that a working gate needed setting up. The CLI's `verity baseline
  // capture` answers it with verityConfigured(), which asks git. One owner.
  // SessionStart is the only hook allowed to spend time healing (see selfHeal).
  const mayHeal = args[0] === 'baseline'

  const override = process.env.VERITY_CLI_PATH
  if (override && existsSync(override)) {
    if (await runInProcess(override, args)) return
  }

  for (const base of [PLUGIN_ROOT, PLUGIN_DATA]) {
    const entry = join(base, CLI_ENTRY)
    if (existsSync(entry) && (await runInProcess(entry, args))) return
  }

  runGlobal(args) // exits the process when a global CLI is present

  if (mayHeal) {
    const version = await pinnedVersion()
    if (await selfHeal(version)) {
      if (await runInProcess(join(PLUGIN_DATA, CLI_ENTRY), args)) return
    }
  }

  warn(
    'Verity CLI not found — this session is running without the quality gate. ' +
      'Try `/plugin update verity@verity`, or install it directly with ' +
      `\`npm install -g ${CLI_PACKAGE}\`.`,
  )
  // Exit 0, always. A missing CLI is our problem, not the agent's.
  process.exit(0)
}

main().catch((err) => {
  warn(`unexpected error: ${err?.message ?? err}`)
  process.exit(0)
})
