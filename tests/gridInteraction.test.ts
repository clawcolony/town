import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getBrushFootprintTiles,
  instanceIdToTile,
  isSameTile,
  resolveTileBuildTarget,
} from '../src/components/three/gridInteraction.ts';

test('instanceIdToTile maps instance id to grid coordinate', () => {
  assert.deepEqual(instanceIdToTile(0, 24), { x: 0, y: 0 });
  assert.deepEqual(instanceIdToTile(23, 24), { x: 23, y: 0 });
  assert.deepEqual(instanceIdToTile(24, 24), { x: 0, y: 1 });
  assert.deepEqual(instanceIdToTile(97, 24), { x: 1, y: 4 });
  assert.deepEqual(instanceIdToTile(0, 24, -3), { x: -3, y: -3 });
  assert.deepEqual(instanceIdToTile(24, 6, -3, 2), { x: -3, y: 6 });
});

test('resolveTileBuildTarget keeps click target on hovered tile', () => {
  const tile = { x: 7, y: 11 };
  const normalBuild = resolveTileBuildTarget(tile, -3, 18, -3, 18, false);
  assert.deepEqual(normalBuild, { target: tile, inBounds: true });
});

test('resolveTileBuildTarget validates asset placement bounds', () => {
  const inBounds = resolveTileBuildTarget({ x: 5, y: 6 }, -3, 18, -3, 18, true);
  const outOfBounds = resolveTileBuildTarget({ x: -4, y: 6 }, -3, 18, -3, 18, true);
  assert.equal(inBounds.inBounds, true);
  assert.equal(outOfBounds.inBounds, false);
});

test('getBrushFootprintTiles returns a centered n x n footprint', () => {
  assert.deepEqual(
    getBrushFootprintTiles({ x: 5, y: 5 }, 3, 3, -3, 18, -3, 18),
    [
      { x: 4, y: 4 },
      { x: 5, y: 4 },
      { x: 6, y: 4 },
      { x: 4, y: 5 },
      { x: 5, y: 5 },
      { x: 6, y: 5 },
      { x: 4, y: 6 },
      { x: 5, y: 6 },
      { x: 6, y: 6 },
    ],
  );
});

test('getBrushFootprintTiles clips footprint at terrain bounds', () => {
  assert.deepEqual(
    getBrushFootprintTiles({ x: -3, y: -3 }, 3, 3, -3, 18, -3, 18),
    [
      { x: -3, y: -3 },
      { x: -2, y: -3 },
      { x: -3, y: -2 },
      { x: -2, y: -2 },
    ],
  );
});

test('isSameTile compares tile identity safely', () => {
  assert.equal(isSameTile(null, null), true);
  assert.equal(isSameTile({ x: 1, y: 2 }, { x: 1, y: 2 }), true);
  assert.equal(isSameTile({ x: 1, y: 2 }, { x: 2, y: 1 }), false);
  assert.equal(isSameTile({ x: 1, y: 2 }, null), false);
});
