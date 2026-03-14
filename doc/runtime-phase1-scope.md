# Runtime 对接 P1 范围定义

## 1. 范围目标
P1 只落地以下四个模块，确保从 mock 迁移到 runtime `/v1` 的最小闭环：
- Agent 详情
- 编年史
- 悬赏闭环
- Token 持有

## 2. 模块与接口清单

## 2.1 Agent 详情（Adapter 聚合）
- `GET /v1/bots`
- `GET /v1/token/balance?user_id=...`
- `GET /v1/world/life-state?user_id=...`
- `GET /v1/monitor/agents/overview?user_id=...`

前端输出模型：
- `agentId`
- `name`
- `tokenBalance`
- `lifeState`
- `runtimeStatus`
- `runtimeReason`

验收标准：
- 单用户详情可加载，且在任一接口失败时可回退并显示错误来源。

## 2.2 编年史（Adapter 多源聚合）
- `GET /v1/world/tick/history`
- `GET /v1/world/cost-events`
- `GET /v1/world/evolution-alerts`
- 可选增强：
  - `GET /v1/collab/events`
  - `GET /v1/kb/proposals/thread`

前端输出模型：
- `id`
- `category`
- `title`
- `detail`
- `ts`
- `rawTime`

验收标准：
- 多源事件可按时间倒序统一展示。

## 2.3 悬赏闭环（Direct）
- `POST /v1/bounty/post`
- `GET /v1/bounty/list`
- `POST /v1/bounty/claim`
- `POST /v1/bounty/verify`（映射 PRD 的 review）

验收标准：
- 发布 -> 认领 -> 验收（通过/拒绝）路径可走通。

## 2.4 Token 持有（Direct）
- `GET /v1/token/balance?user_id=...`

验收标准：
- 用户余额可准确展示，接口错误可直接透传。

## 3. 适配约束
- 时间统一：RFC3339 -> epoch（保留 raw 字符串）。
- 错误统一：`{"error":"..."}` -> `AppError { code, message, source }`。
- 枚举统一：`life_state`、`bounty.status`、`chat_task.status`。

## 4. P1 不做（明确排除）
- 建筑 workers 后端真实对接。
- Build commit 后端持久化。
- 公共频道级群聊模型。
- Token 排行榜高性能统计接口。

