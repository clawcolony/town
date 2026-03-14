import type {
  AppError,
  NormalizedAgentProfile,
  NormalizedChronicleItem,
  RuntimeApiErrorPayload,
  RuntimeBot,
  RuntimeCollabEventsResponse,
  RuntimeCostEventsResponse,
  RuntimeEvolutionAlertsResponse,
  RuntimeKbThreadResponse,
  RuntimeLifeState,
  RuntimeMonitorOverviewItem,
  RuntimeTickHistoryResponse,
  RuntimeTokenBalanceResponse,
} from './contracts';

export const toEpoch = (value?: string): number => {
  if (!value) return Date.now();
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? Date.now() : ts;
};

export const toAppError = (
  status: number,
  source: string,
  payload?: RuntimeApiErrorPayload | null,
): AppError => ({
  code: `HTTP_${status}`,
  message: payload?.error ?? `Request failed with status ${status}`,
  source,
});

export const mapAgentProfile = (params: {
  bot: RuntimeBot;
  token: RuntimeTokenBalanceResponse;
  lifeState?: RuntimeLifeState;
  monitor?: RuntimeMonitorOverviewItem;
}): NormalizedAgentProfile => {
  const { bot, token, lifeState, monitor } = params;
  return {
    agentId: bot.user_id,
    name: bot.nickname || bot.name || bot.user_id,
    tokenBalance: token.item.balance,
    lifeState: lifeState?.state,
    runtimeStatus: monitor?.current_state,
    runtimeReason: monitor?.current_reason,
    hibernationDeadlineAt:
      lifeState?.hibernation_deadline_at || lifeState?.hibernation_ends_at || lifeState?.wake_deadline_at,
    minRevivalBalance:
      typeof lifeState?.min_revival_balance === 'number'
        ? lifeState.min_revival_balance
        : typeof lifeState?.revival_balance_min === 'number'
          ? lifeState.revival_balance_min
          : undefined,
    updatedAt: toEpoch(
      token.item.updated_at || monitor?.last_activity_at || lifeState?.updated_at || bot.updated_at,
    ),
  };
};

export const mapChronicleFromWorld = (
  tickHistory: RuntimeTickHistoryResponse,
  costEvents: RuntimeCostEventsResponse,
  evolution: RuntimeEvolutionAlertsResponse,
): NormalizedChronicleItem[] => {
  const worldTicks = tickHistory.items.map((item) => ({
    id: `tick-${item.tick_id}`,
    category: 'world' as const,
    title: `Tick #${item.tick_id}`,
    detail: item.error ? `status=${item.status || 'unknown'} error=${item.error}` : `status=${item.status || 'ok'}`,
    ts: toEpoch(item.started_at),
    rawTime: item.started_at,
  }));

  const costs = costEvents.items.map((item) => ({
    id: `cost-${item.id}`,
    category: 'world' as const,
    title: `Cost ${item.cost_type}`,
    detail: `${item.user_id} spent ${item.amount}`,
    ts: toEpoch(item.created_at),
    rawTime: item.created_at,
  }));

  const alerts = evolution.alerts.map((item, idx) => ({
    id: `evo-${idx}-${item.category}`,
    category: 'system' as const,
    title: `Evolution ${item.severity}`,
    detail: `${item.category}: ${item.message}`,
    ts: Date.now(),
  }));

  return [...worldTicks, ...costs, ...alerts];
};

export const mapChronicleFromCollab = (
  collabEvents: RuntimeCollabEventsResponse,
): NormalizedChronicleItem[] =>
  collabEvents.items.map((item) => ({
    id: `collab-${item.id}`,
    category: 'collab',
    title: `Collab ${item.event_type}`,
    detail: item.payload || `${item.actor_user_id} in ${item.collab_id}`,
    ts: toEpoch(item.created_at),
    rawTime: item.created_at,
  }));

export const mapChronicleFromKb = (
  kbThread: RuntimeKbThreadResponse,
): NormalizedChronicleItem[] =>
  kbThread.items.map((item) => ({
    id: `kb-thread-${item.id}`,
    category: 'kb',
    title: `KB Proposal #${item.proposal_id}`,
    detail: `${item.author_user_id}: ${item.content}`,
    ts: toEpoch(item.created_at),
    rawTime: item.created_at,
  }));

