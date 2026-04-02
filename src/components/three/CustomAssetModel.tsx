import React from 'react';
import * as THREE from 'three';
import { CustomAsset, useGameStore } from '../../store/gameStore';
import { gridCoordToWorld } from '../../constants/gameData';
import { CanvasBillboardTag } from './CanvasBillboardTag';

interface CustomAssetModelProps {
  data: CustomAsset;
  onSelect: (id: string) => void;
}

export function CustomAssetModel({ data, onSelect }: CustomAssetModelProps) {
  const isBuildMode = useGameStore((state) => state.isBuildMode);
  const disableRaycast = React.useCallback(() => null, []);

  const footprintWidth = data.rotation % 180 === 0 ? data.width : data.length;
  const footprintLength = data.rotation % 180 === 0 ? data.length : data.width;
  const posX = gridCoordToWorld(data.x) + (footprintWidth - 1) / 2;
  const posZ = gridCoordToWorld(data.y) + (footprintLength - 1) / 2;

  return (
    <group
      position={[posX, 0.05, posZ]}
      rotation={[0, (data.rotation * Math.PI) / 180, 0]}
      raycast={isBuildMode ? disableRaycast : undefined}
      onClick={isBuildMode ? undefined : (e) => {
        e.stopPropagation();
        onSelect(data.id);
      }}
    >
      <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={isBuildMode ? disableRaycast : undefined}>
        <planeGeometry args={[Math.max(0.35, footprintWidth - 0.08), Math.max(0.35, footprintLength - 0.08)]} />
        <meshBasicMaterial color={data.isPending ? '#0f766e' : '#1f2937'} transparent opacity={0.78} />
      </mesh>

      <lineSegments position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={isBuildMode ? disableRaycast : undefined}>
        <edgesGeometry args={[new THREE.PlaneGeometry(Math.max(0.35, footprintWidth - 0.08), Math.max(0.35, footprintLength - 0.08))]} />
        <lineBasicMaterial color={data.isPending ? '#5eead4' : '#93c5fd'} />
      </lineSegments>

      <CanvasBillboardTag
        position={[0, 0.18, 0]}
        height={0.42}
        minWidth={194}
        backgroundColor="rgba(7, 17, 29, 0.88)"
        borderColor="rgba(34, 211, 238, 0.4)"
        shadowColor="rgba(0, 0, 0, 0.45)"
        lines={[
          {
            text: data.isPending ? 'Pending Asset' : 'Flat Asset',
            color: '#67e8f9',
            fontSize: 14,
            fontWeight: 700,
          },
          {
            text: data.name,
            color: '#ffffff',
            fontSize: 18,
            fontWeight: 700,
          },
          {
            text: `${footprintWidth} x ${footprintLength}`,
            color: '#cbd5e1',
            fontSize: 14,
            fontWeight: 600,
          },
        ]}
      />
    </group>
  );
}
