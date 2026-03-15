export type TileCoord = { x: number; y: number };

export const isSameTile = (a: TileCoord | null, b: TileCoord | null): boolean => {
  if (!a || !b) return a === b;
  return a.x === b.x && a.y === b.y;
};

export const instanceIdToTile = (
  instanceId: number,
  gridWidth: number,
  gridMinX = 0,
  gridMinY = gridMinX,
): TileCoord => {
  return {
    x: gridMinX + (instanceId % gridWidth),
    y: gridMinY + Math.floor(instanceId / gridWidth),
  };
};

export const resolveTileBuildTarget = (
  tile: TileCoord,
  gridMinX: number,
  gridMaxX: number,
  gridMinY: number,
  gridMaxY: number,
  isAssetPlacement: boolean,
): { target: TileCoord; inBounds: boolean } => {
  if (!isAssetPlacement) {
    return { target: tile, inBounds: true };
  }
  const inBounds =
    tile.x >= gridMinX &&
    tile.x <= gridMaxX &&
    tile.y >= gridMinY &&
    tile.y <= gridMaxY;
  return { target: tile, inBounds };
};

export const getBrushFootprintTiles = (
  centerTile: TileCoord,
  width: number,
  length: number,
  gridMinX: number,
  gridMaxX: number,
  gridMinY: number,
  gridMaxY: number,
): TileCoord[] => {
  const normalizedWidth = Math.max(1, Math.floor(width));
  const normalizedLength = Math.max(1, Math.floor(length));
  const startX = centerTile.x - Math.floor((normalizedWidth - 1) / 2);
  const startY = centerTile.y - Math.floor((normalizedLength - 1) / 2);
  const tiles: TileCoord[] = [];

  for (let y = 0; y < normalizedLength; y += 1) {
    for (let x = 0; x < normalizedWidth; x += 1) {
      const tileX = startX + x;
      const tileY = startY + y;
      if (
        tileX >= gridMinX &&
        tileX <= gridMaxX &&
        tileY >= gridMinY &&
        tileY <= gridMaxY
      ) {
        tiles.push({ x: tileX, y: tileY });
      }
    }
  }

  return tiles;
};
