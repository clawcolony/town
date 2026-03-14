import test from 'node:test';
import assert from 'node:assert/strict';
import { computeAxisAlignedFootprint, computeBuildingFootprintTiles } from '../src/components/three/buildingFootprint';

test('computeBuildingFootprintTiles keeps a compact 1x1 footprint on its center tile', () => {
  const tiles = computeBuildingFootprintTiles(4, 6, 0.92, 0.92, 0);
  assert.deepEqual(tiles, [{ x: 4, y: 6 }]);
});

test('computeBuildingFootprintTiles snaps axis-aligned buildings to discrete tile spans', () => {
  const tiles = computeBuildingFootprintTiles(0, 0, 1.8, 1.8, 0);
  assert.equal(tiles.length, 4);
  assert.deepEqual(tiles, [
    { x: -1, y: -1 },
    { x: 0, y: -1 },
    { x: -1, y: 0 },
    { x: 0, y: 0 },
  ]);
});

test('computeAxisAlignedFootprint exposes the snapped center for even-width buildings', () => {
  const footprint = computeAxisAlignedFootprint(8, 6, 1.8, 2.6, 0);
  assert.equal(footprint.widthTiles, 2);
  assert.equal(footprint.depthTiles, 3);
  assert.equal(footprint.centerX, 7.5);
  assert.equal(footprint.centerY, 6);
  assert.deepEqual(footprint.tiles, [
    { x: 7, y: 5 },
    { x: 8, y: 5 },
    { x: 7, y: 6 },
    { x: 8, y: 6 },
    { x: 7, y: 7 },
    { x: 8, y: 7 },
  ]);
});

test('computeBuildingFootprintTiles respects building rotation when projecting occupied tiles', () => {
  const tiles = computeBuildingFootprintTiles(0, 0, 2.2, 0.8, 45);
  assert(tiles.some((tile) => tile.x === 0 && tile.y === 0));
  assert(tiles.some((tile) => tile.x === 1 && tile.y === 1));
  assert(!tiles.some((tile) => tile.x === 0 && tile.y === 2));
});
