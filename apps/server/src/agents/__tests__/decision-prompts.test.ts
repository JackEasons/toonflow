import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));

function readSkill(relativePath: string) {
  return readFileSync(join(currentDir, "../../../data/skills", relativePath), "utf-8");
}

describe("agent decision prompt autonomy rules", () => {
  it("keeps script agent A-grade approvals and default script batches automatic", () => {
    const prompt = readSkill("script_agent_decision.md");

    expect(prompt).toContain("A 级通过且无阻断项时自动进入下一阶段");
    expect(prompt).toContain("自动生成**全部剩余集数与3集中的较小值**");
    expect(prompt).toContain('无需先询问"本次生成几集"');
    expect(prompt).toContain("自主修复/重做规则");
    expect(prompt).toContain("直接派发当前阶段修复任务，不等待用户确认");
    expect(prompt).toContain("直接按原始项目配置和原任务目标重新派发当前阶段，不等待用户确认");
    expect(prompt).toContain("最多自动闭环2轮");
    expect(prompt).toContain("不先追问剧集类型");
    expect(prompt).toContain("一次性给出完整推荐配置并请用户确认");
    expect(prompt).toContain("不逐一追问");

    expect(prompt).not.toContain("询问用户本次生成几集剧本（默认3集");
    expect(prompt).not.toContain("先询问用户想要做的剧集类型");
    expect(prompt).not.toContain("对未给出的参数**逐一追问**");
    expect(prompt).not.toContain('展示报告 + "审核通过，是否进入下一阶段？"');
    expect(prompt).not.toContain("展示报告后必须停下来等待用户回复，收到用户明确指示前不得派发任何新任务给执行层");
    expect(prompt).not.toContain("B/C/D、审核报告包含明确修复项/缺失项/重做建议、或下一步存在多个合理方案时，必须停下来等待用户回复");
    expect(prompt).not.toContain("仅含用户明确确认要修的项");
  });

  it("keeps production storyboard image generation automatic after stage 5 when safe", () => {
    const prompt = readSkill("production_agent_decision.md");

    expect(prompt).toContain("A 级通过且无阻断项时自动进入下一阶段");
    expect(prompt).toContain("直接自动进入阶段6");
    expect(prompt).toContain("不再询问用户是否生成分镜图");
    expect(prompt).toContain("仅生成 `shouldGenerateImage=true` 且尚未完成的分镜");
    expect(prompt).toContain("自主修复/重做规则");
    expect(prompt).toContain("直接根据审核意见构建修复指令");
    expect(prompt).toContain("直接按原始目标重新派发当前阶段");
    expect(prompt).toContain("最多自动闭环2轮");
    expect(prompt).toContain('默认自动选择 **"分镜图辅助多参模式"**');
    expect(prompt).toContain("无需单独询问用户");
    expect(prompt).toContain("不得在执行层返回工具确认前宣称");
    expect(prompt).toContain("阶段3的衍生资产图片生成必须等待真实完成后再进入阶段4");
    expect(prompt).toContain("若全部成功，决策层直接自动进入阶段4");
    expect(prompt).toContain("避免用缺失资产生成分镜表");

    expect(prompt).not.toContain("返回确认后，告知用户图片生成中，询问用户是否进入阶段4。");
    expect(prompt).not.toContain("收到执行层完成，如果是文本多参模式，则提醒用户进入视频工作台生成视频，否则询问用户是否生成分镜图。");
    expect(prompt).not.toContain('向用户询问：使用 **"纯文本多参模式"** 还是 **"分镜图辅助多参模式"**');
    expect(prompt).not.toContain("监督层审核完毕后将报告展示给用户。决策层**等待用户回复**，根据反馈操作：");
    expect(prompt).not.toContain("存在多方案选择、成本/生成范围选择、质量风险、修复项或重做建议时必须等待用户回复");
    expect(prompt).not.toContain("用户确认的修复项");
    expect(prompt).not.toContain("必须等待用户明确指示");
  });

  it("keeps production execution skills aligned with exposed tool names", () => {
    const storyboardGen = readSkill("production_execution_storyboard_gen.md");
    const generateAssets = readSkill("production_execution_generate_assets.md");
    const storyboardPanel = readSkill("production_execution_storyboard_panel.md");

    expect(storyboardGen).toContain("generate_storyboard({ ids:");
    expect(storyboardGen).toContain("只有 `generate_storyboard` 返回成功后");
    expect(storyboardGen).not.toContain("generate_storyboard_images");

    expect(generateAssets).toContain("generate_deriveAsset({ ids:");
    expect(generateAssets).toContain("等待工具返回最终完成结果");
    expect(generateAssets).toContain("不得只回复“已启动”");
    expect(generateAssets).not.toContain("generate_assets_images");

    expect(storyboardPanel).toContain("禁止调用 `generate_storyboard`");
    expect(storyboardPanel).not.toContain("generate_storyboard_images");
  });

  it("keeps storyboard table output markdown-renderable", () => {
    const storyboardTable = readSkill("production_execution_storyboard_table.md");

    expect(storyboardTable).toContain("Markdown 表格格式铁律");
    expect(storyboardTable).toContain("所有数据行之间严禁空行");
    expect(storyboardTable).toContain("每一行必须严格 14 列");
    expect(storyboardTable).toContain("任何单元格内容严禁出现 ASCII 竖线 `|`");
    expect(storyboardTable).toContain("每条分镜必须完整写在同一物理行内");
  });
});
