import { parse, type SgNode } from "@ast-grep/napi"
import type { LanguageConfig } from "./languages.ts"
import type { Diagnostic, Rule } from "./rules/index.ts"
import { rulesForLanguage } from "./rules/index.ts"

const AST_RULE_KINDS: Record<string, string[]> = {
  TypeScript: ["catch_clause"],
  JavaScript: ["catch_clause"],
  java: ["catch_clause"],
  python: ["except_clause"],
  ruby: ["rescue"],
}

export function scanSource(
  source: string,
  lang: LanguageConfig,
  filename: string,
): Diagnostic[] {
  const root = parse(lang.lang as any, source).root()
  const { comment: commentRules, ast: astRules } = rulesForLanguage(lang)
  const diagnostics: Diagnostic[] = []

  for (const kind of lang.commentKinds) {
    const comments = root.findAll({ rule: { kind } })
    for (const node of comments) {
      for (const rule of commentRules) {
        const match = rule.check(node, lang)
        if (match) {
          diagnostics.push(makeDiagnostic(match, node, filename))
        }
      }
    }
  }

  if (astRules.length > 0) {
    const kinds = AST_RULE_KINDS[lang.lang] ?? []
    for (const kind of kinds) {
      const nodes = root.findAll({ rule: { kind } })
      for (const node of nodes) {
        for (const rule of astRules) {
          const match = rule.check(node, lang)
          if (match) {
            diagnostics.push(makeDiagnostic(match, node, filename))
          }
        }
      }
    }
  }

  return diagnostics
}

function makeDiagnostic(
  rule: Rule,
  node: SgNode,
  filename: string,
): Diagnostic {
  const range = node.range()
  return {
    rule: rule.id,
    message: rule.message,
    note: rule.note,
    file: filename,
    line: range.start.line + 1,
    column: range.start.column + 1,
    text: node.text().split("\n")[0],
  }
}
