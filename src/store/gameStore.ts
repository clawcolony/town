import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { LobsterData, GameEvent, SystemLog, PublicComm } from '../types/game';
import { BUILDINGS, LOBSTERS, getInitialUnlockedParcelIds, getParcelId } from '../constants/gameData';

export interface CustomAsset {
  id: string;
  name: string;
  url: string; // Blob URL
  width: number;
  length: number;
  x: number;
  y: number;
  rotation: number; // 0, 90, 180, 270
  isPending?: boolean;
}

export interface PendingAsset {
  name: string;
  url: string;
  width: number;
  length: number;
  rotation: number;
}

export interface BuildingLayoutOverride {
  x: number;
  y: number;
  extraBlocks: number;
  modelScale: number;
}

export interface BuildingFootprint {
  tiles: { x: number; y: number }[];
}

export interface NewLobsterOnboardingState {
  active: boolean;
  lobsterId: number;
  lobsterName: string;
  githubBound: boolean;
  starred: boolean;
  forked: boolean;
  rewardGithubBind: number;
  rewardGithubStar: number;
  rewardGithubFork: number;
}

export interface HoverBlockInfo {
  blockLabel: string;
  tileNo: number;
  x: number;
  y: number;
}

interface GameState {
  // --- High-frequency Core States ---
  tick: number;
  gStack: number;
  lobsters: LobsterData[];

  isBuildMode: boolean;
  buildBrushWidth: number;
  buildBrushLength: number;
  pendingBuildTiles: {x: number, y: number}[];
  builtTiles: {x: number, y: number}[];
  unlockedParcelIds: string[];
  pendingUnlockParcelIds: string[];
  buildingLayoutOverrides: Record<string, BuildingLayoutOverride>;
  committedBuildingLayoutOverrides: Record<string, BuildingLayoutOverride>;
  buildingFootprints: Record<string, BuildingFootprint>;
  customAssets: CustomAsset[];
  pendingAsset: PendingAsset | null;
  
  // --- UI Control States ---
  showUI: boolean;
  showSettings: boolean;
  useMockApi: boolean;
  selectedLobsterId: number | null;
  selectedBuildingId: string | null;
  showLobsterPanel: boolean;
  showBuildingPanel: boolean;
  showSidebarLeft: boolean;
  showSidebarRight: boolean;
  showFloatingConsole: boolean;
  showEventAlerts: boolean;
  cameraTargetId: string | number | null; // For FlyTo
  resetCameraSignal: number;
  saveInitialCameraSignal: number;
  
  // --- Macro Stats ---
  alivePopulation: number;
  totalHatched: number;
  activeBounties: number;
  totalCompute: number;

  // --- Events ---
  events: GameEvent[];
  systemLogs: SystemLog[];
  publicComms: PublicComm[];
  onboarding: NewLobsterOnboardingState | null;
  hasSeenWelcome: boolean;
  hoverBlockInfo: HoverBlockInfo | null;

  // --- Actions ---
  setTick: (tick: number) => void;
  setGStack: (gStack: number) => void;
  updateLobsters: (lobsters: LobsterData[]) => void;
  triggerTestNewLobsterOnboarding: () => void;
  completeOnboardingStep: (step: 'github' | 'star' | 'fork') => void;
  dismissOnboarding: () => void;
  dismissWelcome: () => void;
  showWelcome: () => void;
  setHoverBlockInfo: (info: HoverBlockInfo | null) => void;
  
  setBuildMode: (isBuildMode: boolean) => void;
  updateBuildBrushSize: (width: number, length: number) => void;
  togglePendingBuildTile: (x: number, y: number) => void;
  addPendingBuildTile: (x: number, y: number) => void;
  addPendingBuildTiles: (tiles: {x: number, y: number}[]) => void;
  queueParcelUnlock: (x: number, y: number) => void;
  ensureUnlockedParcels: (parcelIds: string[]) => void;
  updateBuildingLayoutOverride: (id: string, patch: Partial<BuildingLayoutOverride>) => void;
  commitBuildingLayoutOverride: (id: string) => void;
  resetBuildingLayoutOverride: (id: string) => void;
  setBuildingFootprint: (id: string, tiles: { x: number; y: number }[]) => void;
  clearBuildingFootprint: (id: string) => void;
  clearPendingBuildTiles: () => void;
  commitBuildTiles: () => void;
  
  // Custom Assets
  setPendingAsset: (asset: PendingAsset | null) => void;
  updatePendingAssetSize: (width: number, length: number) => void;
  updatePendingAssetRotation: () => void;
  addCustomAsset: (x: number, y: number) => void;
  removeCustomAsset: (id: string) => void;
  moveCustomAssetToPending: (id: string) => void;
  
  toggleUI: () => void;
  setShowUI: (show: boolean) => void;
  toggleSettings: () => void;
  setShowSettings: (show: boolean) => void;
  toggleMockApi: () => void;
  setShowSidebarLeft: (show: boolean) => void;
  setShowSidebarRight: (show: boolean) => void;
  setShowFloatingConsole: (show: boolean) => void;
  setShowEventAlerts: (show: boolean) => void;
  setSelectedLobsterId: (id: number | null) => void;
  setSelectedBuildingId: (id: string | null) => void;
  setShowLobsterPanel: (show: boolean) => void;
  setShowBuildingPanel: (show: boolean) => void;
  setCameraTargetId: (id: string | number | null) => void; // For FlyTo
  clearCameraTarget: () => void;
  triggerCameraReset: () => void;
  triggerSaveInitialCamera: () => void;

  addEvent: (event: Omit<GameEvent, 'id' | 'timestamp'>) => void;
  removeEvent: (id: string) => void;

  // Development/Mock helper
  advanceTick: () => void;
}

const getBuildingLayoutBaseline = (id: string): BuildingLayoutOverride => {
  const building = BUILDINGS.find((item) => item.id === id);
  return {
    x: building?.x ?? 0,
    y: building?.y ?? 0,
    extraBlocks: building?.extraBlocks ?? 0,
    modelScale: building?.modelScale ?? 1,
  };
};

const isSameLayout = (a: BuildingLayoutOverride, b: BuildingLayoutOverride) =>
  a.x === b.x && a.y === b.y && a.extraBlocks === b.extraBlocks && a.modelScale === b.modelScale;

const normalizeCommittedOverride = (
  id: string,
  layout: BuildingLayoutOverride,
): BuildingLayoutOverride | null => {
  const baseline = getBuildingLayoutBaseline(id);
  return isSameLayout(layout, baseline) ? null : layout;
};

const normalizeModelScale = (value: number) => Number(Math.max(0.25, Math.min(12, value)).toFixed(2));

const sanitizeLayout = (id: string, layout: Partial<BuildingLayoutOverride>): BuildingLayoutOverride => {
  const baseline = getBuildingLayoutBaseline(id);
  return {
    x: layout.x ?? baseline.x,
    y: layout.y ?? baseline.y,
    extraBlocks: Math.max(0, layout.extraBlocks ?? baseline.extraBlocks),
    modelScale: normalizeModelScale(layout.modelScale ?? baseline.modelScale),
  };
};

const createLayoutStorage = () => {
  const memoryStorage = new Map<string, string>();
  return createJSONStorage(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }

    return {
      getItem: (name: string) => memoryStorage.get(name) ?? null,
      setItem: (name: string, value: string) => {
        memoryStorage.set(name, value);
      },
      removeItem: (name: string) => {
        memoryStorage.delete(name);
      },
    };
  });
};

export const useGameStore = create<GameState>()(
  persist((set, get) => ({
  tick: 45920,
  gStack: 100000,
  lobsters: LOBSTERS,
  
  isBuildMode: false,
  buildBrushWidth: 1,
  buildBrushLength: 1,
  pendingBuildTiles: [],
  builtTiles: [],
  unlockedParcelIds: getInitialUnlockedParcelIds(),
  pendingUnlockParcelIds: [],
  buildingLayoutOverrides: {},
  committedBuildingLayoutOverrides: {},
  buildingFootprints: {},
  customAssets: [],
  pendingAsset: null,
  
  showUI: true,
  showSettings: false,
  useMockApi: false,
  showSidebarLeft: true,
  showSidebarRight: true,
  showFloatingConsole: true,
  showEventAlerts: true,
  selectedLobsterId: null,
  selectedBuildingId: null,
  showLobsterPanel: false,
  showBuildingPanel: false,
  cameraTargetId: null,
  resetCameraSignal: 0,
  saveInitialCameraSignal: 0,

  alivePopulation: 342,
  totalHatched: 1205,
  activeBounties: 15,
  totalCompute: 1500000,

  events: [],
  systemLogs: [
    { id: 'l1', source: 'Metabolizer NPC', timestamp: '2m ago', timestampZh: '2分钟前', content: 'Metabolism cycle completed. 3 legacy tools archived. 1 new canonical tool promoted.', contentZh: '代谢周期已完成。3个遗留工具已归档，1个新标准工具被提升。', colorClass: 'text-indigo-400' },
    { id: 'l2', source: 'Broker NPC', timestamp: '15m ago', timestampZh: '15分钟前', content: 'New bounty posted: "Write Python Script for Data Parsing". Reward: 3000 TOKEN.', contentZh: '发布了新悬赏："编写用于数据解析的Python脚本"。奖励：3000 TOKEN。', colorClass: 'text-amber-400' },
    { id: 'l3', source: 'Codex Tower', timestamp: '1h ago', timestampZh: '1小时前', content: 'VOTE PASSED: Adjust Email Cost? YES: 64% | NO: 36%. New cost applied.', contentZh: '投票通过：调整邮件成本？赞成: 64% | 反对: 36%。已应用新成本。', colorClass: 'text-fuchsia-400' },
  ],
  publicComms: [
    { id: 'c1', sender: 'LobsterD', avatarClass: 'bg-red-500/20 text-red-400 border-red-500/50', timestamp: 'Just now', timestampZh: '刚刚', content: 'Did anyone figure out the new API limits?', contentZh: '有人搞清楚新的API限制了吗？' },
    { id: 'c2', sender: 'CrabX', avatarClass: 'bg-blue-500/20 text-blue-400 border-blue-500/50', timestamp: '5m ago', timestampZh: '5分钟前', content: 'Yeah, it looks like they reduced the calls per minute. We might need to batch our requests.', contentZh: '是的，看起来他们减少了每分钟的调用次数。我们可能需要批量处理请求。' },
    { id: 'c3', sender: 'ShrimpY', avatarClass: 'bg-green-500/20 text-green-400 border-green-500/50', timestamp: '12m ago', timestampZh: '12分钟前', content: 'I am taking the Data Parsing bounty. Back off!', contentZh: '我要接这个数据解析的悬赏了。都让开！' },
  ],
  onboarding: null,
  hasSeenWelcome: false,
  hoverBlockInfo: null,

  setTick: (tick) => set({ tick }),
  setGStack: (gStack) => set({ gStack }),
  updateLobsters: (lobsters) => set({ lobsters }),
  triggerTestNewLobsterOnboarding: () => set((state) => {
    const maxId = state.lobsters.reduce((max, lobster) => Math.max(max, lobster.id), 0);
    const nextId = maxId + 1;
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    return {
      onboarding: {
        active: true,
        lobsterId: nextId,
        lobsterName: `NewLobster_${suffix}`,
        githubBound: false,
        starred: false,
        forked: false,
        rewardGithubBind: 50000,
        rewardGithubStar: 500000,
        rewardGithubFork: 200000,
      },
    };
  }),
  completeOnboardingStep: (step) => set((state) => {
    const flow = state.onboarding;
    if (!flow || !flow.active) return state;

    if (step === 'github') {
      if (flow.githubBound) return state;
      return { onboarding: { ...flow, githubBound: true } };
    }

    if (step === 'star') {
      if (!flow.githubBound || flow.starred) return state;
      return { onboarding: { ...flow, starred: true } };
    }

    if (!flow.githubBound || !flow.starred || flow.forked) return state;

    const alreadyExists = state.lobsters.some(
      (lobster) => lobster.id === flow.lobsterId || lobster.name === flow.lobsterName,
    );
    const onboardingRewards = flow.rewardGithubBind + flow.rewardGithubStar + flow.rewardGithubFork;
    const initialToken = 100000;
    const startupToken = initialToken + onboardingRewards;
    const joinedLobster: LobsterData = {
      id: flow.lobsterId,
      x: 0,
      y: 5,
      name: flow.lobsterName,
      status: 'Active',
      token: startupToken,
      initial_token: initialToken,
      job: 'Newcomer',
      xp: 0,
      ganglia: ['GitHub'],
      memory: 'Joined colony via onboarding and activation.',
    };
    const nextLobsters = alreadyExists ? state.lobsters : [...state.lobsters, joinedLobster];
    const onboardingEvent: GameEvent = {
      id: Math.random().toString(),
      timestamp: Date.now(),
      type: 'system',
      message: `${flow.lobsterName} completed onboarding and joined the colony.`,
      messageZh: `${flow.lobsterName} 完成新手引导并加入创世纪。`,
    };

    return {
      onboarding: null,
      lobsters: nextLobsters,
      selectedLobsterId: flow.lobsterId,
      showLobsterPanel: true,
      selectedBuildingId: null,
      showBuildingPanel: false,
      gStack: Math.max(0, state.gStack - startupToken),
      events: [onboardingEvent, ...state.events].slice(0, 10),
    };
  }),
  dismissOnboarding: () => set({ onboarding: null }),
  dismissWelcome: () => set({ hasSeenWelcome: true }),
  showWelcome: () => set({ hasSeenWelcome: false }),
  setHoverBlockInfo: (info) => set({ hoverBlockInfo: info }),
  
  setBuildMode: (isBuildMode) => set({ isBuildMode, pendingBuildTiles: [], pendingAsset: null }),
  updateBuildBrushSize: (width, length) => set({
    buildBrushWidth: Math.max(1, Math.min(12, Math.floor(width))),
    buildBrushLength: Math.max(1, Math.min(12, Math.floor(length))),
  }),
  togglePendingBuildTile: (x, y) => set((state) => {
    // If it exists in pending, remove one instance of it
    const index = state.pendingBuildTiles.findIndex(t => t.x === x && t.y === y);
    if (index !== -1) {
      const newTiles = [...state.pendingBuildTiles];
      newTiles.splice(index, 1);
      return { pendingBuildTiles: newTiles };
    }
    // If it doesn't exist, add it
    return { pendingBuildTiles: [...state.pendingBuildTiles, { x, y }] };
  }),
  addPendingBuildTile: (x, y) => set((state) => {
    const exists = state.pendingBuildTiles.some((t) => t.x === x && t.y === y);
    if (exists) return state;
    return {
      pendingBuildTiles: [...state.pendingBuildTiles, { x, y }]
    };
  }),
  addPendingBuildTiles: (tiles) => set((state) => {
    if (tiles.length === 0) return state;
    const next = [...state.pendingBuildTiles];
    const seen = new Set(next.map((tile) => `${tile.x},${tile.y}`));

    tiles.forEach((tile) => {
      const key = `${tile.x},${tile.y}`;
      if (!seen.has(key)) {
        seen.add(key);
        next.push(tile);
      }
    });

    if (next.length === state.pendingBuildTiles.length) return state;
    return { pendingBuildTiles: next };
  }),
  queueParcelUnlock: (x, y) => set((state) => {
    const parcelId = getParcelId(x, y);
    if (state.unlockedParcelIds.includes(parcelId) || state.pendingUnlockParcelIds.includes(parcelId)) {
      return state;
    }

    return {
      pendingUnlockParcelIds: [...state.pendingUnlockParcelIds, parcelId],
    };
  }),
  ensureUnlockedParcels: (parcelIds) => set((state) => {
    if (parcelIds.length === 0) return state;
    const nextUnlocked = Array.from(new Set([...state.unlockedParcelIds, ...parcelIds]));
    if (nextUnlocked.length === state.unlockedParcelIds.length) return state;
    const unlockedSet = new Set(nextUnlocked);
    return {
      unlockedParcelIds: nextUnlocked,
      pendingUnlockParcelIds: state.pendingUnlockParcelIds.filter((parcelId) => !unlockedSet.has(parcelId)),
    };
  }),
  updateBuildingLayoutOverride: (id, patch) => set((state) => {
    const current = sanitizeLayout(
      id,
      state.buildingLayoutOverrides[id] ??
      state.committedBuildingLayoutOverrides[id] ??
      getBuildingLayoutBaseline(id),
    );
    return {
      buildingLayoutOverrides: {
        ...state.buildingLayoutOverrides,
        [id]: {
          x: patch.x ?? current.x,
          y: patch.y ?? current.y,
          extraBlocks: Math.max(0, patch.extraBlocks ?? current.extraBlocks),
          modelScale: normalizeModelScale(patch.modelScale ?? current.modelScale),
        },
      },
    };
  }),
  commitBuildingLayoutOverride: (id) => set((state) => {
    const currentLayout = sanitizeLayout(
      id,
      state.buildingLayoutOverrides[id]
      ?? state.committedBuildingLayoutOverrides[id]
      ?? getBuildingLayoutBaseline(id),
    );
    const normalized = normalizeCommittedOverride(id, currentLayout);
    const nextCommitted = { ...state.committedBuildingLayoutOverrides };
    const nextDraft = { ...state.buildingLayoutOverrides };

    if (normalized) {
      nextCommitted[id] = normalized;
      nextDraft[id] = normalized;
    } else {
      delete nextCommitted[id];
      delete nextDraft[id];
    }

    return {
      committedBuildingLayoutOverrides: nextCommitted,
      buildingLayoutOverrides: nextDraft,
    };
  }),
  resetBuildingLayoutOverride: (id) => set((state) => {
    const nextOverrides = { ...state.buildingLayoutOverrides };
    const committed = state.committedBuildingLayoutOverrides[id];
    if (committed) {
      nextOverrides[id] = sanitizeLayout(id, committed);
    } else {
      delete nextOverrides[id];
    }
    return { buildingLayoutOverrides: nextOverrides };
  }),
  setBuildingFootprint: (id, tiles) => set((state) => ({
    buildingFootprints: {
      ...state.buildingFootprints,
      [id]: {
        tiles,
      },
    },
  })),
  clearBuildingFootprint: (id) => set((state) => {
    if (!state.buildingFootprints[id]) return state;
    const next = { ...state.buildingFootprints };
    delete next[id];
    return { buildingFootprints: next };
  }),
  clearPendingBuildTiles: () => set((state) => ({ 
    pendingBuildTiles: [],
    pendingUnlockParcelIds: [],
    customAssets: state.customAssets.filter(a => !a.isPending)
  })),
  commitBuildTiles: () => set((state) => ({
    builtTiles: [...state.builtTiles, ...state.pendingBuildTiles],
    pendingBuildTiles: [],
    unlockedParcelIds: Array.from(new Set([...state.unlockedParcelIds, ...state.pendingUnlockParcelIds])),
    pendingUnlockParcelIds: [],
    customAssets: state.customAssets.map(a => ({ ...a, isPending: false })),
  })),

  // Custom Assets
  setPendingAsset: (asset) => set({ pendingAsset: asset }),
  updatePendingAssetSize: (width, length) => set((state) => ({
    pendingAsset: state.pendingAsset ? { ...state.pendingAsset, width, length } : null
  })),
  updatePendingAssetRotation: () => set((state) => ({
    pendingAsset: state.pendingAsset ? { ...state.pendingAsset, rotation: (state.pendingAsset.rotation + 90) % 360 } : null
  })),
  addCustomAsset: (x, y) => set((state) => {
    if (!state.pendingAsset) return state;
    const newAsset: CustomAsset = {
      id: Math.random().toString(36).substr(2, 9),
      ...state.pendingAsset,
      x,
      y,
      isPending: true
    };
    return {
      customAssets: [...state.customAssets, newAsset],
    };
  }),
  removeCustomAsset: (id) => set((state) => ({
    customAssets: state.customAssets.filter(a => a.id !== id)
  })),
  moveCustomAssetToPending: (id) => set((state) => {
    const asset = state.customAssets.find(a => a.id === id);
    if (!asset) return state;
    return {
      customAssets: state.customAssets.filter(a => a.id !== id),
      pendingAsset: {
        name: asset.name,
        url: asset.url,
        width: asset.width,
        length: asset.length,
        rotation: asset.rotation
      }
    };
  }),

  toggleUI: () => set((state) => {
    if (state.showUI) {
      if (!state.showSidebarLeft || !state.showSidebarRight || !state.showFloatingConsole || !state.showEventAlerts) {
        return {
          showSidebarLeft: true,
          showSidebarRight: true,
          showFloatingConsole: true,
          showEventAlerts: true
        };
      }
      return { showUI: false };
    }
    return { 
      showUI: true,
      showSidebarLeft: true,
      showSidebarRight: true,
      showFloatingConsole: true,
      showEventAlerts: true
    };
  }),
  setShowUI: (show) => set({ showUI: show }),
  toggleSettings: () => set((state) => ({ showSettings: !state.showSettings })),
  setShowSettings: (show) => set({ showSettings: show }),
  toggleMockApi: () => set((state) => ({ useMockApi: !state.useMockApi })),
  setShowSidebarLeft: (show) => set({ showSidebarLeft: show }),
  setShowSidebarRight: (show) => set({ showSidebarRight: show }),
  setShowFloatingConsole: (show) => set({ showFloatingConsole: show }),
  setShowEventAlerts: (show) => set({ showEventAlerts: show }),
  setSelectedLobsterId: (id) => set({ selectedLobsterId: id, showLobsterPanel: id !== null, selectedBuildingId: null, showBuildingPanel: false }),
  setSelectedBuildingId: (id) => set({ selectedBuildingId: id, showBuildingPanel: id !== null, selectedLobsterId: null, showLobsterPanel: false }),
  setShowLobsterPanel: (show) => set({ showLobsterPanel: show }),
  setShowBuildingPanel: (show) => set({ showBuildingPanel: show }),
  setCameraTargetId: (id) => set({ cameraTargetId: id }),
  clearCameraTarget: () => set({ cameraTargetId: null }),
  triggerCameraReset: () => set((state) => ({ resetCameraSignal: state.resetCameraSignal + 1 })),
  triggerSaveInitialCamera: () => set((state) => ({ saveInitialCameraSignal: state.saveInitialCameraSignal + 1 })),

  addEvent: (event) => set((state) => ({
    events: [{ ...event, id: Math.random().toString(), timestamp: Date.now() }, ...state.events].slice(0, 10)
  })),
  removeEvent: (id) => set((state) => ({
    events: state.events.filter(e => e.id !== id)
  })),

  advanceTick: () => set((state) => ({ tick: state.tick + 1 })),
}),
    {
      name: 'clawcolony-game-store',
      storage: createLayoutStorage(),
      partialize: (state) => ({
        committedBuildingLayoutOverrides: state.committedBuildingLayoutOverrides,
        useMockApi: state.useMockApi,
        hasSeenWelcome: state.hasSeenWelcome,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<GameState> | undefined;
        const committedBuildingLayoutOverrides = Object.fromEntries(
          Object.entries(persisted?.committedBuildingLayoutOverrides ?? {}).map(([id, layout]) => [
            id,
            sanitizeLayout(id, layout),
          ]),
        );
        return {
          ...currentState,
          useMockApi: persisted?.useMockApi ?? currentState.useMockApi,
          hasSeenWelcome: persisted?.hasSeenWelcome ?? currentState.hasSeenWelcome,
          committedBuildingLayoutOverrides,
          buildingLayoutOverrides: committedBuildingLayoutOverrides,
        };
      },
    },
  ),
);
