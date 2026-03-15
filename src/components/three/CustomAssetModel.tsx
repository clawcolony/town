import React, { useMemo, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { CustomAsset, useGameStore } from '../../store/gameStore';
import { getElevation, gridCoordToWorld, isTerrainCoord } from '../../constants/gameData';

interface CustomAssetModelProps {
  data: CustomAsset;
  onSelect: (id: string) => void;
}

export function CustomAssetModel({ data, onSelect }: CustomAssetModelProps) {
  const isBuildMode = useGameStore((state) => state.isBuildMode);
  const disableRaycast = useMemo(() => (() => null), []);
  const { scene } = useGLTF(data.url);
  const clonedScene = useMemo(() => scene.clone(), [scene]);

  useEffect(() => {
    // Optionally automatically compute bounding box or handle material tweaks
    // If the model is too dark, it might not have proper material or lighting settings
    clonedScene.traverse((child: any) => {
      if (child.isMesh) {
        // Just ensure materials react to lighting properly
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m: any) => {
              m.needsUpdate = true;
            });
          } else {
            child.material.needsUpdate = true;
          }
        }
      }
    });
  }, [clonedScene]);

  const elevation = getElevation(data.x, data.y);
  // Get built count at this tile to determine true height
  const builtCount = useGameStore.getState().builtTiles.filter(t => t.x === data.x && t.y === data.y).length;
  // If not in base grid, builtCount starts at -1 essentially
  const isBaseGrid = isTerrainCoord(data.x, data.y);
  let blocksCount = builtCount;
  if (!isBaseGrid) {
    blocksCount = Math.max(0, blocksCount - 1);
  }

  const footprintWidth = data.rotation % 180 === 0 ? data.width : data.length;
  const footprintLength = data.rotation % 180 === 0 ? data.length : data.width;
  
  // Position needs to account for the grid size and potential multi-tile spans
  // The center is calculated based on the bottom-left coordinate (x, y)
  // For a 1x1, it's just the coordinate offset
  // For NxM, we offset by half the extra size to center it visually
  
  const posX = gridCoordToWorld(data.x) + (footprintWidth - 1) / 2;
  const posZ = gridCoordToWorld(data.y) + (footprintLength - 1) / 2;
  
  // Base height is 0.5 + elevation. Added blocks are 0.5 each.
  // The tile itself has a height of `0.5 + elevation + blocksCount * 0.5`. 
  // Since its center is at `height / 2`, the top surface is exactly at `height`.
  const topSurfaceY = 0.5 + elevation + blocksCount * 0.5;
  const height = topSurfaceY;

  useEffect(() => {
    // Ensure world matrices are updated before computing bounding box
    clonedScene.position.set(0, 0, 0);
    clonedScene.scale.setScalar(1);
    clonedScene.updateMatrixWorld(true);
    
    // When the model loads, we want to auto-scale it so it fits the intended footprint
    const box = new THREE.Box3().setFromObject(clonedScene);
    
    if (box.isEmpty()) {
      console.warn("Bounding box is empty for the loaded model.");
      return;
    }
    
    const size = box.getSize(new THREE.Vector3());
    
    // We want the model's bounding box to fit inside our target area
    const scaleX = data.width / (size.x || 1);
    const scaleZ = data.length / (size.z || 1);
    
    const scale = Math.min(scaleX, scaleZ) * 0.9;
    clonedScene.scale.setScalar(scale);

    // Update matrices again after scaling
    clonedScene.updateMatrixWorld(true);

    const scaledBox = new THREE.Box3().setFromObject(clonedScene);
    const center = scaledBox.getCenter(new THREE.Vector3());
    const min = scaledBox.min;
    
    clonedScene.position.x = -center.x;
    clonedScene.position.y = -min.y; // Shift up so bottom is at 0
    clonedScene.position.z = -center.z;
    
  }, [clonedScene, data.width, data.length]);

  return (
    <group 
      position={[posX, height, posZ]} 
      rotation={[0, (data.rotation * Math.PI) / 180, 0]}
      raycast={isBuildMode ? disableRaycast : undefined}
      onClick={isBuildMode ? undefined : (e) => {
        e.stopPropagation();
        onSelect(data.id);
      }}
    >
      <primitive object={clonedScene} raycast={isBuildMode ? disableRaycast : undefined} />
    </group>
  );
}
