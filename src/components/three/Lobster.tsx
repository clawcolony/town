import React, { useEffect, useRef, useState } from 'react';
import { Billboard, Html, useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { LobsterData } from '../../types/game';
import { gridCoordToWorld } from '../../constants/gameData';
import spriteManifestJson from '../../data/sprite-manifest.json';

interface LobsterProps {
  data: LobsterData;
  allowedTiles: Array<{ x: number; y: number }>;
  onSelect: () => void;
  renderModel?: boolean;
}

const SPRITE_MANIFEST = spriteManifestJson as {
  characters: Record<string, { baseWidth: number; baseDepth: number; baseHeight: number; aspect: number; image: string }>;
};

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
  const [nowMs, setNowMs] = useState(() => Date.now());
  const allowedTileKeySet = React.useMemo(() => new Set(allowedTiles.map((tile) => tileKey(tile.x, tile.y))), [allowedTiles]);
  const sleeping = isHibernating(data);

  const initialTarget = React.useMemo(() => {
    if (allowedTileKeySet.has(tileKey(data.x, data.y))) return { x: data.x, y: data.y };
    return allowedTiles[0] ?? { x: data.x, y: data.y };
  }, [allowedTileKeySet, allowedTiles, data.x, data.y]);
  const targetRef = useRef(initialTarget);
  const [target, setTarget] = useState(initialTarget);

  const characterIndex = ((Math.abs(data.id) - 1) % 16) + 1;
  const spriteKey = `character${characterIndex}`;
  const spriteMeta = SPRITE_MANIFEST.characters[spriteKey];
  const spriteTexture = useTexture(spriteMeta?.image ?? '/assets/images/lobster-colony.png');

  useEffect(() => {
    spriteTexture.colorSpace = THREE.SRGBColorSpace;
    spriteTexture.needsUpdate = true;
  }, [spriteTexture]);

  useEffect(() => {
    if (!sleeping) return undefined;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [sleeping]);

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
      setTarget((prev) => {
        const dirs = [
          { dx: 0, dy: 1 },
          { dx: 0, dy: -1 },
          { dx: 1, dy: 0 },
          { dx: -1, dy: 0 },
          { dx: 0, dy: 0 },
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
    }, 2000 + Math.random() * 3000);

    return () => clearInterval(moveInterval);
  }, [allowedTileKeySet, allowedTiles, data.id, sleeping]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const targetPosX = gridCoordToWorld(target.x);
    const targetPosZ = gridCoordToWorld(target.y);
    const targetHeight = 0.12;

    groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, targetPosX, delta * 4.5);
    groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, targetPosZ, delta * 4.5);
    groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, targetHeight, delta * 4.5);
  });

  const handleClick = (e?: { stopPropagation?: () => void }) => {
    e?.stopPropagation?.();
    onSelect();
  };

  const initPosX = gridCoordToWorld(initialTarget.x);
  const initPosZ = gridCoordToWorld(initialTarget.y);
  const initHeight = 0.12;
  const countdownText = formatCountdown(data.hibernationDeadlineAt, nowMs);
  const displayAspect = THREE.MathUtils.clamp(
    spriteMeta ? spriteMeta.baseWidth / Math.max(spriteMeta.baseHeight, 0.001) : 1,
    0.74,
    1.34,
  );
  const spriteHeight = 0.64 * (sleeping ? 0.96 : 1);
  const spriteWidth = spriteHeight * displayAspect;
  const spriteLift = 0.04;
  const chipTone = sleeping
    ? 'border-slate-400/70 bg-slate-900/85 text-slate-100 shadow-[0_4px_16px_rgba(15,23,42,0.55)]'
    : data.isConsumed
      ? 'border-rose-400/70 bg-rose-950/85 text-rose-100 shadow-[0_4px_16px_rgba(136,19,55,0.45)]'
      : 'border-orange-300/70 bg-[#0d0b12]/85 text-orange-100 shadow-[0_4px_16px_rgba(249,115,22,0.38)]';
  const spriteTint = sleeping ? '#cbd5e1' : data.isConsumed ? '#fecdd3' : '#ffffff';

  return (
    <group
      ref={groupRef}
      position={[initPosX, initHeight, initPosZ]}
    >
      <mesh
        position={[0, spriteHeight * 0.5 + spriteLift * 0.5, 0]}
        onClick={handleClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHover(false);
        }}
      >
        <planeGeometry args={[Math.max(0.56, spriteWidth * 1.24), Math.max(0.82, spriteHeight * 1.18)]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]} onClick={handleClick}>
        <circleGeometry args={[Math.max(0.16, spriteWidth * 0.18), 28]} />
        <meshBasicMaterial color="#020617" transparent opacity={hovered ? 0.22 : 0.14} />
      </mesh>

      {spriteMeta ? (
        <Billboard follow lockX={false} lockY={false} lockZ={false}>
          <mesh
            position={[0, spriteHeight / 2 + spriteLift, 0]}
            onClick={handleClick}
          >
            <planeGeometry args={[spriteWidth, spriteHeight]} />
            <meshBasicMaterial
              map={spriteTexture}
              transparent
              alphaTest={0.22}
              opacity={1}
              color={spriteTint}
              toneMapped={false}
              depthWrite
            />
          </mesh>
        </Billboard>
      ) : (
        <mesh position={[0, 0.16 + spriteLift, 0]} onClick={handleClick}>
          <circleGeometry args={[0.18, 24]} />
          <meshBasicMaterial color="#fb923c" />
        </mesh>
      )}

      <Billboard follow lockX={false} lockY={false} lockZ={false} position={[0, spriteHeight + 0.34, 0]}>
        <Html
          transform
          scale={hovered ? 0.52 : 0.44}
          style={{ transition: 'all 0.2s', pointerEvents: 'none' }}
        >
          <div className="flex flex-col items-center select-none pointer-events-none">
            {!spriteMeta && (
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-amber-300/80 bg-orange-500/90 text-sm font-bold text-white"
                style={{ pointerEvents: 'auto' }}
                onClick={handleClick}
              >
                {data.name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className={`mt-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${chipTone}`}>
              {data.name}
            </div>
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
