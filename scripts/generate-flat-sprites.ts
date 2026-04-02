import fs from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import puppeteer, { type Browser } from 'puppeteer-core';
import sharp from 'sharp';
import { BUILDINGS } from '../src/constants/gameData';

const ROOT_DIR = path.resolve('.');
const BUILDING_OUTPUT_DIR = path.resolve('public/assets/sprites/buildings');
const CHARACTER_OUTPUT_DIR = path.resolve('public/assets/sprites/characters');
const MANIFEST_PATH = path.resolve('src/data/sprite-manifest.json');
const BUILDING_MODEL_DIR = path.resolve('public/assets/models/buildings');
const CHARACTER_MODEL_DIR = path.resolve('public/assets/models/characters');
const CANVAS_SIZE = 1024;
const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
];

type SpriteKind = 'building' | 'character';

interface SpriteDefinition {
  id: string;
  kind: SpriteKind;
  modelFile: string;
  title: string;
  rotationY: number;
  accent: string;
  autoRotate?: boolean;
}

interface SpriteMetrics {
  baseWidth: number;
  baseDepth: number;
  baseHeight: number;
}

interface SpriteManifestEntry extends SpriteMetrics {
  aspect: number;
  image: string;
}

interface SpriteManifest {
  buildings: Record<string, SpriteManifestEntry>;
  characters: Record<string, SpriteManifestEntry>;
}

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

const resolveModelSourcePath = async (baseDir: string, modelFile: string) => {
  const modelPath = path.join(baseDir, modelFile);
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
    <title>Flat Sprite Renderer</title>
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
        width: ${CANVAS_SIZE}px;
        height: ${CANVAS_SIZE}px;
        overflow: hidden;
        background: transparent;
      }
      canvas {
        display: block;
        width: 100%;
        height: 100%;
      }
    </style>
  </head>
  <body>
    <script>
      window.__spriteReady = false;
      window.__spriteError = null;
      window.__spriteMetrics = null;
      window.addEventListener('error', (event) => {
        window.__spriteError = event.message || String(event.error || 'Unknown page error');
      });
      window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason;
        window.__spriteError = reason instanceof Error ? reason.message : String(reason);
      });
    </script>
    <script type="module">
      import * as THREE from '/node_modules/three/build/three.module.js';
      import { GLTFLoader } from '/node_modules/three/examples/jsm/loaders/GLTFLoader.js';

      const params = new URLSearchParams(window.location.search);
      const model = params.get('model');
      const kind = params.get('kind') || 'building';
      const rotationY = Number(params.get('rotationY') || '0');
      const accent = params.get('accent') || '#8b5cf6';
      const autoRotate = params.get('autoRotate') === '1';

      const scene = new THREE.Scene();
      const camera = kind === 'character'
        ? new THREE.PerspectiveCamera(28, 1, 0.1, 100)
        : new THREE.OrthographicCamera(-4, 4, 4, -4, 0.1, 100);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.setSize(${CANVAS_SIZE}, ${CANVAS_SIZE}, false);
      renderer.setPixelRatio(1);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = kind === 'character' ? 1.2 : 1.08;
      renderer.setClearColor(0x000000, 0);
      document.body.append(renderer.domElement);

      const ambient = new THREE.AmbientLight('#ffffff', kind === 'character' ? 2.4 : 1.9);
      const hemi = new THREE.HemisphereLight('#ffffff', '#64748b', kind === 'character' ? 1.55 : 1.2);
      const keyLight = new THREE.DirectionalLight('#ffffff', kind === 'character' ? 2.9 : 2.3);
      keyLight.position.set(8, 12, 8);
      const rimLight = new THREE.PointLight(accent, kind === 'character' ? 8.5 : 7, 30, 2);
      rimLight.position.set(-6, 4, -8);
      const fillLight = new THREE.PointLight('#67e8f9', kind === 'character' ? 5.4 : 3.5, 20, 2);
      fillLight.position.set(6, 2, 6);
      const frontLight = new THREE.DirectionalLight('#fff7ed', kind === 'character' ? 1.8 : 0.9);
      frontLight.position.set(-2, 5, 12);
      scene.add(ambient, hemi, keyLight, rimLight, fillLight, frontLight);

      const renderFrames = (count = 8) => new Promise((resolve) => {
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

      const getBoxPoints = (box) => [
          new THREE.Vector3(box.min.x, box.min.y, box.min.z),
          new THREE.Vector3(box.min.x, box.min.y, box.max.z),
          new THREE.Vector3(box.min.x, box.max.y, box.min.z),
          new THREE.Vector3(box.min.x, box.max.y, box.max.z),
          new THREE.Vector3(box.max.x, box.min.y, box.min.z),
          new THREE.Vector3(box.max.x, box.min.y, box.max.z),
          new THREE.Vector3(box.max.x, box.max.y, box.min.z),
          new THREE.Vector3(box.max.x, box.max.y, box.max.z),
        ];

      const getCameraSpaceBounds = (box, camera) => {
        camera.updateMatrixWorld(true);
        const points = getBoxPoints(box);
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        points.forEach((point) => {
          const cameraSpacePoint = point.clone().applyMatrix4(camera.matrixWorldInverse);
          minX = Math.min(minX, cameraSpacePoint.x);
          maxX = Math.max(maxX, cameraSpacePoint.x);
          minY = Math.min(minY, cameraSpacePoint.y);
          maxY = Math.max(maxY, cameraSpacePoint.y);
        });

        return {
          minX,
          maxX,
          minY,
          maxY,
          width: Math.max(0.0001, maxX - minX),
          height: Math.max(0.0001, maxY - minY),
        };
      };

      const scoreProjectedArea = (box, camera) => {
        const points = getBoxPoints(box);

        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        points.forEach((point) => {
          const projected = point.clone().project(camera);
          minX = Math.min(minX, projected.x);
          maxX = Math.max(maxX, projected.x);
          minY = Math.min(minY, projected.y);
          maxY = Math.max(maxY, projected.y);
        });

        const width = Math.max(0.0001, maxX - minX);
        const height = Math.max(0.0001, maxY - minY);
        const aspect = width / height;
        const area = width * height;
        const aspectPenalty = aspect < 0.42 || aspect > 1.9 ? 0.58 : 1;
        return area * aspectPenalty;
      };

      const fitOrthographicCameraToObject = (box, kind) => {
        const bounds = getCameraSpaceBounds(box, camera);
        const horizontalPad = Math.max(0.12, bounds.width * (kind === 'character' ? 0.18 : 0.16));
        const topPad = Math.max(0.12, bounds.height * (kind === 'character' ? 0.18 : 0.2));
        const bottomPad = Math.max(0.14, bounds.height * (kind === 'character' ? 0.18 : 0.28));

        camera.left = bounds.minX - horizontalPad;
        camera.right = bounds.maxX + horizontalPad;
        camera.top = bounds.maxY + topPad;
        camera.bottom = bounds.minY - bottomPad;
        camera.updateProjectionMatrix();
      };

      const fitPerspectiveCameraToObject = (box) => {
        const sphere = box.getBoundingSphere(new THREE.Sphere());
        const size = box.getSize(new THREE.Vector3());
        const lookTarget = new THREE.Vector3(0, box.min.y + size.y * 0.34, 0);
        const direction = new THREE.Vector3(0.82, 0.38, 1.28).normalize();
        const halfVerticalFov = THREE.MathUtils.degToRad(camera.fov * 0.5);
        const halfHorizontalFov = Math.atan(Math.tan(halfVerticalFov) * camera.aspect);
        const limitingHalfFov = Math.min(halfVerticalFov, halfHorizontalFov);
        const distance = (sphere.radius / Math.sin(limitingHalfFov)) * 1.14;

        camera.position.copy(lookTarget.clone().add(direction.multiplyScalar(distance)));
        camera.near = Math.max(0.05, distance - sphere.radius * 2.6);
        camera.far = distance + sphere.radius * 3.4;
        camera.lookAt(lookTarget);
        camera.updateProjectionMatrix();
      };

      try {
        const loader = new GLTFLoader();
        const gltf = await loader.loadAsync(model);
        const root = gltf.scene;
        root.traverse((child) => {
          if (!child.isMesh) return;
          child.frustumCulled = false;
        });
        scene.add(root);
        root.updateMatrixWorld(true);

        const originalBox = new THREE.Box3().setFromObject(root);
        if (originalBox.isEmpty()) {
          throw new Error('Loaded sprite source has an empty bounding box.');
        }

        const originalSize = originalBox.getSize(new THREE.Vector3());
        const maxDimension = Math.max(originalSize.x, originalSize.y, originalSize.z, 0.001);
        const fitTarget = kind === 'character' ? 0.86 : 0.9;
        const fitScale = fitTarget / maxDimension;

        const originalCenter = originalBox.getCenter(new THREE.Vector3());
        const originalMin = originalBox.min.clone();
        const alignRoot = (rotationDeg, fitCamera = false) => {
          root.rotation.set(0, THREE.MathUtils.degToRad(rotationDeg), 0);
          root.position.set(-originalCenter.x, -originalMin.y, -originalCenter.z);
          root.scale.setScalar(fitScale);
          root.updateMatrixWorld(true);

          const fittedBox = new THREE.Box3().setFromObject(root);
          const fittedCenter = fittedBox.getCenter(new THREE.Vector3());
          const fittedMin = fittedBox.min.clone();
          root.position.set(-fittedCenter.x, -fittedMin.y, -fittedCenter.z);
          root.updateMatrixWorld(true);

          const box = new THREE.Box3().setFromObject(root);
          const size = box.getSize(new THREE.Vector3());
          if (kind === 'character') {
            camera.aspect = 1;
            camera.fov = 28;
            camera.near = 0.1;
            camera.far = 100;
            camera.updateProjectionMatrix();
            if (fitCamera) {
              fitPerspectiveCameraToObject(box);
            } else {
              const previewTarget = new THREE.Vector3(0, size.y * 0.34, 0);
              const previewDistance = Math.max(size.x, size.y, size.z, 0.1) * 3.4;
              camera.position.set(previewDistance * 0.52, previewDistance * 0.26, previewDistance * 0.84);
              camera.lookAt(previewTarget);
              camera.updateProjectionMatrix();
            }
          } else {
            const viewTarget = new THREE.Vector3(0, size.y * 0.28, 0);
            camera.position.set(4.6, 4.7, 5.1);
            camera.lookAt(viewTarget);
            const frustumHeight = Math.max(
              1.34,
              size.y * 1.28,
              size.z * 1.16,
              size.x * 1.04,
            );
            const frustumWidth = frustumHeight;
            camera.left = -frustumWidth / 2;
            camera.right = frustumWidth / 2;
            camera.top = frustumHeight / 2;
            camera.bottom = -frustumHeight / 2;
            camera.updateProjectionMatrix();

            if (fitCamera) {
              fitOrthographicCameraToObject(box, kind);
            }
          }

          return { box, size };
        };

        let finalBox;
        let finalSize;
        if (autoRotate) {
          const candidates = [0, 45, 90, 135, 180, 225, 270, 315];
          let best = { rotation: rotationY, score: -Infinity, size: null, box: null };
          candidates.forEach((candidate) => {
            const { box, size } = alignRoot(candidate, false);
            const score = scoreProjectedArea(box, camera);
            if (score > best.score) {
              best = { rotation: candidate, score, size, box };
            }
          });
          const resolved = alignRoot(best.rotation, true);
          finalBox = resolved.box;
          finalSize = resolved.size;
        } else {
          const resolved = alignRoot(rotationY, true);
          finalBox = resolved.box;
          finalSize = resolved.size;
        }

        await renderFrames(12);

        window.__spriteMetrics = {
          baseWidth: Number(finalSize.x.toFixed(4)),
          baseDepth: Number(finalSize.z.toFixed(4)),
          baseHeight: Number(finalSize.y.toFixed(4)),
        };
        window.__spriteReady = true;
      } catch (error) {
        console.error(error);
        window.__spriteError = error instanceof Error ? error.message : String(error);
      }
    </script>
  </body>
</html>`;

const startServer = async () => {
  const app = express();
  app.use('/node_modules', express.static(path.resolve('node_modules')));
  app.get('/__sprite__/renderer', (_req, res) => {
    res.type('html').send(makeRendererHtml());
  });
  app.get('/__sprite__/model/:kind/:file', async (req, res) => {
    try {
      const kind = req.params.kind === 'character' ? 'character' : 'building';
      const file = path.basename(req.params.file);
      const sourcePath = await resolveModelSourcePath(kind === 'character' ? CHARACTER_MODEL_DIR : BUILDING_MODEL_DIR, file);
      res.sendFile(sourcePath);
    } catch (error) {
      res.status(404).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  return await new Promise<{ close: () => Promise<void>; baseUrl: string }>((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Failed to start sprite preview server');
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

const ensureDirs = async () => {
  await fs.mkdir(BUILDING_OUTPUT_DIR, { recursive: true });
  await fs.mkdir(CHARACTER_OUTPUT_DIR, { recursive: true });
};

const buildingSprites: SpriteDefinition[] = BUILDINGS
  .filter((building) => Boolean(building.modelFile))
  .map((building) => ({
    id: building.id,
    kind: 'building',
    modelFile: building.modelFile!,
    title: building.title,
    rotationY: building.modelRotationY ?? 0,
    accent: building.threeColor,
  }));

const characterSprites: SpriteDefinition[] = Array.from({ length: 16 }, (_, index) => ({
  id: `character${index + 1}`,
  kind: 'character',
  modelFile: `character${index + 1}.glb`,
  title: `character${index + 1}`,
  rotationY: 0,
  accent: '#fb923c',
  autoRotate: true,
}));

const spriteKindFilter = process.env.SPRITE_KIND === 'building'
  ? 'building'
  : process.env.SPRITE_KIND === 'character'
    ? 'character'
    : null;
const spriteIdFilter = new Set(
  (process.env.SPRITE_IDS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
);

const renderSprite = async (
  browser: Browser,
  serverBaseUrl: string,
  sprite: SpriteDefinition,
): Promise<SpriteManifestEntry> => {
  const page = await browser.newPage();
  const logs: string[] = [];
  const rendererUrl = new URL('/__sprite__/renderer', serverBaseUrl);
  rendererUrl.searchParams.set('model', `/__sprite__/model/${sprite.kind}/${sprite.modelFile}`);
  rendererUrl.searchParams.set('kind', sprite.kind);
  rendererUrl.searchParams.set('rotationY', String(sprite.rotationY));
  rendererUrl.searchParams.set('accent', sprite.accent);
  rendererUrl.searchParams.set('autoRotate', sprite.autoRotate ? '1' : '0');

  try {
    page.on('console', (message) => {
      logs.push(`[console:${message.type()}] ${message.text()}`);
    });
    page.on('pageerror', (error) => {
      const message = error instanceof Error ? error.message : String(error);
      logs.push(`[pageerror] ${message}`);
    });
    page.on('requestfailed', (request) => {
      logs.push(`[requestfailed] ${request.url()} ${request.failure()?.errorText ?? ''}`);
    });

    await page.goto(rendererUrl.toString(), { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () => (window as unknown as { __spriteReady?: boolean; __spriteError?: string | null }).__spriteReady === true
        || Boolean((window as unknown as { __spriteError?: string | null }).__spriteError),
      { timeout: 60000 },
    );

    const spriteError = await page.evaluate(
      () => (window as unknown as { __spriteError?: string | null }).__spriteError ?? null,
    );
    if (spriteError) {
      throw new Error(spriteError);
    }

    const metrics = await page.evaluate(
      () => (window as unknown as { __spriteMetrics?: SpriteMetrics | null }).__spriteMetrics ?? null,
    );
    if (!metrics) {
      throw new Error('Renderer did not return sprite metrics.');
    }

    const rawPng = await page.screenshot({
      type: 'png',
      omitBackground: true,
    });

    const outputDir = sprite.kind === 'building' ? BUILDING_OUTPUT_DIR : CHARACTER_OUTPUT_DIR;
    const outputPath = path.join(outputDir, `${sprite.id}.png`);
    await sharp(rawPng)
      .trim()
      .extend({
        top: sprite.kind === 'building' ? 18 : 10,
        bottom: 4,
        left: 12,
        right: 12,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(outputPath);

    const imageMeta = await sharp(outputPath).metadata();
    const aspect = Number((((imageMeta.width ?? 1) / Math.max(1, imageMeta.height ?? 1))).toFixed(4));
    const image = sprite.kind === 'building'
      ? `/assets/sprites/buildings/${sprite.id}.png`
      : `/assets/sprites/characters/${sprite.id}.png`;

    console.log(`Rendered ${sprite.kind} sprite: ${sprite.id}`);

    return {
      ...metrics,
      aspect,
      image,
    };
  } catch (error) {
    const details = logs.length > 0 ? `\n${logs.join('\n')}` : '';
    throw new Error(`Failed rendering ${sprite.kind} sprite ${sprite.id}: ${error instanceof Error ? error.message : String(error)}${details}`);
  } finally {
    await page.close();
  }
};

const main = async () => {
  await ensureDirs();
  const chromePath = await getChromePath();
  const server = await startServer();
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--disable-gpu', '--use-angle=swiftshader', '--enable-webgl', '--hide-scrollbars'],
    defaultViewport: { width: CANVAS_SIZE, height: CANVAS_SIZE, deviceScaleFactor: 1 },
  });

  try {
    const manifest: SpriteManifest = await (async () => {
      if (!(await fileExists(MANIFEST_PATH))) {
        return {
          buildings: {},
          characters: {},
        };
      }

      const existing = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf8')) as Partial<SpriteManifest>;
      return {
        buildings: existing.buildings ?? {},
        characters: existing.characters ?? {},
      };
    })();

    const filteredBuildingSprites = buildingSprites.filter((sprite) => {
      if (spriteKindFilter && sprite.kind !== spriteKindFilter) return false;
      if (spriteIdFilter.size > 0 && !spriteIdFilter.has(sprite.id)) return false;
      return true;
    });

    const filteredCharacterSprites = characterSprites.filter((sprite) => {
      if (spriteKindFilter && sprite.kind !== spriteKindFilter) return false;
      if (spriteIdFilter.size > 0 && !spriteIdFilter.has(sprite.id)) return false;
      return true;
    });

    for (const sprite of filteredBuildingSprites) {
      manifest.buildings[sprite.id] = await renderSprite(browser, server.baseUrl, sprite);
    }

    for (const sprite of filteredCharacterSprites) {
      manifest.characters[sprite.id] = await renderSprite(browser, server.baseUrl, sprite);
    }

    await fs.writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    console.log(`Wrote sprite manifest to ${path.relative(ROOT_DIR, MANIFEST_PATH)}`);
  } finally {
    await browser.close();
    await server.close();
  }
};

void main();
