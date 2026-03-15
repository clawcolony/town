import fs from 'node:fs/promises';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { Plugin, defineConfig, loadEnv } from 'vite';

const layoutConfigPath = path.resolve(__dirname, 'src/data/building-layout.json');
const cameraConfigPath = path.resolve(__dirname, 'src/data/camera-config.json');

const isValidLayoutPayload = (value: unknown): value is Record<string, { x: number; y: number; extraBlocks: number; modelScale: number }> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).every((entry) => (
    !!entry
    && typeof entry === 'object'
    && !Array.isArray(entry)
    && typeof entry.x === 'number'
    && typeof entry.y === 'number'
    && typeof entry.extraBlocks === 'number'
    && typeof entry.modelScale === 'number'
  ));
};

const isValidCameraPayload = (
  value: unknown,
): value is { position: { x: number; y: number; z: number }; target: { x: number; y: number; z: number }; fov: number } => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  const position = payload.position as Record<string, unknown> | undefined;
  const target = payload.target as Record<string, unknown> | undefined;
  return !!position
    && !!target
    && typeof position.x === 'number'
    && typeof position.y === 'number'
    && typeof position.z === 'number'
    && typeof target.x === 'number'
    && typeof target.y === 'number'
    && typeof target.z === 'number'
    && typeof payload.fov === 'number';
};

const buildingLayoutPersistencePlugin = (): Plugin => ({
  name: 'building-layout-persistence',
  configureServer(server) {
    server.middlewares.use('/__codex/building-layout', async (req, res, next) => {
      if (req.method !== 'POST') {
        next();
        return;
      }

      try {
        const chunks: Uint8Array[] = [];
        for await (const chunk of req) {
          chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
        }

        const raw = Buffer.concat(chunks).toString('utf8');
        const payload = JSON.parse(raw);

        if (!isValidLayoutPayload(payload)) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end('Invalid building layout payload');
          return;
        }

        await fs.writeFile(layoutConfigPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ ok: true }));
      } catch (error) {
        console.error('[building-layout-persistence]', error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('Failed to save building layout config');
      }
    });

    server.middlewares.use('/__codex/camera-config', async (req, res, next) => {
      if (req.method === 'GET') {
        try {
          const raw = await fs.readFile(cameraConfigPath, 'utf8');
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(raw);
        } catch (error) {
          console.error('[camera-config-read]', error);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end('Failed to read camera config');
        }
        return;
      }

      if (req.method !== 'POST') {
        next();
        return;
      }

      try {
        const chunks: Uint8Array[] = [];
        for await (const chunk of req) {
          chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
        }

        const raw = Buffer.concat(chunks).toString('utf8');
        const payload = JSON.parse(raw);

        if (!isValidCameraPayload(payload)) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.end('Invalid camera config payload');
          return;
        }

        await fs.writeFile(cameraConfigPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ ok: true }));
      } catch (error) {
        console.error('[camera-config-persistence]', error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('Failed to save camera config');
      }
    });
  },
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const runtimeProxyTarget = env.VITE_RUNTIME_PROXY_TARGET || 'http://127.0.0.1:18080';
  return {
    plugins: [react(), tailwindcss(), buildingLayoutPersistencePlugin()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify-file watching is disabled to prevent flickering during agent edits.
      host: '0.0.0.0',
      // allowedHosts: ['saving-nail-columnists-got.trycloudflare.com'],
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/v1': {
          target: runtimeProxyTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
