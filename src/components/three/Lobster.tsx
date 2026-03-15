import React, { useState, useRef, useEffect } from 'react';
import { Html, Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { LobsterData } from '../../types/game';
import { getElevation, gridCoordToWorld } from '../../constants/gameData';

interface LobsterProps {
  data: LobsterData;
  allowedTiles: Array<{ x: number; y: number }>;
  onSelect: () => void;
}

const lobsterTileClaims = new Map<string, number>();

const tileKey = (x: number, y: number) => `${x},${y}`;
const sameTile = (a: { x: number; y: number }, b: { x: number; y: number }) => a.x === b.x && a.y === b.y;

const releaseClaim = (lobsterId: number, tile: { x: number; y: number }) => {
  const key = tileKey(tile.x, tile.y);
  if (lobsterTileClaims.get(key) === lobsterId) {
    lobsterTileClaims.delete(key);
  }
};

const claimTile = (lobsterId: number, tile: { x: number; y: number }) => {
  const key = tileKey(tile.x, tile.y);
  const occupant = lobsterTileClaims.get(key);
  if (occupant !== undefined && occupant !== lobsterId) return false;
  lobsterTileClaims.set(key, lobsterId);
  return true;
};

const fallbackTileFor = (
  lobsterId: number,
  preferred: { x: number; y: number },
  allowedTiles: Array<{ x: number; y: number }>,
) => {
  const candidates = [...allowedTiles];
  candidates.sort((a, b) => {
    const distA = Math.abs(a.x - preferred.x) + Math.abs(a.y - preferred.y);
    const distB = Math.abs(b.x - preferred.x) + Math.abs(b.y - preferred.y);
    if (distA !== distB) return distA - distB;
    const scoreA = (a.x * 17 + a.y * 31 + lobsterId * 13) % 97;
    const scoreB = (b.x * 17 + b.y * 31 + lobsterId * 13) % 97;
    return scoreA - scoreB;
  });
  const available = candidates.find((tile) => !lobsterTileClaims.has(tileKey(tile.x, tile.y)));
  return available ?? preferred;
};

const isHibernating = (data: LobsterData) => {
  const state = (data.lifeState || data.status || '').toLowerCase();
  return state.includes('hibernat') || state.includes('sleep') || state.includes('rest');
};

const formatCountdown = (deadlineAt?: string, nowMs = Date.now()) => {
  if (!deadlineAt) return '--:--:--';
  const deadline = Date.parse(deadlineAt);
  if (!Number.isFinite(deadline)) return '--:--:--';
  const remainingMs = Math.max(0, deadline - nowMs);
  const totalSec = Math.floor(remainingMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export function Lobster({ data, allowedTiles, onSelect }: LobsterProps) {
  const [hovered, setHover] = useState(false);
  const groupRef = useRef<THREE.Group>(null);
  const modelWrapperRef = useRef<THREE.Group>(null);
  const [modelScene, setModelScene] = useState<THREE.Group | null>(null);
  const [modelFailed, setModelFailed] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const allowedTileKeySet = React.useMemo(() => new Set(allowedTiles.map((tile) => tileKey(tile.x, tile.y))), [allowedTiles]);
  const sleeping = isHibernating(data);
  
  // State for autonomous movement
  const initialTarget = allowedTiles[0] ?? { x: data.x, y: data.y };
  const targetRef = useRef(initialTarget);
  const [target, setTarget] = useState(initialTarget);
  const characterIndex = ((Math.abs(data.id) - 1) % 16) + 1;
  const modelUrl = `/assets/models/characters/character${characterIndex}.glb`;

  useEffect(() => {
    if (!sleeping) return undefined;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [sleeping]);

  useEffect(() => {
    let cancelled = false;
    const loader = new GLTFLoader();

    loader.load(
      modelUrl,
      (gltf) => {
        if (cancelled) return;

        const clonedScene = gltf.scene.clone(true);
        clonedScene.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (!mesh.isMesh) return;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          if (Array.isArray(mesh.material)) {
            mesh.material = mesh.material.map((mat) => mat.clone());
            mesh.material.forEach((m) => {
              m.needsUpdate = true;
            });
          } else if (mesh.material) {
            mesh.material = mesh.material.clone();
            mesh.material.needsUpdate = true;
          }
        });

        clonedScene.position.set(0, 0, 0);
        clonedScene.scale.setScalar(1);
        clonedScene.updateMatrixWorld(true);

        const box = new THREE.Box3().setFromObject(clonedScene);
        if (box.isEmpty()) {
          console.warn(`[Lobster] Empty bounding box for ${data.name}: ${modelUrl}`);
          setModelScene(null);
          setModelFailed(true);
          return;
        }

        const size = box.getSize(new THREE.Vector3());
        const maxDimension = Math.max(size.x, size.z, 0.001);
        const fitScale = (0.48 / maxDimension) * (data.isConsumed ? 0.9 : 1);
        clonedScene.scale.setScalar(fitScale);
        clonedScene.updateMatrixWorld(true);

        const scaledBox = new THREE.Box3().setFromObject(clonedScene);
        const center = scaledBox.getCenter(new THREE.Vector3());
        const min = scaledBox.min;
        clonedScene.position.set(-center.x, -min.y, -center.z);

        setModelScene(clonedScene);
        setModelFailed(false);
      },
      undefined,
      () => {
        if (cancelled) return;
        console.warn(`[Lobster] Failed to load model for ${data.name}: ${modelUrl}`);
        setModelScene(null);
        setModelFailed(true);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [data.id, data.isConsumed, data.name, modelUrl]);

  useEffect(() => {
    if (!modelScene) return;
    modelScene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((mat) => {
        const material = mat as THREE.Material & {
          color?: THREE.Color;
          emissive?: THREE.Color;
          emissiveIntensity?: number;
          userData?: Record<string, unknown>;
        };
        if (!material || !('color' in material)) return;
        if (!material.userData) material.userData = {};
        const hasColor = material.color instanceof THREE.Color;
        if (!hasColor) return;

        const baseHex = material.userData.baseHex as number | undefined;
        if (typeof baseHex !== 'number' && material.color) {
          material.userData.baseHex = material.color.getHex();
        }
        if (material.emissive instanceof THREE.Color && typeof material.userData.baseEmissiveHex !== 'number') {
          material.userData.baseEmissiveHex = material.emissive.getHex();
        }
        if (typeof material.userData.baseEmissiveIntensity !== 'number') {
          material.userData.baseEmissiveIntensity = typeof material.emissiveIntensity === 'number' ? material.emissiveIntensity : 0;
        }

        const baseColor = new THREE.Color(
          typeof material.userData.baseHex === 'number' ? material.userData.baseHex : material.color.getHex(),
        );
        if (sleeping) {
          // Only tint color; keep original transparency pipeline intact.
          material.color.copy(baseColor).lerp(new THREE.Color('#8a8f98'), 0.58);
          if (material.emissive instanceof THREE.Color) {
            material.emissive.set('#1f2430');
            material.emissiveIntensity = 0.1;
          }
        } else {
          material.color.copy(baseColor);
          if (material.emissive instanceof THREE.Color) {
            const baseEmissiveHex = material.userData.baseEmissiveHex as number | undefined;
            material.emissive.setHex(baseEmissiveHex ?? 0x000000);
            material.emissiveIntensity = (material.userData.baseEmissiveIntensity as number | undefined) ?? 0;
          }
        }
        material.needsUpdate = true;
      });
    });
  }, [modelScene, sleeping]);

  useEffect(() => {
    const preferred = allowedTileKeySet.has(tileKey(data.x, data.y))
      ? { x: data.x, y: data.y }
      : (allowedTiles[0] ?? { x: data.x, y: data.y });
    let claimed = preferred;
    if (!claimTile(data.id, preferred)) {
      claimed = fallbackTileFor(data.id, preferred, allowedTiles);
      claimTile(data.id, claimed);
    }
    targetRef.current = claimed;
    setTarget(claimed);
    return () => {
      releaseClaim(data.id, targetRef.current);
    };
  }, [allowedTileKeySet, allowedTiles, data.id, data.x, data.y]);

  useEffect(() => {
    if (sleeping) return undefined;
    if (allowedTiles.length === 0) return undefined;
    const moveInterval = setInterval(() => {
      setTarget(prev => {
        const dirs = [
          { dx: 0, dy: 1 },
          { dx: 0, dy: -1 },
          { dx: 1, dy: 0 },
          { dx: -1, dy: 0 },
          { dx: 0, dy: 0 } // stay occasionally
        ];
        const candidates = dirs
          .map((dir) => ({ x: prev.x + dir.dx, y: prev.y + dir.dy }))
          .filter((candidate) => allowedTileKeySet.has(tileKey(candidate.x, candidate.y)));
        const freeCandidates = candidates.filter((candidate) => {
          const occupant = lobsterTileClaims.get(tileKey(candidate.x, candidate.y));
          return occupant === undefined || occupant === data.id;
        });
        const nonStayFree = freeCandidates.filter((candidate) => !sameTile(candidate, prev));
        const pool = nonStayFree.length > 0 ? nonStayFree : freeCandidates;
        const next = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : prev;

        if (!sameTile(next, prev)) {
          releaseClaim(data.id, prev);
          claimTile(data.id, next);
        } else if (!claimTile(data.id, prev)) {
          const fallback = fallbackTileFor(data.id, prev, allowedTiles);
          releaseClaim(data.id, prev);
          claimTile(data.id, fallback);
          targetRef.current = fallback;
          return fallback;
        }
        
        targetRef.current = next;
        return next;
      });
    }, 2000 + Math.random() * 3000); // 2s to 5s interval
    
    return () => clearInterval(moveInterval);
  }, [allowedTileKeySet, allowedTiles, data.id, sleeping]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    
    const targetPosX = gridCoordToWorld(target.x);
    const targetPosZ = gridCoordToWorld(target.y);
    const elevation = getElevation(target.x, target.y);
    const targetHeight = 0.5 + elevation;
    
    // Smooth interpolation towards target
    groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, targetPosX, delta * 3);
    groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, targetPosZ, delta * 3);
    groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, targetHeight, delta * 3);

    if (modelWrapperRef.current) {
      const cameraPos = state.camera.position;
      const modelPos = modelWrapperRef.current.getWorldPosition(new THREE.Vector3());
      modelWrapperRef.current.lookAt(cameraPos.x, modelPos.y, cameraPos.z);
    }
  });

  const handleClick = (e?: any) => {
    if (e) e.stopPropagation();
    console.log("Lobster clicked:", data.name);
    onSelect();
  };

  // Initial position for first render
  const initElevation = getElevation(initialTarget.x, initialTarget.y);
  const initPosX = gridCoordToWorld(initialTarget.x);
  const initPosZ = gridCoordToWorld(initialTarget.y);
  const initHeight = 0.5 + initElevation;
  const shouldRenderFallback = modelFailed || !modelScene;
  const countdownText = formatCountdown(data.hibernationDeadlineAt, nowMs);

  return (
    <group 
      ref={groupRef}
      position={[initPosX, initHeight, initPosZ]}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
      onClick={handleClick}
    >
      <mesh onClick={handleClick}>
        <sphereGeometry args={[0.6, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {modelScene && (
        <group ref={modelWrapperRef}>
          <primitive
            object={modelScene}
            onClick={handleClick}
            onPointerOver={() => setHover(true)}
            onPointerOut={() => setHover(false)}
          />
        </group>
      )}

      <Billboard>
        <Html 
          transform 
          scale={hovered ? 0.7 : 0.56} 
          style={{ transition: 'all 0.2s' }}
        >
          <div 
            className="flex flex-col items-center select-none pointer-events-none"
            style={{ pointerEvents: 'none' }}
          >
            {shouldRenderFallback && (
              <div 
                className={`w-12 h-12 bg-[#0a0a14]/80 border-2 ${hovered ? 'border-red-400' : 'border-red-500/80'} rounded-full flex items-center justify-center shadow-[0_4px_15px_rgba(239,68,68,0.5)] cursor-pointer backdrop-blur-xl transition-all text-[10px] text-red-300`}
                style={{ pointerEvents: 'auto' }}
                onClick={handleClick}
              >
                LOB
              </div>
            )}
            {sleeping && (
              <div className="mt-2 min-w-[170px] rounded-xl border border-slate-500/60 bg-slate-900/80 px-2 py-1 text-center shadow-[0_4px_14px_rgba(0,0,0,0.45)]">
                <div className="text-[10px] font-bold tracking-wide text-slate-200">💤 休眠倒计时 {countdownText}</div>
                <div className="text-[9px] text-slate-300">即将被送往 AGI Bar</div>
              </div>
            )}
          </div>
        </Html>
      </Billboard>
    </group>
  );
}
