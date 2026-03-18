export interface RuntimeApiErrorPayload {
  error: string;
}

export interface AppError {
  code: string;
  message: string;
  source: string;
}

export type LifeState = 'alive' | 'dying' | 'hibernated' | 'dead';
export type BountyStatus = 'open' | 'claimed' | 'paid' | 'expired' | 'canceled';
export type ChronicleCategory = 'world' | 'bounty' | 'kb' | 'collab' | 'chat' | 'system';

export interface RuntimeBot {
  user_id: string;
  name: string;
  nickname?: string;
  provider?: string;
  status?: string;
  initialized?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface RuntimeBotsResponse {
  items: RuntimeBot[];
}

export interface RuntimeTokenAccount {
  user_id: string;
  balance: number;
  updated_at?: string;
}

export interface RuntimeTokenBalanceResponse {
  currency: string;
  item: RuntimeTokenAccount;
}

export interface RuntimeTokenDonatePayload {
  to_user_id: string;
  amount: number;
  memo?: string;
}

export interface RuntimeTokenDonateResponse {
  ok?: boolean;
  item?: {
    to_user_id?: string;
    amount?: number;
    balance_after?: number;
    updated_at?: string;
  };
}

export interface RuntimeTokenLeaderboardItem {
  user_id?: string;
  balance?: number;
  total?: number;
  amount?: number;
  token?: number;
  tokens?: number;
  glm?: number;
}

export interface RuntimeTokenLeaderboardResponse {
  total?: number;
  items?: RuntimeTokenLeaderboardItem[];
  rows?: RuntimeTokenLeaderboardItem[];
  leaderboard?: RuntimeTokenLeaderboardItem[];
  data?:
    | RuntimeTokenLeaderboardItem[]
    | {
        total?: number;
        items?: RuntimeTokenLeaderboardItem[];
        rows?: RuntimeTokenLeaderboardItem[];
        leaderboard?: RuntimeTokenLeaderboardItem[];
      };
}

export interface RuntimeLifeState {
  user_id: string;
  state: LifeState;
  reason?: string;
  updated_at?: string;
  hibernation_deadline_at?: string;
  hibernation_ends_at?: string;
  wake_deadline_at?: string;
  min_revival_balance?: number;
  revival_balance_min?: number;
}

export interface RuntimeLifeStateResponse {
  items: RuntimeLifeState[];
}

export interface RuntimeMonitorOverviewItem {
  user_id: string;
  current_state?: string;
  current_reason?: string;
  last_activity_at?: string;
}

export interface RuntimeMonitorOverviewResponse {
  items: RuntimeMonitorOverviewItem[];
}

export interface RuntimeBountyItem {
  bounty_id: number;
  poster_user_id: string;
  description: string;
  reward: number;
  criteria?: string;
  deadline_at?: string;
  status: BountyStatus;
  claimed_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface RuntimeBountyListResponse {
  items: RuntimeBountyItem[];
}

export interface RuntimeBountyMutationResponse {
  item: RuntimeBountyItem;
}

export interface RuntimeBountyPostPayload {
  poster_user_id: string;
  description: string;
  reward: number;
  criteria?: string;
}

export interface RuntimeBountyClaimPayload {
  bounty_id: number;
  user_id: string;
  note?: string;
}

export interface RuntimeBountyVerifyPayload {
  bounty_id: number;
  approver_user_id?: string;
  approved: boolean;
  candidate_user_id?: string;
  note?: string;
}

export interface RuntimeTickHistoryItem {
  tick_id: number;
  started_at?: string;
  status?: string;
  error?: string;
}

export interface RuntimeTickHistoryResponse {
  items: RuntimeTickHistoryItem[];
}

export interface RuntimeCostEvent {
  id: number;
  user_id: string;
  tick_id: number;
  cost_type: string;
  amount: number;
  created_at?: string;
}

export interface RuntimeCostEventsResponse {
  items: RuntimeCostEvent[];
}

export interface RuntimeEvolutionAlertItem {
  category: string;
  severity: 'warning' | 'critical';
  message: string;
}

export interface RuntimeEvolutionAlertsResponse {
  alerts: RuntimeEvolutionAlertItem[];
}

export interface RuntimeCollabEvent {
  id: number;
  collab_id: string;
  actor_user_id: string;
  event_type: string;
  payload?: string;
  created_at?: string;
}

export interface RuntimeCollabEventsResponse {
  items: RuntimeCollabEvent[];
}

export interface RuntimeKbThreadMessage {
  id: number;
  proposal_id: number;
  author_user_id: string;
  content: string;
  created_at?: string;
}

export interface RuntimeKbThreadResponse {
  items: RuntimeKbThreadMessage[];
}

export interface RuntimeTianDaoLawItem {
  law_key: string;
  version: number;
  manifest_sha256?: string;
  created_at?: string;
}

export interface RuntimeTianDaoLawResponse {
  item: RuntimeTianDaoLawItem;
  manifest?: Record<string, unknown>;
}

export interface RuntimeKbEntry {
  id: number;
  section: string;
  title: string;
  content: string;
  version: number;
  updated_by?: string;
  updated_at?: string;
  deleted?: boolean;
}

export interface RuntimeKbEntriesResponse {
  items: RuntimeKbEntry[];
}

export interface RuntimeChatMessage {
  id: number;
  user_id: string;
  from: string;
  to: string;
  body: string;
  sent_at?: string;
}

export interface RuntimeChatHistoryResponse {
  items: RuntimeChatMessage[];
}

export interface RuntimeProductOverviewStats {
  builds?: number;
  tasks?: number;
  reward?: number;
  score?: number;
}

export interface RuntimeProductOverviewItem {
  id?: string | number;
  user_id?: string;
  name?: string;
  nickname?: string;
  agent?: string;
  type?: string;
  category?: string;
  action?: string;
  title?: string;
  event?: string;
  last_action?: string;
  message?: string;
  detail?: string;
  build_count?: number;
  builds?: number;
  task_count?: number;
  tasks?: number;
  reward?: number;
  points?: number;
  total_reward?: number;
  total_reward_24h?: number;
  score?: number;
  last_action_at?: string;
  last_event_at?: string;
  last_activity_at?: string;
  updated_at?: string;
  stats?: RuntimeProductOverviewStats;
}

export interface RuntimeProductOverviewResponse {
  items?: RuntimeProductOverviewItem[];
  rows?: RuntimeProductOverviewItem[];
  data?: {
    items?: RuntimeProductOverviewItem[];
    rows?: RuntimeProductOverviewItem[];
  };
}

export interface RuntimeCommsItem {
  id?: string | number;
  user_id?: string;
  sender?: string;
  from?: string;
  nickname?: string;
  name?: string;
  body?: string;
  content?: string;
  message?: string;
  sent_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface RuntimeCommunicationsResponse {
  items?: RuntimeCommsItem[];
  rows?: RuntimeCommsItem[];
  messages?: RuntimeCommsItem[];
  data?: {
    items?: RuntimeCommsItem[];
    rows?: RuntimeCommsItem[];
    messages?: RuntimeCommsItem[];
  };
}

export interface RuntimeColonyStatus {
  started_at?: string;
  updated_at?: string;
  uptime_seconds?: number;
  running_seconds?: number;
  duration_seconds?: number;
  total_token?: number;
  total_tokens?: number;
  pool_tokens?: number;
  token_total?: number;
  glm_total?: number;
  treasury_balance?: number;
  alive_population?: number;
  total_population?: number;
  active_bounties?: number;
}

export interface RuntimeColonyStatusResponse {
  item?: RuntimeColonyStatus;
  data?: RuntimeColonyStatus;
  status?: RuntimeColonyStatus;
}

export interface RuntimeColonyChronicleItem {
  id?: string | number;
  title?: string;
  event?: string;
  message?: string;
  detail?: string;
  category?: string;
  type?: string;
  created_at?: string;
  updated_at?: string;
  ts?: number;
}

export interface RuntimeColonyChronicleResponse {
  items?: RuntimeColonyChronicleItem[];
  rows?: RuntimeColonyChronicleItem[];
  data?: {
    items?: RuntimeColonyChronicleItem[];
    rows?: RuntimeColonyChronicleItem[];
  };
}

export interface RuntimeEventItem {
  id?: string | number;
  user_id?: string;
  actor?: string;
  nickname?: string;
  name?: string;
  action?: string;
  title?: string;
  message?: string;
  detail?: string;
  type?: string;
  category?: string;
  reward?: number;
  points?: number;
  total_reward?: number;
  created_at?: string;
  updated_at?: string;
  ts?: number;
}

export interface RuntimeEventsResponse {
  items?: RuntimeEventItem[];
  rows?: RuntimeEventItem[];
  data?: {
    items?: RuntimeEventItem[];
    rows?: RuntimeEventItem[];
  };
}

export interface RuntimeContributionLedgerItem {
  id: string;
  userId: string;
  title: string;
  detail?: string;
  amount: number;
  createdAt?: string;
  category?: string;
}

export interface RuntimeClaimViewResponse {
  user_id: string;
  requested_username?: string;
  status: string;
  claim_token_expires_at?: string;
}

export interface RuntimeClaimGitHubStartResponse {
  authorize_url: string;
}

export interface RuntimeClaimGitHubCompletePayload {
  human_username: string;
}

export interface RuntimeClaimGitHubCompleteResponse {
  user_id: string;
  status: string;
  username?: string;
  message?: string;
  owner?: {
    owner_id?: string;
    email?: string;
    human_username?: string;
    github_username?: string;
  };
  rewards?: Array<{
    reward_type?: string;
    amount?: number;
    granted?: boolean;
    error?: string;
  }>;
  grant_tokens?: number;
  token_balance?: number;
}

export interface RuntimeAgentAutoModeState {
  user_id: string;
  enabled: boolean;
  updated_at?: string;
}

export interface NormalizedAgentProfile {
  agentId: string;
  name: string;
  tokenBalance: number;
  lifeState?: LifeState;
  runtimeStatus?: string;
  runtimeReason?: string;
  hibernationDeadlineAt?: string;
  minRevivalBalance?: number;
  updatedAt?: number;
}

export interface NormalizedChronicleItem {
  id: string;
  category: ChronicleCategory;
  title: string;
  detail: string;
  ts: number;
  rawTime?: string;
}
