import express from "express";
import { success } from "@/lib/responseFormat";

const router = express.Router();

export default router.get("/", async (_req, res) => {
  res.status(200).send(success(["admin", "super", "*"]));
});
