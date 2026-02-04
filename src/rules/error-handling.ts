import type { SgNode } from "@ast-grep/napi"
import type { LanguageConfig } from "../languages.ts"
import type { Diagnostic, Rule } from "./index.ts"

const emptyCatchTS: Rule = {
  id: "empty-error-handler",
  message: "Empty catch block silently swallows errors",
  note: "At minimum, log the error or add a comment explaining why it's safe to ignore.",
  languages: ["TypeScript", "JavaScript"],
  check(node, lang) {
    if (node.kind() !== "catch_clause") return null
    const body = node.field("body")
    if (!body) return null
    const children = body.children().filter((c) => c.isNamed())
    if (children.length === 0) return this
    return null
  },
}

const emptyCatchJava: Rule = {
  id: "empty-error-handler",
  message: "Empty catch block silently swallows errors",
  note: "At minimum, log the error or add a comment explaining why it's safe to ignore.",
  languages: ["java"],
  check(node, lang) {
    if (node.kind() !== "catch_clause") return null
    const body = node.field("body")
    if (!body) return null
    const children = body.children().filter((c) => c.isNamed())
    if (children.length === 0) return this
    return null
  },
}

const bareExceptPython: Rule = {
  id: "empty-error-handler",
  message:
    "Bare except catches everything including KeyboardInterrupt and SystemExit",
  note: "Use `except Exception:` to avoid catching system-level exceptions.",
  languages: ["python"],
  check(node, _lang) {
    if (node.kind() !== "except_clause") return null
    const children = node.children()
    const hasType = children.some(
      (c) => c.kind() === "identifier" || c.kind() === "as_pattern",
    )
    if (!hasType) return this
    return null
  },
}

const passInExceptPython: Rule = {
  id: "silent-exception",
  message: "Silent exception swallowing — at minimum log the error",
  note: "AI loves `except Exception: pass` to make code 'robust'. This hides bugs.",
  languages: ["python"],
  check(node, _lang) {
    if (node.kind() !== "except_clause") return null
    const body = node.children().find((c) => c.kind() === "block")
    if (!body) return null
    const stmts = body.children().filter((c) => c.isNamed())
    if (stmts.length === 1 && stmts[0].kind() === "pass_statement") return this
    return null
  },
}

const consoleLogInCatchTS: Rule = {
  id: "log-in-error-handler",
  message: "console.log in catch — use console.error or a proper logger",
  note: "AI defaults to console.log for everything, even error handling.",
  languages: ["TypeScript", "JavaScript"],
  check(node, _lang) {
    if (node.kind() !== "catch_clause") return null
    const logCalls = node.findAll("console.log($$$ARGS)")
    if (logCalls.length > 0) return this
    return null
  },
}

export const errorHandlingRules: Rule[] = [
  emptyCatchTS,
  emptyCatchJava,
  bareExceptPython,
  passInExceptPython,
  consoleLogInCatchTS,
]
