import { describe, test, expect } from "bun:test"
import { scanSource } from "../src/scanner.ts"
import { LANGUAGES } from "../src/languages.ts"
import type { Diagnostic } from "../src/rules/index.ts"

function scan(code: string, langKey: string): Diagnostic[] {
  return scanSource(code, LANGUAGES[langKey], `test.${LANGUAGES[langKey].extensions[0]}`)
}

function ruleIds(diagnostics: Diagnostic[]): string[] {
  return diagnostics.map((d) => d.rule)
}

// ─── Comment rules: cross-language ───

const SLOP_COMMENTS: Record<string, [string, string][]> = {
  "obvious-comment": [
    ["typescript", "// Initialize the counter\nlet x = 0;"],
    ["javascript", "// Create a new instance\nconst obj = {};"],
    ["python", "# Handle the request\ndef f(): pass"],
    ["go", "package main\n// Return the result\nfunc f() {}"],
    ["rust", "// Initialize the vector\nfn main() {}"],
    ["c", "// Allocate memory for the array\nint x;"],
    ["cpp", "// Delete the old buffer\nint x;"],
    ["java", "// Initialize the service\nclass Foo {}"],
  ],
  "narrator-comment": [
    ["typescript", "// This function handles the request\nfunction f() {}"],
    ["python", "# This method is responsible for parsing\ndef f(): pass"],
    ["go", "package main\n// This function creates a new server\nfunc f() {}"],
    ["rust", "// This struct implements the parser\nstruct S;"],
    ["java", "// This method handles the event\nclass Foo {}"],
  ],
  "step-comment": [
    ["typescript", "// Step 1: validate\nlet x;"],
    ["python", "# Step 2: transform\nx = 1"],
    ["go", "package main\n// Step 3: send\nfunc f() {}"],
  ],
  "section-divider": [
    ["typescript", "// ============\nlet x;"],
    ["typescript", "// --- Helpers ---\nlet x;"],
    ["python", "# =============================\nx = 1"],
    ["go", "package main\n// --- Utils ---\nfunc f() {}"],
  ],
  "placeholder-comment": [
    ["typescript", "// ... rest of the code\nlet x;"],
    ["python", "# omitted for brevity\nx = 1"],
    ["go", "package main\n// implementation details omitted\nfunc f() {}"],
    ["rust", "// handle remaining cases similarly\nfn main() {}"],
    ["typescript", "// ... remaining implementation\nlet x;"],
    ["java", "// repeat for each item\nclass Foo {}"],
  ],
  "apologetic-comment": [
    ["typescript", "// quick hack\nlet x;"],
    ["python", "# good enough for now\nx = 1"],
    ["go", "package main\n// dirty hack\nfunc f() {}"],
    ["rust", "// temporary fix\nfn main() {}"],
    ["typescript", "// just a placeholder\nlet x;"],
    ["java", "// fix this later\nclass Foo {}"],
  ],
  "ai-generated-comment": [
    ["typescript", "// Replace this with your actual implementation\nlet x;"],
    ["python", "# Add your code here\nx = 1"],
    ["go", "package main\n// In a real application you would handle this\nfunc f() {}"],
    ["rust", "// This is just a starting point\nfn main() {}"],
    ["typescript", "// You'll need to add your own logic\nlet x;"],
    ["java", "// Customize as needed\nclass Foo {}"],
  ],
}

for (const [ruleId, cases] of Object.entries(SLOP_COMMENTS)) {
  describe(ruleId, () => {
    for (const [lang, code] of cases) {
      test(`detects in ${lang}`, () => {
        const hits = scan(code, lang)
        expect(ruleIds(hits)).toContain(ruleId)
      })
    }
  })
}

// ─── False negatives: should NOT match ───

describe("no false positives", () => {
  test("useful comments pass", () => {
    expect(scan("// Wire format: 4-byte LE header\nlet x;", "typescript")).toHaveLength(0)
    expect(scan("// TODO: optimize later\nlet x;", "typescript")).toHaveLength(0)
    expect(scan("# Hilbert curve uses Skilling algorithm\nx = 1", "python")).toHaveLength(0)
    expect(scan("// Mutex ordering: acquire A before B\npackage main", "go")).toHaveLength(0)
  })

  test("tool directives pass", () => {
    expect(scan("// eslint-disable-next-line\nlet x;", "typescript")).toHaveLength(0)
    expect(scan("# noqa: E501\nx = 1", "python")).toHaveLength(0)
    expect(scan("// nolint:errcheck\npackage main", "go")).toHaveLength(0)
    expect(scan("// SAFETY: pointer valid\nfn main() {}", "rust")).toHaveLength(0)
  })
})

// ─── Error handling rules ───

describe("empty-error-handler", () => {
  test("TypeScript empty catch", () => {
    const hits = scan("try { x() } catch (e) {}", "typescript")
    expect(ruleIds(hits)).toContain("empty-error-handler")
  })

  test("TypeScript non-empty catch passes", () => {
    const hits = scan("try { x() } catch (e) { console.error(e) }", "typescript")
    expect(ruleIds(hits)).not.toContain("empty-error-handler")
  })

  test("Python bare except", () => {
    const hits = scan("try:\n    x()\nexcept:\n    pass", "python")
    expect(ruleIds(hits)).toContain("empty-error-handler")
  })

  test("Python typed except passes bare-except rule", () => {
    const hits = scan("try:\n    x()\nexcept Exception:\n    print(e)", "python")
    expect(ruleIds(hits)).not.toContain("empty-error-handler")
  })
})

describe("silent-exception", () => {
  test("Python except pass", () => {
    const hits = scan("try:\n    x()\nexcept Exception:\n    pass", "python")
    expect(ruleIds(hits)).toContain("silent-exception")
  })

  test("Python except with logging passes", () => {
    const hits = scan("try:\n    x()\nexcept Exception as e:\n    print(e)", "python")
    expect(ruleIds(hits)).not.toContain("silent-exception")
  })
})

describe("log-in-error-handler", () => {
  test("console.log in catch", () => {
    const hits = scan("try { x() } catch (e) { console.log(e) }", "typescript")
    expect(ruleIds(hits)).toContain("log-in-error-handler")
  })

  test("console.error in catch passes", () => {
    const hits = scan("try { x() } catch (e) { console.error(e) }", "typescript")
    expect(ruleIds(hits)).not.toContain("log-in-error-handler")
  })
})
