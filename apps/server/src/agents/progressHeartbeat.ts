import type { MessageBuilder } from "@/socket/resTool";

interface ProgressHeartbeatOptions {
  initialDelayMs?: number;
  intervalMs?: number;
  title: string;
  updates?: string[];
}

const DEFAULT_UPDATES = [
  "仍在等待模型响应，任务没有中断。",
  "正在处理长上下文或等待子任务返回。",
  "如果当前请求不再需要，可以点击停止后重新发起。",
];

export function createProgressHeartbeat(initialMsg: MessageBuilder, options: ProgressHeartbeatOptions) {
  const initialDelayMs = options.initialDelayMs ?? 8000;
  const intervalMs = options.intervalMs ?? 15000;
  const updates = options.updates?.length ? options.updates : DEFAULT_UPDATES;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let updateIndex = 0;
  let thinking: ReturnType<MessageBuilder["thinking"]> | null = null;
  let msg = initialMsg;
  const startedAt = Date.now();

  function clearTimer() {
    if (!timer) return;
    clearTimeout(timer);
    timer = null;
  }

  function elapsedSeconds() {
    return Math.max(1, Math.round((Date.now() - startedAt) / 1000));
  }

  function schedule(delay = initialDelayMs) {
    clearTimer();
    if (stopped) return;
    timer = setTimeout(tick, delay);
    timer.unref?.();
  }

  function ensureThinking() {
    if (!thinking) {
      thinking = msg.thinking(options.title);
    }
    return thinking;
  }

  function tick() {
    if (stopped) return;
    const stream = ensureThinking();
    const update = updates[updateIndex % updates.length];
    updateIndex += 1;
    stream.updateTitle(`${options.title}（${elapsedSeconds()} 秒）`);
    stream.appendText(`${new Date().toLocaleTimeString("zh-CN", { hour12: false })} ${update}\n`);
    schedule(intervalMs);
  }

  schedule();

  return {
    activity(title = "已收到响应，继续处理") {
      if (stopped) return;
      if (thinking) {
        thinking.updateTitle(`${title}（${elapsedSeconds()} 秒）`);
        thinking.complete();
        thinking = null;
      }
      schedule();
    },
    setMessage(nextMsg: MessageBuilder, title = "已切换到新的执行消息") {
      if (stopped) return;
      if (thinking) {
        thinking.updateTitle(`${title}（${elapsedSeconds()} 秒）`);
        thinking.complete();
        thinking = null;
      }
      msg = nextMsg;
      schedule();
    },
    fail() {
      stopped = true;
      clearTimer();
      thinking?.error();
      thinking = null;
    },
    stop(title = "处理完成") {
      stopped = true;
      clearTimer();
      if (thinking) {
        thinking.updateTitle(`${title}（${elapsedSeconds()} 秒）`);
        thinking.complete();
        thinking = null;
      }
    },
  };
}

export type ProgressHeartbeat = ReturnType<typeof createProgressHeartbeat>;
