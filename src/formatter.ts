import type { Diagnostic } from "./rules/index.ts"

const RESET = "\x1b[0m"
const BOLD = "\x1b[1m"
const DIM = "\x1b[2m"
const YELLOW = "\x1b[33m"
const CYAN = "\x1b[36m"
const GRAY = "\x1b[90m"

export function formatDiagnostics(
  diagnostics: Diagnostic[],
  color = true,
): string {
  if (diagnostics.length === 0) return ""

  const c = color
    ? { reset: RESET, bold: BOLD, dim: DIM, yellow: YELLOW, cyan: CYAN, gray: GRAY }
    : { reset: "", bold: "", dim: "", yellow: "", cyan: "", gray: "" }

  const byFile = new Map<string, Diagnostic[]>()
  for (const d of diagnostics) {
    const list = byFile.get(d.file) ?? []
    list.push(d)
    byFile.set(d.file, list)
  }

  const lines: string[] = []
  for (const [file, diags] of byFile) {
    lines.push("")
    lines.push(`${c.bold}${file}${c.reset}`)
    for (const d of diags) {
      const loc = `${c.gray}${d.line}:${d.column}${c.reset}`
      const rule = `${c.cyan}${d.rule}${c.reset}`
      lines.push(`  ${loc}  ${c.yellow}warning${c.reset}  ${d.message}  ${rule}`)
      if (d.text) {
        lines.push(`  ${c.gray}> ${d.text}${c.reset}`)
      }
    }
  }

  lines.push("")
  const count = diagnostics.length
  lines.push(
    `${c.yellow}${c.bold}⚠ ${count} problem${count === 1 ? "" : "s"}${c.reset}`,
  )
  return lines.join("\n")
}
