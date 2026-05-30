import express from "express";
import { success } from "@/lib/responseFormat";

const router = express.Router();

const adminMenus = [
  {
    component: "BasicLayout",
    meta: {
      icon: "lucide:layout-dashboard",
      order: -1,
      title: "仪表盘",
    },
    name: "Dashboard",
    path: "/dashboard",
    redirect: "/analytics",
    children: [
      {
        component: "/dashboard/analytics/index.vue",
        meta: {
          affixTab: true,
          icon: "lucide:area-chart",
          title: "分析页",
        },
        name: "Analytics",
        path: "/analytics",
      },
      {
        component: "/dashboard/workspace/index.vue",
        meta: {
          icon: "carbon:workspace",
          title: "工作台",
        },
        name: "Workspace",
        path: "/workspace",
      },
    ],
  },
];

export default router.get("/", async (_req, res) => {
  res.status(200).send(success(adminMenus));
});
