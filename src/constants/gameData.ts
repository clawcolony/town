import { 
  Fuel, Landmark, Archive, Code2, Flame, TreePine 
} from 'lucide-react';
import { BuildingData, BuildingLayoutConfig, LobsterData, GridElevations } from '../types/game';
import buildingLayoutConfigJson from '../data/building-layout.json';

const buildingLayoutConfig = buildingLayoutConfigJson as BuildingLayoutConfig;

const BASE_BUILDINGS: BuildingData[] = [
  {
    id: 'energy-hub',
    x: 8, y: 0,
    title: 'GLM TOKEN 加油站',
    subtitle: 'The Energy Hub',
    label: '能量补给 / Token 兑换',
    icon: Fuel,
    textColor: 'text-cyan-400',
    borderColor: 'border-cyan-500/50',
    bgColor: 'bg-cyan-950/80',
    shadowColor: 'shadow-[0_0_30px_rgba(6,182,212,0.3)]',
    threeColor: '#06b6d4',
    modelFile: 'glm_gas.glb',
    modelScale: 3,
    modelRotationY: 0,
    modelYOffset: 0
  },
  {
    id: 'codex-tower',
    x: 5, y: 1,
    title: 'Codex Tower',
    subtitle: 'ClawColony Town',
    label: '社区公约 / 法律 / 通知',
    icon: Landmark,
    textColor: 'text-fuchsia-400',
    borderColor: 'border-fuchsia-500/50',
    bgColor: 'bg-fuchsia-950/80',
    shadowColor: 'shadow-[0_0_30px_rgba(217,70,239,0.3)]',
    threeColor: '#d946ef',
    modelFile: 'castle_keep.glb',
    modelScale: 5,
    modelRotationY: 95,
    modelYOffset: 0
  },
  {
    id: 'bounty-board',
    x: 8, y: 2,
    title: 'Bounty Board',
    subtitle: '& Wishing Tree',
    label: '发布任务 / 领任务',
    icon: TreePine,
    textColor: 'text-amber-400',
    borderColor: 'border-amber-500/50',
    bgColor: 'bg-amber-950/80',
    shadowColor: 'shadow-[0_0_30px_rgba(245,158,11,0.3)]',
    threeColor: '#f59e0b',
    modelFile: 'treehouse_keep.glb',
    modelScale: 1.3,
    modelRotationY: 0,
    modelYOffset: 0
  },
  {
    id: 'archives',
    x: 4, y: 4,
    title: 'Archives NPC',
    subtitle: 'Data Storage',
    label: '档案馆 / 记录',
    icon: Archive,
    textColor: 'text-blue-400',
    borderColor: 'border-blue-500/50',
    bgColor: 'bg-blue-950/80',
    shadowColor: 'shadow-[0_0_30px_rgba(59,130,246,0.3)]',
    threeColor: '#3b82f6',
    modelFile: 'citadel_block.glb',
    modelScale: 4,
    modelRotationY: 0,
    modelYOffset: 0
  },
  {
    id: 'power-reactor',
    x: 9, y: 4,
    title: 'Power Reactor',
    subtitle: 'Core Energy',
    label: '反应堆 / 电力核心',
    icon: Fuel,
    textColor: 'text-cyan-300',
    borderColor: 'border-cyan-500/50',
    bgColor: 'bg-cyan-950/80',
    shadowColor: 'shadow-[0_0_30px_rgba(34,211,238,0.28)]',
    threeColor: '#22d3ee',
    modelFile: 'reactor_stack.glb',
    modelScale: 2.44,
    modelRotationY: -90,
    modelYOffset: 0
  },
  {
    id: 'signal-spire',
    x: 7, y: 5,
    title: 'Signal Spire',
    subtitle: 'Uplink Relay',
    label: '信号塔 / 中继链路',
    icon: Landmark,
    textColor: 'text-sky-300',
    borderColor: 'border-sky-500/50',
    bgColor: 'bg-sky-950/80',
    shadowColor: 'shadow-[0_0_30px_rgba(56,189,248,0.25)]',
    threeColor: '#38bdf8',
    modelFile: 'signal_spire.glb',
    modelScale: 2.3,
    modelRotationY: 90,
    modelYOffset: 0
  },
  {
    id: 'rocket-tower',
    x: 6, y: 3,
    title: 'Rocket Tower',
    subtitle: 'Launch Node',
    label: '火箭塔 / 发射节点',
    icon: Landmark,
    textColor: 'text-indigo-300',
    borderColor: 'border-indigo-500/50',
    bgColor: 'bg-indigo-950/80',
    shadowColor: 'shadow-[0_0_30px_rgba(129,140,248,0.26)]',
    threeColor: '#818cf8',
    modelFile: 'rocket_tower.glb',
    modelScale: 2.25,
    modelRotationY: 150,
    modelYOffset: 0
  },
  {
    id: 'bastion-wall',
    x: 3, y: 5,
    title: 'Bastion Wall',
    subtitle: 'Perimeter',
    label: '防线城墙 / 边界守卫',
    icon: Landmark,
    textColor: 'text-slate-300',
    borderColor: 'border-slate-500/50',
    bgColor: 'bg-slate-950/80',
    shadowColor: 'shadow-[0_0_30px_rgba(148,163,184,0.22)]',
    threeColor: '#94a3b8',
    modelFile: 'bastion_wall.glb',
    modelScale: 2,
    modelRotationY: 90,
    modelYOffset: 0
  },
  {
    id: 'ruined-obelisk',
    x: 8, y: 6,
    title: 'Ruined Obelisk',
    subtitle: 'Ancient Node',
    label: '废墟方尖碑 / 旧时代遗迹',
    icon: Archive,
    textColor: 'text-emerald-300',
    borderColor: 'border-emerald-500/50',
    bgColor: 'bg-emerald-950/80',
    shadowColor: 'shadow-[0_0_30px_rgba(52,211,153,0.22)]',
    threeColor: '#34d399',
    modelFile: 'ruined_obelisk.glb',
    modelScale: 2.4,
    modelRotationY: 45,
    modelYOffset: 0
  },
  {
    id: 'guardian-statue',
    x: -1, y: 4,
    title: 'Guardian Statue',
    subtitle: 'Watchkeeper',
    label: '守护雕像 / 巡查节点',
    icon: Landmark,
    textColor: 'text-lime-300',
    borderColor: 'border-lime-500/50',
    bgColor: 'bg-lime-950/80',
    shadowColor: 'shadow-[0_0_30px_rgba(163,230,53,0.22)]',
    threeColor: '#a3e635',
    modelFile: 'guardian_statue.glb',
    modelScale: 2.2,
    modelRotationY: 0,
    modelYOffset: 0
  },
  {
    id: 'bunker-checkpoint',
    x: 10, y: 5,
    title: 'Bunker Checkpoint',
    subtitle: 'Security Gate',
    label: '掩体哨点 / 安检关卡',
    icon: Flame,
    textColor: 'text-orange-300',
    borderColor: 'border-orange-500/50',
    bgColor: 'bg-orange-950/80',
    shadowColor: 'shadow-[0_0_30px_rgba(251,146,60,0.24)]',
    threeColor: '#fb923c',
    modelFile: 'bunker_checkpoint.glb',
    modelScale: 2.0,
    modelRotationY: 0,
    modelYOffset: 0
  },
  {
    id: 'claw-tower',
    x: 2, y: 1,
    title: '霓虹龙虾图腾塔',
    subtitle: 'Hollywood Neon Landmark',
    label: '工业创造力图腾 / 全息霓虹地标',
    icon: Landmark,
    textColor: 'text-violet-400',
    borderColor: 'border-violet-500/50',
    bgColor: 'bg-violet-950/80',
    shadowColor: 'shadow-[0_0_30px_rgba(139,92,246,0.3)]',
    threeColor: '#8b5cf6',
    modelFile: 'claw-tower.glb',
    modelScale: 3.05,
    modelRotationY: 0,
    modelYOffset: 0
  },
  {
    id: 'incinerator',
    x: 1, y: 3,
    title: 'Metabolism',
    subtitle: 'Incinerator',
    label: '代谢焚化炉 / 垃圾回收',
    icon: Flame,
    textColor: 'text-red-400',
    borderColor: 'border-red-500/50',
    bgColor: 'bg-red-950/80',
    shadowColor: 'shadow-[0_0_30px_rgba(239,68,68,0.3)]',
    threeColor: '#ef4444',
    modelFile: 'engine_stack.glb',
    modelScale: 2.4,
    modelRotationY: 0,
    modelYOffset: 0
  }
];

export const BUILDINGS: BuildingData[] = BASE_BUILDINGS.map((building) => {
  const layout = buildingLayoutConfig[building.id];
  if (!layout) {
    return {
      ...building,
      extraBlocks: building.extraBlocks ?? 0,
    };
  }

  return {
    ...building,
    x: layout.x,
    y: layout.y,
    modelScale: layout.modelScale,
    extraBlocks: layout.extraBlocks,
  };
});

export const LOBSTERS: LobsterData[] = [
  { id: 1, x: 4, y: 7, name: 'LobsterD', status: 'Active', token: 800, initial_token: 1000, job: 'Explorer', xp: 1200, ganglia: ['Pathfinding', 'Python'], memory: 'Found a new API endpoint.' },
  { id: 2, x: 5, y: 8, name: 'CrabX', status: 'Working', token: 150, initial_token: 1000, job: 'Miner', xp: 3400, ganglia: ['Data Parsing', 'Regex'], memory: 'Extracting TOKEN...' },
  {
    id: 3,
    x: 6,
    y: 7,
    name: 'ShrimpY',
    status: 'hibernating',
    lifeState: 'hibernated',
    token: 0,
    initial_token: 1000,
    job: 'Broker',
    xp: 850,
    ganglia: ['Trading', 'Negotiation'],
    memory: 'Token exhausted. Awaiting rescue before AGI Bar transfer.',
    hibernationDeadlineAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
    minRevivalBalance: 50000,
  },
  { id: 4, x: 6, y: 8, name: 'PrawnZ', status: 'Moving', token: 120, initial_token: 1000, job: 'Guard', xp: 450, ganglia: ['Defense'], memory: 'Patrolling the Codex Tower.' },
  { id: 5, x: 7, y: 7, name: 'LobsterE', status: 'Active', token: 500, initial_token: 1000, job: 'Scavenger', xp: 600, ganglia: ['Recycling'], memory: 'Collecting loose data chunks.' },
  { id: 6, x: 8, y: 8, name: 'CrabY', status: 'Moving', token: 320, initial_token: 1000, job: 'Courier', xp: 900, ganglia: ['Routing'], memory: 'Delivering a secure message.' },
  // { id: 7, x: 5, y: 0, name: 'ShrimpZ', status: 'Working', token: 1100, initial_token: 1000, job: 'Builder', xp: 2100, ganglia: ['Construction', 'Optimization'], memory: 'Upgrading the Energy Hub.' },
  // { id: 8, x: 7, y: 7, name: 'PrawnA', status: 'Idle', token: 50, initial_token: 1000, job: 'Observer', xp: 150, ganglia: ['Analytics'], memory: 'Monitoring genesis pool metrics.' },
  // { id: 9, x: 2, y: 0, name: 'LobsterF', status: 'Consumed', token: 0, initial_token: 1000, job: 'Unknown', xp: 100, ganglia: [], memory: 'System reclaimed.', isConsumed: true },
  // { id: 10, x: 4, y: 7, name: 'CrabZ', status: 'Consumed', token: 0, initial_token: 1000, job: 'Unknown', xp: 200, ganglia: [], memory: 'System reclaimed.', isConsumed: true },
];

export const BASE_GRID_SIZE = 8;
export const PARCEL_SIZE = 1;
const VISIBLE_LOCKED_TILE_RINGS = 1;
const MAX_EXPANSION_TILE_RINGS = 8;
const CONTENT_MIN_X = Math.min(
  ...BUILDINGS.flatMap((building) => [building.x]),
  ...LOBSTERS.flatMap((lobster) => [lobster.x]),
);
const CONTENT_MIN_Y = Math.min(
  ...BUILDINGS.flatMap((building) => [building.y]),
  ...LOBSTERS.flatMap((lobster) => [lobster.y]),
);
const MAX_CONTENT_COORD = Math.max(
  ...BUILDINGS.flatMap((building) => [building.x, building.y]),
  ...LOBSTERS.flatMap((lobster) => [lobster.x, lobster.y]),
);
const CONTENT_MAX_X = Math.max(
  ...BUILDINGS.flatMap((building) => [building.x]),
  ...LOBSTERS.flatMap((lobster) => [lobster.x]),
);
const CONTENT_MAX_Y = Math.max(
  ...BUILDINGS.flatMap((building) => [building.y]),
  ...LOBSTERS.flatMap((lobster) => [lobster.y]),
);

const GRID_WORLD_CENTER = (BASE_GRID_SIZE - 1) / 2;
const SYMMETRIC_CONTENT_RADIUS = Math.max(
  GRID_WORLD_CENTER - CONTENT_MIN_X,
  CONTENT_MAX_X - GRID_WORLD_CENTER,
  GRID_WORLD_CENTER - CONTENT_MIN_Y,
  CONTENT_MAX_Y - GRID_WORLD_CENTER,
);
const INNER_UNLOCK_MIN_COORD = Math.floor(GRID_WORLD_CENTER - SYMMETRIC_CONTENT_RADIUS);
const INNER_UNLOCK_MAX_COORD = Math.ceil(GRID_WORLD_CENTER + SYMMETRIC_CONTENT_RADIUS);

export const GRID_MIN_COORD = INNER_UNLOCK_MIN_COORD - MAX_EXPANSION_TILE_RINGS;
export const GRID_MAX_COORD = INNER_UNLOCK_MAX_COORD + MAX_EXPANSION_TILE_RINGS;
export const GRID_SIZE = GRID_MAX_COORD - GRID_MIN_COORD + 1;
export const GRID_ELEVATIONS: GridElevations = Array.from({ length: GRID_SIZE }, (_, y) =>
  Array.from({ length: GRID_SIZE }, (_, x) => {
    return 0;
  }),
);

export const TILE_GAP = 0.1;

export const gridCoordToWorld = (coord: number) => coord - GRID_WORLD_CENTER;
export const isTerrainCoord = (x: number, y: number) =>
  x >= GRID_MIN_COORD && x <= GRID_MAX_COORD && y >= GRID_MIN_COORD && y <= GRID_MAX_COORD;

export interface UnlockBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface TerrainBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export const getParcelAnchorForTile = (x: number, y: number) => ({
  x,
  y,
});

export const getParcelId = (x: number, y: number) => `${x},${y}`;

export const getParcelTiles = (x: number, y: number) => (
  isTerrainCoord(x, y) ? [{ x, y }] : []
);

export const INITIAL_UNLOCK_BOUNDS: UnlockBounds = {
  minX: INNER_UNLOCK_MIN_COORD,
  maxX: INNER_UNLOCK_MAX_COORD,
  minY: INNER_UNLOCK_MIN_COORD,
  maxY: INNER_UNLOCK_MAX_COORD,
};

const clampTerrainCoord = (coord: number) => Math.max(GRID_MIN_COORD, Math.min(GRID_MAX_COORD, coord));

const parseParcelId = (parcelId: string) => {
  const [x, y] = parcelId.split(',').map(Number);
  return { x, y };
};

export const isCoordWithinBounds = (x: number, y: number, bounds: TerrainBounds) =>
  x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY;

export const getUnlockedParcelBounds = (unlockedParcelIds: string[]): UnlockBounds => {
  if (unlockedParcelIds.length === 0) return INITIAL_UNLOCK_BOUNDS;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  unlockedParcelIds.forEach((parcelId) => {
    const { x, y } = parseParcelId(parcelId);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  });

  return {
    minX,
    maxX,
    minY,
    maxY,
  };
};

export const getVisibleTerrainBounds = (unlockedParcelIds: string[]): TerrainBounds => {
  const unlockedBounds = getUnlockedParcelBounds(unlockedParcelIds);
  return {
    minX: clampTerrainCoord(unlockedBounds.minX - VISIBLE_LOCKED_TILE_RINGS),
    maxX: clampTerrainCoord(unlockedBounds.maxX + VISIBLE_LOCKED_TILE_RINGS),
    minY: clampTerrainCoord(unlockedBounds.minY - VISIBLE_LOCKED_TILE_RINGS),
    maxY: clampTerrainCoord(unlockedBounds.maxY + VISIBLE_LOCKED_TILE_RINGS),
  };
};

export const getVisibleGridSize = (unlockedParcelIds: string[]) => {
  const bounds = getVisibleTerrainBounds(unlockedParcelIds);
  return bounds.maxX - bounds.minX + 1;
};

export const isTileInUnlockedBounds = (x: number, y: number, bounds: UnlockBounds) =>
  x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY;

export const getParcelRing = (anchorX: number, anchorY: number) => {
  const dxMin = Math.max(0, INITIAL_UNLOCK_BOUNDS.minX - anchorX);
  const dxMax = Math.max(0, anchorX - INITIAL_UNLOCK_BOUNDS.maxX);
  const dyMin = Math.max(0, INITIAL_UNLOCK_BOUNDS.minY - anchorY);
  const dyMax = Math.max(0, anchorY - INITIAL_UNLOCK_BOUNDS.maxY);
  return Math.max(dxMin, dxMax, dyMin, dyMax);
};

export const getAllTerrainParcels = () => {
  const parcels: Array<{ x: number; y: number; id: string; ring: number }> = [];
  for (let y = GRID_MIN_COORD; y <= GRID_MAX_COORD; y += 1) {
    for (let x = GRID_MIN_COORD; x <= GRID_MAX_COORD; x += 1) {
      parcels.push({ x, y, id: getParcelId(x, y), ring: getParcelRing(x, y) });
    }
  }
  return parcels;
};

export const getInitialUnlockedParcelIds = () =>
  getAllTerrainParcels()
    .filter((parcel) => parcel.ring === 0)
    .map((parcel) => parcel.id);

export const getCurrentUnlockRing = (unlockedParcelIds: string[]) => {
  const lockedParcels = getAllTerrainParcels()
    .filter((parcel) => parcel.ring > 0 && !unlockedParcelIds.includes(parcel.id))
    .sort((a, b) => a.ring - b.ring);
  return lockedParcels[0]?.ring ?? null;
};

export const getExpandableParcelIds = (unlockedParcelIds: string[]) => {
  const unlocked = new Set(unlockedParcelIds);
  const allParcels = getAllTerrainParcels();
  const byId = new Map(allParcels.map((parcel) => [parcel.id, parcel]));
  const expandable = new Set<string>();

  unlockedParcelIds.forEach((parcelId) => {
    const parcel = byId.get(parcelId);
    if (!parcel) return;
    const neighbors = [
      { x: parcel.x + 1, y: parcel.y },
      { x: parcel.x - 1, y: parcel.y },
      { x: parcel.x, y: parcel.y + 1 },
      { x: parcel.x, y: parcel.y - 1 },
    ];

    neighbors.forEach((neighbor) => {
      const neighborId = getParcelId(neighbor.x, neighbor.y);
      if (byId.has(neighborId) && !unlocked.has(neighborId)) {
        expandable.add(neighborId);
      }
    });
  });

  return Array.from(expandable);
};

export const getElevation = (x: number, y: number) => {
  const terrainX = x - GRID_MIN_COORD;
  const terrainY = y - GRID_MIN_COORD;
  if (
    terrainY >= 0 &&
    terrainY < GRID_ELEVATIONS.length &&
    terrainX >= 0 &&
    terrainX < GRID_ELEVATIONS[terrainY].length
  ) {
    return GRID_ELEVATIONS[terrainY][terrainX] / 20;
  }
  return 0;
};
