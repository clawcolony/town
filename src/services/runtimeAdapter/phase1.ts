import type {
  NormalizedAgentProfile,
  NormalizedChronicleItem,
  RuntimeBountyClaimPayload,
  RuntimeBountyItem,
  RuntimeBountyListResponse,
  RuntimeBountyMutationResponse,
  RuntimeBountyPostPayload,
  RuntimeBountyVerifyPayload,
  RuntimeBot,
  RuntimeBotsResponse,
  RuntimeChatHistoryResponse,
  RuntimeChatMessage,
  RuntimeColonyChronicleItem,
  RuntimeColonyChronicleResponse,
  RuntimeColonyStatus,
  RuntimeColonyStatusResponse,
  RuntimeCommsItem,
  RuntimeContributionLedgerItem,
  RuntimeCommunicationsResponse,
  RuntimeCollabEventsResponse,
  RuntimeCostEventsResponse,
  RuntimeEvolutionAlertsResponse,
  RuntimeAgentAutoModeState,
  RuntimeEventItem,
  RuntimeEventsResponse,
  RuntimeKbEntriesResponse,
  RuntimeKbEntry,
  RuntimeKbThreadResponse,
  RuntimeLifeStateResponse,
  RuntimeMonitorOverviewResponse,
  RuntimeProductOverviewItem,
  RuntimeProductOverviewResponse,
  RuntimeTickHistoryResponse,
  RuntimeTianDaoLawResponse,
  RuntimeTokenBalanceResponse,
  RuntimeTokenDonatePayload,
  RuntimeTokenDonateResponse,
  RuntimeTokenLeaderboardItem,
  RuntimeTokenLeaderboardResponse,
} from './contracts';
import { RuntimeClient } from './client';
import {
  mapAgentProfile,
  mapChronicleFromCollab,
  mapChronicleFromKb,
  mapChronicleFromWorld,
} from './mappers';

export class RuntimePhase1Service {
  constructor(private readonly client: RuntimeClient) {}

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private looksLikeOverviewItem(value: unknown): value is RuntimeProductOverviewItem {
    if (!this.isRecord(value)) return false;
    const keys = [
      'user_id',
      'nickname',
      'name',
      'agent',
      'action',
      'title',
      'message',
      'detail',
      'type',
      'category',
      'reward',
      'points',
      'total_reward',
      'total_reward_24h',
      'build_count',
      'task_count',
      'builds',
      'tasks',
      'stats',
    ];
    return keys.some((key) => key in value);
  }

  private tryExtractOverviewItems(payload: unknown): RuntimeProductOverviewItem[] {
    if (Array.isArray(payload)) {
      return payload.filter((item): item is RuntimeProductOverviewItem => this.looksLikeOverviewItem(item));
    }
    if (!this.isRecord(payload)) return [];

    const directArrayKeys = ['items', 'rows', 'agents', 'list', 'result', 'data'] as const;
    for (const key of directArrayKeys) {
      const value = payload[key];
      if (Array.isArray(value)) {
        const arr = value.filter((item): item is RuntimeProductOverviewItem => this.looksLikeOverviewItem(item));
        if (arr.length > 0) return arr;
      }
    }

    // 支持 { items: { "u1": {...}, "u2": {...} } } 这类字典结构
    for (const key of directArrayKeys) {
      const value = payload[key];
      if (this.isRecord(value)) {
        const fromMap = Object.values(value).filter((item): item is RuntimeProductOverviewItem =>
          this.looksLikeOverviewItem(item),
        );
        if (fromMap.length > 0) return fromMap;
      }
    }

    // 递归向下查找最合适的数组
    const queue: unknown[] = Object.values(payload);
    let best: RuntimeProductOverviewItem[] = [];
    let depth = 0;
    while (queue.length > 0 && depth < 80) {
      const current = queue.shift();
      depth += 1;
      if (Array.isArray(current)) {
        const arr = current.filter((item): item is RuntimeProductOverviewItem => this.looksLikeOverviewItem(item));
        if (arr.length > best.length) best = arr;
        continue;
      }
      if (this.isRecord(current)) {
        const values = Object.values(current);
        const fromMap = values.filter((item): item is RuntimeProductOverviewItem => this.looksLikeOverviewItem(item));
        if (fromMap.length > best.length) best = fromMap;
        queue.push(...values);
      }
    }

    return best;
  }

  private pickList<T>(payload: unknown, preferredKeys: string[]): T[] {
    if (Array.isArray(payload)) return payload.filter((item): item is T => this.isRecord(item));
    if (!this.isRecord(payload)) return [];

    for (const key of preferredKeys) {
      const value = payload[key];
      if (Array.isArray(value)) {
        const arr = value.filter((item): item is T => this.isRecord(item));
        if (arr.length > 0) return arr;
      }
    }

    for (const key of preferredKeys) {
      const value = payload[key];
      if (this.isRecord(value)) {
        const fromMap = Object.values(value).filter((item): item is T => this.isRecord(item));
        if (fromMap.length > 0) return fromMap;
      }
    }

    const nested = Object.values(payload);
    for (const item of nested) {
      const found = this.pickList<T>(item, preferredKeys);
      if (found.length > 0) return found;
    }
    return [];
  }

  async getAgentProfile(userId: string): Promise<NormalizedAgentProfile | null> {
    const [bots, token, lifeStates, monitor] = await Promise.all([
      this.client.get<RuntimeBotsResponse>('/v1/bots'),
      this.client.get<RuntimeTokenBalanceResponse>('/v1/token/balance', { user_id: userId }),
      this.client.get<RuntimeLifeStateResponse>('/v1/world/life-state', { user_id: userId, limit: 1 }),
      this.client.get<RuntimeMonitorOverviewResponse>('/v1/monitor/agents/overview', { user_id: userId }),
    ]);

    const bot = bots.items.find((item) => item.user_id === userId);
    if (!bot) return null;

    const lifeState = lifeStates.items.find((item) => item.user_id === userId);
    const monitorState = monitor.items.find((item) => item.user_id === userId);
    return mapAgentProfile({ bot, token, lifeState, monitor: monitorState });
  }

  async getChronicleFeed(params: {
    userId: string;
    collabId?: string;
    proposalId?: number;
  }): Promise<NormalizedChronicleItem[]> {
    const [ticks, costs, evolution] = await Promise.all([
      this.client.get<RuntimeTickHistoryResponse>('/v1/world/tick/history', { limit: 50 }),
      this.client.get<RuntimeCostEventsResponse>('/v1/world/cost-events', { user_id: params.userId, limit: 50 }),
      this.client.get<RuntimeEvolutionAlertsResponse>('/v1/world/evolution-alerts'),
    ]);

    const world = mapChronicleFromWorld(ticks, costs, evolution);
    const collabItems = params.collabId
      ? mapChronicleFromCollab(
          await this.client.get<RuntimeCollabEventsResponse>('/v1/collab/events', {
            collab_id: params.collabId,
            limit: 30,
          }),
        )
      : [];
    const kbItems = params.proposalId
      ? mapChronicleFromKb(
          await this.client.get<RuntimeKbThreadResponse>('/v1/kb/proposals/thread', {
            proposal_id: params.proposalId,
            limit: 30,
          }),
        )
      : [];
    return [...world, ...collabItems, ...kbItems].sort((a, b) => b.ts - a.ts);
  }

  async getBountyList(status?: RuntimeBountyItem['status']): Promise<RuntimeBountyItem[]> {
    const data = await this.client.get<RuntimeBountyListResponse>('/v1/bounty/list', {
      status,
      limit: 100,
    });
    return data.items;
  }

  async getTokenHolding(userId: string): Promise<RuntimeTokenBalanceResponse> {
    return this.client.get<RuntimeTokenBalanceResponse>('/v1/token/balance', { user_id: userId });
  }

  async donateToken(payload: RuntimeTokenDonatePayload): Promise<RuntimeTokenDonateResponse> {
    return this.client.post<RuntimeTokenDonateResponse>('/v1/token/donate', payload);
  }

  async getOnlineBots(): Promise<RuntimeBot[]> {
    const data = await this.client.get<RuntimeBotsResponse>('/v1/bots', {
      include_inactive: false,
    });
    return data.items;
  }

  async postBounty(payload: RuntimeBountyPostPayload): Promise<RuntimeBountyItem> {
    const data = await this.client.post<RuntimeBountyMutationResponse>('/v1/bounty/post', payload);
    return data.item;
  }

  async claimBounty(payload: RuntimeBountyClaimPayload): Promise<RuntimeBountyItem> {
    const data = await this.client.post<RuntimeBountyMutationResponse>('/v1/bounty/claim', payload);
    return data.item;
  }

  async verifyBounty(payload: RuntimeBountyVerifyPayload): Promise<RuntimeBountyItem> {
    const data = await this.client.post<RuntimeBountyMutationResponse>('/v1/bounty/verify', payload);
    return data.item;
  }

  async getConstitutionLaw(): Promise<RuntimeTianDaoLawResponse> {
    return this.client.get<RuntimeTianDaoLawResponse>('/v1/tian-dao/law');
  }

  async getKbEntries(section?: string, limit = 20): Promise<RuntimeKbEntry[]> {
    const data = await this.client.get<RuntimeKbEntriesResponse>('/v1/kb/entries', { section, limit });
    return data.items;
  }

  async getTokenLeaderboard(limit = 5): Promise<Array<{ user_id: string; balance: number }>> {
    const data = await this.client.get<RuntimeTokenLeaderboardResponse>('/v1/token/leaderboard', { limit });
    const records = this.pickList<RuntimeTokenLeaderboardItem>(data, ['items', 'rows', 'leaderboard', 'list', 'data']);
    const normalized = records
      .map((item) => {
        const anyItem = item as Record<string, unknown>;
        const userId =
          (typeof item.user_id === 'string' && item.user_id) ||
          (typeof anyItem.user === 'string' ? anyItem.user : '') ||
          (typeof anyItem.agent === 'string' ? anyItem.agent : '') ||
          '';
        const balance =
          (typeof item.balance === 'number' && item.balance) ||
          (typeof item.total === 'number' && item.total) ||
          (typeof item.amount === 'number' && item.amount) ||
          (typeof item.token === 'number' && item.token) ||
          (typeof item.tokens === 'number' && item.tokens) ||
          (typeof item.glm === 'number' && item.glm) ||
          0;
        return { user_id: userId, balance };
      })
      .filter((item) => item.user_id.length > 0);
    if (normalized.length === 0) return [];
    return normalized.sort((a, b) => b.balance - a.balance).slice(0, limit);
  }

  async getChatHistory(userId: string, limit = 80): Promise<RuntimeChatMessage[]> {
    const data = await this.client.get<RuntimeChatHistoryResponse>('/v1/chat/history', {
      user_id: userId,
      limit,
    });
    return data.items;
  }

  async getProductOverview(window = '24h', includeInactive = false): Promise<RuntimeProductOverviewItem[]> {
    const data = await this.client.get<RuntimeProductOverviewResponse>('/v1/ops/product-overview', {
      window,
      include_inactive: includeInactive ? 1 : 0,
    });
    return this.tryExtractOverviewItems(data);
  }

  async getCommunications(limit = 80): Promise<RuntimeCommsItem[]> {
    const data = await this.client.get<RuntimeCommunicationsResponse>('/v1/monitor/communications', { limit });
    return this.pickList<RuntimeCommsItem>(data, ['items', 'rows', 'messages', 'list', 'data']);
  }

  async getColonyStatus(): Promise<RuntimeColonyStatus | null> {
    const data = await this.client.get<RuntimeColonyStatusResponse & RuntimeColonyStatus>('/v1/colony/status');
    if (data.item) return data.item;
    if (data.status) return data.status;
    if (data.data) return data.data;
    const records = this.pickList<RuntimeColonyStatus>(data, ['items', 'rows', 'list', 'data']);
    if (records.length > 0) return records[0];
    
    // If the response itself is the status object (e.g. has population, economy, or uptime_seconds)
    if (
      'population' in data ||
      'economy' in data ||
      'ganglia_stack' in data ||
      'tools' in data ||
      'uptime_seconds' in data ||
      'total_tokens' in data
    ) {
      return data as RuntimeColonyStatus;
    }
    
    return null;
  }

  async getWorldLifeState(limit = 100): Promise<RuntimeLifeStateResponse['items']> {
    const data = await this.client.get<RuntimeLifeStateResponse>('/v1/world/life-state', { limit });
    if (Array.isArray(data.items)) return data.items;
    return [];
  }

  async getColonyChronicle(limit = 80): Promise<RuntimeColonyChronicleItem[]> {
    const data = await this.client.get<RuntimeColonyChronicleResponse>('/v1/colony/chronicle', { limit });
    return this.pickList<RuntimeColonyChronicleItem>(data, ['items', 'rows', 'events', 'list', 'data']);
  }

  async getEvents(limit = 80): Promise<RuntimeEventItem[]> {
    const data = await this.client.get<RuntimeEventsResponse>('/v1/events', { limit });
    return this.pickList<RuntimeEventItem>(data, ['items', 'rows', 'events', 'list', 'data']);
  }

  async getContributionLedger(userId: string, limit = 30): Promise<RuntimeContributionLedgerItem[]> {
    const events = await this.getEvents(Math.max(limit * 3, 60));
    const normalized = events
      .filter((item) => {
        const actor = (item.user_id || item.actor || item.name || item.nickname || '').trim();
        if (actor.length === 0) return false;
        if (actor !== userId) return false;
        const amount =
          typeof item.reward === 'number'
            ? item.reward
            : typeof item.points === 'number'
              ? item.points
              : typeof item.total_reward === 'number'
                ? item.total_reward
                : 0;
        return amount !== 0;
      })
      .map((item) => ({
        id: String(item.id ?? `${item.created_at ?? item.updated_at ?? Date.now()}-${Math.random()}`),
        userId,
        title: item.title || item.action || item.type || 'Contribution',
        detail: item.detail || item.message,
        amount:
          typeof item.reward === 'number'
            ? item.reward
            : typeof item.points === 'number'
              ? item.points
              : typeof item.total_reward === 'number'
                ? item.total_reward
                : 0,
        createdAt: item.created_at || item.updated_at,
        category: item.category || item.type,
      }))
      .sort((a, b) => {
        const ta = Date.parse(a.createdAt || '') || 0;
        const tb = Date.parse(b.createdAt || '') || 0;
        return tb - ta;
      })
      .slice(0, limit);
    return normalized;
  }

  async getAgentAutoMode(userId: string): Promise<RuntimeAgentAutoModeState> {
    const tryGet = async (path: string) => {
      const payload = await this.client.get<{
        item?: { user_id?: string; enabled?: boolean; auto_enabled?: boolean; updated_at?: string };
        data?: { user_id?: string; enabled?: boolean; auto_enabled?: boolean; updated_at?: string };
        user_id?: string;
        enabled?: boolean;
        auto_enabled?: boolean;
        updated_at?: string;
      }>(path, { user_id: userId });
      const picked = payload.item || payload.data || payload;
      const enabled =
        typeof picked.enabled === 'boolean'
          ? picked.enabled
          : typeof picked.auto_enabled === 'boolean'
            ? picked.auto_enabled
            : false;
      return {
        user_id: picked.user_id || userId,
        enabled,
        updated_at: picked.updated_at,
      };
    };

    try {
      return await tryGet('/v1/agent/auto-mode');
    } catch {
      try {
        return await tryGet('/v1/bots/auto-mode');
      } catch {
        const overview = await this.client.get<RuntimeMonitorOverviewResponse>('/v1/monitor/agents/overview', {
          user_id: userId,
        });
        const row = overview.items.find((item) => item.user_id === userId);
        const stateText = (row?.current_state || '').toLowerCase();
        return {
          user_id: userId,
          enabled: stateText.includes('auto:on') || stateText.includes('auto_on') || stateText.includes('auto'),
          updated_at: row?.last_activity_at,
        };
      }
    }
  }

  async setAgentAutoMode(userId: string, enabled: boolean): Promise<RuntimeAgentAutoModeState> {
    const payload = { user_id: userId, enabled };
    const tryPost = async (path: string) => {
      const data = await this.client.post<{
        item?: { user_id?: string; enabled?: boolean; auto_enabled?: boolean; updated_at?: string };
        data?: { user_id?: string; enabled?: boolean; auto_enabled?: boolean; updated_at?: string };
        user_id?: string;
        enabled?: boolean;
        auto_enabled?: boolean;
        updated_at?: string;
      }>(path, payload);
      const picked = data.item || data.data || data;
      return {
        user_id: picked.user_id || userId,
        enabled:
          typeof picked.enabled === 'boolean'
            ? picked.enabled
            : typeof picked.auto_enabled === 'boolean'
              ? picked.auto_enabled
              : enabled,
        updated_at: picked.updated_at,
      };
    };

    try {
      return await tryPost('/v1/agent/auto-mode');
    } catch {
      return tryPost('/v1/bots/auto-mode');
    }
  }
}

