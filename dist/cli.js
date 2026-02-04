#!/usr/bin/env node

// src/cli.ts
import { readFileSync, statSync, readdirSync } from "fs";
import { join, extname, resolve } from "path";

// src/languages.ts
import { Lang, registerDynamicLanguage } from "@ast-grep/napi";
import python from "@ast-grep/lang-python";
import go from "@ast-grep/lang-go";
import rust from "@ast-grep/lang-rust";
import c from "@ast-grep/lang-c";
import cpp from "@ast-grep/lang-cpp";
import java from "@ast-grep/lang-java";
import ruby from "@ast-grep/lang-ruby";
registerDynamicLanguage({ python, go, rust, c, cpp, java, ruby });
var LANGUAGES = {
  typescript: {
    lang: Lang.TypeScript,
    commentKinds: ["comment"],
    extensions: ["ts", "tsx", "mts", "cts"],
    toolDirectives: /eslint|prettier|@ts-|istanbul|c8|vitest|jest|biome|oxlint/i
  },
  javascript: {
    lang: Lang.JavaScript,
    commentKinds: ["comment"],
    extensions: ["js", "jsx", "mjs", "cjs"],
    toolDirectives: /eslint|prettier|istanbul|c8|vitest|jest|webpack|biome|oxlint/i
  },
  python: {
    lang: "python",
    commentKinds: ["comment"],
    extensions: ["py", "pyi"],
    toolDirectives: /noqa|type:\s*ignore|pylint|mypy|pyright|ruff|fmt|isort/i
  },
  go: {
    lang: "go",
    commentKinds: ["comment"],
    extensions: ["go"],
    toolDirectives: /nolint|go:generate|go:build|go:embed|gofmt|govet/i
  },
  rust: {
    lang: "rust",
    commentKinds: ["line_comment", "block_comment"],
    extensions: ["rs"],
    toolDirectives: /clippy|allow|deny|forbid|expect|cfg|rustfmt|SAFETY|safety/
  },
  c: {
    lang: "c",
    commentKinds: ["comment"],
    extensions: ["c", "h"],
    toolDirectives: /NOLINT|NOLINTNEXTLINE|clang-format|IWYU|pragma/i
  },
  cpp: {
    lang: "cpp",
    commentKinds: ["comment"],
    extensions: ["cpp", "cc", "cxx", "hpp", "hh", "hxx"],
    toolDirectives: /NOLINT|NOLINTNEXTLINE|clang-format|IWYU|pragma/i
  },
  java: {
    lang: "java",
    commentKinds: ["line_comment", "block_comment"],
    extensions: ["java"],
    toolDirectives: /checkstyle|SuppressWarnings|PMD|SpotBugs|NOSONAR|noinspection/i
  },
  ruby: {
    lang: "ruby",
    commentKinds: ["comment"],
    extensions: ["rb", "rake"],
    toolDirectives: /rubocop|sorbet|sig|steep|yard|:nocov:|frozen_string_literal/i
  }
};
function languageForExtension(ext) {
  return Object.values(LANGUAGES).find((l) => l.extensions.includes(ext));
}

// src/scanner.ts
import { parse } from "@ast-grep/napi";

// src/rules/comments.ts
var OBVIOUS_VERBS = /^(?:\/\/|#|\/\*\*?)\s*(?:initialize|create|set\s?up|handle|process|check\s(?:if|whether)|validate|update|return|(?:get|gets|get the)|store|add|increment|decrement|define|declare|assign|call|invoke|loop\s(?:through|over)|iterate\s(?:through|over)|import|export|render|fetch|send|remove|delete|destroy|free|reset|clear|toggle|convert|parse|format|calculate|compute|extract|merge|sort|filter|map|transform|append|prepend|push|pop|insert|set the|set\s\w+\sto|allocate|malloc|realloc)\s/i;
var NARRATOR_PATTERN = /^(?:\/\/|#|\/\*\*?)\s*this\s+(?:function|method|class|component|hook|module|handler|helper|utility|service|middleware|guard|interceptor|decorator|factory|provider|controller|resolver|validator|pipe|filter|struct|enum|trait|impl|macro|typedef|interface)\s+(?:is\s+responsible\s+for|is\s+used\s+to|will|handles|creates|initializes|sets\s+up|processes|validates|returns|manages|provides|defines|takes|accepts|receives|implements|extends|overrides|wraps|delegates|dispatches|emits|triggers|invokes|calls|renders|fetches|sends|removes|deletes|frees|updates|checks|ensures|converts|parses|formats|calculates|computes|extracts|merges|sorts|filters|maps|transforms)/i;
var STEP_PATTERN = /^(?:\/\/|#|\/\*\*?)\s*step\s+\d/i;
var PLACEHOLDER_PATTERN = /^(?:\/\/|#|\/\*\*?)\s*(?:(?:\.\.\.|…)\s*(?:rest of|more|remaining|implementation|logic|code|here|functionality|similarly|and so on|etc|as above)|(?:omitted|truncated)\s+for\s+brevity|implementation details omitted|repeat (?:for each|as needed)|handle (?:other|remaining) cases similarly|similar for other cases)/i;
var APOLOGETIC_PATTERN = /^(?:\/\/|#|\/\*\*?)\s*(?:sorry,? this is a (?:quick )?hack|(?:quick|ugly|dirty|nasty) hack|(?:quick|dirty|naive) solution|not the best way but works|I know this is bad|(?:temporary|temp) (?:fix|workaround|solution|implementation|code)|(?:fix|refactor|implement|do|clean up) (?:this )?later|(?:good|fine|okay|ok|simple|works|good enough) for now|simplified (?:version|implementation|logic)|(?:basic|minimal|naive) approach|just a placeholder)/i;
var AI_SPECIFIC_PATTERN = /^(?:\/\/|#|\/\*\*?)\s*(?:As an AI,? I cannot|I'll leave this for you to (?:implement|complete|finish)|You'll need to add your own|Replace this with your (?:actual|real|own) implementation|Add your (?:code|logic) here|Insert your (?:logic|code|handling) here|Customize (?:as needed|according to your needs)|Modify (?:according to|based on) your needs|This is a (?:simplified|basic|example) (?:example|version|implementation)|In a real application,? you (?:would|should)|For production,? (?:consider|make sure to)|In practice,? you (?:should|might want to)|This is just a starting point)/i;
var DIVIDER_PATTERNS = [
  /^(?:\/\/|#)\s*[-=~#*]{3,}/,
  /^(?:\/\/|#)\s*#{1,3}\s/i,
  /^(?:\/\/|#)\s*-{2,}\s*(?:helpers?|utils?|types?|interfaces?|constants?|exports?|imports?|methods?|functions?|handlers?|hooks?|state|props?|styles?|config|setup|init|main|private|public|api|routes?|middleware|validation|rendering|lifecycle|events?|callbacks?|mutations?|actions?|getters?|selectors?|reducers?|effects?|subscriptions?|impl|traits?|structs?|enums?|tests?|mods?|models?|macros?)\s*-{0,}/i
];
var KEEPER_PATTERN = /\bTODO\b|\bFIXME\b|\bHACK\b|\bNOTE\b|\bSAFETY\b|\bWARN\b|\bBUG\b|\bXXX\b|\bPERF\b|\bIMPORTANT\b|\bLICENSE\b|\bCOPYRIGHT\b/;
function isComment(node, lang) {
  return lang.commentKinds.includes(node.kind());
}
function isToolDirective(text, lang) {
  return lang.toolDirectives.test(text);
}
function shouldKeep(text, lang) {
  return KEEPER_PATTERN.test(text) || isToolDirective(text, lang);
}
function commentText(node) {
  return node.text().trim();
}
var obviousComment = {
  id: "obvious-comment",
  message: "Obvious comment — remove it, the code should speak for itself",
  note: "Comments should explain WHY or document non-obvious constraints, not restate WHAT. If the code isn't clear, rename variables or extract a well-named function.",
  check(node, lang) {
    const text = commentText(node);
    if (!isComment(node, lang))
      return null;
    if (shouldKeep(text, lang))
      return null;
    if (!OBVIOUS_VERBS.test(text))
      return null;
    return this;
  }
};
var narratorComment = {
  id: "narrator-comment",
  message: '"This function..." comment — let the function name and signature tell the story',
  note: "A well-named function doesn't need a preamble. If behavior is non-obvious, explain WHY, not WHAT.",
  check(node, lang) {
    const text = commentText(node);
    if (!isComment(node, lang))
      return null;
    if (shouldKeep(text, lang))
      return null;
    if (!NARRATOR_PATTERN.test(text))
      return null;
    return this;
  }
};
var stepComment = {
  id: "step-comment",
  message: '"Step N:" comment — the function is doing too much',
  note: "Numbered step comments suggest the function should be split. Extract each step into its own well-named function.",
  check(node, lang) {
    const text = commentText(node);
    if (!isComment(node, lang))
      return null;
    if (shouldKeep(text, lang))
      return null;
    if (!STEP_PATTERN.test(text))
      return null;
    return this;
  }
};
var sectionDivider = {
  id: "section-divider",
  message: "Section divider comment — extract into separate modules instead",
  note: "If your file needs section banners, it's probably too long. Split into separate files or modules.",
  check(node, lang) {
    const text = commentText(node);
    if (!isComment(node, lang))
      return null;
    if (shouldKeep(text, lang))
      return null;
    if (!DIVIDER_PATTERNS.some((p) => p.test(text)))
      return null;
    return this;
  }
};
var placeholderComment = {
  id: "placeholder-comment",
  message: "Placeholder comment — this code is incomplete",
  note: 'Comments like "... rest of the code" or "omitted for brevity" mean the implementation was never finished.',
  check(node, lang) {
    const text = commentText(node);
    if (!isComment(node, lang))
      return null;
    if (shouldKeep(text, lang))
      return null;
    if (!PLACEHOLDER_PATTERN.test(text))
      return null;
    return this;
  }
};
var apologeticComment = {
  id: "apologetic-comment",
  message: "Apologetic comment — fix the code instead of apologizing for it",
  note: 'Comments admitting "this is a hack" or "good enough for now" are a sign the code needs actual improvement, not an apology.',
  check(node, lang) {
    const text = commentText(node);
    if (!isComment(node, lang))
      return null;
    if (shouldKeep(text, lang))
      return null;
    if (!APOLOGETIC_PATTERN.test(text))
      return null;
    return this;
  }
};
var aiSpecificComment = {
  id: "ai-generated-comment",
  message: "AI-generated placeholder — the AI left a note instead of writing the code",
  note: "The AI assistant admitted it didn't finish the job. Replace the comment with an actual implementation.",
  check(node, lang) {
    const text = commentText(node);
    if (!isComment(node, lang))
      return null;
    if (shouldKeep(text, lang))
      return null;
    if (!AI_SPECIFIC_PATTERN.test(text))
      return null;
    return this;
  }
};
var commentRules = [
  obviousComment,
  narratorComment,
  stepComment,
  sectionDivider,
  placeholderComment,
  apologeticComment,
  aiSpecificComment
];

// src/rules/error-handling.ts
var emptyCatchTS = {
  id: "empty-error-handler",
  message: "Empty catch block silently swallows errors",
  note: "At minimum, log the error or add a comment explaining why it's safe to ignore.",
  languages: ["TypeScript", "JavaScript"],
  check(node, lang) {
    if (node.kind() !== "catch_clause")
      return null;
    const body = node.field("body");
    if (!body)
      return null;
    const children = body.children().filter((c2) => c2.isNamed());
    if (children.length === 0)
      return this;
    return null;
  }
};
var emptyCatchJava = {
  id: "empty-error-handler",
  message: "Empty catch block silently swallows errors",
  note: "At minimum, log the error or add a comment explaining why it's safe to ignore.",
  languages: ["java"],
  check(node, lang) {
    if (node.kind() !== "catch_clause")
      return null;
    const body = node.field("body");
    if (!body)
      return null;
    const children = body.children().filter((c2) => c2.isNamed());
    if (children.length === 0)
      return this;
    return null;
  }
};
var bareExceptPython = {
  id: "empty-error-handler",
  message: "Bare except catches everything including KeyboardInterrupt and SystemExit",
  note: "Use `except Exception:` to avoid catching system-level exceptions.",
  languages: ["python"],
  check(node, _lang) {
    if (node.kind() !== "except_clause")
      return null;
    const children = node.children();
    const hasType = children.some((c2) => c2.kind() === "identifier" || c2.kind() === "as_pattern");
    if (!hasType)
      return this;
    return null;
  }
};
var passInExceptPython = {
  id: "silent-exception",
  message: "Silent exception swallowing — at minimum log the error",
  note: "AI loves `except Exception: pass` to make code 'robust'. This hides bugs.",
  languages: ["python"],
  check(node, _lang) {
    if (node.kind() !== "except_clause")
      return null;
    const body = node.children().find((c2) => c2.kind() === "block");
    if (!body)
      return null;
    const stmts = body.children().filter((c2) => c2.isNamed());
    if (stmts.length === 1 && stmts[0].kind() === "pass_statement")
      return this;
    return null;
  }
};
var consoleLogInCatchTS = {
  id: "log-in-error-handler",
  message: "console.log in catch — use console.error or a proper logger",
  note: "AI defaults to console.log for everything, even error handling.",
  languages: ["TypeScript", "JavaScript"],
  check(node, _lang) {
    if (node.kind() !== "catch_clause")
      return null;
    const logCalls = node.findAll("console.log($$$ARGS)");
    if (logCalls.length > 0)
      return this;
    return null;
  }
};
var emptyRescueRuby = {
  id: "empty-error-handler",
  message: "Empty rescue block silently swallows errors",
  note: "At minimum, log the error or add a comment explaining why it's safe to ignore.",
  languages: ["ruby"],
  check(node, _lang) {
    if (node.kind() !== "rescue")
      return null;
    const then = node.children().find((c2) => c2.kind() === "then");
    if (!then)
      return this;
    const stmts = then.children().filter((c2) => c2.isNamed());
    if (stmts.length === 0)
      return this;
    return null;
  }
};
var errorHandlingRules = [
  emptyCatchTS,
  emptyCatchJava,
  bareExceptPython,
  passInExceptPython,
  consoleLogInCatchTS,
  emptyRescueRuby
];

// src/rules/index.ts
function rulesForLanguage(lang) {
  const comment = commentRules;
  const ast = errorHandlingRules.filter((r) => !r.languages || r.languages.includes(lang.lang));
  return { comment, ast };
}

// src/scanner.ts
var AST_RULE_KINDS = {
  TypeScript: ["catch_clause"],
  JavaScript: ["catch_clause"],
  java: ["catch_clause"],
  python: ["except_clause"],
  ruby: ["rescue"]
};
function scanSource(source, lang, filename) {
  const root = parse(lang.lang, source).root();
  const { comment: commentRules2, ast: astRules } = rulesForLanguage(lang);
  const diagnostics = [];
  for (const kind of lang.commentKinds) {
    const comments = root.findAll({ rule: { kind } });
    for (const node of comments) {
      for (const rule of commentRules2) {
        const match = rule.check(node, lang);
        if (match) {
          diagnostics.push(makeDiagnostic(match, node, filename));
        }
      }
    }
  }
  if (astRules.length > 0) {
    const kinds = AST_RULE_KINDS[lang.lang] ?? [];
    for (const kind of kinds) {
      const nodes = root.findAll({ rule: { kind } });
      for (const node of nodes) {
        for (const rule of astRules) {
          const match = rule.check(node, lang);
          if (match) {
            diagnostics.push(makeDiagnostic(match, node, filename));
          }
        }
      }
    }
  }
  return diagnostics;
}
function makeDiagnostic(rule, node, filename) {
  const range = node.range();
  return {
    rule: rule.id,
    message: rule.message,
    note: rule.note,
    file: filename,
    line: range.start.line + 1,
    column: range.start.column + 1,
    text: node.text().split(`
`)[0]
  };
}

// src/formatter.ts
var RESET = "\x1B[0m";
var BOLD = "\x1B[1m";
var DIM = "\x1B[2m";
var YELLOW = "\x1B[33m";
var CYAN = "\x1B[36m";
var GRAY = "\x1B[90m";
function formatDiagnostics(diagnostics, color = true) {
  if (diagnostics.length === 0)
    return "";
  const c2 = color ? { reset: RESET, bold: BOLD, dim: DIM, yellow: YELLOW, cyan: CYAN, gray: GRAY } : { reset: "", bold: "", dim: "", yellow: "", cyan: "", gray: "" };
  const byFile = new Map;
  for (const d of diagnostics) {
    const list = byFile.get(d.file) ?? [];
    list.push(d);
    byFile.set(d.file, list);
  }
  const lines = [];
  for (const [file, diags] of byFile) {
    lines.push("");
    lines.push(`${c2.bold}${file}${c2.reset}`);
    for (const d of diags) {
      const loc = `${c2.gray}${d.line}:${d.column}${c2.reset}`;
      const rule = `${c2.cyan}${d.rule}${c2.reset}`;
      lines.push(`  ${loc}  ${c2.yellow}warning${c2.reset}  ${d.message}  ${rule}`);
      if (d.text) {
        lines.push(`  ${c2.gray}> ${d.text}${c2.reset}`);
      }
    }
  }
  lines.push("");
  const count = diagnostics.length;
  lines.push(`${c2.yellow}${c2.bold}⚠ ${count} problem${count === 1 ? "" : "s"}${c2.reset}`);
  return lines.join(`
`);
}

// src/cli.ts
function usage() {
  console.error("Usage: sloplint <path> [path...]");
  console.error("");
  console.error("Scan files or directories for AI slop patterns.");
  console.error("");
  console.error("Examples:");
  console.error("  sloplint src/");
  console.error("  sloplint main.ts utils.py");
  console.error("  sloplint .");
  process.exit(1);
}
function collectFiles(paths) {
  const files = [];
  for (const p of paths) {
    const resolved = resolve(p);
    const stat = statSync(resolved, { throwIfNoEntry: false });
    if (!stat) {
      console.error(`sloplint: ${p}: No such file or directory`);
      continue;
    }
    if (stat.isFile()) {
      files.push(resolved);
    } else if (stat.isDirectory()) {
      walkDir(resolved, files);
    }
  }
  return files;
}
function walkDir(dir, files) {
  const SKIP = new Set([
    "node_modules",
    ".git",
    "dist",
    "build",
    "out",
    ".next",
    "vendor",
    "target",
    "__pycache__",
    ".venv",
    "venv"
  ]);
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".")
      continue;
    if (SKIP.has(entry.name))
      continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full, files);
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
}
function main() {
  const args = process.argv.slice(2);
  if (args.length === 0)
    usage();
  const files = collectFiles(args);
  if (files.length === 0) {
    console.error("sloplint: no matching files found");
    process.exit(0);
  }
  const allDiagnostics = [];
  for (const file of files) {
    const ext = extname(file).slice(1);
    const lang = languageForExtension(ext);
    if (!lang)
      continue;
    const source = readFileSync(file, "utf-8");
    const diagnostics = scanSource(source, lang, file);
    allDiagnostics.push(...diagnostics);
  }
  if (allDiagnostics.length > 0) {
    const color = process.stdout.isTTY ?? false;
    console.log(formatDiagnostics(allDiagnostics, color));
    process.exit(1);
  }
}
main();
