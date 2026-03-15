export interface FootprintTile {
  x: number;
  y: number;
}

export interface AxisAlignedFootprint {
  widthTiles: number;
  depthTiles: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  centerX: number;
  centerY: number;
  tiles: FootprintTile[];
}

const TILE_HALF_EXTENT = 0.5;
const AXIS_ALIGNMENT_EPSILON = 0.001;

const overlapsOrientedRect = (
  tileCenterX: number,
  tileCenterY: number,
  rectCenterX: number,
  rectCenterY: number,
  halfWidth: number,
  halfDepth: number,
  rotationDeg: number,
) => {
  const theta = (rotationDeg * Math.PI) / 180;
  const ux = Math.cos(theta);
  const uy = Math.sin(theta);
  const vx = -uy;
  const vy = ux;
  const dx = tileCenterX - rectCenterX;
  const dy = tileCenterY - rectCenterY;

  const axes = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: ux, y: uy },
    { x: vx, y: vy },
  ];

  return axes.every((axis) => {
    const centerProjection = Math.abs(dx * axis.x + dy * axis.y);
    const rectProjection =
      halfWidth * Math.abs(ux * axis.x + uy * axis.y) +
      halfDepth * Math.abs(vx * axis.x + vy * axis.y);
    const tileProjection = TILE_HALF_EXTENT * Math.abs(axis.x) + TILE_HALF_EXTENT * Math.abs(axis.y);
    return centerProjection <= rectProjection + tileProjection;
  });
};

export const computeBuildingFootprintTiles = (
  centerX: number,
  centerY: number,
  width: number,
  depth: number,
  rotationDeg: number,
): FootprintTile[] => {
  const normalizedRotation = ((rotationDeg % 360) + 360) % 360;
  if (
    Math.abs(normalizedRotation - 0) < AXIS_ALIGNMENT_EPSILON ||
    Math.abs(normalizedRotation - 90) < AXIS_ALIGNMENT_EPSILON ||
    Math.abs(normalizedRotation - 180) < AXIS_ALIGNMENT_EPSILON ||
    Math.abs(normalizedRotation - 270) < AXIS_ALIGNMENT_EPSILON
  ) {
    return computeAxisAlignedFootprint(centerX, centerY, width, depth, normalizedRotation).tiles;
  }

  const halfWidth = Math.max(width, 0.2) / 2;
  const halfDepth = Math.max(depth, 0.2) / 2;
  const searchRadius = Math.ceil(Math.sqrt(halfWidth ** 2 + halfDepth ** 2) + 1);
  const tiles: FootprintTile[] = [];

  for (let y = centerY - searchRadius; y <= centerY + searchRadius; y += 1) {
    for (let x = centerX - searchRadius; x <= centerX + searchRadius; x += 1) {
      if (overlapsOrientedRect(x, y, centerX, centerY, halfWidth, halfDepth, rotationDeg)) {
        tiles.push({ x, y });
      }
    }
  }

  return tiles;
};

const getFootprintTileSpan = (size: number) => Math.max(1, Math.ceil(Math.max(size, 0.2) - 0.08));

export const computeAxisAlignedFootprint = (
  anchorX: number,
  anchorY: number,
  width: number,
  depth: number,
  rotationDeg = 0,
): AxisAlignedFootprint => {
  const normalizedRotation = ((rotationDeg % 360) + 360) % 360;
  const swapAxes = Math.abs(normalizedRotation - 90) < AXIS_ALIGNMENT_EPSILON || Math.abs(normalizedRotation - 270) < AXIS_ALIGNMENT_EPSILON;
  const effectiveWidth = swapAxes ? depth : width;
  const effectiveDepth = swapAxes ? width : depth;
  const widthTiles = getFootprintTileSpan(effectiveWidth);
  const depthTiles = getFootprintTileSpan(effectiveDepth);
  const minX = anchorX - Math.floor(widthTiles / 2);
  const minY = anchorY - Math.floor(depthTiles / 2);
  const maxX = minX + widthTiles - 1;
  const maxY = minY + depthTiles - 1;
  const tiles: FootprintTile[] = [];

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      tiles.push({ x, y });
    }
  }

  return {
    widthTiles,
    depthTiles,
    minX,
    maxX,
    minY,
    maxY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    tiles,
  };
};
