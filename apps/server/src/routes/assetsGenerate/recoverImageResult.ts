import express from "express";
import u from "@/utils";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { error, success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";

const router = express.Router();

const assetDirByType: Record<string, string> = {
  role: "role",
  scene: "scene",
  tool: "props",
};

function parseProviderPayload(value: unknown) {
  if (!value || typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function resolveModelKey(params: { model?: string; projectImageModel?: string | null; storedModel?: string | null }) {
  if (params.model?.includes(":")) return params.model as `${string}:${string}`;
  const storedModel = params.storedModel || params.model || "";
  if (params.projectImageModel?.includes(":")) {
    const [, projectModel] = params.projectImageModel.split(/:(.+)/);
    if (!storedModel || projectModel === storedModel) return params.projectImageModel as `${string}:${string}`;
  }
  if (!storedModel) return null;
  const vendors = await u.db("o_vendorConfig").where("enable", 1).select("id");
  for (const row of vendors) {
    const models = await u.vendor.getEnabledModelList(row.id);
    if (models.some((item: any) => item.modelName === storedModel)) return `${row.id}:${storedModel}` as `${string}:${string}`;
  }
  return null;
}

export default router.post(
  "/",
  validateFields({
    id: z.number(),
    model: z.string().optional(),
    projectId: z.number(),
  }),
  async (req, res) => {
    const { id, model, projectId } = req.body;
    const asset = await u
      .db("o_assets")
      .leftJoin("o_image", "o_assets.imageId", "o_image.id")
      .leftJoin("o_project", "o_assets.projectId", "o_project.id")
      .where("o_assets.id", id)
      .andWhere("o_assets.projectId", projectId)
      .select(
        "o_assets.id",
        "o_assets.type",
        "o_assets.imageId",
        "o_project.imageModel as projectImageModel",
        "o_image.filePath",
        "o_image.model",
        "o_image.providerPayload",
        "o_image.providerTaskId",
        "o_image.providerTaskType",
        "o_image.resolution",
        "o_image.state",
      )
      .first();

    if (!asset?.imageId) return res.status(404).send(error("未找到图片记录"));
    if (asset.filePath && asset.state === "已完成") {
      return res.status(200).send(
        success({
          filePath: await u.oss.getSmallImageUrl(asset.filePath),
          status: "completed",
        }),
      );
    }
    if (!asset.providerTaskId) {
      return res.status(200).send(
        success({
          status: "unavailable",
          message: "这条记录没有供应商任务ID，无法通过供应商查询接口回捞结果；只能人工确认后重新提交生成。",
        }),
      );
    }

    const modelKey = await resolveModelKey({ model, projectImageModel: asset.projectImageModel, storedModel: asset.model });
    if (!modelKey) {
      return res.status(200).send(
        success({
          status: "unsupported",
          message: "无法确定该图片对应的供应商模型，不能查询供应商结果。",
        }),
      );
    }

    const queryResult = await u.Ai.Image(modelKey).queryTask({
      payload: parseProviderPayload(asset.providerPayload),
      taskId: asset.providerTaskId,
      taskType: asset.providerTaskType,
    });

    if (queryResult.status === "processing") return res.status(200).send(success(queryResult));
    if (queryResult.status === "unsupported") return res.status(200).send(success(queryResult));
    if (queryResult.status === "failed") {
      await u.db("o_image").where("id", asset.imageId).update({
        errorReason: queryResult.error || queryResult.message || "供应商任务失败",
        state: "生成失败",
      });
      return res.status(200).send(success(queryResult));
    }

    if (!queryResult.data) return res.status(200).send(success({ status: "processing", message: "供应商暂未返回图片结果" }));

    const imagePath = `/${projectId}/${assetDirByType[asset.type] || "props"}/${uuidv4()}.jpg`;
    const storageProvider = u.oss.getStorageProvider();
    await u.oss.writeFile(imagePath, queryResult.data, storageProvider);
    await u.db("o_image").where("id", asset.imageId).update({
      errorReason: null,
      filePath: imagePath,
      storageProvider,
      state: "已完成",
    });

    return res.status(200).send(
      success({
        filePath: await u.oss.getSmallImageUrl(imagePath),
        status: "completed",
      }),
    );
  },
);
