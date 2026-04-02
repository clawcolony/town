import React, { useRef, useEffect } from 'react';
import { OrbitControls, OrthographicCamera } from '@react-three/drei';
import { GridSystem } from './GridSystem';
import { Building } from './Building';
import { Lobster } from './Lobster';
import { CustomAssetModel } from './CustomAssetModel';
import { CanvasBillboardTag } from './CanvasBillboardTag';
import { BUILDINGS, LOBSTERS, getElevation, getParcelId, getVisibleTerrainBounds, TILE_GAP, gridCoordToWorld } from '../../constants/gameData';
import { useGameStore } from '../../store/gameStore';
import { useI18nStore } from '../../store/i18nStore';
import {
  DEFAULT_CAMERA_CONFIG,
  loadCameraConfig,
  normalizeCameraConfig,
  readCachedCameraConfig,
  saveCameraConfig,
} from '../../services/cameraConfig';
import type { CameraConfigEntry } from '../../types/game';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import { RuntimeClient, RuntimePhase1Service, getRuntimeBaseUrl } from '../../services/runtimeAdapter';
import { toast } from 'sonner';

const INITIAL_FULL_DETAIL_LOBSTERS = 18;
const FULL_DETAIL_BATCH_SIZE = 12;
const FULL_DETAIL_BATCH_INTERVAL_MS = 140;
const MAX_FULL_DETAIL_LOBSTERS = 72;

interface BlockRegion {
  id: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  worldX: number;
  worldZ: number;
  kind: 'core' | 'construction';
}

export function Scene() {
  const lobsters = useGameStore(state => state.lobsters);
  const updateLobsters = useGameStore(state => state.updateLobsters);
  const setSelectedLobsterId = useGameStore(state => state.setSelectedLobsterId);
  const buildingLayoutOverrides = useGameStore(state => state.buildingLayoutOverrides);
  const buildingFootprints = useGameStore(state => state.buildingFootprints);
  const builtTiles = useGameStore(state => state.builtTiles);
  const unlockedParcelIds = useGameStore(state => state.unlockedParcelIds);
  const cameraTargetId = useGameStore(state => state.cameraTargetId);
  const clearCameraTarget = useGameStore(state => state.clearCameraTarget);
  const resetCameraSignal = useGameStore(state => state.resetCameraSignal);
  const saveInitialCameraSignal = useGameStore(state => state.saveInitialCameraSignal);
  const triggerCameraReset = useGameStore(state => state.triggerCameraReset);
  const customAssets = useGameStore(state => state.customAssets);
  const moveCustomAssetToPending = useGameStore(state => state.moveCustomAssetToPending);
  const setHoverBlockInfo = useGameStore(state => state.setHoverBlockInfo);
  const language = useI18nStore(state => state.language);
  const unlockedParcelIdSet = React.useMemo(() => new Set(unlockedParcelIds), [unlockedParcelIds]);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const lobsterIdMapRef = useRef<Map<string, number>>(new Map());
  const lobsterPosMapRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const lastCameraLogAtRef = useRef<number>(0);
  const [cameraPreset, setCameraPreset] = React.useState<CameraConfigEntry>(() => readCachedCameraConfig() ?? DEFAULT_CAMERA_CONFIG);
  const [hoveredTile, setHoveredTile] = React.useState<{ x: number; y: number } | null>(null);
  const [fullDetailLobsterCount, setFullDetailLobsterCount] = React.useState(() =>
    Math.min(INITIAL_FULL_DETAIL_LOBSTERS, MAX_FULL_DETAIL_LOBSTERS),
  );
  const buildings = React.useMemo(
    () =>
      BUILDINGS.map((building) => {
        const override = buildingLayoutOverrides[building.id];
        if (!override) return { ...building, extraBlocks: 0 };
        return {
          ...building,
          x: override.x,
          y: override.y,
          extraBlocks: override.extraBlocks,
          modelScale: override.modelScale,
        };
      }),
    [buildingLayoutOverrides],
  );
  const visibleTerrainBounds = React.useMemo(() => getVisibleTerrainBounds(unlockedParcelIds), [unlockedParcelIds]);
  const visibleGridWidth = visibleTerrainBounds.maxX - visibleTerrainBounds.minX + 1;
  const visibleGridHeight = visibleTerrainBounds.maxY - visibleTerrainBounds.minY + 1;
  const terrainCenterLocalX = React.useMemo(
    () => (gridCoordToWorld(visibleTerrainBounds.minX) + gridCoordToWorld(visibleTerrainBounds.maxX)) / 2,
    [visibleTerrainBounds.maxX, visibleTerrainBounds.minX],
  );
  const terrainCenterLocalZ = React.useMemo(
    () => (gridCoordToWorld(visibleTerrainBounds.minY) + gridCoordToWorld(visibleTerrainBounds.maxY)) / 2,
    [visibleTerrainBounds.maxY, visibleTerrainBounds.minY],
  );
  const sceneSpan = Math.max(visibleGridWidth, visibleGridHeight) * (1 + TILE_GAP);
  const fallbackCameraPreset = React.useMemo<CameraConfigEntry>(
    () => ({
      position: {
        x: sceneSpan * 1.22,
        y: Math.max(9, sceneSpan * 0.95),
        z: -sceneSpan * 1.18,
      },
      target: { x: 0, y: 0.12, z: 0 },
      fov: 24,
    }),
    [sceneSpan],
  );
  const activeCameraPreset = React.useMemo<CameraConfigEntry>(() => {
    const preset = cameraPreset ?? fallbackCameraPreset;
    return normalizeCameraConfig({
      position: {
        x: preset.position.x,
        y: Math.max(7, preset.position.y),
        z: preset.position.z,
      },
      target: {
        x: preset.target.x,
        y: 0.12,
        z: preset.target.z,
      },
      fov: THREE.MathUtils.clamp(preset.fov * 2.1, 38, 60),
    });
  }, [cameraPreset, fallbackCameraPreset]);
  const initialCameraPosition = React.useMemo<[number, number, number]>(
    () => [activeCameraPreset.position.x, activeCameraPreset.position.y, activeCameraPreset.position.z],
    [activeCameraPreset],
  );
  const initialCameraTarget = React.useMemo<[number, number, number]>(
    () => [activeCameraPreset.target.x, activeCameraPreset.target.y, activeCameraPreset.target.z],
    [activeCameraPreset],
  );
  const initialCameraZoom = activeCameraPreset.fov;
  const subPlotTileCount = 8;
  const subPlotTileOffsets = React.useMemo(
    () =>
      Array.from({ length: subPlotTileCount * subPlotTileCount }, (_, index) => {
        const row = Math.floor(index / subPlotTileCount);
        const col = index % subPlotTileCount;
        return {
          row,
          col,
          xOffset: col - (subPlotTileCount - 1) / 2,
          zOffset: row - (subPlotTileCount - 1) / 2,
        };
      }),
    [subPlotTileCount],
  );
  const coreBlocks = React.useMemo<BlockRegion[]>(
    () => {
      const coreMinX = visibleTerrainBounds.minX;
      const coreMinY = visibleTerrainBounds.minY;
      const coreWestMinX = coreMinX;
      const coreEastMinX = coreMinX + subPlotTileCount;
      const coreSouthMinY = coreMinY;
      const coreNorthMinY = coreMinY + subPlotTileCount;
      const buildCoreBlock = (id: string, minX: number, minY: number): BlockRegion => ({
        id,
        minX,
        maxX: minX + subPlotTileCount - 1,
        minY,
        maxY: minY + subPlotTileCount - 1,
        worldX: gridCoordToWorld(minX + (subPlotTileCount - 1) / 2),
        worldZ: gridCoordToWorld(minY + (subPlotTileCount - 1) / 2),
        kind: 'core',
      });
      return [
        buildCoreBlock('core-sw', coreWestMinX, coreSouthMinY),
        buildCoreBlock('core-se', coreEastMinX, coreSouthMinY),
        buildCoreBlock('core-nw', coreWestMinX, coreNorthMinY),
        buildCoreBlock('core-ne', coreEastMinX, coreNorthMinY),
      ];
    },
    [subPlotTileCount, visibleTerrainBounds.minX, visibleTerrainBounds.minY],
  );
  const underConstructionPlots = React.useMemo<BlockRegion[]>(
    () => {
      const coreMinX = visibleTerrainBounds.minX;
      const coreMinY = visibleTerrainBounds.minY;
      const blocks: BlockRegion[] = [];
      for (let blockRow = -1; blockRow <= 2; blockRow += 1) {
        for (let blockCol = -1; blockCol <= 2; blockCol += 1) {
          const isCoreCol = blockCol >= 0 && blockCol <= 1;
          const isCoreRow = blockRow >= 0 && blockRow <= 1;
          if (isCoreCol && isCoreRow) continue;

          const minX = coreMinX + blockCol * subPlotTileCount;
          const minY = coreMinY + blockRow * subPlotTileCount;
          blocks.push({
            id: `uc-r${blockRow + 2}-c${blockCol + 2}`,
            minX,
            maxX: minX + subPlotTileCount - 1,
            minY,
            maxY: minY + subPlotTileCount - 1,
            worldX: gridCoordToWorld(minX + (subPlotTileCount - 1) / 2),
            worldZ: gridCoordToWorld(minY + (subPlotTileCount - 1) / 2),
            kind: 'construction',
          });
        }
      }
      return blocks;
    },
    [subPlotTileCount, visibleTerrainBounds.minX, visibleTerrainBounds.minY],
  );
  const numberedBlocks = React.useMemo(
    () =>
      [...coreBlocks, ...underConstructionPlots].map((block, index) => ({
        ...block,
        label: `B${String(index + 1).padStart(2, '0')}`,
      })),
    [coreBlocks, underConstructionPlots],
  );
  const currentHoverInfo = React.useMemo(() => {
    if (!hoveredTile) return null;
    const block = numberedBlocks.find(
      (item) =>
        hoveredTile.x >= item.minX &&
        hoveredTile.x <= item.maxX &&
        hoveredTile.y >= item.minY &&
        hoveredTile.y <= item.maxY,
    );
    if (!block) return null;
    const localCol = hoveredTile.x - block.minX;
    const localRow = hoveredTile.y - block.minY;
    const tileNo = localRow * subPlotTileCount + localCol + 1;
    if (tileNo < 1 || tileNo > subPlotTileCount * subPlotTileCount) return null;
    return {
      blockLabel: block.label,
      tileNo,
      x: hoveredTile.x,
      y: hoveredTile.y,
    };
  }, [hoveredTile, numberedBlocks, subPlotTileCount]);
  useEffect(() => {
    setHoverBlockInfo(currentHoverInfo);
    return () => {
      setHoverBlockInfo(null);
    };
  }, [currentHoverInfo, setHoverBlockInfo]);
  const lobsterBlockedTileSet = React.useMemo(() => {
    const blocked = new Set<string>();
    builtTiles.forEach((tile) => blocked.add(`${tile.x},${tile.y}`));
    Object.values(buildingFootprints).forEach((footprint) => {
      footprint.tiles.forEach((tile) => blocked.add(`${tile.x},${tile.y}`));
    });
    customAssets.forEach((asset) => {
      const width = asset.rotation % 180 === 0 ? asset.width : asset.length;
      const length = asset.rotation % 180 === 0 ? asset.length : asset.width;
      for (let y = asset.y; y < asset.y + length; y += 1) {
        for (let x = asset.x; x < asset.x + width; x += 1) {
          blocked.add(`${x},${y}`);
        }
      }
    });
    return blocked;
  }, [buildingFootprints, builtTiles, customAssets]);
  const availableLobsterTiles = React.useMemo(() => {
    const tiles: Array<{ x: number; y: number }> = [];
    for (let y = visibleTerrainBounds.minY; y <= visibleTerrainBounds.maxY; y += 1) {
      for (let x = visibleTerrainBounds.minX; x <= visibleTerrainBounds.maxX; x += 1) {
        const parcelId = getParcelId(x, y);
        if (!unlockedParcelIdSet.has(parcelId)) continue;
        if (lobsterBlockedTileSet.has(`${x},${y}`)) continue;
        tiles.push({ x, y });
      }
    }
    return tiles;
  }, [lobsterBlockedTileSet, unlockedParcelIdSet, visibleTerrainBounds]);

  const logCameraParams = React.useCallback((reason: string, force = false) => {
    const controls = controlsRef.current;
    if (!controls) return;

    const now = performance.now();
    if (!force && now - lastCameraLogAtRef.current < 150) return;
    lastCameraLogAtRef.current = now;

    const camera = controls.object;
    const round = (value: number) => Number(value.toFixed(3));

    console.log('[CameraDebug]', {
      reason,
      position: {
        x: round(camera.position.x),
        y: round(camera.position.y),
        z: round(camera.position.z),
      },
      target: {
        x: round(controls.target.x),
        y: round(controls.target.y),
        z: round(controls.target.z),
      },
      distance: round(camera.position.distanceTo(controls.target)),
      polarAngle: round(controls.getPolarAngle()),
      azimuthAngle: round(controls.getAzimuthalAngle()),
      zoom: round(camera.zoom),
      fov: camera instanceof THREE.PerspectiveCamera ? round(camera.fov) : null,
      near: round(camera.near),
      far: round(camera.far),
    });
  }, []);

  const applyCameraPreset = React.useCallback((preset: CameraConfigEntry) => {
    const controls = controlsRef.current;
    if (!controls) return;

    controls.target.set(preset.target.x, preset.target.y, preset.target.z);
    controls.object.position.set(preset.position.x, preset.position.y, preset.position.z);
    if (controls.object instanceof THREE.OrthographicCamera) {
      controls.object.zoom = preset.fov;
      controls.object.updateProjectionMatrix();
    } else if (controls.object instanceof THREE.PerspectiveCamera) {
      controls.object.zoom = 1;
      controls.object.fov = preset.fov;
      controls.object.updateProjectionMatrix();
    }
    controls.update();
    controls.saveState();
  }, []);

  const pickPosition = (
    userId: string,
    used: Set<string>,
    existing: Map<string, { x: number; y: number }>,
    availableTiles: Array<{ x: number; y: number }>,
  ): { x: number; y: number } => {
    if (availableTiles.length === 0) {
      return existing.get(userId) ?? { x: 0, y: 0 };
    }

    const availableKeys = new Set(availableTiles.map((tile) => `${tile.x},${tile.y}`));
    const cached = existing.get(userId);
    if (cached) {
      if (availableKeys.has(`${cached.x},${cached.y}`) && !used.has(`${cached.x},${cached.y}`)) return cached;
    }

    let hash = 0;
    for (let i = 0; i < userId.length; i += 1) {
      hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
    }
    const preferred = existing.get(userId) ?? availableTiles[hash % availableTiles.length];
    const candidates = [...availableTiles].sort((a, b) => {
      const distA = Math.abs(a.x - preferred.x) + Math.abs(a.y - preferred.y);
      const distB = Math.abs(b.x - preferred.x) + Math.abs(b.y - preferred.y);
      if (distA !== distB) return distA - distB;
      const scoreA = (a.x * 17 + a.y * 31 + hash) % 97;
      const scoreB = (b.x * 17 + b.y * 31 + hash) % 97;
      return scoreA - scoreB;
    });

    const free = candidates.find((tile) => !used.has(`${tile.x},${tile.y}`));
    return free ?? candidates[0];
  };

  useEffect(() => {
    // seed stable id / position maps from local initial state
    if (lobsterIdMapRef.current.size === 0) {
      lobsters.forEach((lobster, idx) => {
        lobsterIdMapRef.current.set(lobster.name, lobster.id || idx + 1);
      });
      LOBSTERS.forEach((lobster, idx) => {
        if (!lobsterIdMapRef.current.has(lobster.name)) {
          lobsterIdMapRef.current.set(lobster.name, lobster.id || idx + 1);
        }
      });
    }
  }, [lobsters]);

  useEffect(() => {
    if (availableLobsterTiles.length === 0) return;
    const used = new Set<string>();
    const nextPositions = new Map<string, { x: number; y: number }>();
    const knownNames = new Set([
      ...lobsters.map((lobster) => lobster.name),
      ...LOBSTERS.map((lobster) => lobster.name),
    ]);

    knownNames.forEach((name) => {
      const next = pickPosition(name, used, lobsterPosMapRef.current, availableLobsterTiles);
      used.add(`${next.x},${next.y}`);
      nextPositions.set(name, next);
    });

    lobsterPosMapRef.current = nextPositions;
  }, [availableLobsterTiles, lobsters]);

  useEffect(() => {
    const targetFullCount = Math.min(lobsters.length, MAX_FULL_DETAIL_LOBSTERS);
    const initialCount = Math.min(targetFullCount, INITIAL_FULL_DETAIL_LOBSTERS);
    setFullDetailLobsterCount(initialCount);
    if (initialCount >= targetFullCount) return;

    const timer = window.setInterval(() => {
      setFullDetailLobsterCount((prev) => {
        if (prev >= targetFullCount) return prev;
        return Math.min(targetFullCount, prev + FULL_DETAIL_BATCH_SIZE);
      });
    }, FULL_DETAIL_BATCH_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [lobsters.length]);

  useEffect(() => {
    let cancelled = false;
    const runtimeBaseUrl = getRuntimeBaseUrl();
    const service = new RuntimePhase1Service(new RuntimeClient({ baseUrl: runtimeBaseUrl }));

    const syncRuntimeLobsters = async () => {
      try {
        const [bots, lifeStates, leaderboard, allGanglia, allIntegrations, colonyStatus] = await Promise.all([
          service.getOnlineBots(),
          service.getWorldLifeState(300),
          service.getTokenLeaderboard(500).catch(() => []),
          service.getGangliaBrowse(2000).catch(() => [] as Array<{ id: number; name: string }>),
          service.getAllGangliaIntegrations(2000).catch(() => [] as Array<{ ganglion_id: number; user_id: string }>),
          service.getColonyStatus().catch(() => null),
        ]);
        if (cancelled || bots.length === 0) return;

        // Build ganglion ID → name lookup
        const ganglionNameMap = new Map<number, string>();
        allGanglia.forEach((g) => ganglionNameMap.set(g.id, g.name));

        // Build user_id → ganglia skill names lookup
        const userGangliaMap = new Map<string, string[]>();
        allIntegrations.forEach((integration) => {
          const name = ganglionNameMap.get(integration.ganglion_id);
          if (!name) return;
          const list = userGangliaMap.get(integration.user_id) || [];
          if (!list.includes(name)) list.push(name);
          userGangliaMap.set(integration.user_id, list);
        });

        // Get initial_token from colony config (fallback 1000)
        const statusRaw = colonyStatus as Record<string, unknown> | null;
        const initialTokenFromConfig =
          statusRaw && typeof statusRaw.initial_token === 'number' ? statusRaw.initial_token : 1000;

        const lifeMap = new Map<string, (typeof lifeStates)[number]>();
        lifeStates.forEach((item) => {
          if (typeof item.user_id === 'string' && item.user_id.length > 0) {
            lifeMap.set(item.user_id, item);
          }
        });
        const tokenMap = new Map<string, number>();
        leaderboard.forEach((item) => {
          if (typeof item.user_id === 'string' && typeof item.balance === 'number') {
            tokenMap.set(item.user_id, item.balance);
          }
        });
        const missingTokenBots = bots.filter((bot) => !tokenMap.has(bot.user_id));
        if (missingTokenBots.length > 0) {
          await Promise.all(
            missingTokenBots.map(async (bot) => {
              try {
                const holding = await service.getTokenHolding(bot.user_id);
                if (typeof holding.item.balance === 'number') {
                  tokenMap.set(bot.user_id, holding.item.balance);
                }
              } catch {
                // ignore single-agent token fetch failures
              }
            }),
          );
        }
        const used = new Set<string>();
        const next = [...bots]
          .sort((a, b) => a.user_id.localeCompare(b.user_id))
          .map((bot, idx) => {
            const userId = bot.user_id;
            const life = lifeMap.get(userId);
            const lifeState = life?.state ?? '';
            const reason = (life?.reason || '').toLowerCase();
            const exiled = reason.includes('exile') || reason.includes('banish') || reason.includes('放逐');
            const consumed = lifeState === 'dead' || exiled;
            const hibernationDeadlineAt =
              life?.hibernation_deadline_at || life?.hibernation_ends_at || life?.wake_deadline_at;
            const minRevivalBalance =
              typeof life?.min_revival_balance === 'number'
                ? life.min_revival_balance
                : typeof life?.revival_balance_min === 'number'
                  ? life.revival_balance_min
                  : undefined;

            let id = lobsterIdMapRef.current.get(userId);
            if (typeof id !== 'number') {
              let maxId = 0;
              lobsterIdMapRef.current.forEach((value) => {
                if (typeof value === 'number' && value > maxId) maxId = value;
              });
              id = maxId + 1 + idx;
              lobsterIdMapRef.current.set(userId, id);
            }

            const pos = pickPosition(userId, used, lobsterPosMapRef.current, availableLobsterTiles);
            used.add(`${pos.x},${pos.y}`);
            lobsterPosMapRef.current.set(userId, pos);

            return {
              id,
              x: pos.x,
              y: pos.y,
              name: bot.nickname || bot.name || userId,
              status: lifeState || bot.status || (consumed ? 'Consumed' : 'Active'),
              lifeState,
              token: tokenMap.get(userId) ?? 0,
              initial_token: initialTokenFromConfig,
              job: bot.status || 'Agent',
              xp: 0,
              ganglia: userGangliaMap.get(userId) ?? [],
              memory: life?.reason || 'Runtime sync',
              isConsumed: consumed,
              hibernationDeadlineAt,
              minRevivalBalance,
            };
          });

        if (!cancelled) updateLobsters(next);
      } catch {
        // keep existing local lobsters when runtime fetch fails
      }
    };

    syncRuntimeLobsters();
    const timer = window.setInterval(syncRuntimeLobsters, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [availableLobsterTiles, updateLobsters]);

  useEffect(() => {
    let cancelled = false;

    void loadCameraConfig()
      .then((config) => {
        if (!cancelled) {
          setCameraPreset(config);
        }
      })
      .catch((error) => {
        console.warn('[camera-config-load]', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // useEffect(() => {
  //   const controls = controlsRef.current;
  //   if (!controls) return;

  //   const onChange = () => logCameraParams('orbit-change');
  //   const onEnd = () => logCameraParams('orbit-end', true);

  //   controls.addEventListener('change', onChange);
  //   controls.addEventListener('end', onEnd);
  //   logCameraParams('init', true);

  //   return () => {
  //     controls.removeEventListener('change', onChange);
  //     controls.removeEventListener('end', onEnd);
  //   };
  // }, [logCameraParams]);

  useEffect(() => {
    if (!controlsRef.current) return;
    applyCameraPreset(activeCameraPreset);
    logCameraParams('apply-default-camera', true);
  }, [activeCameraPreset, applyCameraPreset, logCameraParams]);

  useEffect(() => {
    if (cameraTargetId !== null && controlsRef.current) {
      const targetLobster = lobsters.find(l => l.id === cameraTargetId);
      const targetBuilding = buildings.find(b => b.id === cameraTargetId);
      
      const target = targetLobster || targetBuilding;
      
      if (target) {
        const x = gridCoordToWorld(target.x);
        const z = gridCoordToWorld(target.y);
        const y = ('extraBlocks' in target ? (target.extraBlocks ?? 0) * 0.02 : 0.12);

        // Target pos
        // We use bounding box center of the tile the target is on to perfectly center it
        const targetPos = new THREE.Vector3(-x, y, -z);
        const offset = controlsRef.current.object.position.clone().sub(controlsRef.current.target);

        controlsRef.current.target.copy(targetPos);
        controlsRef.current.object.position.copy(targetPos.clone().add(offset));
        controlsRef.current.update();
        logCameraParams('focus-target', true);
        
        clearCameraTarget();
      }
    }
  }, [buildings, cameraTargetId, lobsters, clearCameraTarget, logCameraParams]);

  useEffect(() => {
    if (resetCameraSignal > 0 && controlsRef.current) {
      // First call reset to clear any internal OrbitControls state
      controlsRef.current.reset();
      applyCameraPreset(activeCameraPreset);
      logCameraParams('reset-camera', true);
    }
  }, [activeCameraPreset, applyCameraPreset, logCameraParams, resetCameraSignal]);

  useEffect(() => {
    if (saveInitialCameraSignal <= 0 || !controlsRef.current) return;

    const controls = controlsRef.current;
    const nextPreset = normalizeCameraConfig({
      position: {
        x: controls.object.position.x,
        y: controls.object.position.y,
        z: controls.object.position.z,
      },
      target: {
        x: controls.target.x,
        y: controls.target.y,
        z: controls.target.z,
      },
      fov: controls.object instanceof THREE.OrthographicCamera ? controls.object.zoom : initialCameraZoom,
    });

    setCameraPreset(nextPreset);
    void saveCameraConfig(nextPreset)
      .then(() => {
        toast.success(
          language === 'zh'
            ? '已保存当前镜头和双指位移为默认初始镜头'
            : 'Saved current camera and pan target as default',
        );
      })
      .catch((error) => {
        console.error(error);
        toast.error(language === 'zh' ? '默认镜头保存失败' : 'Failed to save default camera');
      });
  }, [initialCameraZoom, language, saveInitialCameraSignal]);

  return (
    <>
      <OrthographicCamera makeDefault position={initialCameraPosition} zoom={initialCameraZoom} near={0.1} far={200} />
      <OrbitControls 
        ref={controlsRef}
        enablePan={false}
        enableRotate={false}
        enableZoom={false}
        makeDefault
      />
      
      <ambientLight intensity={0.9} color="#f8fbff" />
      
      <group rotation={[0, Math.PI, 0]} position={[0, 0, 0]}>
        <GridSystem onHoverTileChange={setHoveredTile} />
        {underConstructionPlots.map((plot) => {
          const plotHovered = hoveredTile
            ? hoveredTile.x >= plot.minX && hoveredTile.x <= plot.maxX && hoveredTile.y >= plot.minY && hoveredTile.y <= plot.maxY
            : false;
          return (
            <group key={plot.id} position={[plot.worldX, 0, plot.worldZ]} onPointerLeave={() => setHoveredTile(null)}>
              {subPlotTileOffsets.map((tile) => (
                <mesh
                  key={`${plot.id}-${tile.row}-${tile.col}`}
                  position={[tile.xOffset, 0.012, tile.zOffset]}
                  rotation={[-Math.PI / 2, 0, 0]}
                  onPointerOver={(e) => {
                    e.stopPropagation();
                    setHoveredTile({ x: plot.minX + tile.col, y: plot.minY + tile.row });
                  }}
                >
                  <planeGeometry args={[1 - TILE_GAP, 1 - TILE_GAP]} />
                  <meshBasicMaterial color="#2c2b31" transparent opacity={0.92} />
                </mesh>
              ))}
              <lineSegments position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <edgesGeometry args={[new THREE.PlaneGeometry(subPlotTileCount, subPlotTileCount)]} />
                <lineBasicMaterial color="#67e8f9" opacity={0.92} transparent />
              </lineSegments>
              <CanvasBillboardTag
                position={[0, 0.5, 0]}
                height={plotHovered ? 0.34 : 0.32}
                minWidth={248}
                backgroundColor="rgba(0, 0, 0, 0.72)"
                borderColor="rgba(251, 191, 36, 0.52)"
                shadowColor="rgba(0, 0, 0, 0.45)"
                accentDotColor="#fcd34d"
                progress={0.68}
                lines={[
                  {
                    text: language === 'zh' ? '正在施工中...' : 'Under Construction...',
                    color: '#fcd34d',
                    fontSize: 18,
                    fontWeight: 700,
                  },
                ]}
              />
            </group>
          );
        })}
        
        {buildings.map(b => <Building key={b.id} data={b} />)}
        {customAssets.map(a => (
          <React.Suspense key={a.id} fallback={null}>
            <CustomAssetModel data={a} onSelect={moveCustomAssetToPending} />
          </React.Suspense>
        ))}
        {lobsters.map((l, index) => (
          <Lobster
            key={l.id}
            data={l}
            allowedTiles={availableLobsterTiles}
            onSelect={() => setSelectedLobsterId(l.id)}
            renderModel={false}
          />
        ))}
      </group>
      
    </>
  );
}
