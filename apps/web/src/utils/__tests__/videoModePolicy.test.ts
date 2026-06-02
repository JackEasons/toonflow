import { describe, expect, it } from "vitest";

import {
  getFirstEnabledVideoModeValue,
  isRealPersonVisualManual,
  isSeedance2VideoModel,
  isVideoModeOptionDisabled,
  withVideoModePolicy,
} from "../videoModePolicy";

describe("videoModePolicy", () => {
  it("disables text-to-video mode", () => {
    expect(isVideoModeOptionDisabled("text")).toBe(true);
    expect(isVideoModeOptionDisabled("startFrameOptional")).toBe(false);
    expect(withVideoModePolicy({ value: "text", label: "文本生视频" })).toEqual({
      value: "text",
      label: "文本生视频",
      disabled: true,
    });
  });

  it("returns the first enabled video mode", () => {
    expect(
      getFirstEnabledVideoModeValue([
        { value: "text", label: "文本生视频", disabled: true },
        { value: "startFrameOptional", label: "首尾帧" },
      ]),
    ).toBe("startFrameOptional");
  });

  it("detects Seedance 2.0 model identifiers", () => {
    expect(isSeedance2VideoModel("1:doubao-seedance-2-0-260128")).toBe(true);
    expect(isSeedance2VideoModel("bytedance/seedance-2.0-fast/reference-to-video")).toBe(true);
    expect(isSeedance2VideoModel("jimeng-video-seedance-2.0-vip")).toBe(true);
    expect(isSeedance2VideoModel("doubao-seedance-1-5-pro-251215")).toBe(false);
  });

  it("detects real-person visual manuals by name or path", () => {
    expect(isRealPersonVisualManual({ name: "真人都市写实风格说明", stylePath: "realpeople_modern_city" })).toBe(true);
    expect(isRealPersonVisualManual({ name: "国风3D风格说明", stylePath: "3D_chinese_guofeng" })).toBe(false);
  });
});
