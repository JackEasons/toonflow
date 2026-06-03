import { tool, zodSchema, Tool } from "ai";
import { z } from "zod";
import _ from "lodash";
import ResTool from "@/socket/resTool";
import { getAssetImageGenerationItems, startAssetImageGeneration } from "@/services/assetImageGeneration";
import { startStoryboardImageGeneration } from "@/services/storyboardImageGeneration";
import u from "@/utils";

const deriveAssetSchema = z.object({
  id: z.number().describe("衍生资产ID,如果新增则为空"),
  assetsId: z.number().describe("关联的资产ID"),
  prompt: z.string().describe("生成提示词"),
  name: z.string().describe("衍生资产名称"),
  desc: z.string().describe("衍生资产描述"),
  src: z.string().nullable().describe("衍生资产资源路径"),
  state: z.enum(["未生成", "生成中", "已完成", "生成失败"]).describe("衍生资产生成状态"),
  type: z.enum(["role", "tool", "scene", "clip"]).describe("衍生资产类型"),
});
export const assetItemSchema = z.object({
  id: z.number().describe("资产唯一标识"),
  name: z.string().describe("资产名称"),
  type: z.enum(["role", "tool", "scene", "clip"]).describe("资产类型"),
  prompt: z.string().describe("生成提示词"),
  desc: z.string().describe("资产描述"),
  derive: z.array(deriveAssetSchema).describe("衍生资产列表"),
});
const storyboardSchema = z.object({
  id: z.number().describe("分镜ID，必须为真实id"),
  duration: z.number().describe("持续时长(秒)"),
  prompt: z.string().describe("生成提示词"),
  associateAssetsIds: z.array(z.number()).describe("关联资产ID列表"),
  src: z.string().nullable().describe("分镜资源路径"),
  index: z.number().nullable().optional().describe("分镜排序字段"),
});
const workbenchDataSchema = z.object({
  name: z.string().describe("项目名称"),
  duration: z.string().describe("视频时长"),
  resolution: z.string().describe("分辨率"),
  fps: z.string().describe("帧率"),
  cover: z.string().optional().describe("封面图片路径"),
  gradient: z.string().optional().describe("渐变色配置"),
});
const posterItemSchema = z.object({
  id: z.number().describe("海报ID"),
  image: z.string().describe("海报图片路径"),
});
export const flowDataSchema = z.object({
  script: z.string().describe("剧本内容"),
  scriptPlan: z.string().describe("拍摄计划"),
  assets: z.array(assetItemSchema).describe("衍生资产"),
  storyboardTable: z.string().describe("分镜表"),
  storyboard: z.array(storyboardSchema).describe("分镜面板"),
});

export type FlowData = z.infer<typeof flowDataSchema>;

const keySchema = z.enum(Object.keys(flowDataSchema.shape) as [keyof FlowData, ...Array<keyof FlowData>]);
const flowDataKeyLabels = Object.fromEntries(
  Object.entries(flowDataSchema.shape).map(([key, schema]) => [key, (schema as z.ZodTypeAny).description ?? key]),
) as Record<keyof FlowData, string>;

interface ToolConfig {
  resTool: ResTool;
  toolsNames?: string[];
  msg: ReturnType<ResTool["newMessage"]>;
  userId?: string;
}

export default (toolCpnfig: ToolConfig) => {
  const { resTool, toolsNames, msg, userId } = toolCpnfig;
  const { socket } = resTool;
  const tools: Record<string, Tool> = {
    get_flowData: tool({
      description: "获取工作区数据",
      inputSchema: zodSchema<{ key: keyof FlowData }>(
        z
          .object({
            key: keySchema.describe("数据key"),
          }),
      ),
      execute: async ({ key }) => {
        const thinking = msg.thinking(`正在获取${flowDataKeyLabels[key]}工作区数据...`);
        console.log("[tools] get_flowData", key);
        const flowData: FlowData = await new Promise((resolve) => socket.emit("getFlowData", { key }, (res: any) => resolve(res)));
        thinking.appendText(`获取到${flowDataKeyLabels[key]}:\n` + JSON.stringify(flowData[key], null, 2));
        thinking.updateTitle(`获取${flowDataKeyLabels[key]}完成`);
        thinking.complete();
        return flowData[key];
      },
    }),
    add_deriveAsset: tool({
      description: "新增或更新衍生资产",
      inputSchema: zodSchema<{ assetsId: number; id: number | null; name: string; desc: string }>(
        z
          .object({
            assetsId: z.number().describe("关联的资产ID"),
            id: z.number().nullable().describe("衍生资产ID,如果新增则为空"),
            name: z.string().describe("衍生资产名称"),
            desc: z.string().describe("衍生资产描述"),
          }),
      ),
      execute: async (raw) => {
        // 容错：LLM 偶尔传 "null" 字符串或空串，统一规范为 null
        const idRaw = raw.id as unknown;
        const normalizedId = idRaw === "null" || idRaw === "" || idRaw === undefined ? null : (idRaw as number | null);
        const deriveAsset = { ...raw, id: normalizedId };

        const thinking = msg.thinking("正在操作资产...");
        const { projectId, scriptId } = resTool.data;
        const startTime = Date.now();
        const parentAssets = await u.db("o_assets").where("id", deriveAsset.assetsId).select("id", "type").first();
        if (!parentAssets) return "关联的资产不存在";

        const data = {
          id: deriveAsset.id ?? undefined,
          assetsId: deriveAsset.assetsId,
          projectId,
          name: deriveAsset.name,
          type: parentAssets.type,
          describe: deriveAsset.desc,
          startTime,
        };
        if (deriveAsset.id) {
          await u.db("o_assets").where("id", deriveAsset.id).update(data);
          thinking.appendText(`已更新衍生资产，ID: ${deriveAsset.id}\n`);
        } else {
          const [insertedId] = await u.db("o_assets").insert(data);
          data.id = insertedId;
          await u.db("o_scriptAssets").insert({ scriptId, assetId: insertedId });
          thinking.appendText(`已新增衍生资产，ID: ${insertedId}\n`);
        }
        const res = await new Promise((resolve) => socket.emit("addDeriveAsset", data, (res: any) => resolve(res)));
        thinking.updateTitle("资产操作完成");
        thinking.complete();
        return res ?? "操作成功";
      },
    }),
    del_deriveAsset: tool({
      description: "删除衍生资产",
      inputSchema: zodSchema<{ assetsId: number; id: number }>(
        z
          .object({
            assetsId: z.number().describe("关联的资产ID"),
            id: z.number().describe("衍生资产ID"),
          }),
      ),
      execute: async ({ assetsId, id }) => {
        const thinking = msg.thinking("正在操作资产...");
        const { scriptId } = resTool.data;
        await u.db("o_assets").where("id", id).del();
        await u.db("o_scriptAssets").where({ scriptId, assetId: id }).del();
        thinking.appendText(`已删除衍生资产，ID: ${id}\n`);
        const res = await new Promise((resolve) => socket.emit("delDeriveAsset", { assetsId, id }, (res: any) => resolve(res)));
        thinking.updateTitle("资产操作完成");
        thinking.complete();
        return res ?? "删除成功";
      },
    }),
    generate_deriveAsset: tool({
      description: "生成衍生资产图片",
      inputSchema: zodSchema<{ ids: number[] }>(
        z
          .object({
            ids: z.array(z.number()).default([]).describe("需要生成的衍生资产ID；为空时自动生成当前剧本中尚未完成的衍生资产"),
          }),
      ),
      execute: async ({ ids }) => {
        const thinking = msg.thinking("正在启动衍生资产图片生成...");
        const { projectId, scriptId } = resTool.data;
        if (!projectId || !scriptId) throw new Error("缺少项目或剧本上下文，无法生成衍生资产");
        if (!userId) throw new Error("缺少用户上下文，无法进行计费与生成");

        const requestedIds = [...new Set((ids || []).map(Number).filter((id) => Number.isFinite(id)))];
        const query = u
          .db("o_assets")
          .leftJoin("o_image", "o_assets.imageId", "o_image.id")
          .join("o_scriptAssets", "o_scriptAssets.assetId", "o_assets.id")
          .where("o_assets.projectId", projectId)
          .where("o_scriptAssets.scriptId", scriptId)
          .whereNotNull("o_assets.assetsId")
          .where((qb) => {
            qb.whereNull("o_image.state").orWhereNot("o_image.state", "已完成");
          })
          .select("o_assets.id");
        if (requestedIds.length) query.whereIn("o_assets.id", requestedIds);

        const rows = await query;
        const targetIds = rows.map((row: any) => Number(row.id)).filter((id: number) => Number.isFinite(id));
        if (!targetIds.length) {
          if (requestedIds.length) {
            const items = await getAssetImageGenerationItems(requestedIds);
            if (items.length) socket.emit("assetGenerationFinished", { items });
          }
          thinking.appendText("没有找到需要生成且尚未完成的衍生资产，当前资产可能已完成或不属于本剧集。\n");
          thinking.updateTitle("无需生成衍生资产");
          thinking.complete();
          return "没有需要生成的衍生资产图片";
        }

        const generation = await startAssetImageGeneration({
          assetIds: targetIds,
          concurrentCount: 5,
          projectId,
          scriptId,
          userId,
        });
        socket.emit("assetGenerationStarted", { items: generation.data });
        if (generation.generateIds.length) {
          thinking.appendText(`服务端已提交 ${generation.generateIds.length} 个衍生资产图片生成任务，ID: ${generation.generateIds.join(", ")}\n`);
        } else {
          thinking.appendText("服务端未重复提交新任务，正在复用已有生成任务或已完成结果。\n");
        }
        thinking.appendText("正在等待衍生资产图片生成完成，完成后将继续后续阶段。\n");
        const result = await generation.background;
        socket.emit("assetGenerationFinished", { items: result });
        const failed = result.filter((item) => item.state === "生成失败");
        if (failed.length > 0) {
          thinking.appendText(`衍生资产图片生成完成，其中 ${failed.length} 个失败：${failed.map((item) => item.id).join(", ")}\n`);
          thinking.updateTitle("衍生资产生成存在失败");
          thinking.complete();
          return `衍生资产图片生成完成，但 ${failed.length} 个失败：${failed.map((item) => item.id).join(", ")}`;
        }
        thinking.appendText(`衍生资产图片已全部生成完成：${result.length} 个。\n`);
        thinking.updateTitle("衍生资产生成完成");
        thinking.complete();
        return `衍生资产图片已全部生成完成：${result.length} 个`;
      },
    }),
    generate_storyboard: tool({
      description: "生成分镜图片",
      inputSchema: zodSchema<{ ids: number[] }>(
        z
          .object({
            ids: z.array(z.number()).default([]).describe("真实分镜ID列表；为空时自动生成当前剧本中需要生成且未完成的分镜"),
          }),
      ),
      execute: async ({ ids }) => {
        const thinking = msg.thinking("正在启动分镜图生成...");
        const { projectId, scriptId } = resTool.data;
        if (!projectId || !scriptId) throw new Error("缺少项目或剧本上下文，无法生成分镜图");
        if (!userId) throw new Error("缺少用户上下文，无法进行计费与生成");

        const requestedIds = [...new Set((ids || []).map(Number).filter((id) => Number.isFinite(id)))];
        const query = u
          .db("o_storyboard")
          .where({ projectId, scriptId })
          .where("shouldGenerateImage", 1)
          .whereNot("state", "已完成")
          .select("id");
        if (requestedIds.length) query.whereIn("id", requestedIds);

        const rows = await query;
        const targetIds = rows.map((row: any) => Number(row.id)).filter((id: number) => Number.isFinite(id));
        if (!targetIds.length) {
          thinking.appendText("没有找到需要生成且尚未完成的分镜。\n");
          thinking.updateTitle("无需生成分镜图");
          thinking.complete();
          return "没有需要生成的分镜图片";
        }

        const generation = await startStoryboardImageGeneration({
          concurrentCount: 5,
          projectId,
          scriptId,
          storyboardIds: targetIds,
          userId,
        });
        socket.emit("storyboardGenerationStarted", { items: generation.data });
        void generation.background.catch((err) => {
          console.error("[productionAgent] storyboard generation background error:", u.error(err).message);
        });

        thinking.appendText(`服务端已提交 ${generation.generateIds.length} 个分镜图生成任务，ID: ${generation.generateIds.join(", ")}\n`);
        thinking.updateTitle("分镜图生成任务已启动");
        thinking.complete();
        return `分镜图生成任务已在服务端启动：${generation.generateIds.length} 个`;
      },
    }),
  };
  tools.generate_storyboard_images = tools.generate_storyboard;
  tools.generate_assets_images = tools.generate_deriveAsset;

  return toolsNames ? Object.fromEntries(Object.entries(tools).filter(([n]) => toolsNames.includes(n))) : tools;
};
