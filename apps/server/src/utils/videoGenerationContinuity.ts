import { v4 as uuidv4 } from "uuid";
import type { ReferenceList } from "@/utils/ai";
import type { OssStorageProvider } from "@/utils/oss";

type VideoModeValue = string | unknown[];
type VideoOutputWriter = {
  save: (path: string, storageProvider?: OssStorageProvider) => Promise<unknown>;
  saveLastFrame?: (path: string, storageProvider?: OssStorageProvider) => Promise<boolean>;
};

const IMAGE_DRIVEN_VIDEO_MODES = new Set(["singleImage", "startEndRequired", "endFrameOptional", "startFrameOptional"]);

export function parseVideoModeValue(mode: unknown): VideoModeValue {
  if (Array.isArray(mode)) return mode;
  if (typeof mode !== "string") return "";
  try {
    const parsed = JSON.parse(mode);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return mode;
}

export function isImageDrivenVideoMode(mode: unknown): boolean {
  const value = parseVideoModeValue(mode);
  return typeof value === "string" && IMAGE_DRIVEN_VIDEO_MODES.has(value);
}

export function supportsReturnedLastFrame(model: string): boolean {
  const [vendorId, modelName = model] = model.split(/:(.+)/);
  return vendorId === "volcengine" && /seedance-2-0/i.test(modelName);
}

export function shouldRequestVideoLastFrame(model: string, mode: unknown): boolean {
  return supportsReturnedLastFrame(model) && isImageDrivenVideoMode(mode);
}

export function withChainedFirstFrame(referenceList: ReferenceList[], firstFrameBase64?: string | null): ReferenceList[] {
  if (!firstFrameBase64) return referenceList;

  let replaced = false;
  const nextList = referenceList.map((item) => {
    if (!replaced && item.type === "image") {
      replaced = true;
      return { ...item, base64: firstFrameBase64 };
    }
    return item;
  });

  if (replaced) return nextList;
  return [{ type: "image", base64: firstFrameBase64 }, ...nextList];
}

export async function saveGeneratedVideoOutputs({
  aiVideo,
  projectId,
  storageProvider,
  videoPath,
}: {
  aiVideo: VideoOutputWriter;
  projectId: number;
  storageProvider: OssStorageProvider;
  videoPath: string;
}) {
  await aiVideo.save(videoPath, storageProvider);

  const lastFramePath = `/${projectId}/video-last-frame/${uuidv4()}.png`;
  let savedLastFrame = false;
  try {
    savedLastFrame = typeof aiVideo.saveLastFrame === "function" ? await aiVideo.saveLastFrame(lastFramePath, storageProvider) : false;
  } catch (error) {
    console.warn("[视频生成] 尾帧保存失败，已保留视频结果:", error);
  }

  return {
    lastFramePath: savedLastFrame ? lastFramePath : null,
  };
}
