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

    expect(prompt).not.toContain("收到执行层完成，如果是文本多参模式，则提醒用户进入视频工作台生成视频，否则询问用户是否生成分镜图。");
    expect(prompt).not.toContain('向用户询问：使用 **"纯文本多参模式"** 还是 **"分镜图辅助多参模式"**');
    expect(prompt).not.toContain("监督层审核完毕后将报告展示给用户。决策层**等待用户回复**，根据反馈操作：");
    expect(prompt).not.toContain("存在多方案选择、成本/生成范围选择、质量风险、修复项或重做建议时必须等待用户回复");
    expect(prompt).not.toContain("用户确认的修复项");
    expect(prompt).not.toContain("必须等待用户明确指示");
  });
});
