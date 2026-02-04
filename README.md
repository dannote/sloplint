# sloplint

AST-based multilingual linter that catches AI-generated code slop.

Powered by [ast-grep](https://ast-grep.github.io/) via `@ast-grep/napi` — rules run on real syntax trees, not regex over text.

## What it catches

**Comment patterns** (all 8 languages):

| Rule | Example |
|------|---------|
| `obvious-comment` | `// Initialize the counter` above `let counter = 0` |
| `narrator-comment` | `// This function handles the request` |
| `step-comment` | `// Step 1: Validate input` |
| `section-divider` | `// ============` or `// --- Helpers ---` |
| `placeholder-comment` | `// ... rest of the code` or `// omitted for brevity` |
| `apologetic-comment` | `// quick hack` or `// good enough for now` |
| `ai-generated-comment` | `// Replace this with your actual implementation` |

**Code patterns** (language-specific):

| Rule | Language | Example |
|------|----------|---------|
| `empty-error-handler` | TS/JS/Java/Python/Ruby | `catch (e) {}`, bare `except:`, empty `rescue` |
| `silent-exception` | Python | `except Exception: pass` |
| `log-in-error-handler` | TS/JS | `console.log` inside catch |

## Supported languages

TypeScript, JavaScript, Python, Go, Rust, C, C++, Java, Ruby

## Usage

```sh
# scan a directory
npx @dannote/sloplint src/

# scan specific files
npx @dannote/sloplint main.ts utils.py server.go

# scan everything
npx @dannote/sloplint .
```

Exits with code 1 if any problems are found.

## What it ignores

Comments that provide actual value are never flagged:

- `// Wire format: 4-byte LE header followed by varint-encoded payload`
- `// SAFETY: pointer is guaranteed valid by the borrow checker invariant above`
- `// Mutex ordering: always acquire lockA before lockB to prevent deadlocks`
- `// TODO: optimize later`

Tool directives are also skipped: `eslint-disable`, `noqa`, `nolint`, `NOLINT`, `clippy::allow`, `@ts-ignore`, etc.

## Install

```sh
npm install -D @dannote/sloplint
```

## Philosophy

From the [PR that inspired this](https://github.com/maplibre/maplibre-tile-spec/pull/813):

> **Explicit anti-slop editing pass.** Removed comments that restate what code does, dead code, unused includes, near-duplicate functions. Comments that remain document wire format specs, non-obvious constraints, or algorithm provenance.

Good comments explain **why**. Slop comments explain **what** — and the code already does that.
