import { afterEach, describe, expect, it, vi } from "vitest";

import { createProgressHeartbeat } from "../progressHeartbeat";

function createMessageMock() {
  let thinking: any;
  thinking = {
    appendText: vi.fn(() => thinking),
    complete: vi.fn(() => thinking),
    error: vi.fn(() => thinking),
    updateTitle: vi.fn(() => thinking),
  };

  const msg = {
    thinking: vi.fn(() => thinking),
  } as unknown as Parameters<typeof createProgressHeartbeat>[0];

  return { msg, thinking };
}

describe("createProgressHeartbeat", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows progress only after the initial silence window", () => {
    vi.useFakeTimers();
    const { msg, thinking } = createMessageMock();

    const heartbeat = createProgressHeartbeat(msg, {
      initialDelayMs: 1000,
      intervalMs: 2000,
      title: "正在处理",
      updates: ["任务仍在进行。"],
    });

    expect(msg.thinking).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);

    expect(msg.thinking).toHaveBeenCalledWith("正在处理");
    expect(thinking.updateTitle).toHaveBeenCalledWith(expect.stringContaining("正在处理"));
    expect(thinking.appendText).toHaveBeenCalledWith(expect.stringContaining("任务仍在进行。"));

    heartbeat.stop();
  });

  it("resets the silence timer when activity arrives", () => {
    vi.useFakeTimers();
    const { msg } = createMessageMock();

    const heartbeat = createProgressHeartbeat(msg, {
      initialDelayMs: 1000,
      intervalMs: 2000,
      title: "正在处理",
    });

    vi.advanceTimersByTime(800);
    heartbeat.activity();
    vi.advanceTimersByTime(800);

    expect(msg.thinking).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);

    expect(msg.thinking).toHaveBeenCalledTimes(1);

    heartbeat.stop();
  });

  it("stops scheduled updates and marks an active heartbeat as failed", () => {
    vi.useFakeTimers();
    const { msg, thinking } = createMessageMock();

    const heartbeat = createProgressHeartbeat(msg, {
      initialDelayMs: 1000,
      intervalMs: 2000,
      title: "正在处理",
    });

    vi.advanceTimersByTime(1000);
    heartbeat.fail();
    vi.advanceTimersByTime(5000);

    expect(thinking.error).toHaveBeenCalledTimes(1);
    expect(msg.thinking).toHaveBeenCalledTimes(1);
  });

  it("sends later heartbeat updates to the current message after a message switch", () => {
    vi.useFakeTimers();
    const first = createMessageMock();
    const second = createMessageMock();

    const heartbeat = createProgressHeartbeat(first.msg, {
      initialDelayMs: 1000,
      intervalMs: 2000,
      title: "正在处理",
    });

    heartbeat.setMessage(second.msg);
    vi.advanceTimersByTime(1000);

    expect(first.msg.thinking).not.toHaveBeenCalled();
    expect(second.msg.thinking).toHaveBeenCalledTimes(1);

    heartbeat.stop();
  });
});
