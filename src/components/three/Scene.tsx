import React, { useRef, useEffect } from 'react';
import { Environment, OrbitControls, PerspectiveCamera, ContactShadows, GizmoHelper, GizmoViewcube } from '@react-three/drei';
import { GridSystem } from './GridSystem';
import { Building } from './Building';
import { Lobster } from './Lobster';
import { CustomAssetModel } from './CustomAssetModel';
import { PostProcessing } from './PostProcessing';
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
  const language = useI18nStore(state => state.language);
  const unlockedParcelIdSet = React.useMemo(() => new Set(unlockedParcelIds), [unlockedParcelIds]);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const lobsterIdMapRef = useRef<Map<string, number>>(new Map());
  const lobsterPosMapRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const lastCameraLogAtRef = useRef<number>(0);
  const centerSpotTarget = React.useMemo(() => new THREE.Object3D(), []);
  const [cameraPreset, setCameraPreset] = React.useState<CameraConfigEntry>(() => readCachedCameraConfig() ?? DEFAULT_CAMERA_CONFIG);
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
  const terrainCenterWorldX = -terrainCenterLocalX;
  const terrainCenterWorldZ = -terrainCenterLocalZ;
  const sceneSpan = Math.max(visibleGridWidth, visibleGridHeight) * (1 + TILE_GAP);
  const fallbackCameraPreset = React.useMemo<CameraConfigEntry>(
    () => ({
      position: {
        x: sceneSpan * 1.35,
        y: Math.max(7, sceneSpan * 0.6),
        z: -sceneSpan * 1.15,
      },
      target: { x: 0, y: 0, z: 0 },
      fov: 20,
    }),
    [sceneSpan],
  );
  const activeCameraPreset = cameraPreset ?? fallbackCameraPreset;
  const initialCameraPosition = React.useMemo<[number, number, number]>(
    () => [activeCameraPreset.position.x, activeCameraPreset.position.y, activeCameraPreset.position.z],
    [activeCameraPreset],
  );
  const initialCameraTarget = React.useMemo<[number, number, number]>(
    () => [activeCameraPreset.target.x, activeCameraPreset.target.y, activeCameraPreset.target.z],
    [activeCameraPreset],
  );
  const initialCameraFov = activeCameraPreset.fov;
  const contactShadowScale = Math.max(15, sceneSpan * 1.2);
  const contactShadowFar = Math.max(10, sceneSpan);
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
    if (controls.object instanceof THREE.PerspectiveCamera) {
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
    let cancelled = false;
    const runtimeBaseUrl = getRuntimeBaseUrl();
    const service = new RuntimePhase1Service(new RuntimeClient({ baseUrl: runtimeBaseUrl }));

    const syncRuntimeLobsters = async () => {
      try {
        const [bots, lifeStates, leaderboard] = await Promise.all([
          service.getOnlineBots(),
          service.getWorldLifeState(300),
          service.getTokenLeaderboard(500).catch(() => []),
        ]);
        if (cancelled || bots.length === 0) return;

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
              name: userId,
              status: lifeState || bot.status || (consumed ? 'Consumed' : 'Active'),
              lifeState,
              token: tokenMap.get(userId) ?? 0,
              initial_token: 1000,
              job: bot.status || 'Agent',
              xp: 0,
              ganglia: [],
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

  useEffect(() => {
    centerSpotTarget.position.set(terrainCenterWorldX, -1, terrainCenterWorldZ);
    centerSpotTarget.updateMatrixWorld();
  }, [centerSpotTarget, terrainCenterWorldX, terrainCenterWorldZ]);

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
        const y = getElevation(target.x, target.y) + ('extraBlocks' in target ? (target.extraBlocks ?? 0) * 0.5 : 0);

        // Target pos
        // We use bounding box center of the tile the target is on to perfectly center it
        const targetPos = new THREE.Vector3(-x, y + 0.5, -z);
        
        // Change camera to look at the target, close to it
        controlsRef.current.target.copy(targetPos);
        controlsRef.current.object.position.set(-x - 10, y + 10, -z - 10);
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
      fov: controls.object instanceof THREE.PerspectiveCamera ? controls.object.fov : initialCameraFov,
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
  }, [initialCameraFov, language, saveInitialCameraSignal]);

  return (
    <>
      <PerspectiveCamera makeDefault position={initialCameraPosition} fov={initialCameraFov} />
      <OrbitControls 
        ref={controlsRef}
        enablePan={true} 
        enableZoom={true} 
        minPolarAngle={0} 
        maxPolarAngle={Math.PI / 2.1}
        makeDefault
      />
      
      <ambientLight intensity={0.78} color="#5e4b8b" />
      <pointLight position={[-10, 20, -10]} intensity={2.8} color="#63e6ff" />
      <pointLight position={[12, 10, 14]} intensity={1.9} color="#ff79d1" />
      <hemisphereLight intensity={0.95} groundColor="#0c0716" color="#8759ff" />
      <spotLight position={[15, 25, -10]} angle={0.4} penumbra={1} intensity={4.8} color="#c7f8ff" castShadow shadow-mapSize={[2048, 2048]} />
      <primitive object={centerSpotTarget} />
      <spotLight
        position={[terrainCenterWorldX, 22, terrainCenterWorldZ]}
        target={centerSpotTarget}
        angle={0.3}
        penumbra={0.9}
        intensity={6.2}
        distance={42}
        decay={1.35}
        color="#d9fbff"
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      
      <group rotation={[0, Math.PI, 0]} position={[0, -1.5, 0]}>
        <GridSystem />
        
        {buildings.map(b => <Building key={b.id} data={b} />)}
        {customAssets.map(a => (
          <React.Suspense key={a.id} fallback={null}>
            <CustomAssetModel data={a} onSelect={moveCustomAssetToPending} />
          </React.Suspense>
        ))}
        {lobsters.map(l => (
          <Lobster
            key={l.id}
            data={l}
            allowedTiles={availableLobsterTiles}
            onSelect={() => setSelectedLobsterId(l.id)}
          />
        ))}
      </group>
      
      <ContactShadows
        frames={1}
        resolution={512}
        scale={contactShadowScale}
        blur={2}
        opacity={0.25}
        far={contactShadowFar}
        color="#000000"
      />
      <PostProcessing />
      <Environment preset="city" />

      <GizmoHelper
        alignment="bottom-left"
        margin={[60, 180]}
      >
        <group rotation={[0, Math.PI, 0]} onDoubleClick={(e) => { e.stopPropagation(); triggerCameraReset(); }}>
          <GizmoViewcube 
            faces={language === 'zh' ? ['右', '左', '上', '下', '前', '后'] : ['Right', 'Left', 'Top', 'Bottom', 'Front', 'Back']}
            opacity={0.8}
            color="#334155"
            strokeColor="#475569"
            textColor="#f8fafc"
            hoverColor="#6366f1"
          />
        </group>
      </GizmoHelper>
    </>
  );
}
