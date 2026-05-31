import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { isVendorModelEnabled } from "@/utils/modelBilling";
const router = express.Router();

export default router.post(
  "/",
  validateFields({
    modelId: z.string(),
  }),
  async (req, res) => {
    const { modelId } = req.body;
    const [id, name] = modelId.split(/:(.+)/);
    const vendorRow = await u.db("o_vendorConfig").select("enable").where("id", id).first();
    if (!vendorRow || Number(vendorRow.enable || 0) !== 1) return res.status(404).send(error("模型未找到"));
    const models = await u.vendor.getModelList(id);
    const findData = models.find((i: any) => i.modelName == name && isVendorModelEnabled(i));
    if (!findData) return res.status(404).send(error("模型未找到"));
    res.status(200).send(success(findData));
  },
);
