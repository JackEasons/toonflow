import { describe, expect, it } from "vitest";
import { shouldRequestVideoLastFrame, withChainedFirstFrame } from "../videoGenerationContinuity";
import type { ReferenceList } from "../ai";

describe("videoGenerationContinuity", () => {
  it("only enables returned last frame for Volcengine Seedance 2.0 image-driven modes", () => {
    expect(shouldRequestVideoLastFrame("volcengine:doubao-seedance-2-0-260128", "startFrameOptional")).toBe(true);
    expect(shouldRequestVideoLastFrame("volcengine:doubao-seedance-2-0-fast-260128", "singleImage")).toBe(true);
    expect(shouldRequestVideoLastFrame("volcengine:doubao-seedance-2-0-260128", "text")).toBe(false);
    expect(shouldRequestVideoLastFrame("atlascloud:bytedance/seedance-2.0/text-to-video", "startFrameOptional")).toBe(false);
    expect(shouldRequestVideoLastFrame("volcengine:doubao-seedance-1-5-pro-251215", "startFrameOptional")).toBe(false);
  });

  it("chains the previous last frame as the next first image without dropping other references", () => {
    const references: ReferenceList[] = [
      { type: "image", base64: "old-start" },
      { type: "image", base64: "explicit-end" },
      { type: "audio", base64: "audio-ref" },
    ];

    expect(withChainedFirstFrame(references, "previous-tail")).toEqual([
      { type: "image", base64: "previous-tail" },
      { type: "image", base64: "explicit-end" },
      { type: "audio", base64: "audio-ref" },
    ]);
  });
});
