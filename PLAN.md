# sloplint — AI slop linter

## Problem

AI-generated code has recognizable low-quality patterns that slip through review:
- Comments restating what code does ("Initialize the counter", "This function handles...")
- Numbered step comments ("Step 1:", "Step 2:")
- Section divider banners ("// --- Helpers ---", "// ============")
- Empty catch/except blocks silently swallowing errors
- console.log in error handlers instead of console.error
- Redundant else after return
- Boolean literal arguments (readability trap)

These patterns are **language-agnostic** in concept but differ in syntax across languages.

## What we're detecting (rule catalog)

### Comment patterns (universal — differ only by comment syntax)
1. **obvious-comment** — "Initialize the counter", "Create a new instance", "Return the result"
2. **narrator-comment** — "This function handles...", "This method is responsible for..."
3. **step-comment** — "Step 1:", "Step 2:" numbered steps
4. **section-divider** — "// --- Helpers ---", "# ========", banner comments

### Code patterns (language-specific)
5. **empty-error-handler** — empty catch/except/recover blocks
6. **log-in-error-handler** — console.log / print in catch instead of proper error logging
7. **error-message-only** — logging error.message instead of the full error object (loses stack trace)
8. **redundant-else-return** — else after a branch that returns/throws/continues

### Target languages
TypeScript, JavaScript, Python, Go, Rust, C, C++, Java

## Tool evaluation

### Option A: ast-grep CLI (sg scan with YAML rules)
**Pros:**
- Already installed, fast, YAML rules, good diagnostics output
- Proven to work for comment rules (tested above)
- Supports all target languages via tree-sitter

**Cons:**
- **One language per rule file** — no way around this. 4 comment rules × 8 languages = 32 nearly identical YAML files
- Comment node `kind` varies by language (see table below)
- Needs a generator to avoid duplication

### Option B: Semgrep
**Pros:**
- `languages: [python, javascript, go, ...]` in a single rule file
- Large ecosystem, CI-friendly

**Cons:**
- Not installed, heavier dependency (Python/OCaml runtime)
- Slower than ast-grep
- `generic` mode is line-based, not AST-aware
- Rules license changed in Dec 2024

### Option C: @ast-grep/napi (programmatic API in TypeScript)
**Verified working** — `@ast-grep/napi` exposes the full ast-grep engine as a Node.js API:

```ts
import { parse, Lang, registerDynamicLanguage } from '@ast-grep/napi'
import python from '@ast-grep/lang-python'

registerDynamicLanguage({ python })
const root = parse('python', code).root()
const hits = root.findAll({ rule: { kind: 'comment', regex: '...' } })
```

Available `@ast-grep/lang-*` packages: c, cpp, csharp, go, java, kotlin, python, rust, swift, plus TS/JS/HTML/CSS built-in.

**Pros:**
- **One rule definition in TypeScript, loop over all languages** — zero YAML duplication
- Full access to SgNode API: `.kind()`, `.text()`, `.next()`, `.parent()`, `.range()`, `.children()`
- `findInFiles()` for parallel multi-threaded scanning (Rust threads under the hood)
- Can combine regex + AST context freely (e.g., check if comment text mirrors the next sibling's function name)
- Smart detection possible: compare comment text to adjacent code
- Distributable as npm package (`bunx sloplint`) or standalone CLI
- `node.getRoot().filename()` in findInFiles callback gives the file path

**Cons:**
- Need to build our own CLI and diagnostics output
- Depends on native modules (the @ast-grep/lang-* packages have postinstall scripts)
- Comment node `kind` still varies by language — but we handle it in a simple map, not duplicated files

### Option D: ast-grep CLI + generator script (hybrid)
**Pros:**
- ast-grep CLI as runtime — proven output format, CI-friendly
- Generator eliminates YAML duplication

**Cons:**
- Extra build step
- Limited to what YAML rules can express — no "compare comment text to next AST node"
- Two tools (generator + sg) instead of one

## Comment node kinds by language (verified)

| Language   | Comment kinds                    |
|------------|----------------------------------|
| TypeScript | `comment`                        |
| JavaScript | `comment`                        |
| Python     | `comment`                        |
| Go         | `comment`                        |
| C          | `comment`                        |
| C++        | `comment`                        |
| Rust       | `line_comment`, `block_comment`  |
| Java       | `line_comment`, `block_comment`  |

## Recommendation: Option C (@ast-grep/napi)

Reasoning:
1. **Zero duplication.** One rule definition in TS works across all 8 languages. The only per-language variation (comment node kind) is a 2-entry map, not 32 YAML files.
2. **Smarter detection.** The API gives us `.next()`, `.parent()`, `.text()` — we can check if a comment just mirrors its adjacent code (e.g., "// increment counter" above `counter++`). YAML rules can't do this.
3. **One tool, not two.** No generator step, no YAML — just TypeScript.
4. **Fast.** `findInFiles` runs Rust threads. `parse()` is native. This is not "slow JS" — it's a thin TS layer over ast-grep's Rust core.
5. **Distribution.** `npm install -D sloplint` / `bunx sloplint .` — standard toolchain.
6. **Extensible.** Users can add custom rules in JS/TS that have full AST access. YAML rules can't express "if the function is named X and the comment says X, warn".

The CLI we need to build is minimal: walk args, call `findInFiles` per language, format diagnostics. ~200 lines.

## Architecture

```
sloplint/
├── src/
│   ├── cli.ts                      # entry point: arg parsing, orchestration, exit code
│   ├── rules/
│   │   ├── comments.ts             # comment pattern rules (shared across all languages)
│   │   ├── error-handling.ts       # empty catch, log-in-catch, etc. (per-language patterns)
│   │   └── index.ts                # rule registry
│   ├── languages.ts                # per-language config (comment kinds, file extensions, tool directives)
│   ├── scanner.ts                  # findInFiles orchestration per language
│   └── formatter.ts                # diagnostic output formatting
├── test/
│   ├── fixtures/                   # test files with known slop patterns per language
│   └── rules.test.ts              # run rules on fixtures, assert expected diagnostics
├── package.json
├── tsconfig.json
├── README.md
└── PLAN.md
```

### How it works

```ts
// languages.ts — single source of truth for per-language variation
const LANGUAGES = {
  typescript: {
    lang: Lang.TypeScript,
    commentKinds: ['comment'],
    extensions: ['ts', 'tsx'],
    toolDirectives: /eslint|prettier|@ts-|istanbul|vitest|jest/i,
  },
  rust: {
    lang: 'rust',
    commentKinds: ['line_comment', 'block_comment'],
    extensions: ['rs'],
    toolDirectives: /clippy|allow|deny|forbid|expect|cfg|rustfmt/i,
  },
  // ...
}

// rules/comments.ts — one definition, all languages
function obviousComment(node: SgNode, lang: LanguageConfig): Diagnostic | null {
  if (!lang.commentKinds.includes(node.kind())) return null
  if (lang.toolDirectives.test(node.text())) return null
  if (!/(?i)^(\/\/|#)\s*(initialize|create|handle|return|...)\s/.test(node.text())) return null
  return { rule: 'obvious-comment', message: '...', node }
}
```

### Key design decisions

1. **Rules are functions, not YAML.** A rule is `(node: SgNode, langConfig) => Diagnostic | null`. This lets us do arbitrary logic — compare comment text to adjacent code, check nesting depth, etc.

2. **Two-pass architecture.** First pass: `findAll({ kind: commentKind })` to get all comments, run comment rules. Second pass: language-specific AST pattern rules via `findAll({ rule: ... })`.

3. **findInFiles for speed.** For scanning whole projects, use `findInFiles` which runs Rust threads. For single-file/stdin, use `parse()`.

4. **Existing ast-grep YAML rules still work.** The `rules/` directory from the prototype is kept and can be used with `sg scan` independently. The napi tool is an alternative runner, not a replacement.

## Open questions

1. **JavaScript vs TypeScript** — ast-grep treats them as separate languages. Scan both by default? JS uses `Lang.JavaScript`, TS uses `Lang.TypeScript`. Both have `comment` kind. Probably just register both.
2. **Block comments** — `/* This function handles... */` should also be caught. For languages where `comment` covers both (TS/JS/Go/C/C++/Python), we already get them. For Rust/Java, we check both `line_comment` and `block_comment`.
3. **False positive tuning** — start strict (high precision), loosen later. Better to miss some slop than annoy users.
4. **Distribution** — npm package (`bunx sloplint .`). Also works as `npx`.
5. **CI integration** — just document `bunx sloplint .` in CI. GitHub Action is premature.
6. **Config file** — should users be able to disable specific rules? `.sloplintrc`? Start without it — just CLI flags like `--ignore-rule=step-comment`.
