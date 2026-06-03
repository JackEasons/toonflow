import { describe, expect, it } from "vitest";

import { normalizeStoryboardTableMarkdown } from "../storyboardTableMarkdown";

describe("storyboardTableMarkdown", () => {
  it("removes blank lines that split generated storyboard markdown tables", () => {
    const input = `| 序号 | 画面描述 | 场景 | 关联资产名称 | 时长 | 景别 | 运镜 | 角色动作 | 朝向 | 空间关系 | 情绪 | 台词 | 音效 | 关联资产ID |
|----|-------------|------|----------|------|------|------|------|------|------|------|-------|-------|----------|
| 12 | 锦衣少年抬起双手，对陈平安行了一个少年人之间不算见的拱手礼 | 院中 | [陈平安, 锦衣少年, 吴爷爷, 院中] | 7 | 中景 | 静止 | (承接上镜)锦衣少年缓缓抬起双手 | 陈平安-3/4正面朝右;锦衣少年-3/4正面朝左 | 陈平安(左中)、锦衣少年(右中) | 诚意意外 | 无台词 | 静 | [20, 7, 15, 17] |

| 13 | 陈平安瞳孔微微放大 | 院中 | [陈平安, 院中] | 3 | 特写 | 静止 | (承接上镜)陈平安睁孔缓缓放大 | 陈平安-正面 | 陈平安(中中) | 悦然追忆 | 无台词 | 静 | [20, 17] |`;

    const normalized = normalizeStoryboardTableMarkdown(input);

    expect(normalized).not.toContain("|\n\n|");
    expect(normalized.split("\n")).toHaveLength(4);
  });

  it("merges extra pipe-delimited fragments back into the action column", () => {
    const input = `| 序号 | 画面描述 | 场景 | 关联资产名称 | 时长 | 景别 | 运镜 | 角色动作 | 朝向 | 空间关系 | 情绪 | 台词 | 音效 | 关联资产ID |
|----|-------------|------|----------|------|------|------|------|------|------|------|-------|-------|----------|
| 1 | 陈平安抬头 | 院中 | [陈平安, 院中] | 3 | 近景 | 静止 | (开篇)陈平安抬头 | 朝向:正面 | 空间关系:中中 | 陈平安-正面 | 陈平安(中中) | 平静 | 无台词 | 静 | [20, 17] |`;

    const normalized = normalizeStoryboardTableMarkdown(input);
    const dataRow = normalized.split("\n")[2];

    expect(dataRow.split("|").length - 2).toBe(14);
    expect(dataRow).toContain("朝向:正面");
    expect(dataRow).toContain("空间关系:中中");
  });
});
