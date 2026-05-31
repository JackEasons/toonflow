import express from "express";
import { success, error } from "@/lib/responseFormat";
import { listModelBillingRules } from "@/utils/modelBilling";

const router = express.Router();

export default router.get("/", async (_req, res) => {
  try {
    return res.status(200).send(success(await listModelBillingRules()));
  } catch (err: any) {
    return res.status(400).send(error(err?.message || "获取模型计费规则失败"));
  }
});

