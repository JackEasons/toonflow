import dotenv from "dotenv";
import fs from "fs";
import path from "path";

function resolveConfiguredEnvPath(value: string | undefined): string | null {
  if (!value) return null;
  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
}

function resolveEnvPath(): string | null {
  const candidates = [
    resolveConfiguredEnvPath(process.env.TOONFLOW_ENV_FILE),
    resolveConfiguredEnvPath(process.env.ENV_FILE),
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "server", ".env"),
    path.resolve(__dirname, "../.env"),
    path.resolve(__dirname, "../../.env"),
  ].filter((value): value is string => Boolean(value));

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

const envPath = resolveEnvPath();
if (envPath) {
  dotenv.config({ path: envPath, quiet: true });
  console.log(`[环境配置文件：${envPath}]`);
}

// 加载环境变量，后端服务默认使用 prod，开发脚本显式传 dev。
const env = process.env.NODE_ENV;
if (!env) {
  process.env.NODE_ENV = "prod";
  console.log(`[环境变量：${process.env.NODE_ENV}]`);
}
