import express from "express";

import { error } from "@/lib/responseFormat";

const router = express.Router();

export default router.post("/", (_req, res) => {
  res.status(403).send(error("Web 端不开放文件编辑功能"));
});
