import type { SgNode } from "@ast-grep/napi"
import type { LanguageConfig } from "../languages.ts"
import type { Diagnostic, Rule } from "./index.ts"

const OBVIOUS_VERBS =
  /^(?:\/\/|#|\/\*\*?)\s*(?:initialize|create|set\s?up|handle|process|check\s(?:if|whether)|validate|update|return|(?:get|gets|get the)|store|add|increment|decrement|define|declare|assign|call|invoke|loop\s(?:through|over)|iterate\s(?:through|over)|import|export|render|fetch|send|remove|delete|destroy|free|reset|clear|toggle|convert|parse|format|calculate|compute|extract|merge|sort|filter|map|transform|append|prepend|push|pop|insert|set the|set\s\w+\sto|allocate|malloc|realloc)\s/i

const NARRATOR_PATTERN =
  /^(?:\/\/|#|\/\*\*?)\s*this\s+(?:function|method|class|component|hook|module|handler|helper|utility|service|middleware|guard|interceptor|decorator|factory|provider|controller|resolver|validator|pipe|filter|struct|enum|trait|impl|macro|typedef|interface)\s+(?:is\s+responsible\s+for|is\s+used\s+to|will|handles|creates|initializes|sets\s+up|processes|validates|returns|manages|provides|defines|takes|accepts|receives|implements|extends|overrides|wraps|delegates|dispatches|emits|triggers|invokes|calls|renders|fetches|sends|removes|deletes|frees|updates|checks|ensures|converts|parses|formats|calculates|computes|extracts|merges|sorts|filters|maps|transforms)/i

const STEP_PATTERN = /^(?:\/\/|#|\/\*\*?)\s*step\s+\d/i

const PLACEHOLDER_PATTERN =
  /^(?:\/\/|#|\/\*\*?)\s*(?:(?:\.\.\.|…)\s*(?:rest of|more|remaining|implementation|logic|code|here|functionality|similarly|and so on|etc|as above)|(?:omitted|truncated)\s+for\s+brevity|implementation details omitted|repeat (?:for each|as needed)|handle (?:other|remaining) cases similarly|similar for other cases)/i

const APOLOGETIC_PATTERN =
  /^(?:\/\/|#|\/\*\*?)\s*(?:sorry,? this is a (?:quick )?hack|(?:quick|ugly|dirty|nasty) hack|(?:quick|dirty|naive) solution|not the best way but works|I know this is bad|(?:temporary|temp) (?:fix|workaround|solution|implementation|code)|(?:fix|refactor|implement|do|clean up) (?:this )?later|(?:good|fine|okay|ok|simple|works|good enough) for now|simplified (?:version|implementation|logic)|(?:basic|minimal|naive) approach|just a placeholder)/i

const AI_SPECIFIC_PATTERN =
  /^(?:\/\/|#|\/\*\*?)\s*(?:As an AI,? I cannot|I'll leave this for you to (?:implement|complete|finish)|You'll need to add your own|Replace this with your (?:actual|real|own) implementation|Add your (?:code|logic) here|Insert your (?:logic|code|handling) here|Customize (?:as needed|according to your needs)|Modify (?:according to|based on) your needs|This is a (?:simplified|basic|example) (?:example|version|implementation)|In a real application,? you (?:would|should)|For production,? (?:consider|make sure to)|In practice,? you (?:should|might want to)|This is just a starting point)/i

const DIVIDER_PATTERNS = [
  /^(?:\/\/|#)\s*[-=~#*]{3,}/,
  /^(?:\/\/|#)\s*#{1,3}\s/i,
  /^(?:\/\/|#)\s*-{2,}\s*(?:helpers?|utils?|types?|interfaces?|constants?|exports?|imports?|methods?|functions?|handlers?|hooks?|state|props?|styles?|config|setup|init|main|private|public|api|routes?|middleware|validation|rendering|lifecycle|events?|callbacks?|mutations?|actions?|getters?|selectors?|reducers?|effects?|subscriptions?|impl|traits?|structs?|enums?|tests?|mods?|models?|macros?)\s*-{0,}/i,
]

const KEEPER_PATTERN =
  /\bTODO\b|\bFIXME\b|\bHACK\b|\bNOTE\b|\bSAFETY\b|\bWARN\b|\bBUG\b|\bXXX\b|\bPERF\b|\bIMPORTANT\b|\bLICENSE\b|\bCOPYRIGHT\b/

function isComment(node: SgNode, lang: LanguageConfig): boolean {
  return lang.commentKinds.includes(node.kind())
}

function isToolDirective(text: string, lang: LanguageConfig): boolean {
  return lang.toolDirectives.test(text)
}

function shouldKeep(text: string, lang: LanguageConfig): boolean {
  return KEEPER_PATTERN.test(text) || isToolDirective(text, lang)
}

function commentText(node: SgNode): string {
  return node.text().trim()
}

const obviousComment: Rule = {
  id: "obvious-comment",
  message: "Obvious comment — remove it, the code should speak for itself",
  note: "Comments should explain WHY or document non-obvious constraints, not restate WHAT. If the code isn't clear, rename variables or extract a well-named function.",
  check(node, lang) {
    const text = commentText(node)
    if (!isComment(node, lang)) return null
    if (shouldKeep(text, lang)) return null
    if (!OBVIOUS_VERBS.test(text)) return null
    return this
  },
}

const narratorComment: Rule = {
  id: "narrator-comment",
  message:
    '"This function..." comment — let the function name and signature tell the story',
  note: 'A well-named function doesn\'t need a preamble. If behavior is non-obvious, explain WHY, not WHAT.',
  check(node, lang) {
    const text = commentText(node)
    if (!isComment(node, lang)) return null
    if (shouldKeep(text, lang)) return null
    if (!NARRATOR_PATTERN.test(text)) return null
    return this
  },
}

const stepComment: Rule = {
  id: "step-comment",
  message: '"Step N:" comment — the function is doing too much',
  note: "Numbered step comments suggest the function should be split. Extract each step into its own well-named function.",
  check(node, lang) {
    const text = commentText(node)
    if (!isComment(node, lang)) return null
    if (shouldKeep(text, lang)) return null
    if (!STEP_PATTERN.test(text)) return null
    return this
  },
}

const sectionDivider: Rule = {
  id: "section-divider",
  message: "Section divider comment — extract into separate modules instead",
  note: "If your file needs section banners, it's probably too long. Split into separate files or modules.",
  check(node, lang) {
    const text = commentText(node)
    if (!isComment(node, lang)) return null
    if (shouldKeep(text, lang)) return null
    if (!DIVIDER_PATTERNS.some((p) => p.test(text))) return null
    return this
  },
}

const placeholderComment: Rule = {
  id: "placeholder-comment",
  message: "Placeholder comment — this code is incomplete",
  note: 'Comments like "... rest of the code" or "omitted for brevity" mean the implementation was never finished.',
  check(node, lang) {
    const text = commentText(node)
    if (!isComment(node, lang)) return null
    if (shouldKeep(text, lang)) return null
    if (!PLACEHOLDER_PATTERN.test(text)) return null
    return this
  },
}

const apologeticComment: Rule = {
  id: "apologetic-comment",
  message: "Apologetic comment — fix the code instead of apologizing for it",
  note: 'Comments admitting "this is a hack" or "good enough for now" are a sign the code needs actual improvement, not an apology.',
  check(node, lang) {
    const text = commentText(node)
    if (!isComment(node, lang)) return null
    if (shouldKeep(text, lang)) return null
    if (!APOLOGETIC_PATTERN.test(text)) return null
    return this
  },
}

const aiSpecificComment: Rule = {
  id: "ai-generated-comment",
  message: "AI-generated placeholder — the AI left a note instead of writing the code",
  note: "The AI assistant admitted it didn't finish the job. Replace the comment with an actual implementation.",
  check(node, lang) {
    const text = commentText(node)
    if (!isComment(node, lang)) return null
    if (shouldKeep(text, lang)) return null
    if (!AI_SPECIFIC_PATTERN.test(text)) return null
    return this
  },
}

export const commentRules: Rule[] = [
  obviousComment,
  narratorComment,
  stepComment,
  sectionDivider,
  placeholderComment,
  apologeticComment,
  aiSpecificComment,
]
