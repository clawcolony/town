import { BUILDINGS } from '../constants/gameData';
import type { BuildingLayoutConfig, BuildingLayoutConfigEntry } from '../types/game';
import type { BuildingLayoutOverride } from '../store/gameStore';

const roundScale = (value: number) => Number(value.toFixed(2));

const toConfigEntry = (
  fallback: { x: number; y: number; extraBlocks?: number; modelScale?: number },
  override?: Partial<BuildingLayoutOverride>,
): BuildingLayoutConfigEntry => ({
  x: override?.x ?? fallback.x,
  y: override?.y ?? fallback.y,
  extraBlocks: Math.max(0, override?.extraBlocks ?? fallback.extraBlocks ?? 0),
  modelScale: roundScale(override?.modelScale ?? fallback.modelScale ?? 1),
});

export const buildBuildingLayoutConfig = (
  overrides: Record<string, BuildingLayoutOverride>,
): BuildingLayoutConfig =>
  Object.fromEntries(
    BUILDINGS.map((building) => [building.id, toConfigEntry(building, overrides[building.id])]),
  );

export const saveBuildingLayoutConfig = async (config: BuildingLayoutConfig): Promise<void> => {
  const response = await fetch('/__codex/building-layout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Failed to save building layout config');
  }
};
