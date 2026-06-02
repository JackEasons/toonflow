export interface VideoModeOption {
  label: string;
  value: string;
  disabled?: boolean;
}

interface VisualManualLike {
  name?: string;
  stylePath?: string;
}

const DISABLED_VIDEO_MODES = new Set(["text"]);

export function isVideoModeOptionDisabled(value: string | undefined | null) {
  return DISABLED_VIDEO_MODES.has(value ?? "");
}

export function withVideoModePolicy<T extends VideoModeOption>(option: T): T {
  return {
    ...option,
    disabled: isVideoModeOptionDisabled(option.value),
  };
}

export function getFirstEnabledVideoModeValue(options: VideoModeOption[]) {
  return options.find((item) => !item.disabled)?.value ?? "";
}

export function isSeedance2VideoModel(...sources: unknown[]) {
  const sourceText = sources
    .filter((item) => typeof item === "string" && item.trim())
    .join(" ")
    .toLowerCase();

  return /seedance[\s_./-]*2(?:[\s_.-]*0)?/.test(sourceText);
}

export function isRealPersonVisualManual(item: VisualManualLike) {
  const sourceText = [item.name, item.stylePath].filter(Boolean).join(" ").toLowerCase();
  return /真人|real[\s_-]*people|real[\s_-]*person|live[\s_-]*action/.test(sourceText);
}
