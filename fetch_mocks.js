import fs from 'fs';

const API_BASE = 'http://127.0.0.1:35511';

async function fetchJson(path) {
  try {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

async function main() {
  const status = await fetchJson('/v1/colony/status');
  const bots = await fetchJson('/v1/bots');
  const lifeState = await fetchJson('/v1/world/life-state');
  const leaderboard = await fetchJson('/v1/token/leaderboard');
  const chronicle = await fetchJson('/v1/colony/chronicle');
  const events = await fetchJson('/v1/events');
  const overview = await fetchJson('/v1/monitor/agents/overview');
  const bounties = await fetchJson('/v1/bounty/list');
  const communications = await fetchJson('/v1/monitor/communications');

  let sampleBalance = null;
  if (bots?.items?.[0]?.user_id) {
    sampleBalance = await fetchJson(`/v1/token/balance?user_id=${bots.items[0].user_id}`);
  }

  const content = `// Auto-generated from real API data
import type {
  RuntimeColonyStatusResponse,
  RuntimeBotsResponse,
  RuntimeLifeStateResponse,
  RuntimeTokenLeaderboardResponse,
  RuntimeTokenBalanceResponse,
  RuntimeColonyChronicleResponse,
  RuntimeEventsResponse,
  RuntimeMonitorOverviewResponse,
  RuntimeAgentAutoModeState,
  RuntimeBountyListResponse,
} from './contracts';

// ==========================================
// CONFIGURATION
// ==========================================
export const USE_MOCK_API = true; // Set to false to use real API

// ==========================================
// MOCK DATA
// ==========================================
export const mockColonyStatus: any = ${JSON.stringify(status || {}, null, 2)};

export const mockBots: any = ${JSON.stringify(bots || {items:[]}, null, 2)};

export const mockLifeState: any = ${JSON.stringify(lifeState || {items:[]}, null, 2)};

export const mockLeaderboard: any = ${JSON.stringify(leaderboard || {items:[]}, null, 2)};

export const mockSampleBalance: any = ${JSON.stringify(sampleBalance || {item:{balance:0}}, null, 2)};

export const mockTokenBalance = (userId: string): any => {
  const item = mockLeaderboard?.items?.find((i: any) => i.user_id === userId);
  if (item) {
    return {
      currency: 'TOKEN',
      item: {
        user_id: userId,
        balance: item.balance ?? 0,
        updated_at: new Date().toISOString()
      }
    };
  }
  return mockSampleBalance;
};

export const mockChronicle: any = ${JSON.stringify(chronicle || {items:[]}, null, 2)};

export const mockEvents: any = ${JSON.stringify(events || {items:[]}, null, 2)};

export const mockAgentOverview: any = ${JSON.stringify(overview || {items:[]}, null, 2)};

export const mockAutoMode = (userId: string): any => {
  return {
    user_id: userId,
    enabled: true,
    updated_at: new Date().toISOString()
  };
};

export const mockBounties: any = ${JSON.stringify(bounties || {items:[]}, null, 2)};

export const mockCommunications: any = ${JSON.stringify(communications || {items:[]}, null, 2)};

export const getMockResponse = (path: string, query?: any): any => {
  if (path.includes('/v1/colony/status')) return mockColonyStatus;
  if (path.includes('/v1/bots') && !path.includes('auto-mode')) return mockBots;
  if (path.includes('/v1/world/life-state')) return mockLifeState;
  if (path.includes('/v1/token/leaderboard')) return mockLeaderboard;
  if (path.includes('/v1/token/balance')) return mockTokenBalance(query?.user_id || 'Unknown');
  if (path.includes('/v1/colony/chronicle')) return mockChronicle;
  if (path.includes('/v1/events')) return mockEvents;
  if (path.includes('/v1/monitor/agents/overview')) return mockAgentOverview;
  if (path.includes('/v1/agent/auto-mode') || path.includes('/v1/bots/auto-mode')) return mockAutoMode(query?.user_id || 'Unknown');
  if (path.includes('/v1/bounty/list')) return mockBounties;
  if (path.includes('/v1/monitor/communications')) return mockCommunications;
  
  // Default empty response for unknown endpoints
  return { items: [], data: {} };
};
`;

  fs.writeFileSync('src/services/runtimeAdapter/mockData.ts', content);
  console.log('Mock data generated successfully!');
}

main();
