import cameraConfigJson from '../data/camera-config.json';
import type { CameraConfigEntry } from '../types/game';

export const DEFAULT_CAMERA_CONFIG = cameraConfigJson as CameraConfigEntry;
const CAMERA_CONFIG_STORAGE_KEY = 'claw-colony:camera-config';

const roundVector = (value: number) => Number(value.toFixed(3));

export const normalizeCameraConfig = (config: CameraConfigEntry): CameraConfigEntry => ({
  position: {
    x: roundVector(config.position.x),
    y: roundVector(config.position.y),
    z: roundVector(config.position.z),
  },
  target: {
    x: roundVector(config.target.x),
    y: roundVector(config.target.y),
    z: roundVector(config.target.z),
  },
  fov: roundVector(config.fov),
});

const isCameraConfigEntry = (value: unknown): value is CameraConfigEntry => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const config = value as Record<string, unknown>;
  const position = config.position as Record<string, unknown> | undefined;
  const target = config.target as Record<string, unknown> | undefined;
  return !!position
    && !!target
    && typeof position.x === 'number'
    && typeof position.y === 'number'
    && typeof position.z === 'number'
    && typeof target.x === 'number'
    && typeof target.y === 'number'
    && typeof target.z === 'number'
    && typeof config.fov === 'number';
};

export const readCachedCameraConfig = (): CameraConfigEntry | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(CAMERA_CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isCameraConfigEntry(parsed) ? normalizeCameraConfig(parsed) : null;
  } catch {
    return null;
  }
};

export const cacheCameraConfig = (config: CameraConfigEntry): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CAMERA_CONFIG_STORAGE_KEY, JSON.stringify(normalizeCameraConfig(config)));
  } catch {
    // Ignore storage write failures; the project JSON remains the source of truth.
  }
};

export const loadCameraConfig = async (): Promise<CameraConfigEntry> => {
  const response = await fetch('/__codex/camera-config', {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to load camera config');
  }

  const payload = await response.json();
  if (!isCameraConfigEntry(payload)) {
    throw new Error('Invalid camera config payload');
  }

  const normalized = normalizeCameraConfig(payload);
  cacheCameraConfig(normalized);
  return normalized;
};

export const saveCameraConfig = async (config: CameraConfigEntry): Promise<void> => {
  const normalized = normalizeCameraConfig(config);
  cacheCameraConfig(normalized);

  const response = await fetch('/__codex/camera-config', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(normalized),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Failed to save camera config');
  }
};
