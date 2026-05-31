import express from 'express';
import u from '@/utils';
import { z } from 'zod';
import { error, success } from '@/lib/responseFormat';
import { validateFields } from '@/middleware/middleware';
import axios from 'axios';
import { quoteModelCalls, releasePointHold, reserveModelCallPoints, settlePointHold } from '@/utils/modelBilling';
const router = express.Router();

async function urlToBase64(imageUrl: string): Promise<string> {
  if (imageUrl.startsWith('data:')) return imageUrl;

  const isRemoteUrl = /^https?:\/\//i.test(imageUrl);
  const isOssUrl = (() => {
    if (!isRemoteUrl) return true;
    try {
      const pathname = new URL(imageUrl).pathname;
      return (
        pathname.startsWith('/oss/') || pathname.startsWith('/smallImage/')
      );
    } catch {
      return false;
    }
  })();

  if (isOssUrl) {
    return await u.oss.getImageBase64(u.replaceUrl(imageUrl), u.oss.getStorageProviderFromUrl(imageUrl));
  }

  const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
  const contentType = response.headers['content-type'] || 'image/png';
  const base64 = Buffer.from(response.data, 'binary').toString('base64');
  return `data:${contentType};base64,${base64}`;
}
export default router.post(
  '/',
  validateFields({
    model: z.string(),
    references: z.array(z.string()).optional(),
    quality: z.string(),
    ratio: z.string(),
    prompt: z.string(),
    projectId: z.number(),
  }),
  async (req, res) => {
    const {
      model,
      references = [],
      quality,
      ratio,
      prompt,
      projectId,
    } = req.body;
    const userId = String((req as any).user?.id || '');
    if (!userId) return res.status(401).send(error('未提供token'));

    let quote;
    try {
      quote = await quoteModelCalls(userId, [
        {
          count: 1,
          model,
          modelType: 'image',
          resolution: quality,
          taskType: 'workflow_image_generation',
        },
      ]);
    } catch (err: any) {
      return res.status(400).send(error(err?.message || '获取积分报价失败'));
    }
    if (!quote.enough) return res.status(400).send(error(`积分不足，需要 ${quote.requiredPoints} 积分，当前可用 ${quote.availablePoints} 积分`));

    const billingAttemptId = u.uuid();
    let billingHold = null;
    try {
      billingHold = await reserveModelCallPoints({
        billingMeta: quote,
        description: `工作流图片生成：${quote.items[0]?.modelLabel || model}`,
        idempotencyKey: `model-call:workflow-image:${billingAttemptId}`,
        projectId,
        quote,
        relatedId: billingAttemptId,
        taskType: 'workflow_image_generation',
        userId,
      });
    } catch (err: any) {
      return res.status(400).send(error(err?.message || '积分不足'));
    }

    try {
      const imageClass = await u.Ai.Image(model).run(
        {
          prompt: prompt,
          referenceList: await (async () => {
            const list: { type: 'image'; base64: string }[] = [];
            for (const url of references) {
              list.push({
                type: 'image' as const,
                base64: await urlToBase64(url),
              });
            }
            return list;
          })(),
          size: quality,
          aspectRatio: ratio,
        },
        {
          taskClass: '工作流图片生成',
          describe: '工作流图片生成',
          relatedObjects: JSON.stringify({
            ...req.body,
            billingHoldId: billingHold?.id || null,
            billingRelatedId: billingAttemptId,
            billingTaskType: 'workflow_image_generation',
          }),
          projectId: projectId,
        },
      );
      const savePath = `${projectId}/workFlow/${u.uuid()}.jpg`;
      const storageProvider = u.oss.getStorageProvider();
      await imageClass.save(savePath, storageProvider);
      await settlePointHold(billingHold?.id);

      const url = await u.oss.getSmallImageUrl(savePath, storageProvider);
      return res.status(200).send(success({ url }));
    } catch (e) {
      await releasePointHold(billingHold?.id);
      res.status(400).send(error(u.error(e).message));
    }
  },
);
