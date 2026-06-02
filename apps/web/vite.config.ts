import { createRequire } from "node:module";
import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "@super/vite-config";

const require = createRequire(import.meta.url);
const postcsspxtoviewport = require("postcss-px-to-viewport") as (options: Record<string, unknown>) => any;

function getPackageName(id: string) {
  const parts = id.split("/node_modules/");
  if (parts.length < 2) return "";
  const packagePath = parts.at(-1) ?? "";
  const segments = packagePath.split("/");
  return packagePath.startsWith("@") ? `${segments[0]}/${segments[1]}` : segments[0];
}

function manualChunks(id: string) {
  const packageName = getPackageName(id);
  if (!packageName) return undefined;
  if (packageName === "@icon-park/vue-next" || packageName === "@devui-design/icons") return "vendor-icons";
  if (packageName.startsWith("@tdesign-vue-next") || packageName === "tdesign-vue-next") return "vendor-ui";
  if (packageName === "vue" || packageName.startsWith("@vue/") || ["pinia", "vue-router", "vue-i18n"].includes(packageName)) return "vendor-vue";
  if (packageName.startsWith("@vueuse/") || ["lodash", "dayjs", "axios", "es-toolkit"].includes(packageName)) return "vendor-utils";
  return undefined;
}

export default defineConfig(async () => {
  return {
    application: {
      extraAppConfig: false,
      injectGlobalScss: false,
      license: false,
    },
    vite: {
      build: {
        assetsInlineLimit: 4096,
        cssCodeSplit: true,
        rolldownOptions: {
          output: {
            manualChunks,
          },
        },
      },
      css: {
        preprocessorOptions: {
          scss: {},
        },
        postcss: {
          plugins: [
            postcsspxtoviewport({
              // 要转化的单位
              unitToConvert: "px",
              // UI设计稿的大小
              viewportWidth: 1600,
              // 转换后的精度
              unitPrecision: 4,
              // 转换后的单位
              viewportUnit: "rem",
              // 字体转换后的单位
              fontViewportUnit: "rem",
              // 能转换的属性，*表示所有属性，!border表示border不转
              propList: ["*"],
              // 指定不转换为视窗单位的类名
              selectorBlackList: ["ignore"],
              // 最小转换的值，小于等于1不转
              minPixelValue: 1,
              // 是否在媒体查询的css代码中也进行转换，默认false
              mediaQuery: true,
              // 是否转换后直接更换属性值
              replace: true,
              // 忽略某些文件夹下的文件或特定文件，例如 'node_modules' 下的文件
              exclude: [],
              // 包含那些文件或者特定文件
              include: [],
              // 是否处理横屏情况
              landscape: false,
            }),
          ],
        },
      },
      resolve: {
        alias: {
          "@": fileURLToPath(new URL("./src", import.meta.url)),
          "#": fileURLToPath(new URL("./src", import.meta.url)),
        },
      },
    },
  };
});
