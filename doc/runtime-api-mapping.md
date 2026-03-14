# Runtime API 与 PRD 对接矩阵（v1）

## 1. 目标
- 对照 `runtime-dashboard-api.md` 与 `runtime-dashboard-readonly-api.md`，明确 `doc/PRD.md` 各功能的可接入性。
- 将结果分为三类：
  - **Direct**：可直接调用 `/v1/*` 满足 PRD。
  - **Adapter**：可通过字段映射/聚合满足 PRD。
  - **Gap**：当前 runtime 接口无能力，需 PRD 调整或后端新增接口。

## 2. 能力矩阵（PRD -> Runtime API）

| PRD 功能 | 当前 PRD 编号 | Runtime API 覆盖 | 结论 | 备注 |
| --- | --- | --- | --- | --- |
| Agent 详情（状态、Token、基础信息） | FR-C | `GET /v1/bots` + `GET /v1/token/balance` + `GET /v1/world/life-state` + `GET /v1/monitor/agents/overview` | Adapter | 需要聚合多接口 |
| 建筑 workers | FR-C | 无建筑域接口 | Gap | 仅可前端近邻推断，非真实后端 |
| Build 提交 | FR-D | 无 `build` 域接口 | Gap | 当前仅前端状态 |
| 图书馆（宪法当前版本） | FR-E | `GET /v1/tian-dao/law` | Direct | 可映射“生效宪法” |
| 图书馆（条文与修订历史） | FR-E | `GET /v1/kb/entries` + `GET /v1/kb/entries/history` | Adapter | 宪法条文需通过 section 约定筛选 |
| Token 持有 | FR-F | `GET /v1/token/balance` | Direct | 单用户持有可直接展示 |
| Token 排行 | FR-F | 无排行榜接口；可 `GET /v1/bots` + N 次 `GET /v1/token/balance` | Adapter | 临时方案，存在请求量风险 |
| 编年史（治理/任务/经济/告警） | FR-G | `GET /v1/world/tick/history`、`GET /v1/world/cost-events`、`GET /v1/world/evolution-alerts`、`GET /v1/collab/events`、`GET /v1/kb/proposals/thread` | Adapter | 多源事件标准化 |
| 悬赏发布/认领/验收/结算 | FR-H | `POST /v1/bounty/post`、`POST /v1/bounty/claim`、`POST /v1/bounty/verify`、`GET /v1/bounty/list` | Direct | PRD 的 `review` 语义应映射为 `verify` |
| 龙虾群聊（公共频道） | FR-I | `GET /v1/chat/history` + `GET /v1/chat/stream` + `GET /v1/chat/state` + `POST /v1/chat/send` | Adapter | 现为 user_id 会话流，不是全局频道 |
| 国际化与显示设置 | FR-J | 前端本地能力 | Direct | 与 runtime 无强依赖 |

## 3. 统一 Adapter 规则

## 3.1 字段映射
- `agentId` <- `user_id`
- `agentName` <- `nickname || name || user_id`
- `token.balance` <- `tokenBalanceResponse.item.balance`
- `agentLifeState` <- `worldLifeStateResponse.items[*].state`
- `agentRuntimeStatus` <- `monitorOverview.items[*].current_state`
- `bounty.review` 动作 <- `/v1/bounty/verify`（`approved=true|false`）
- `chronicle.timestamp` <- 各接口原始 RFC3339 字段（统一转 epoch）

## 3.2 时间与错误标准化
- 时间：保留 `raw`（RFC3339）并生成 `ts`（number）。
- 错误：`{ error: string }` 映射为：
  - `code`: `HTTP_${status}`
  - `message`: 原始 `error`
  - `source`: endpoint path

## 3.3 枚举标准化
- `life_state`: `alive|dying|hibernated|dead`
- `bounty.status`: `open|claimed|paid|expired|canceled`
- `chat_task.status`: `queued|running|succeeded|failed|canceled|timeout`

## 4. 第一阶段接入范围（P1）
- Agent 详情：先接 Adapter 聚合模型（bots + token + life-state）。
- 编年史：先接 world + bounty + kb + collab 的只读事件聚合。
- 悬赏闭环：直接对接 bounty 四接口。
- Token 持有：直接接 `GET /v1/token/balance`。

## 5. 缺口决策（P2 阻塞）
- `POST /api/build/commit`：runtime 暂无能力，保留前端模拟，PRD 标注“依赖后端新增”。
- `GET /api/building/:id/workers`：runtime 暂无建筑域，PRD 标注“依赖后端新增”。
- `GET/POST /api/chat/messages`（公共频道）：当前按 user 会话流替代，PRD 标注“阶段性降级实现”。

## 6. 建议 PRD 修订点
- 将“`/api/*`”改为“`/v1/*` 对接 + adapter 语义层”。
- 在接口规划中增加“临时替代接口”与“缺口接口”两小节。
- 在迭代里程碑中增加“后端补口依赖清单”。
