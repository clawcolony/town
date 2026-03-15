# 🦞 ClawColony Town - 建造模式自定义资产导入 (PRD & Plan)

## 1. 背景与目标 (Background & Goals)

当前游戏中的“建造模式”主要用于地形高度堆叠。为了提升 UGC 体验与可玩性，将引入外部 3D 资产导入功能。玩家可以主动上传 `.glb` 格式模型，自定义占地尺寸，并通过拖拽或点击部署到基地中。

## 2. 产品需求说明 (PRD)

### 2.1 UI 交互与入口

- **显示条件**：仅当玩家点击“建造模式 (Build Mode)”后，UI 才会显示入口。
- **入口位置**：固定在画面左下角，三维视角控制器（Gizmo Viewcube）的正上方。
- **入口样式**：风格契合现有赛博朋克深色 UI，提供“装载资产 (Load Asset)”按钮。

### 2.2 资产读取与配置

- 点击“装载资产”后，调起本地文件选择器，仅过滤 `.glb` 或 `.gltf` 扩展名。
- 上传成功后进入“待放置 (Pending)”状态。此时会在屏幕上悬浮一个“**尺寸配置器**”：
  - 默认占地尺寸为 `1 x 1`。
  - 用户可调整宽度与长度，支持诸如 `1x2`, `2x2`, `2x3` 一直到 `6x6`。
  - 用户可随时修改该模型的放置方向（旋转 90 度）。

### 2.3 场景交互与部署 (Drag & Drop)

- 在“待放置”状态下，鼠标划过 3D 场景的空地块时，地面会出现对应尺寸（例如 `3x3`）的**半透明发光网格投影 (Footprint Cursor)**，用于预览。
- 如果目标区块上有障碍物（已有建筑或超出边界），高亮为红色不可放置；合法空地则显示为绿色。
- 单击合法区域即完成模型的部署。

### 2.4 二次修改与管理

- 在建造模式下，点击已经部署的自定义资产，将弹出轻量级交互菜单。
- 菜单支持：重新调整尺寸、旋转建筑、移动建筑（重新进入 Pending 状态）以及删除该资产。

---

## 3. 开发实施计划 (Implementation Plan)

### 阶段一：状态管理与数据结构 (Zustand Store)

在 `src/store/gameStore.ts` 扩展状态：

1. 定义 `CustomAsset` 接口：包含 `id, name, url (Blob), width, length, x, y, rotation`。
2. 新增状态树：`customAssets: CustomAsset[]` 与 `pendingAsset: PendingAsset | null`。
3. 增加用于新增、修改、移除与更新 pending 状态的 actions。

### 阶段二：UI 层组件开发 (Overlay UI)

1. 在 `src/App.tsx` 左下角新增 `<AssetLoaderOverlay />`，通过 `isBuildMode` 决定其挂载。
2. 实现 `<input type="file" />` 读取本地文件转 `Blob URL` 的逻辑。
3. 在屏幕左下侧/侧边栏提供一个尺寸选择控制台，用于调整 `pendingAsset` 的 `width` 和 `length`。

### 阶段三：3D 渲染与模型加载 (React-Three-Fiber)

1. 在 `src/components/three/Scene.tsx` 渲染所有的 `customAssets`，借助 `useGLTF` hook 和 `<primitive object={...} />` 来动态加载并显示 GLB 模型。
2. 增加 `<PlacementCursor />` 组件：根据 `pendingAsset` 的尺寸，利用三维射线 (Raycaster) 捕捉鼠标焦点，实时在网格表面渲染一个 `[width, length]` 尺寸的指示框。

### 阶段四：网格吸附与冲突校验 (Validation Logic)

1. 计算落点区域的所有 `(x, y)` 坐标。
2. 校验此区域内是否已存在原生 `BUILDINGS` 或其他 `customAssets`。
3. 实现点击确认落子并写入全局 Store 的逻辑，完成部署。

### 阶段五：点击修改逻辑 (Edit Mode)

1. 给生成的自定义 `<primitive />` 绑定 `onClick` 事件。
2. 当点击已部署建筑时，唤起小弹窗，支持“删除”或“进入移动状态 (变回 pendingAsset)”。
