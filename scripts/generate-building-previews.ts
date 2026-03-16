import fs from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { BUILDINGS } from '../src/constants/gameData';

const ROOT_DIR = path.resolve('.');
const OUTPUT_DIR = path.resolve('public/assets/images/buildings');
const MODEL_DIR = path.resolve('public/assets/models/buildings');
const WIDTH = 1024;
const HEIGHT = 640;
const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
];

const fileExists = async (targetPath: string) => {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const getChromePath = async () => {
  for (const candidate of CHROME_CANDIDATES) {
    if (await fileExists(candidate)) return candidate;
  }
  throw new Error(`Chrome executable not found. Checked: ${CHROME_CANDIDATES.join(', ')}`);
};

const resolveModelSourcePath = async (modelFile: string) => {
  const modelPath = path.join(MODEL_DIR, modelFile);
  const content = await fs.readFile(modelPath);
  const pointerText = content.toString('utf8');
  const oidMatch = pointerText.match(/oid sha256:([a-f0-9]{64})/i);

  if (!oidMatch) return modelPath;

  const oid = oidMatch[1];
  const lfsObjectPath = path.resolve('.git/lfs/objects', oid.slice(0, 2), oid.slice(2, 4), oid);
  if (!(await fileExists(lfsObjectPath))) {
    throw new Error(`Missing LFS object for ${modelFile}: ${oid}`);
  }
  return lfsObjectPath;
};

const makeRendererHtml = () => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Building Preview Renderer</title>
    <script type="importmap">
      {
        "imports": {
          "three": "/node_modules/three/build/three.module.js",
          "three/addons/": "/node_modules/three/examples/jsm/"
        }
      }
    </script>
    <style>
      html, body {
        margin: 0;
        width: ${WIDTH}px;
        height: ${HEIGHT}px;
        overflow: hidden;
        background:
          radial-gradient(circle at 78% 18%, rgba(99, 102, 241, 0.22), transparent 26%),
          radial-gradient(circle at 24% 80%, rgba(34, 211, 238, 0.18), transparent 24%),
          linear-gradient(135deg, #050816 0%, #08111f 55%, #111827 100%);
      }
      body::before {
        content: "";
        position: absolute;
        inset: 0;
        background-image:
          linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
        background-size: 40px 40px;
        mask-image: linear-gradient(to bottom, transparent, rgba(0,0,0,0.75) 20%, rgba(0,0,0,0.75) 80%, transparent);
        pointer-events: none;
      }
      #app {
        position: relative;
        width: 100%;
        height: 100%;
      }
      canvas {
        display: block;
        width: 100%;
        height: 100%;
      }
      .hud {
        position: absolute;
        left: 36px;
        bottom: 28px;
        padding: 10px 14px;
        border-radius: 18px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: rgba(3, 7, 18, 0.46);
        backdrop-filter: blur(10px);
        font-family: Inter, Arial, sans-serif;
        color: rgba(248, 250, 252, 0.92);
        font-size: 14px;
        letter-spacing: 0.08em;
      }
      .accent {
        position: absolute;
        top: 28px;
        right: 32px;
        width: 128px;
        height: 128px;
        border-radius: 9999px;
        filter: blur(18px);
        opacity: 0.3;
      }
    </style>
  </head>
  <body>
    <div id="app">
      <div class="accent" id="accent-orb"></div>
      <div class="hud" id="hud-label"></div>
    </div>
    <script>
      window.__previewReady = false;
      window.__previewError = null;
      window.addEventListener('error', (event) => {
        window.__previewError = event.message || String(event.error || 'Unknown page error');
      });
      window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason;
        window.__previewError = reason instanceof Error ? reason.message : String(reason);
      });
    </script>
    <script type="module">
      import * as THREE from '/node_modules/three/build/three.module.js';
      import { GLTFLoader } from '/node_modules/three/examples/jsm/loaders/GLTFLoader.js';

      const params = new URLSearchParams(window.location.search);
      const model = params.get('model');
      const accent = params.get('accent') || '#8b5cf6';
      const rotationY = Number(params.get('rotationY') || '0');
      const title = params.get('title') || 'Building';

      document.getElementById('accent-orb').style.background = accent;
      document.getElementById('hud-label').textContent = title;

      const app = document.getElementById('app');
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(28, ${WIDTH} / ${HEIGHT}, 0.1, 1000);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.setSize(${WIDTH}, ${HEIGHT}, false);
      renderer.setPixelRatio(1);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      app.prepend(renderer.domElement);

      const ambient = new THREE.AmbientLight('#cbd5e1', 1.8);
      const hemi = new THREE.HemisphereLight('#c4b5fd', '#020617', 1.1);
      const keyLight = new THREE.DirectionalLight('#f8fafc', 3.6);
      keyLight.position.set(7, 9, 10);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(2048, 2048);
      const rimLight = new THREE.PointLight(accent, 18, 40, 2);
      rimLight.position.set(-6, 5, -7);
      const fillLight = new THREE.PointLight('#67e8f9', 9, 40, 2);
      fillLight.position.set(8, 3, 5);
      scene.add(ambient, hemi, keyLight, rimLight, fillLight);

      const ground = new THREE.Mesh(
        new THREE.CircleGeometry(3.4, 64),
        new THREE.MeshStandardMaterial({
          color: '#0f172a',
          roughness: 0.9,
          metalness: 0.05,
          transparent: true,
          opacity: 0.8,
        }),
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.02;
      ground.receiveShadow = true;
      scene.add(ground);

      const glowRing = new THREE.Mesh(
        new THREE.RingGeometry(2.6, 3.15, 64),
        new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.22, side: THREE.DoubleSide }),
      );
      glowRing.rotation.x = -Math.PI / 2;
      glowRing.position.y = -0.01;
      scene.add(glowRing);

      const renderFrames = (count = 12) => new Promise((resolve) => {
        let current = 0;
        const tick = () => {
          renderer.render(scene, camera);
          current += 1;
          if (current >= count) {
            resolve();
            return;
          }
          requestAnimationFrame(tick);
        };
        tick();
      });

      const loader = new GLTFLoader();

      try {
        const gltf = await loader.loadAsync(model);
        const root = gltf.scene;
        root.traverse((child) => {
          if (!child.isMesh) return;
          child.castShadow = true;
          child.receiveShadow = true;
        });

        root.rotation.y = THREE.MathUtils.degToRad(rotationY);
        scene.add(root);
        root.updateMatrixWorld(true);

        let box = new THREE.Box3().setFromObject(root);
        const center = box.getCenter(new THREE.Vector3());
        const min = box.min.clone();
        root.position.set(-center.x, -min.y, -center.z);
        root.updateMatrixWorld(true);

        box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z, 0.001);
        const fitScale = 3.1 / maxDim;
        root.scale.setScalar(fitScale);
        root.updateMatrixWorld(true);

        box = new THREE.Box3().setFromObject(root);
        const fittedSize = box.getSize(new THREE.Vector3());
        const fittedCenter = box.getCenter(new THREE.Vector3());
        const fittedMin = box.min.clone();
        root.position.set(-fittedCenter.x, -fittedMin.y, -fittedCenter.z);
        root.updateMatrixWorld(true);

        const finalBox = new THREE.Box3().setFromObject(root);
        const finalSize = finalBox.getSize(new THREE.Vector3());
        const target = new THREE.Vector3(0, finalSize.y * 0.33, 0);
        const distance = Math.max(finalSize.x, finalSize.y, finalSize.z) * 2.3;
        camera.position.set(distance * 0.95, Math.max(2.1, finalSize.y * 0.9), distance * 1.25);
        camera.lookAt(target);

        await renderFrames(18);
        window.__previewReady = true;
      } catch (error) {
        console.error(error);
        window.__previewError = error instanceof Error ? error.message : String(error);
      }
    </script>
  </body>
</html>`;

const startServer = async () => {
  const app = express();
  app.use('/node_modules', express.static(path.resolve('node_modules')));
  app.get('/__preview__/renderer', (_req, res) => {
    res.type('html').send(makeRendererHtml());
  });
  app.get('/__preview__/model/:file', async (req, res) => {
    try {
      const file = path.basename(req.params.file);
      const sourcePath = await resolveModelSourcePath(file);
      res.sendFile(sourcePath);
    } catch (error) {
      res.status(404).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  return await new Promise<{ close: () => Promise<void>; baseUrl: string }>((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Failed to start preview server');
      }
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise<void>((closeResolve, closeReject) => {
            server.close((error) => (error ? closeReject(error) : closeResolve()));
          }),
      });
    });
  });
};

const main = async () => {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const chromePath = await getChromePath();
  const server = await startServer();
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--disable-gpu', '--use-angle=swiftshader', '--enable-webgl', '--hide-scrollbars'],
    defaultViewport: { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 },
  });

  try {
    for (const building of BUILDINGS) {
      if (!building.modelFile) continue;

      const page = await browser.newPage();
      const pngPath = path.join(OUTPUT_DIR, `${building.id}.png`);
      const webpPath = path.join(OUTPUT_DIR, `${building.id}.webp`);
      const debugLogs: string[] = [];
      const rendererUrl = new URL('/__preview__/renderer', server.baseUrl);
      rendererUrl.searchParams.set('model', `/__preview__/model/${building.modelFile}`);
      rendererUrl.searchParams.set('accent', building.threeColor);
      rendererUrl.searchParams.set('rotationY', String(building.modelRotationY ?? 0));
      rendererUrl.searchParams.set('title', building.title);

      try {
        page.on('console', (message) => {
          debugLogs.push(`[console:${message.type()}] ${message.text()}`);
        });
        page.on('pageerror', (error) => {
          const message = error instanceof Error ? error.message : String(error);
          debugLogs.push(`[pageerror] ${message}`);
        });
        page.on('requestfailed', (request) => {
          debugLogs.push(`[requestfailed] ${request.url()} ${request.failure()?.errorText ?? ''}`);
        });

        await page.goto(rendererUrl.toString(), { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(
          () => (window as unknown as { __previewReady?: boolean; __previewError?: string | null }).__previewReady === true
            || Boolean((window as unknown as { __previewError?: string | null }).__previewError),
          { timeout: 60000 },
        );
        const previewError = await page.evaluate(
          () => (window as unknown as { __previewError?: string | null }).__previewError ?? null,
        );
        if (previewError) {
          throw new Error(previewError);
        }

        await page.screenshot({ path: pngPath, type: 'png' });
        await sharp(pngPath).webp({ quality: 92 }).toFile(webpPath);
        console.log(`Rendered preview for ${building.id}`);
      } catch (error) {
        const details = debugLogs.length > 0 ? `\n${debugLogs.join('\n')}` : '';
        throw new Error(`Failed rendering ${building.id}: ${error instanceof Error ? error.message : String(error)}${details}`);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }
};

void main();
