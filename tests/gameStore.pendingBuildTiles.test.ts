import test from 'node:test';
import assert from 'node:assert/strict';
import { useGameStore } from '../src/store/gameStore.ts';

test('addPendingBuildTile de-duplicates same coordinate', () => {
  useGameStore.setState({ pendingBuildTiles: [] });
  const store = useGameStore.getState();

  store.addPendingBuildTile(3, 4);
  store.addPendingBuildTile(3, 4);
  store.addPendingBuildTile(3, 4);

  const tiles = useGameStore.getState().pendingBuildTiles;
  assert.equal(tiles.length, 1);
  assert.deepEqual(tiles[0], { x: 3, y: 4 });
});

test('addPendingBuildTile still allows distinct coordinates', () => {
  useGameStore.setState({ pendingBuildTiles: [] });
  const store = useGameStore.getState();

  store.addPendingBuildTile(1, 1);
  store.addPendingBuildTile(1, 2);
  store.addPendingBuildTile(2, 1);

  const tiles = useGameStore.getState().pendingBuildTiles;
  assert.equal(tiles.length, 3);
});

test('addPendingBuildTiles de-duplicates both existing and repeated footprint tiles', () => {
  useGameStore.setState({ pendingBuildTiles: [{ x: 2, y: 2 }] });
  const store = useGameStore.getState();

  store.addPendingBuildTiles([
    { x: 2, y: 2 },
    { x: 2, y: 3 },
    { x: 2, y: 3 },
    { x: 3, y: 3 },
  ]);

  const tiles = useGameStore.getState().pendingBuildTiles;
  assert.deepEqual(tiles, [
    { x: 2, y: 2 },
    { x: 2, y: 3 },
    { x: 3, y: 3 },
  ]);
});

test('queueParcelUnlock queues a single grass tile once', () => {
  useGameStore.setState({ unlockedParcelIds: [], pendingUnlockParcelIds: [] });
  const store = useGameStore.getState();

  store.queueParcelUnlock(3, 4);
  store.queueParcelUnlock(3, 4);

  assert.deepEqual(useGameStore.getState().pendingUnlockParcelIds, ['3,4']);
});

test('commitBuildTiles de-duplicates unlocked grass tiles on save', () => {
  useGameStore.setState({
    builtTiles: [],
    pendingBuildTiles: [],
    unlockedParcelIds: ['0,0'],
    pendingUnlockParcelIds: ['1,0', '1,0'],
    customAssets: [],
  });

  useGameStore.getState().commitBuildTiles();

  assert.deepEqual(useGameStore.getState().unlockedParcelIds, ['0,0', '1,0']);
});
