import express from "express";
import { z } from "zod";

import { error, success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import u from "@/utils";
import { parseNotificationSettings } from "@/utils/userProfile";

const router = express.Router();

const notificationFields = ["accountPassword", "systemMessage", "todoTask"] as const;

router.get("/", async (req, res) => {
  const tokenUser = (req as any).user;
  if (!tokenUser?.id) return res.status(401).send(error("未提供token"));

  const user = await u.db("o_user").where("id", tokenUser.id).first();
  if (!user) return res.status(401).send(error("用户不存在"));

  res.status(200).send(success(parseNotificationSettings(user.notificationSettings)));
});

router.post(
  "/",
  validateFields({
    accountPassword: z.boolean().optional(),
    systemMessage: z.boolean().optional(),
    todoTask: z.boolean().optional(),
  }),
  async (req, res) => {
    const tokenUser = (req as any).user;
    if (!tokenUser?.id) return res.status(401).send(error("未提供token"));

    const user = await u.db("o_user").where("id", tokenUser.id).first();
    if (!user) return res.status(401).send(error("用户不存在"));

    const settings = parseNotificationSettings(user.notificationSettings);
    for (const field of notificationFields) {
      if (typeof req.body[field] === "boolean") settings[field] = req.body[field];
    }

    await u
      .db("o_user")
      .where("id", user.id)
      .update({ notificationSettings: JSON.stringify(settings) });

    res.status(200).send(success(settings, "提醒设置已更新"));
  },
);

export default router;
