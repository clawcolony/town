import React from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

interface SceneEnvironmentProps {
  hdrPath?: string;
  intensity?: number;
}

export function SceneEnvironment({
  hdrPath = '/assets/hdri/potsdamer_platz_1k.hdr',
  intensity = 0.9,
}: SceneEnvironmentProps) {
  const { gl, scene } = useThree();

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

        texture.dispose();
        loadedTexture = null;
      },
      undefined,
      (error) => {
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

  return null;
}
