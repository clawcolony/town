import { LucideIcon } from 'lucide-react';

export interface BuildingData {
  id: string;
  x: number;
  y: number;
  extraBlocks?: number;
  title: string;
  subtitle: string;
  label: string;
  icon: LucideIcon;
  textColor: string;
  borderColor: string;
  bgColor: string;
  shadowColor: string;
  threeColor: string;
  modelFile?: string;
  modelScale?: number;
  modelRotationY?: number;
  modelYOffset?: number;
}

export interface BuildingLayoutConfigEntry {
  x: number;
  y: number;
  extraBlocks: number;
  modelScale: number;
}

export type BuildingLayoutConfig = Record<string, BuildingLayoutConfigEntry>;

export interface CameraVector3Config {
  x: number;
  y: number;
  z: number;
}

export interface CameraConfigEntry {
  position: CameraVector3Config;
  target: CameraVector3Config;
  fov: number;
}

export interface LobsterData {
  id: number;
  x: number;
  y: number;
  name: string;
  status: string;
  lifeState?: string;
  token: number;
  initial_token: number;
  job: string;
  xp: number;
  ganglia: string[];
  memory: string;
  isConsumed?: boolean;
  hibernationDeadlineAt?: string;
  minRevivalBalance?: number;
}

export interface GameEvent {
  id: string;
  type: 'death' | 'exile' | 'bounty' | 'system';
  message: string;
  messageZh?: string;
  timestamp: number;
}

export interface SystemLog {
  id: string;
  kind?: 'chronicle' | 'repo';
  source: string;
  timestamp: string;
  timestampZh?: string;
  sortAt?: number;
  content: string;
  contentZh?: string;
  colorClass: string;
}

export interface PublicComm {
  id: string;
  sender: string;
  avatarClass: string;
  timestamp: string;
  timestampZh?: string;
  content: string;
  contentZh?: string;
}

export type GridElevations = number[][];
