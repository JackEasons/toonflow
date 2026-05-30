// import "./logger";
import "./err";
import "./env";
import express, { Request, Response, NextFunction } from "express";
import { Server } from "socket.io";
import http from "node:http";
import expressWs from "express-ws";
import logger from "morgan";
import cors from "cors";
import buildRoute from "@/core";
import fs from "fs";
import path from "node:path";
import u from "@/utils";
import jwt from "jsonwebtoken";
import socketInit from "@/socket/index";
import { dbReady } from "@/utils/db";
import { isAdminRequest } from "@/utils/admin";

const app = express();
const server = http.createServer(app);

function resolvePort(randomPort: boolean): number {
  if (randomPort) return 0;
  const port = Number.parseInt(process.env.PORT ?? "", 10);
  return Number.isFinite(port) && port > 0 ? port : 10588;
}

export default async function startServe(randomPort: boolean = false) {
  await dbReady;
  await u.oss.reloadConfig();
  await u.writeVersion();
  const io = new Server(server, { cors: { origin: "*" } });
  socketInit(io);

  if (process.env.NODE_ENV == "dev") await buildRoute();

  expressWs(app);

  app.use(logger("dev"));
  app.use(cors({ origin: "*" }));
  app.use(
    express.json({
      limit: "100mb",
      verify: (req, _res, buf) => {
        (req as any).rawBody = buf.toString("utf8");
      },
    }),
  );
  app.use(express.urlencoded({ extended: true, limit: "100mb" }));

  // oss 静态资源
  const ossDir = u.getPath("oss");
  if (!fs.existsSync(ossDir)) {
    fs.mkdirSync(ossDir, { recursive: true });
  }
  console.log("OSS 存储:", u.oss.getStorageDescription());
  app.use("/oss", async (req, res, next) => {
    const filePath = req.path.replace(/^\/+/, "");
    try {
      const provider = u.oss.getStorageProviderFromUrl(req.originalUrl);
      const buffer = await u.oss.getFile(filePath, provider);
      res.setHeader("Accept-Ranges", "none");
      res.type(path.extname(filePath) || "application/octet-stream");
      res.send(buffer);
    } catch (error) {
      const err = error as NodeJS.ErrnoException & { status?: number };
      if (err.status === 404 || err.code === "ENOENT") {
        res.status(404).end();
        return;
      }
      next(error);
    }
  });
  // skills 静态资源
  const skillsDir = u.getPath("skills");
  if (!fs.existsSync(skillsDir)) {
    fs.mkdirSync(skillsDir, { recursive: true });
  }
  console.log("文件目录:", skillsDir);
  // 只允许图片文件访问
  app.use(
    "/skills",
    (req, res, next) => {
      /\.(jpe?g|png|gif|webp|svg|ico|bmp)$/i.test(req.path) ? next() : res.status(403).end();
    },
    express.static(skillsDir, { acceptRanges: false }),
  );

  // assets 静态资源
  const assetsDir = u.getPath("assets");
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }
  console.log("文件目录:", assetsDir);
  app.use("/assets", express.static(assetsDir, { acceptRanges: false }));

  // data/web 静态网站
  const webDir = u.getPath("web");
  if (fs.existsSync(webDir)) {
    console.log("静态网站目录:", webDir);
    app.use(express.static(webDir, { acceptRanges: false }));
  } else {
    console.warn("静态网站目录不存在:", webDir);
  }

  app.use(async (req, res, next) => {
    const setting = await u.db("o_setting").where("key", "tokenKey").select("value").first();
    if (!setting) return res.status(444).send({ message: "服务器秘钥未配置，请联系管理员" });
    const { value: tokenKey } = setting;
    // 从 header 或 query 参数获取 token
    const rawToken = req.headers.authorization || (req.query.token as string) || "";
    const token = rawToken.replace("Bearer ", "");
    // 白名单路径
    if (
      [
        "/api/auth/login",
        "/api/login/login",
        "/api/login/register",
        "/api/payment/alipay/notify",
        "/api/payment/alipay/return",
        "/api/payment/wechat/notify",
      ].includes(req.path)
    )
      return next();

    if (!token) return res.status(401).send({ message: "未提供token" });
    try {
      const decoded = jwt.verify(token, tokenKey as string);
      (req as any).user = decoded;
      next();
    } catch (err) {
      return res.status(401).send({ message: "无效的token" });
    }
  });

  const adminOnlyPrefixes = [
    "/api/admin",
    "/api/setting/vendorConfig",
    "/api/setting/modelMap",
    "/api/setting/agentDeploy",
    "/api/setting/promptManage",
    "/api/setting/skillManagement",
    "/api/setting/memoryConfig",
    "/api/setting/loginConfig",
    "/api/setting/paymentConfig",
    "/api/setting/ossConfig",
    "/api/setting/dbConfig",
    "/api/setting/fileManagement",
  ];
  app.use((req, res, next) => {
    if (adminOnlyPrefixes.some((prefix) => req.path.startsWith(prefix)) && !isAdminRequest(req)) {
      return res.status(403).send({ message: "仅管理员可访问" });
    }
    next();
  });

  const router = await import("@/router");
  await router.default(app);

  // 404 处理
  app.use((_, res, next: NextFunction) => {
    return res.status(404).send({ message: "API 404 Not Found" });
  });

  // 错误处理
  app.use((err: any, _: Request, res: Response, __: NextFunction) => {
    res.locals.message = err.message;
    res.locals.error = err;
    console.error(err);
    res.status(err.status || 500).send(err);
  });

  const port = resolvePort(randomPort);
  return await new Promise((resolve) => {
    server.listen(port, async () => {
      const address = server.address();
      const realPort = typeof address === "string" ? address : address?.port;
      if (realPort) process.env.PORT = String(realPort);
      console.log(`[服务启动成功]: http://localhost:${realPort}`);
      resolve(realPort);
    });
  });
}

// 支持await关闭
export function closeServe(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (server) {
      server.close((err?: Error) => {
        if (err) return reject(err);
        console.log("[服务已关闭]");
        resolve();
      });
    } else {
      resolve();
    }
  });
}

if (require.main === module) {
  void startServe();
}
