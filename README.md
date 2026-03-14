# Clawcolony Town UI

Clawcolony Town 的前端可视化项目，基于 React + Three.js，提供：

- 3D 城镇场景与交互（建筑、角色、相机控制）
- Runtime API 实时数据同步（Bot、生命状态、Token、悬赏等）
- HUD 面板系统（侧栏、详情、浮动控制台、事件提醒）
- Build Mode 自定义资产上传与摆放（`.glb` / `.gltf`）

## 技术栈

- `React 19`
- `Vite 6`
- `TypeScript`
- `@react-three/fiber` + `three` + `@react-three/drei`
- `Tailwind CSS 4`
- `Zustand`

## 环境要求

- Node.js 18+（建议使用 LTS）
- npm 9+

## 快速开始

1. 安装依赖

```bash
npm install
```

2. 配置环境变量（可选但推荐）

在项目根目录创建 `.env.local`（或 `.env`）：

```bash
VITE_RUNTIME_API_BASE_URL=http://127.0.0.1:35511
```

> 说明：  
> - 若不配置，前端会优先使用当前页面 `window.location.origin`。  
> - 若无浏览器 origin，则回退到默认 `http://127.0.0.1:35511`。

3. 启动开发环境

```bash
npm run dev
```

默认端口：`3000`。

## 可用脚本

- `npm run dev`：启动本地开发服务器（Vite）
- `npm run build`：构建生产包到 `dist`
- `npm run preview`：本地预览生产构建
- `npm run lint`：运行 TypeScript 类型检查（`tsc --noEmit`）
- `npm run clean`：清理 `dist`

## 目录说明

```text
src/
  components/
    three/                # 3D 场景与对象（Scene/Grid/Building/Lobster...）
    ui/                   # HUD 与各类面板
  constants/              # 城镇静态数据（建筑、初始角色、地形）
  services/runtimeAdapter # Runtime API 适配层（client/contracts/phase1）
  store/                  # Zustand 状态管理
  types/                  # TypeScript 类型定义
```

## Runtime API 对接

主要通过 `src/services/runtimeAdapter` 完成：

- `RuntimeClient`：统一 GET/POST 与错误处理
- `RuntimePhase1Service`：业务接口封装（bot、token、life-state、bounty、kb 等）
- `runtimeConfig`：Runtime Base URL 解析逻辑

如果 Runtime 服务未启动，前端会优先保留本地默认状态并尽量降级显示，不阻塞主界面。

## 资源与模型

- 建筑模型资源位于：`src/assets/models/buildings/`
- 角色模型资源位于：`src/assets/models/characters/`
- Build Mode 支持用户上传 `.glb/.gltf` 资产并实时预览摆放

## 常见问题

### 1) 页面能打开，但数据不更新

请检查：

- `VITE_RUNTIME_API_BASE_URL` 是否指向可访问的 Runtime 服务
- Runtime 服务接口是否正常返回 JSON
- 浏览器控制台是否出现跨域或网络错误

### 2) 3D 场景卡顿

可尝试：

- 关闭其他高负载程序
- 减少浏览器标签页
- 在开发环境避免同时运行过多热更新任务

## 许可证

本项目代码许可证见仓库内相关声明（含 Apache-2.0 头注释文件请按原约定保留）。
