export type MediaType = "image" | "video";

export interface NegativePromptContext {
  mediaType: MediaType;
  modelKey: string;
}

export interface NegativePromptInput {
  prompt: string;
  negativePrompt?: string;
  negativePromptSource?: string;
  disableNegativePrompt?: boolean;
}

type NegativePromptOutput<T extends NegativePromptInput> = Omit<T, "negativePromptSource" | "disableNegativePrompt"> & {
  negativePrompt?: string;
};

const NEGATIVE_MARKER_RE = /("negative"\s*:|<negative>|负面(?:提示词|约束|规避)|负向词|negative\s*(prompt|constraints?|\]))/i;
const CJK_RE = /[\u3400-\u9fff]/;

const IMAGE_NEGATIVE_ZH = [
  "低清",
  "模糊",
  "噪点",
  "马赛克",
  "畸形肢体",
  "错乱手指",
  "扭曲五官",
  "重复人物",
  "多余人物",
  "字幕",
  "水印",
  "logo",
  "UI界面",
  "标题叠字",
].join("、");

const VIDEO_NEGATIVE_ZH = [
  "低清",
  "模糊",
  "画面闪烁",
  "镜头抖动",
  "人物变形",
  "身份漂移",
  "前后帧不连续",
  "畸形肢体",
  "错乱手指",
  "重复人物",
  "字幕",
  "水印",
  "logo",
  "UI界面",
  "标题叠字",
].join("、");

const IMAGE_NEGATIVE_EN = [
  "low quality",
  "blurry",
  "noise",
  "pixelated",
  "deformed anatomy",
  "bad hands",
  "distorted face",
  "duplicated subjects",
  "extra characters",
  "subtitles",
  "watermark",
  "logo",
  "UI text",
  "title overlay",
].join(", ");

const VIDEO_NEGATIVE_EN = [
  "low quality",
  "blurry",
  "flicker",
  "camera jitter",
  "morphing body",
  "identity drift",
  "temporal inconsistency",
  "deformed anatomy",
  "bad hands",
  "duplicated subjects",
  "subtitles",
  "watermark",
  "logo",
  "UI text",
  "title overlay",
].join(", ");

export function withNegativePrompt<T extends NegativePromptInput>(input: T, context: NegativePromptContext): NegativePromptOutput<T> {
  const { negativePromptSource, disableNegativePrompt, ...rest } = input;
  if (disableNegativePrompt) return rest;

  const prompt = input.prompt ?? "";
  const existingNegative = input.negativePrompt?.trim();
  const resolvedNegative = resolveNegativePrompt(input, context);
  if (!resolvedNegative) return rest;

  if (hasNegativePrompt(prompt)) {
    return existingNegative ? ({ ...rest, negativePrompt: existingNegative } as NegativePromptOutput<T>) : rest;
  }

  if (supportsNativeNegativePrompt(context.modelKey, context.mediaType)) {
    return { ...rest, negativePrompt: resolvedNegative } as NegativePromptOutput<T>;
  }

  return {
    ...rest,
    prompt: appendInlineNegativePrompt(prompt, resolvedNegative, context.mediaType),
  } as NegativePromptOutput<T>;
}

export function resolveNegativePrompt(input: NegativePromptInput, context: NegativePromptContext): string | undefined {
  if (input.disableNegativePrompt) return undefined;
  const existingNegative = input.negativePrompt?.trim();
  if (existingNegative) return existingNegative;
  return buildNegativePrompt(input.prompt ?? "", input.negativePromptSource, context.mediaType);
}

function buildNegativePrompt(prompt: string, source: string | undefined, mediaType: MediaType): string {
  const sourceNegative = normalizeNegativePrompt(extractNegativeSections(source ?? ""));
  if (sourceNegative) return sourceNegative;

  const useChinese = CJK_RE.test(prompt) || CJK_RE.test(source ?? "");
  if (mediaType === "video") return useChinese ? VIDEO_NEGATIVE_ZH : VIDEO_NEGATIVE_EN;
  return useChinese ? IMAGE_NEGATIVE_ZH : IMAGE_NEGATIVE_EN;
}

function hasNegativePrompt(prompt: string): boolean {
  return NEGATIVE_MARKER_RE.test(prompt);
}

function supportsNativeNegativePrompt(modelKey: string, mediaType: MediaType): boolean {
  const [vendorId] = modelKey.split(/:(.+)/);
  void vendorId;
  void mediaType;
  // Keep negatives inline until each vendor adapter explicitly maps its native negative field.
  return false;
}

function appendInlineNegativePrompt(prompt: string, negativePrompt: string, mediaType: MediaType): string {
  const parsed = tryParseJsonObject(prompt);
  if (parsed && !("negative" in parsed)) {
    parsed.negative = negativePrompt;
    return JSON.stringify(parsed, null, 2);
  }

  const useChinese = CJK_RE.test(prompt) || CJK_RE.test(negativePrompt);
  if (useChinese) {
    return `${prompt.trim()}\n\n【负面约束】${negativePrompt}。`;
  }

  const title = mediaType === "video" ? "[Negative video constraints]" : "[Negative constraints]";
  return `${prompt.trim()}\n\n${title}\n${negativePrompt}.`;
}

function tryParseJsonObject(prompt: string): Record<string, unknown> | null {
  const trimmed = prompt.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {}
  return null;
}

function extractNegativeSections(source: string): string[] {
  const sections: string[] = [];
  for (const match of source.matchAll(/<negative>([\s\S]*?)<\/negative>/gi)) {
    sections.push(match[1]);
  }

  const headingRe =
    /(^|\n)#{1,6}\s*(?:负面规避提示词|负面\/严禁提示词|负向词模板|负面词|严禁提示词|美学禁止项|Negative prompt|Negative constraints)[^\n]*\n([\s\S]*?)(?=\n#{1,6}\s|\n---|$)/gi;
  for (const match of source.matchAll(headingRe)) {
    sections.push(match[2]);
  }

  return sections;
}

function normalizeNegativePrompt(sections: string[]): string {
  const lines = sections
    .join("\n")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^\s*[-*+]\s*/, "")
        .replace(/^\s*\d+[.)]\s*/, "")
        .replace(/^\s*#{1,6}\s*/, "")
        .trim(),
    )
    .filter((line) => line && !line.includes("|") && !line.startsWith(">"))
  const text = lines.join(" ");

  const terms = lines
    .flatMap((line) => line.split(/[,，、;；]/))
    .map((term) => term.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const uniqueTerms = [...new Set(terms)];
  return uniqueTerms.join(CJK_RE.test(text) ? "、" : ", ").slice(0, 800).trim();
}
