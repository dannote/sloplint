import { Lang, registerDynamicLanguage } from "@ast-grep/napi"
import python from "@ast-grep/lang-python"
import go from "@ast-grep/lang-go"
import rust from "@ast-grep/lang-rust"
import c from "@ast-grep/lang-c"
import cpp from "@ast-grep/lang-cpp"
import java from "@ast-grep/lang-java"

registerDynamicLanguage({ python, go, rust, c, cpp, java })

export interface LanguageConfig {
  lang: string
  commentKinds: string[]
  extensions: string[]
  toolDirectives: RegExp
}

export const LANGUAGES: Record<string, LanguageConfig> = {
  typescript: {
    lang: Lang.TypeScript,
    commentKinds: ["comment"],
    extensions: ["ts", "tsx", "mts", "cts"],
    toolDirectives:
      /eslint|prettier|@ts-|istanbul|c8|vitest|jest|biome|oxlint/i,
  },
  javascript: {
    lang: Lang.JavaScript,
    commentKinds: ["comment"],
    extensions: ["js", "jsx", "mjs", "cjs"],
    toolDirectives:
      /eslint|prettier|istanbul|c8|vitest|jest|webpack|biome|oxlint/i,
  },
  python: {
    lang: "python",
    commentKinds: ["comment"],
    extensions: ["py", "pyi"],
    toolDirectives: /noqa|type:\s*ignore|pylint|mypy|pyright|ruff|fmt|isort/i,
  },
  go: {
    lang: "go",
    commentKinds: ["comment"],
    extensions: ["go"],
    toolDirectives: /nolint|go:generate|go:build|go:embed|gofmt|govet/i,
  },
  rust: {
    lang: "rust",
    commentKinds: ["line_comment", "block_comment"],
    extensions: ["rs"],
    toolDirectives:
      /clippy|allow|deny|forbid|expect|cfg|rustfmt|SAFETY|safety/,
  },
  c: {
    lang: "c",
    commentKinds: ["comment"],
    extensions: ["c", "h"],
    toolDirectives: /NOLINT|NOLINTNEXTLINE|clang-format|IWYU|pragma/i,
  },
  cpp: {
    lang: "cpp",
    commentKinds: ["comment"],
    extensions: ["cpp", "cc", "cxx", "hpp", "hh", "hxx"],
    toolDirectives: /NOLINT|NOLINTNEXTLINE|clang-format|IWYU|pragma/i,
  },
  java: {
    lang: "java",
    commentKinds: ["line_comment", "block_comment"],
    extensions: ["java"],
    toolDirectives:
      /checkstyle|SuppressWarnings|PMD|SpotBugs|NOSONAR|noinspection/i,
  },
}

export function languageForExtension(
  ext: string,
): LanguageConfig | undefined {
  return Object.values(LANGUAGES).find((l) => l.extensions.includes(ext))
}
