import "#/views/production/components/workbench/type/type";

export type PromptSourceInfo = Array<{
  id: number | null | undefined;
  sources: string | undefined;
}>;

const FRAME_VIDEO_MODES = new Set(["startEndRequired", "endFrameOptional", "startFrameOptional"]);
const FRAME_SLOT_RANK: Partial<Record<Type, number>> = {
  startImage: 0,
  endImage: 1,
};

function parseVideoMode(value: string): VideoMode | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed as ReferenceType[];
  } catch {
    return value as Exclude<VideoMode, ReferenceType[]>;
  }
  return value as Exclude<VideoMode, ReferenceType[]>;
}

function isFrameVideoMode(mode: VideoMode | null): boolean {
  return typeof mode === "string" && FRAME_VIDEO_MODES.has(mode);
}

function isStoryboard(item: UploadItem | TrackMedia): boolean {
  return item.sources === "storyboard";
}

function getStoryboardIndex(item: UploadItem | TrackMedia): number {
  const index = (item as { index?: number }).index;
  return typeof index === "number" ? index : Number.MAX_SAFE_INTEGER;
}

function byStoryboardIndex(a: UploadItem | TrackMedia, b: UploadItem | TrackMedia): number {
  return getStoryboardIndex(a) - getStoryboardIndex(b);
}

function getFrameSlotRank(item: UploadItem | TrackMedia): number | null {
  const rank = item.slotType ? FRAME_SLOT_RANK[item.slotType] : undefined;
  return typeof rank === "number" ? rank : null;
}

function isUsable(item: UploadItem | TrackMedia, filterEmpty: boolean): boolean {
  return item.id != null && (!filterEmpty || Boolean(item.src));
}

function toSourceInfo(items: Array<UploadItem | TrackMedia>): PromptSourceInfo {
  const seen = new Set<string>();
  const result: PromptSourceInfo = [];
  items.forEach((item) => {
    if (item.id == null) return;
    const sources = item.sources ?? "storyboard";
    const key = `${sources}:${item.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push({ id: item.id, sources });
  });
  return result;
}

function selectFrameItems(items: Array<UploadItem | TrackMedia>, mode: VideoMode | null): Array<UploadItem | TrackMedia> {
  const storyboards = items.filter(isStoryboard);
  if (mode === "singleImage") return storyboards[0] ? [storyboards[0]] : items.slice(0, 1);
  if (!isFrameVideoMode(mode)) return items;
  const slotted = items
    .filter((item) => getFrameSlotRank(item) != null)
    .sort((a, b) => getFrameSlotRank(a)! - getFrameSlotRank(b)!);
  if (slotted.length) return slotted.slice(0, 2);
  if (storyboards.length) return storyboards.slice(0, 2);
  return items.slice(0, 2);
}

export function orderUploadItemsForMode(items: UploadItem[], modeValue: string): UploadItem[] {
  const mode = parseVideoMode(modeValue);
  const frameLike = mode === "singleImage" || isFrameVideoMode(mode);
  return items
    .map((item, index) => ({ index, item }))
    .sort((a, b) => {
      const priority = ({ item }: { item: UploadItem }) => {
        const slotRank = getFrameSlotRank(item);
        if (slotRank != null) return slotRank;
        if (frameLike && !item.src) return 4;
        if (frameLike) return isStoryboard(item) ? 2 : 3;
        if (!item.src) return 2;
        return item.sources === "assets" ? 0 : 1;
      };
      return priority(a) - priority(b) || byStoryboardIndex(a.item, b.item) || a.index - b.index;
    })
    .map(({ item }) => item);
}

export function buildPromptSourceInfoForMode(items: Array<UploadItem | TrackMedia>, modeValue: string): PromptSourceInfo {
  const mode = parseVideoMode(modeValue);
  const usable = items.filter((item) => isUsable(item, false));
  if (mode === "text") return toSourceInfo(usable);
  return toSourceInfo(selectFrameItems(usable, mode));
}

export function buildVideoReferenceInfoForMode(items: Array<UploadItem | TrackMedia>, modeValue: string): PromptSourceInfo {
  const mode = parseVideoMode(modeValue);
  if (mode === "text") return [];
  const usable = items.filter((item) => isUsable(item, true));
  return toSourceInfo(selectFrameItems(usable, mode));
}
