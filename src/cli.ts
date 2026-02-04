#!/usr/bin/env node

import { readFileSync, statSync, readdirSync } from "fs"
import { join, extname, resolve } from "path"
import { languageForExtension } from "./languages.ts"
import { scanSource } from "./scanner.ts"
import { formatDiagnostics } from "./formatter.ts"
import type { Diagnostic } from "./rules/index.ts"

function usage(): never {
  console.error("Usage: sloplint <path> [path...]")
  console.error("")
  console.error("Scan files or directories for AI slop patterns.")
  console.error("")
  console.error("Examples:")
  console.error("  sloplint src/")
  console.error("  sloplint main.ts utils.py")
  console.error("  sloplint .")
  process.exit(1)
}

function collectFiles(paths: string[]): string[] {
  const files: string[] = []

  for (const p of paths) {
    const resolved = resolve(p)
    const stat = statSync(resolved, { throwIfNoEntry: false })
    if (!stat) {
      console.error(`sloplint: ${p}: No such file or directory`)
      continue
    }

    if (stat.isFile()) {
      files.push(resolved)
    } else if (stat.isDirectory()) {
      walkDir(resolved, files)
    }
  }

  return files
}

function walkDir(dir: string, files: string[]) {
  const SKIP = new Set([
    "node_modules", ".git", "dist", "build", "out", ".next",
    "vendor", "target", "__pycache__", ".venv", "venv",
  ])

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".") continue
    if (SKIP.has(entry.name)) continue

    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      walkDir(full, files)
    } else if (entry.isFile()) {
      files.push(full)
    }
  }
}

function main() {
  const args = process.argv.slice(2)
  if (args.length === 0) usage()

  const files = collectFiles(args)
  if (files.length === 0) {
    console.error("sloplint: no matching files found")
    process.exit(0)
  }

  const allDiagnostics: Diagnostic[] = []

  for (const file of files) {
    const ext = extname(file).slice(1)
    const lang = languageForExtension(ext)
    if (!lang) continue

    const source = readFileSync(file, "utf-8")
    const diagnostics = scanSource(source, lang, file)
    allDiagnostics.push(...diagnostics)
  }

  if (allDiagnostics.length > 0) {
    const color = process.stdout.isTTY ?? false
    console.log(formatDiagnostics(allDiagnostics, color))
    process.exit(1)
  }
}

main()
