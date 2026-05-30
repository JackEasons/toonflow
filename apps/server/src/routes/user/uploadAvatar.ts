import express from "express";
import { z } from "zod";
import { v4 as uuid } from "uuid";

import { error, success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import u from "@/utils";
import { buildUserInfo } from "@/utils/userProfile";

const router = express.Router();

const MIME_EXTENSIONS: Record<string, string> = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function parseAvatarDataUrl(contentBase64: string) {
  const match = contentBase64.match(/^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;

  const mime = match[1];
  const payload = match[2];
  if (!mime || !payload) return null;

  const extension = MIME_EXTENSIONS[mime.toLowerCase()];
  if (!extension) return null;

  return { extension, payload };
}

function getBase64Size(payload: string) {
  return Buffer.byteLength(payload, "base64");
}

export default router.post(
  "/",
  validateFields({
    contentBase64: z.string(),
    filename: z.string().optional(),
  }),
  async (req, res) => {
    const tokenUser = (req as any).user;
    if (!tokenUser?.id) return res.status(401).send(error("未提供token"));

    const user = await u.db("o_user").where("id", tokenUser.id).first();
    if (!user) return res.status(401).send(error("用户不存在"));

    const contentBase64 = String(req.body.contentBase64 || "");
    const parsedAvatar = parseAvatarDataUrl(contentBase64);

    if (!parsedAvatar) return res.status(400).send(error("仅支持 JPG、PNG、WEBP、GIF 图片"));
    if (getBase64Size(parsedAvatar.payload) > 5 * 1024 * 1024) {
      return res.status(400).send(error("头像大小不能超过 5MB"));
    }

    const savePath = `/avatar/${user.id}/${uuid()}.${parsedAvatar.extension}`;

    try {
      await u.oss.writeFile(savePath, contentBase64);
      const avatar = await u.oss.getFileUrl(savePath);

      await u.db("o_user").where("id", user.id).update({ avatar });
      const nextUser = await u.db("o_user").where("id", user.id).first();

      res.status(200).send(success(buildUserInfo(nextUser), "头像上传成功"));
    } catch (err: any) {
      res.status(400).send(error(err?.message || "头像上传失败"));
    }
  },
);
