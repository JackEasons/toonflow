import express from "express";
import { success } from "@/lib/responseFormat";
import { isAdminRequest } from "@/utils/admin";

const router = express.Router();

export default router.get("/", async (req, res) => {
  res.status(200).send(success(isAdminRequest(req) ? ["admin", "super", "*"] : ["user"]));
});
