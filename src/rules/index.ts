import type { SgNode } from "@ast-grep/napi"
import type { LanguageConfig } from "../languages.ts"
import { commentRules } from "./comments.ts"
import { errorHandlingRules } from "./error-handling.ts"

export interface Diagnostic {
  rule: string
  message: string
  note?: string
  file: string
  line: number
  column: number
  text: string
}

export interface Rule {
  id: string
  message: string
  note?: string
  languages?: string[]
  check(node: SgNode, lang: LanguageConfig): Rule | null
}

export function rulesForLanguage(lang: LanguageConfig): {
  comment: Rule[]
  ast: Rule[]
} {
  const comment = commentRules
  const ast = errorHandlingRules.filter(
    (r) => !r.languages || r.languages.includes(lang.lang),
  )
  return { comment, ast }
}
