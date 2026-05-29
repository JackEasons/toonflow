import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { hashPassword } from "@/lib/password";
const router = express.Router();

export default router.post(
  "/",
  validateFields({
    name: z.string(),
    password: z.string().optional(),
    id: z.number(),
  }),
  async (req, res) => {
    const { name, password, id } = req.body;
    const updateData: { name: string; password?: string } = {
      name,
    };
    if (typeof password === "string" && password.trim()) {
      updateData.password = await hashPassword(password);
    }
    await u.db("o_user").where("id", id).update(updateData);
    res.status(200).send(success("保存设置成功"));
  },
);
