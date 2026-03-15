import React from 'react';
import * as THREE from 'three';
import {
  TILE_GAP,
  gridCoordToWorld,
  isTerrainCoord,
} from '../../constants/gameData';
import type { PendingAsset } from '../../store/gameStore';

interface TileProps {
  x: number;
  y: number;
  elevation: number;
  pendingCount: number;
  builtCount: number;
  isBuildMode: boolean;
  tileState: 'pending_unlock' | 'unlocked' | 'available' | 'future' | 'blocked';
  isBuildingOccupied: boolean;
  pendingAsset: PendingAsset | null;
  isPreviewed?: boolean;
  isPreviewBlocked?: boolean;
  isHovered?: boolean;
  onHover?: (x: number, y: number) => void;
  onBuildStart?: (x: number, y: number) => void;
  onBuildDrag?: (x: number, y: number) => void;
}

const roadColor = '#3d3c45';
const dirtColor = '#35343d';
const grassColor = '#2c2b31';
const roadEdgeColor = '#2a2930';
const dirtEdgeColor = '#26252b';
const grassEdgeColor = '#1e1d22';
const pendingFillColor = '#ff9a3c';
const pendingEdgeColor = '#ffd27a';
const blockedPreviewFill = '#6b4a6f';
const blockedPreviewEdge = '#f1a2c0';
const raisedBlockColor = '#505057';
const raisedBlockHoverColor = '#595960';
const raisedBlockEdgeColor = '#3d3d44';

export const Tile = React.memo(function Tile({
  x,
  y,
  elevation,
  pendingCount,
  builtCount,
  isBuildMode,
  tileState,
  isBuildingOccupied,
  pendingAsset,
  isPreviewed = false,
  isPreviewBlocked = false,
  isHovered = false,
  onHover,
  onBuildStart,
  onBuildDrag,
}: TileProps) {
  const disableRaycast = React.useCallback(() => null, []);
  const hovered = isHovered;
  const isPending = pendingCount > 0;
  
  const posX = gridCoordToWorld(x);
  const posZ = gridCoordToWorld(y);
  
  const isBaseGrid = isTerrainCoord(x, y);
  let blocksCount = builtCount + pendingCount;
  if (!isBaseGrid) {
    blocksCount = Math.max(0, blocksCount - 1);
  }
  
  const addedHeight = blocksCount * 0.5;
  const baseHeight = 0.5;
  const aboveGroundHeight = isBuildingOccupied ? 0 : elevation + addedHeight;
  const totalHeight = baseHeight + aboveGroundHeight;
  const mergedPlotSize = isBuildingOccupied ? 1 : 1 - TILE_GAP;
  const hidePlotEdges = isBuildingOccupied;

  const handleBuildPointerDown = (e: any) => {
    if (!isBuildMode) return;
    e.stopPropagation();
    onBuildStart?.(x, y);
  };

  const handleBuildPointerEnter = (e: any) => {
    if (!isBuildMode) return;
    if ((e.buttons ?? 0) !== 1) return;
    e.stopPropagation();
    onBuildDrag?.(x, y);
  };

  const getPlotColor = () => {
    if (isPending) return pendingFillColor;
    if (isBuildMode && isPreviewed && isPreviewBlocked) return blockedPreviewFill;
    if (isBuildMode && isPreviewed && (builtCount > 0 || isBuildingOccupied)) return '#59575f';
    if (isBuildMode && isPreviewed) return tileState === 'unlocked' ? '#4d4b52' : '#403e45';
    if (isBuildMode && hovered && (builtCount > 0 || isBuildingOccupied)) return '#514f57';
    if (hovered && (builtCount > 0 || isBuildingOccupied)) return '#48464d';
    if (builtCount > 0 || isBuildingOccupied) return roadColor;
    if (tileState === 'pending_unlock') return '#45434a';
    if (isBuildMode && hovered && pendingAsset) return '#5a5860';
    if (isBuildMode && hovered) return tileState === 'unlocked' ? '#434148' : '#37353b';
    if (hovered) return tileState === 'unlocked' ? '#3d3b42' : '#313036';
    if (tileState === 'unlocked') return dirtColor;
    return grassColor;
  };

  const getBuildingColor = () => {
    if (isPending) return '#ffb54f';
    if (hovered) return raisedBlockHoverColor;
    return raisedBlockColor;
  };

  const getPlotEdgeColor = () => {
    if (isPending) return pendingEdgeColor;
    if (isBuildMode && isPreviewed && isPreviewBlocked) return blockedPreviewEdge;
    if (isBuildMode && isPreviewed && (builtCount > 0 || isBuildingOccupied)) return '#918d98';
    if (isBuildMode && isPreviewed) return tileState === 'unlocked' ? '#78747d' : '#646067';
    if (builtCount > 0 || isBuildingOccupied) return roadEdgeColor;
    if (tileState === 'pending_unlock') return '#727078';
    if (isBuildMode && hovered && pendingAsset) return '#87848c';
    if (isBuildMode && hovered) return tileState === 'unlocked' ? '#706d74' : '#5d5a61';
    if (hovered) return tileState === 'unlocked' ? '#67646a' : '#525057';
    return tileState === 'unlocked' ? dirtEdgeColor : grassEdgeColor;
  };

  const getBuildingEdgeColor = () => {
    if (isPending) return '#ffe18a';
    return raisedBlockEdgeColor;
  };
  
  return (
    <group 
      position={[posX, 0, posZ]}
      onPointerEnter={(e) => {
        e.stopPropagation();
        if (onHover) onHover(x, y);
      }}
      onPointerMove={(e) => {
        e.stopPropagation();
        if (onHover) onHover(x, y);
      }}
    >
      {isBuildMode && (
        <mesh
          position={[0, baseHeight / 2 + 0.02, 0]}
          onPointerOver={(e) => e.stopPropagation()}
          onPointerMove={(e) => {
            e.stopPropagation();
            if (onHover) onHover(x, y);
          }}
          onPointerDown={handleBuildPointerDown}
          onPointerEnter={handleBuildPointerEnter}
        >
          <boxGeometry args={[1, 0.04, 1]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      {/* If there is a pending asset and we are hovering, show a cursor for it */}
      {isBuildMode && hovered && pendingAsset && (
        <mesh
          position={[
            ((pendingAsset.rotation % 180 === 0 ? pendingAsset.width : pendingAsset.length) - 1) / 2,
            totalHeight + 0.05,
            ((pendingAsset.rotation % 180 === 0 ? pendingAsset.length : pendingAsset.width) - 1) / 2,
          ]}
        >
          <boxGeometry
            args={[
              Math.max(0.1, (pendingAsset.rotation % 180 === 0 ? pendingAsset.width : pendingAsset.length) - TILE_GAP),
              0.1,
              Math.max(0.1, (pendingAsset.rotation % 180 === 0 ? pendingAsset.length : pendingAsset.width) - TILE_GAP),
            ]}
          />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.5} />
        </mesh>
      )}

      {/* Plot (Underground) */}
      <group position={[0, baseHeight / 2, 0]}>
        <mesh 
          raycast={isBuildMode ? disableRaycast : undefined}
          onPointerOver={(e) => e.stopPropagation()}
          onPointerDown={handleBuildPointerDown}
          onPointerEnter={handleBuildPointerEnter}
        >
          <boxGeometry args={[mergedPlotSize, baseHeight, mergedPlotSize]} />
            <meshLambertMaterial 
              color={getPlotColor()} 
              flatShading
            />
          </mesh>
        {!hidePlotEdges && (
          <lineSegments raycast={isBuildMode ? disableRaycast : undefined}>
            <edgesGeometry args={[new THREE.BoxGeometry(mergedPlotSize, baseHeight, mergedPlotSize)]} />
            <lineBasicMaterial color={getPlotEdgeColor()} />
          </lineSegments>
        )}
      </group>

      {/* Building (Above Ground) */}
      {aboveGroundHeight > 0 && (
        <group position={[0, baseHeight + aboveGroundHeight / 2, 0]}>
          <mesh 
            raycast={isBuildMode ? disableRaycast : undefined}
            onPointerOver={(e) => e.stopPropagation()}
            onPointerDown={handleBuildPointerDown}
            onPointerEnter={handleBuildPointerEnter}
          >
            <boxGeometry args={[1 - TILE_GAP, aboveGroundHeight, 1 - TILE_GAP]} />
            <meshLambertMaterial 
              color={getBuildingColor()} 
              flatShading
            />
          </mesh>
          <lineSegments raycast={isBuildMode ? disableRaycast : undefined}>
            <edgesGeometry args={[new THREE.BoxGeometry(1 - TILE_GAP, aboveGroundHeight, 1 - TILE_GAP)]} />
            <lineBasicMaterial color={getBuildingEdgeColor()} />
          </lineSegments>
        </group>
      )}
    </group>
  );
});
