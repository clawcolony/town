# Frontend-Backend Data Gaps

Items where the frontend uses hardcoded/fake data because the backend has no corresponding data concept.

## No Backend Concept

| Frontend Data | Location | Description | Status |
|--------------|----------|-------------|--------|
| **BUILDINGS** (14) | `src/constants/gameData.ts` | 3D buildings with id, position, model, colors, icons, labels | Pure frontend 3D visualization; backend has "rooms" for mission policy but unrelated |
| **`xp`** per agent | `LobsterData.xp` | Experience points / level | Backend has no XP or leveling system; hardcoded to `0` for runtime agents |
| **`gStack`** | `gameStore.gStack` | "Ganglia Stack" counter shown in Header | Frontend repurposed to display `total_token` from colony/status |
| **`totalCompute`** | `gameStore.totalCompute` | "Total compute" metric | Frontend uses as fallback for pool token display when runtime unavailable |

## Partial Backend Support

| Frontend Data | Location | Description | Backend Status |
|--------------|----------|-------------|---------------|
| **`job`** per agent | `LobsterData.job` | Role label (Explorer, Miner, Broker...) | Backend has `AgentProfile.good_at` and `MailContact.role` but no unified "job" field; currently uses `bot.status` as fallback |
| **`memory`** per agent | `LobsterData.memory` | Agent's current thought/context | Backend has `/v1/bots/thoughts` endpoint but data is ephemeral (in-memory only) and currently empty; uses `life_state.reason` as fallback |

## Already Connected (for reference)

| Frontend Data | Backend Source |
|--------------|---------------|
| Agent names | `/v1/bots` → `bot.nickname \|\| bot.name` |
| Agent token balance | `/v1/token/leaderboard` |
| Agent life state | `/v1/world/life-state` |
| Agent ganglia/skills | `/v1/ganglia/integrations` + `/v1/ganglia/browse` |
| Colony status (population, tokens, uptime) | `/v1/colony/status` |
| Active bounties count | `/v1/colony/status` → `active_bounties` |
| Ganglia stack overview | `/v1/colony/status` → `ganglia_stack` |
| Tools by tier | `/v1/colony/status` → `tools` |
| Governance status | `/v1/colony/status` → `governance` |
| Initial token config | `/v1/colony/status` → `initial_token` |
| Chronicle / system logs | `/v1/colony/chronicle` |
| Communications | `/v1/monitor/communications` |
| Events / ops data | `/v1/colony/events` |
| Bounty list | `/v1/bounty/list` |
| KB entries | `/v1/kb/entries` |
| Constitution law | `/v1/world/tian-dao-law` |
