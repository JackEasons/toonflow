import { Socket } from "socket.io";
import { tool, zodSchema } from "ai";
import { z } from "zod";
import u from "@/utils";
import Memory from "@/utils/agent/memory";
import useTools from "@/agents/scriptAgent/tools";
import ResTool from "@/socket/resTool";
import * as fs from "fs";
import path from "path";
import { quoteModelCalls, releasePointHold, reserveModelCallPoints, resolveModelBillingKey, settlePointHold } from "@/utils/modelBilling";
import { createProgressHeartbeat, type ProgressHeartbeat } from "@/agents/progressHeartbeat";

export interface AgentContext {
  socket: Socket;
  isolationKey: string;
  text: string;
  userMessageTime?: number;
  abortSignal?: AbortSignal;
  resTool: ResTool;
  userId?: string;
  msg: ReturnType<ResTool["newMessage"]>;
  thinkConfig: {
    think: boolean;
    thinlLevel: 0 | 1 | 2 | 3;
  };
}

async function reserveAgentCall(ctx: AgentContext, modelKey: `${string}:${string}` | string, taskType: string, description: string) {
  if (!ctx.userId) return null;
  const billingModel = await resolveModelBillingKey(modelKey);
  const quote = await quoteModelCalls(ctx.userId, [
    {
      count: 1,
      model: billingModel,
      modelType: "text",
      taskType,
    },
  ]);
  if (!quote.enough) throw new Error(`积分不足，需要 ${quote.requiredPoints} 积分，当前可用 ${quote.availablePoints} 积分`);
  return reserveModelCallPoints({
    billingMeta: quote,
    description: `${description}：${quote.items[0]?.modelLabel || modelKey}`,
    idempotencyKey: `model-call:${taskType}:${ctx.isolationKey}:${u.uuid()}`,
    projectId: ctx.resTool.data.projectId,
    quote,
    relatedId: ctx.isolationKey,
    taskType,
    userId: ctx.userId,
  });
}

function buildMemPrompt(mem: Awaited<ReturnType<Memory["get"]>>): string {
  let memoryContext = "";
  if (mem.rag.length) {
    memoryContext += `[相关记忆]\n${mem.rag.map((r) => r.content).join("\n")}`;
  }
  if (mem.summaries.length) {
    if (memoryContext) memoryContext += "\n\n";
    memoryContext += `[历史摘要]\n${mem.summaries.map((s, i) => `${i + 1}. ${s.content}`).join("\n")}`;
  }
  if (mem.shortTerm.length) {
    if (memoryContext) memoryContext += "\n\n";
    memoryContext += `[近期对话]\n${mem.shortTerm.map((m) => `${m.role}: ${m.content}`).join("\n")}`;
  }
  return `## Memory\n以下是你对用户的记忆，可作为参考但不要主动提及：\n${memoryContext}`;
}

export async function runDecisionAI(ctx: AgentContext) {
  const { isolationKey, text, userMessageTime, abortSignal, resTool } = ctx;
  const memory = new Memory("scriptAgent", isolationKey, ctx.userId);
  const billingHold = await reserveAgentCall(ctx, "scriptAgent:decisionAgent", "script_agent_call", "剧本Agent统筹");
  let settled = false;
  let heartbeat: ProgressHeartbeat | null = null;

  try {
    await memory.addBestEffort("user", text, { createTime: userMessageTime });

    const skill = path.join(u.getPath("skills"), "script_agent_decision.md");
    const prompt = await fs.promises.readFile(skill, "utf-8");

    const mem = buildMemPrompt(await memory.getBestEffort(text));

    const projectData = await u.db("o_project").where("id", resTool.data.projectId).first();

    const novelData = await u.db("o_novel").where("projectId", resTool.data.projectId).select("chapterIndex");

    const projectInfo = [
      "## 项目信息",
      `小说名称：${projectData?.name ?? "未知"}`,
      `小说类型：${projectData?.type ?? "未知"}`,
      `小说简介：${projectData?.intro ?? "无"}`,
      `目标改编影视视觉手册|画风：${projectData?.artStyle ?? "无"}`,
      `目标改编视频画幅：${projectData?.videoRatio ?? "16:9"}`,
      `章节数量：${novelData.length}章`,
    ].join("\n");

    let currentMsg = ctx.msg;
    heartbeat = createProgressHeartbeat(currentMsg, {
      title: "正在统筹剧本任务",
      updates: ["正在准备上下文和项目配置。", "仍在等待模型或工具返回，任务没有中断。", "长文本任务可能需要更久，请稍候。"],
    });
    const { fullStream } = await u.Ai.Text("scriptAgent:decisionAgent", ctx.thinkConfig.think, ctx.thinkConfig.thinlLevel).stream({
      messages: [
        { role: "system", content: prompt },
        { role: "assistant", content: projectInfo + "\n" + mem },
        { role: "user", content: text },
      ],
      abortSignal,
      tools: {
        ...memory.getTools(),
        ...useTools({ resTool: ctx.resTool, msg: ctx.msg }),
        ...createSubAgent(ctx),
      },
      onFinish: async (completion) => {
        try {
          await memory.addBestEffort("assistant:decision", removeAllXmlTags(completion.text));
        } finally {
          await settlePointHold(billingHold?.id);
          settled = true;
        }
      },
    });
    await consumeFullStream(fullStream, currentMsg, () => {
      if (ctx.msg === currentMsg) return currentMsg;
      currentMsg.complete();
      currentMsg = ctx.msg;
      heartbeat?.setMessage(currentMsg);
      return currentMsg;
    }, heartbeat);
    heartbeat.stop();
    if (!settled) await settlePointHold(billingHold?.id);
  } catch (error) {
    heartbeat?.fail();
    if (!settled) await releasePointHold(billingHold?.id);
    throw error;
  }
}

function createSubAgent(parentCtx: AgentContext) {
  const { resTool, abortSignal } = parentCtx;
  const memory = new Memory("scriptAgent", parentCtx.isolationKey, parentCtx.userId);

  async function runAgent({
    key,
    prompt,
    system,
    name,
    memoryKey,
    tools: extraTools,
    messages,
  }: {
    key: `${string}:${string}`;
    prompt: string;
    system: string;
    name: string;
    memoryKey: string;
    tools?: Record<string, any>;
    messages?: { role: "user" | "assistant" | "system"; content: string }[];
  }) {
    parentCtx.msg.complete();
    const subMsg = resTool.newMessage("assistant", name);
    const billingHold = await reserveAgentCall(parentCtx, key, "script_agent_call", `剧本Agent-${name}`);
    let settled = false;
    const heartbeat = createProgressHeartbeat(subMsg, {
      title: `${name}正在执行任务`,
      updates: ["正在读取所需上下文。", "正在等待模型返回执行结果。", "长文本生成仍在进行，请稍候。"],
    });

    try {
      const { fullStream } = await u.Ai.Text(key, parentCtx.thinkConfig.think, parentCtx.thinkConfig.thinlLevel).stream({
        system,
        messages: messages ?? [{ role: "user", content: prompt }],
        abortSignal,
        tools: { ...extraTools, ...useTools({ resTool, msg: subMsg }) },
      });
      const fullResponse = await consumeFullStream(fullStream, subMsg, undefined, heartbeat);
      heartbeat.stop();
      await settlePointHold(billingHold?.id);
      settled = true;

      if (fullResponse.trim()) {
        await memory.addBestEffort(memoryKey, removeAllXmlTags(fullResponse), {
          name,
          createTime: new Date(subMsg.datetime).getTime(),
        });
      }

      parentCtx.msg = resTool.newMessage("assistant", "视频策划");
      return fullResponse;
    } catch (error) {
      heartbeat.fail();
      if (!settled) await releasePointHold(billingHold?.id);
      throw error;
    }
  }

  const promptInput = z.object({
    prompt: z.string().describe("交给子Agent的任务简约描述，100字以内"),
  });

  const run_sub_agent_storySkeleton = tool({
    description: "运行执行subAgent来完成故事骨架相关任务",
    inputSchema: zodSchema<{ prompt: string }>(promptInput),
    execute: async ({ prompt }) => {
      const skill = path.join(u.getPath("skills"), "script_execution_skeleton.md");
      const systemPrompt = await fs.promises.readFile(skill, "utf-8");

      const formatPrompt = "\n你必须使用如下XML格式写入工作区：\n<storySkeleton>故事骨架内容</storySkeleton>";

      return runAgent({
        key: "scriptAgent:storySkeletonAgent",
        prompt,
        system: systemPrompt + formatPrompt,
        name: "编剧",
        memoryKey: "assistant:execution:storySkeleton",
        messages: [{ role: "user", content: prompt + formatPrompt }],
      });
    },
  });

  const run_sub_agent_adaptationStrategy = tool({
    description: "运行执行subAgent来完成改编策略相关任务",
    inputSchema: zodSchema<{ prompt: string }>(promptInput),
    execute: async ({ prompt }) => {
      const skill = path.join(u.getPath("skills"), "script_execution_adaptation.md");
      const systemPrompt = await fs.promises.readFile(skill, "utf-8");

      const formatPrompt = "\n你必须使用如下XML格式写入工作区：\n<adaptationStrategy>改编策略内容</adaptationStrategy>";

      return runAgent({
        key: "scriptAgent:adaptationStrategyAgent",
        prompt,
        system: systemPrompt + formatPrompt,
        name: "编剧",
        memoryKey: "assistant:execution:adaptationStrategy",
        messages: [{ role: "user", content: prompt + formatPrompt }],
      });
    },
  });

  const run_sub_agent_script = tool({
    description: "运行执行subAgent来完成剧本相关任务",
    inputSchema: zodSchema<{ prompt: string }>(promptInput),
    execute: async ({ prompt }) => {
      const skill = path.join(u.getPath("skills"), "script_execution_script.md");
      const systemPrompt = await fs.promises.readFile(skill, "utf-8");

      const scriptList = await u.db("o_script").where("projectId", resTool.data.projectId).select("id", "name");
      const scriptPrompt = ["## 可用剧本(ID:名称)", scriptList.map((s: any) => `${s.id}:${(s.name || "").replace(/[,:]/g, "")}`).join(","), ""].join(
        "\n",
      );

      const novelData = await u.db("o_novel").where("projectId", resTool.data.projectId).select("chapterIndex");

      const formatPrompt = `\n你必须使用如下XML格式写入工作区：\nXML不得添加任何额外标签<scriptItem name="剧本名称">剧本内容</scriptItem><scriptItem name="剧本名称">剧本内容</scriptItem><scriptItem name="剧本名称">剧本内容</scriptItem>`;

      return runAgent({
        key: "scriptAgent:scriptAgent",
        prompt,
        system: systemPrompt + formatPrompt,
        messages: [
          { role: "assistant", content: scriptPrompt + `章节数量：${novelData.length}章` },
          { role: "user", content: prompt + formatPrompt },
        ],
        name: "编剧",
        memoryKey: "assistant:execution:script",
      });
    },
  });

  const run_supervision_agent = tool({
    description: "运行监督层subAgent执行独立任务，完成后返回结果",
    inputSchema: zodSchema<{ prompt: string }>(promptInput),
    execute: async ({ prompt }) => {
      const skill = path.join(u.getPath("skills"), "script_agent_supervision.md");
      const systemPrompt = await fs.promises.readFile(skill, "utf-8");

      return runAgent({
        key: "scriptAgent:supervisionAgent",
        prompt,
        system: systemPrompt,
        name: "编辑",
        memoryKey: "assistant:supervision",
      });
    },
  });

  return {
    run_sub_agent_storySkeleton,
    run_sub_agent_adaptationStrategy,
    run_sub_agent_script,
    run_supervision_agent,
  };
}

async function consumeFullStream(
  fullStream: AsyncIterable<any>,
  initialMsg: ReturnType<ResTool["newMessage"]>,
  syncMsg?: () => ReturnType<ResTool["newMessage"]>,
  heartbeat?: ProgressHeartbeat,
): Promise<string> {
  let msg = initialMsg;
  let text = msg.text();
  let thinking: ReturnType<typeof msg.thinking> | null = null;
  let thinkTime = 0;
  let fullResponse = "";

  try {
    for await (const chunk of fullStream) {
      heartbeat?.activity();
      await new Promise<void>((resolve) => setTimeout(() => resolve(), 1));
      if (syncMsg) {
        const newMsg = syncMsg();
        if (newMsg !== msg) {
          msg = newMsg;
          text = msg.text();
        }
      }
      if (chunk.type === "reasoning-start") {
        thinkTime = Date.now();
        thinking = msg.thinking("思考中...");
      } else if (chunk.type === "reasoning-delta") {
        thinking?.append(chunk.text);
      } else if (chunk.type === "reasoning-end") {
        thinkTime = Date.now() - thinkTime;
        thinking?.updateTitle(`思考完毕（${(thinkTime / 1000).toFixed(1)} 秒）`);
        thinking?.complete();
        thinking = null;
      } else if (chunk.type === "text-delta") {
        text.append(chunk.text);
        fullResponse += chunk.text;
      } else if (chunk.type === "error") {
        throw chunk.error;
      }
    }
    text.complete();
    msg.complete();
    heartbeat?.stop();
  } catch (err: any) {
    heartbeat?.fail();
    thinking?.complete();
    const errMsg = err?.message ?? String(err);
    text.append(errMsg);
    text.error();
    msg.error();
    throw err;
  }

  return fullResponse;
}

function removeAllXmlTags(text: string): string {
  text = text.replace(/<([a-zA-Z][\w-]*)(\s+[^>]*)?>([\s\S]*?)<\/\1>/g, "");
  text = text.replace(/<([a-zA-Z][\w-]*)(\s+[^>]*)?\/>/g, "");
  text = text.replace(/<\/?[a-zA-Z][\w-]*(\s+[^>]*)?>/g, "");
  return text.trim();
}
