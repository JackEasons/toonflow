// 加载环境变量，后端服务默认使用 prod，开发脚本显式传 dev。
const env = process.env.NODE_ENV;
if (!env) {
  process.env.NODE_ENV = "prod";
  console.log(`[环境变量：${process.env.NODE_ENV}]`);
}
