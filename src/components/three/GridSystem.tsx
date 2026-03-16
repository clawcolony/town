import React, { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../../store/gameStore';
import {
  TILE_GAP,
  getExpandableParcelIds,
  getElevation,
  getParcelId,
  getVisibleTerrainBounds,
  gridCoordToWorld,
  isCoordWithinBounds,
  isTerrainCoord,
} from '../../constants/gameData';
import { Tile } from './Tile';
import { getBrushFootprintTiles, instanceIdToTile, isSameTile } from './gridInteraction';
import { toast } from 'sonner';

interface GridSystemProps {
  onHoverTileChange?: (tile: { x: number; y: number } | null) => void;
}

const grassColor = new THREE.Color('#2c2b31');
const dirtColor = new THREE.Color('#35343d');
const roadColor = new THREE.Color('#3d3c45');
const colorPendingUnlock = new THREE.Color('#45434a');
const colorGrassHover = new THREE.Color('#525057');
const colorDirtHover = new THREE.Color('#67646a');
const colorRoadHover = new THREE.Color('#706d74');

const getTerrainColor = (
  x: number,
  y: number,
  state: 'pending_unlock' | 'unlocked' | 'available' | 'future' | 'blocked',
  isRoad: boolean,
) => {
  if (isRoad) return roadColor;
  if (state === 'pending_unlock') return colorPendingUnlock;
  if (state === 'unlocked') return dirtColor;
  return grassColor;
};

export function GridSystem({ onHoverTileChange }: GridSystemProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const dragActiveRef = useRef(false);
  const lastStagedTileKeyRef = useRef<string | null>(null);
  const lastToastRef = useRef<{ message: string; at: number }>({ message: '', at: 0 });
  
  const [hoveredTile, setHoveredTile] = useState<{x: number, y: number} | null>(null);

  const builtTiles = useGameStore(state => state.builtTiles);
  const pendingBuildTiles = useGameStore(state => state.pendingBuildTiles);
  const isBuildMode = useGameStore(state => state.isBuildMode);
  const buildBrushWidth = useGameStore(state => state.buildBrushWidth);
  const buildBrushLength = useGameStore(state => state.buildBrushLength);
  const addPendingBuildTiles = useGameStore(state => state.addPendingBuildTiles);
  const queueParcelUnlock = useGameStore(state => state.queueParcelUnlock);
  const unlockedParcelIds = useGameStore(state => state.unlockedParcelIds);
  const pendingUnlockParcelIds = useGameStore(state => state.pendingUnlockParcelIds);
  const pendingAsset = useGameStore(state => state.pendingAsset);
  const addCustomAsset = useGameStore(state => state.addCustomAsset);
  const buildingFootprints = useGameStore(state => state.buildingFootprints);
  const expandableParcelIds = useMemo(() => getExpandableParcelIds(unlockedParcelIds), [unlockedParcelIds]);
  const unlockedParcelIdSet = useMemo(() => new Set(unlockedParcelIds), [unlockedParcelIds]);
  const pendingUnlockParcelIdSet = useMemo(() => new Set(pendingUnlockParcelIds), [pendingUnlockParcelIds]);
  const expandableParcelIdSet = useMemo(() => new Set(expandableParcelIds), [expandableParcelIds]);
  const visibleTerrainBounds = useMemo(() => getVisibleTerrainBounds(unlockedParcelIds), [unlockedParcelIds]);
  const visibleGridWidth = visibleTerrainBounds.maxX - visibleTerrainBounds.minX + 1;
  const visibleGridHeight = visibleTerrainBounds.maxY - visibleTerrainBounds.minY + 1;

  const buildingFootprintTileSet = useMemo(() => {
    const set = new Set<string>();
    Object.values(buildingFootprints).forEach((footprint) => {
      footprint.tiles.forEach((tile) => set.add(`${tile.x},${tile.y}`));
    });
    return set;
  }, [buildingFootprints]);
  const builtTileSet = useMemo(() => new Set(builtTiles.map((tile) => `${tile.x},${tile.y}`)), [builtTiles]);
  const builtTileCountMap = useMemo(() => {
    const map = new Map<string, number>();
    builtTiles.forEach((tile) => {
      const key = `${tile.x},${tile.y}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return map;
  }, [builtTiles]);
  const pendingTileCountMap = useMemo(() => {
    const map = new Map<string, number>();
    pendingBuildTiles.forEach((tile) => {
      const key = `${tile.x},${tile.y}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return map;
  }, [pendingBuildTiles]);

  // activeTilesMap tracks which tiles are handled by the React <Tile> component.
  const activeTilesMap = useMemo(() => {
    const map = new Map<string, {x: number, y: number, elevation: number}>();
    
    // Add base tiles with elevation
    for (let y = visibleTerrainBounds.minY; y <= visibleTerrainBounds.maxY; y++) {
      for (let x = visibleTerrainBounds.minX; x <= visibleTerrainBounds.maxX; x++) {
        const el = getElevation(x, y);
        if (el > 0) {
          map.set(`${x},${y}`, { x, y, elevation: el });
        }
      }
    }
    
    // Add built tiles
    builtTiles.forEach(t => {
      if (!map.has(`${t.x},${t.y}`)) {
        map.set(`${t.x},${t.y}`, { x: t.x, y: t.y, elevation: getElevation(t.x, t.y) });
      }
    });
    
    // Add pending tiles
    pendingBuildTiles.forEach(t => {
      if (!map.has(`${t.x},${t.y}`)) {
        map.set(`${t.x},${t.y}`, { x: t.x, y: t.y, elevation: getElevation(t.x, t.y) });
      }
    });

    buildingFootprintTileSet.forEach((key) => {
      if (!map.has(key)) {
        const [x, y] = key.split(',').map(Number);
        map.set(key, { x, y, elevation: getElevation(x, y) });
      }
    });
    
    if (isBuildMode) {
      // In build mode, use concrete Tile components for all visible ground cells.
      // This keeps hover/click behavior stable even when post-processing is enabled.
      for (let y = visibleTerrainBounds.minY; y <= visibleTerrainBounds.maxY; y++) {
        for (let x = visibleTerrainBounds.minX; x <= visibleTerrainBounds.maxX; x++) {
          const key = `${x},${y}`;
          if (!map.has(key)) {
            map.set(key, { x, y, elevation: getElevation(x, y) });
          }
        }
      }
    }

    if (isBuildMode && pendingAsset) {
      // Add one-ring virtual tiles around known active tiles to support
      // horizontal expansion outside the fixed base grid.
      const seeds = Array.from(map.values());
      const dirs = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const;
      seeds.forEach((tile) => {
        dirs.forEach(([dx, dy]) => {
          const nx = tile.x + dx;
          const ny = tile.y + dy;
          const key = `${nx},${ny}`;
          if (map.has(key)) return;
          const elevation = isCoordWithinBounds(nx, ny, visibleTerrainBounds) && isTerrainCoord(nx, ny) ? getElevation(nx, ny) : 0;
          if (!isCoordWithinBounds(nx, ny, visibleTerrainBounds)) return;
          map.set(key, { x: nx, y: ny, elevation });
        });
      });
    }

    return map;
  }, [buildingFootprintTileSet, builtTiles, pendingBuildTiles, isBuildMode, pendingAsset, visibleTerrainBounds]);

  const getTileParcelState = (x: number, y: number) => {
    const parcelId = getParcelId(x, y);
    if (!isTerrainCoord(x, y)) return 'blocked';
    if (pendingUnlockParcelIdSet.has(parcelId)) return 'pending_unlock';
    if (unlockedParcelIdSet.has(parcelId)) return 'unlocked';
    if (expandableParcelIdSet.has(parcelId)) return 'available';
    return 'future';
  };

  const showBuildToast = useCallback((message: string) => {
    const now = Date.now();
    if (lastToastRef.current.message === message && now - lastToastRef.current.at < 800) {
      return;
    }
    lastToastRef.current = { message, at: now };
    toast.error(message);
  }, []);

  const hoveredBrushPreview = useMemo(() => {
    if (!isBuildMode || !hoveredTile || pendingAsset) {
      return { keys: new Set<string>(), blocked: false };
    }

    const tileState = getTileParcelState(hoveredTile.x, hoveredTile.y);
    if (tileState === 'future' || tileState === 'blocked') {
      return { keys: new Set<string>([`${hoveredTile.x},${hoveredTile.y}`]), blocked: true };
    }

    if (tileState === 'available') {
      return { keys: new Set<string>([`${hoveredTile.x},${hoveredTile.y}`]), blocked: false };
    }

    const footprint = getBrushFootprintTiles(
      hoveredTile,
      buildBrushWidth,
      buildBrushLength,
      visibleTerrainBounds.minX,
      visibleTerrainBounds.maxX,
      visibleTerrainBounds.minY,
      visibleTerrainBounds.maxY,
    );
    const keys = new Set<string>(footprint.map((tile) => `${tile.x},${tile.y}`));
    const blocked =
      footprint.length !== buildBrushWidth * buildBrushLength ||
      footprint.some((tile) => {
        const state = getTileParcelState(tile.x, tile.y);
        return state !== 'unlocked' && state !== 'pending_unlock';
      });

    return { keys, blocked };
  }, [
    buildBrushLength,
    buildBrushWidth,
    hoveredTile,
    isBuildMode,
    pendingAsset,
    pendingUnlockParcelIdSet,
    unlockedParcelIdSet,
    expandableParcelIdSet,
    visibleTerrainBounds,
  ]);

  // Update instanced mesh
  useEffect(() => {
    if (!meshRef.current) return;
    
    let i = 0;
    for (let y = visibleTerrainBounds.minY; y <= visibleTerrainBounds.maxY; y++) {
      for (let x = visibleTerrainBounds.minX; x <= visibleTerrainBounds.maxX; x++) {
        const posX = gridCoordToWorld(x);
        const posZ = gridCoordToWorld(y);
        const baseHeight = 0.5;
        
        dummy.position.set(posX, baseHeight / 2, posZ);
        const tileParcelState = getTileParcelState(x, y);
        const isRoadTile = buildingFootprintTileSet.has(`${x},${y}`) || builtTileSet.has(`${x},${y}`);
        const hoveredParcelId = hoveredTile ? getParcelId(hoveredTile.x, hoveredTile.y) : null;
        const currentParcelId = getParcelId(x, y);
        
        // Hide this instance if it's being rendered by a full Tile component
        if (activeTilesMap.has(`${x},${y}`)) {
          dummy.scale.set(0, 0, 0);
        } else {
          dummy.scale.set(1, 1, 1);
        }
        
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
        if (isRoadTile && isBuildMode && hoveredTile?.x === x && hoveredTile?.y === y) {
          meshRef.current.setColorAt(i, colorRoadHover);
        } else if (isBuildMode && hoveredParcelId !== null && hoveredParcelId === currentParcelId) {
          meshRef.current.setColorAt(i, tileParcelState === 'unlocked' ? colorDirtHover : colorGrassHover);
        } else {
          meshRef.current.setColorAt(i, getTerrainColor(x, y, tileParcelState, isRoadTile));
        }
        i++;
      }
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [dummy, activeTilesMap, hoveredTile, isBuildMode, pendingUnlockParcelIdSet, unlockedParcelIdSet, expandableParcelIdSet, visibleTerrainBounds, buildingFootprintTileSet, builtTileSet]);

  const stageBuildAtTile = useCallback((x: number, y: number) => {
    const tileKey = `${x},${y}`;
    if (dragActiveRef.current && lastStagedTileKeyRef.current === tileKey) {
      return;
    }
    lastStagedTileKeyRef.current = tileKey;
    const tileParcelState = getTileParcelState(x, y);

    if (pendingAsset) {
      if (tileParcelState !== 'unlocked' && tileParcelState !== 'pending_unlock') {
        showBuildToast('Unlock this grass tile before placing assets');
        return;
      }
      const isAlreadyPending = useGameStore.getState().customAssets.some(
        (asset) => asset.isPending && asset.x === x && asset.y === y && asset.name === pendingAsset.name,
      );
      if (!isAlreadyPending) {
        addCustomAsset(x, y);
      }
      return;
    }

    if (tileParcelState === 'available') {
      queueParcelUnlock(x, y);
      return;
    }

    if (tileParcelState === 'future' || tileParcelState === 'blocked') {
      showBuildToast('Unlock from the current boundary before expanding outward');
      return;
    }

    const footprint = getBrushFootprintTiles(
      { x, y },
      buildBrushWidth,
      buildBrushLength,
      visibleTerrainBounds.minX,
      visibleTerrainBounds.maxX,
      visibleTerrainBounds.minY,
      visibleTerrainBounds.maxY,
    );

    if (footprint.length !== buildBrushWidth * buildBrushLength) {
      showBuildToast('Brush footprint must stay inside the terrain boundary');
      return;
    }

    const blockedFootprint = footprint.some((tile) => {
      const state = getTileParcelState(tile.x, tile.y);
      return state !== 'unlocked' && state !== 'pending_unlock';
    });

    if (blockedFootprint) {
      showBuildToast('Unlock the surrounding grass tiles before building this footprint');
      return;
    }

    addPendingBuildTiles(footprint);
  }, [
    addCustomAsset,
    addPendingBuildTiles,
    buildBrushLength,
    buildBrushWidth,
    pendingAsset,
    queueParcelUnlock,
    showBuildToast,
    visibleTerrainBounds,
  ]);

  const clearDragState = useCallback(() => {
    dragActiveRef.current = false;
    lastStagedTileKeyRef.current = null;
  }, []);

  const updateHoveredTile = useCallback(
    (next: { x: number; y: number } | null) => {
      setHoveredTile((current) => {
        if (isSameTile(current, next)) return current;
        onHoverTileChange?.(next);
        return next;
      });
    },
    [onHoverTileChange],
  );

  useEffect(() => {
    const handlePointerUp = () => {
      clearDragState();
    };
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [clearDragState]);

  const handleTileHover = useCallback((x: number, y: number) => {
    updateHoveredTile({ x, y });
  }, [updateHoveredTile]);

  const handleTileBuildStart = useCallback((x: number, y: number) => {
    dragActiveRef.current = true;
    lastStagedTileKeyRef.current = null;
    stageBuildAtTile(x, y);
  }, [stageBuildAtTile]);

  const handleTileBuildDrag = useCallback((x: number, y: number) => {
    if (!dragActiveRef.current) return;
    stageBuildAtTile(x, y);
  }, [stageBuildAtTile]);

  const handlePointerMove = (e: any) => {
    e.stopPropagation();
    if (e.instanceId !== undefined) {
      const next = instanceIdToTile(
        e.instanceId,
        visibleGridWidth,
        visibleTerrainBounds.minX,
        visibleTerrainBounds.minY,
      );
      updateHoveredTile(next);
      if (isBuildMode && dragActiveRef.current && (e.buttons ?? 0) === 1) {
        stageBuildAtTile(next.x, next.y);
      }
    }
  };

  const handlePointerLeaveGroup = () => {
    updateHoveredTile(null);
    clearDragState();
  };

  const handlePointerDown = (e: any) => {
    if (isBuildMode && e.instanceId !== undefined) {
      e.stopPropagation();
      dragActiveRef.current = true;
      lastStagedTileKeyRef.current = null;
      const { x, y } = instanceIdToTile(
        e.instanceId,
        visibleGridWidth,
        visibleTerrainBounds.minX,
        visibleTerrainBounds.minY,
      );
      stageBuildAtTile(x, y);
    }
  };

  const activeTiles: Array<{ x: number; y: number; elevation: number }> = Array.from(activeTilesMap.values());

  return (
    <group onPointerLeave={handlePointerLeaveGroup}>
      {/* Base Grid using InstancedMesh */}
      <instancedMesh 
        ref={meshRef} 
        args={[undefined, undefined, visibleGridWidth * visibleGridHeight]}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
      >
        <boxGeometry args={[1 - TILE_GAP, 0.5, 1 - TILE_GAP]} />
        <meshLambertMaterial flatShading />
      </instancedMesh>

      {/* Active tiles (built, pending, hovered, elevated) */}
      {activeTiles.map(t => (
        <Tile 
          key={`${t.x}-${t.y}`} 
          x={t.x} 
          y={t.y} 
          elevation={t.elevation} 
          pendingCount={pendingTileCountMap.get(`${t.x},${t.y}`) ?? 0}
          builtCount={builtTileCountMap.get(`${t.x},${t.y}`) ?? 0}
          isBuildMode={isBuildMode}
          tileState={getTileParcelState(t.x, t.y)}
          isBuildingOccupied={buildingFootprintTileSet.has(`${t.x},${t.y}`)}
          pendingAsset={pendingAsset}
          isPreviewed={hoveredBrushPreview.keys.has(`${t.x},${t.y}`)}
          isPreviewBlocked={hoveredBrushPreview.blocked}
          isHovered={hoveredTile?.x === t.x && hoveredTile?.y === t.y}
          onHover={handleTileHover}
          onBuildStart={handleTileBuildStart}
          onBuildDrag={handleTileBuildDrag}
        />
      ))}
    </group>
  );
}
