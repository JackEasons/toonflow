import { describe, expect, it } from "vitest";

import {
  buildPromptSourceInfoForMode,
  buildVideoReferenceInfoForMode,
  orderUploadItemsForMode,
} from "../videoUploadSources";

function storyboard(id: number, index: number, extra: Partial<UploadItem> = {}): UploadItem {
  return {
    fileType: "image",
    id,
    index,
    sources: "storyboard",
    src: `/storyboard-${id}.png`,
    ...extra,
  };
}

describe("videoUploadSources", () => {
  it("uses the visible first two frame slots instead of the hidden last storyboard", () => {
    const items = [storyboard(1, 0), storyboard(2, 1), storyboard(9, 8)];

    expect(buildVideoReferenceInfoForMode(items, "startFrameOptional")).toEqual([
      { id: 1, sources: "storyboard" },
      { id: 2, sources: "storyboard" },
    ]);
    expect(buildPromptSourceInfoForMode(items, "startFrameOptional")).toEqual([
      { id: 1, sources: "storyboard" },
      { id: 2, sources: "storyboard" },
    ]);
  });

  it("preserves explicit start and end frame slots before storyboard index sorting", () => {
    const endFrame = storyboard(9, 8, { slotType: "endImage" });
    const startFrame = storyboard(4, 3, { slotType: "startImage" });
    const middleFrame = storyboard(5, 4);

    const ordered = orderUploadItemsForMode([endFrame, middleFrame, startFrame], "startFrameOptional");

    expect(ordered.map((item) => item.id)).toEqual([4, 9, 5]);
    expect(buildVideoReferenceInfoForMode(ordered, "startFrameOptional")).toEqual([
      { id: 4, sources: "storyboard", slotType: "startImage" },
      { id: 9, sources: "storyboard", slotType: "endImage" },
    ]);
  });
});
