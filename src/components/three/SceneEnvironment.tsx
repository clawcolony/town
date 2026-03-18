import React from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

interface SceneEnvironmentProps {
  hdrPath?: string;
  intensity?: number;
}

type EnvironmentStatus = 'loading' | 'ready' | 'error';

export function SceneEnvironment({
  hdrPath = '/assets/hdri/potsdamer_platz_1k.hdr',
  intensity = 0.9,
}: SceneEnvironmentProps) {
  const { gl, scene } = useThree();
  const [status, setStatus] = React.useState<EnvironmentStatus>('loading');

  React.useEffect(() => {
    let disposed = false;
    let loadedTexture: THREE.DataTexture | null = null;
    let envRenderTarget: THREE.WebGLRenderTarget | null = null;

    const previousEnvironment = scene.environment;
    const previousIntensity = scene.environmentIntensity;
    const pmremGenerator = new THREE.PMREMGenerator(gl);
    pmremGenerator.compileEquirectangularShader();

    const loader = new RGBELoader();
    loader.load(
      hdrPath,
      (texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }

        loadedTexture = texture;
        envRenderTarget = pmremGenerator.fromEquirectangular(texture);
        scene.environment = envRenderTarget.texture;
        scene.environmentIntensity = intensity;
        setStatus('ready');

        texture.dispose();
        loadedTexture = null;
      },
      undefined,
      (error) => {
        if (!disposed) setStatus('error');
        console.warn('[scene-environment] Failed to load HDR environment, continuing without it.', error);
      },
    );

    return () => {
      disposed = true;
      scene.environment = previousEnvironment;
      scene.environmentIntensity = previousIntensity;
      loadedTexture?.dispose();
      envRenderTarget?.dispose();
      pmremGenerator.dispose();
    };
  }, [gl, hdrPath, intensity, scene]);

  if (status === 'ready') return null;

  return (
    <>
      <hemisphereLight intensity={0.68} color="#d7f6ff" groundColor="#201726" />
      <directionalLight position={[16, 18, 12]} intensity={1.15} color="#f6fbff" />
      <directionalLight position={[-14, 10, -8]} intensity={0.45} color="#6bd8ff" />
    </>
  );
}
