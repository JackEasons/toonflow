export const IMAGE_RESULT_PENDING_STATE = "结果待确认";

export function getErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) return String((error as { message?: unknown }).message || "");
  return String(error || "");
}

export function isAmbiguousImageGenerationError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return /socket hang up|ECONNRESET|ECONNABORTED|ETIMEDOUT|timeout|network error/i.test(message);
}

export function toPendingImageGenerationReason(error: unknown): string {
  const message = getErrorMessage(error) || "连接中断";
  if (message.includes(IMAGE_RESULT_PENDING_STATE) || message.includes("请勿直接重复生成")) return message;
  return `图片生成${IMAGE_RESULT_PENDING_STATE}：供应商请求连接中断（${message}）。供应商可能已继续执行并计费，请先刷新或到供应商平台确认结果，避免直接重复生成。`;
}

export function normalizeAmbiguousImageState<T extends { state?: string | null; errorReason?: string | null }>(row: T): T {
  if (row?.state === "生成失败" && isAmbiguousImageGenerationError(row.errorReason || "")) {
    return {
      ...row,
      state: IMAGE_RESULT_PENDING_STATE,
      errorReason: toPendingImageGenerationReason(row.errorReason || ""),
    };
  }
  return row;
}
