import React from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

const cyberGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    shadowTint: { value: new THREE.Color('#221038') },
    highlightTint: { value: new THREE.Color('#8ef9ff') },
    midTint: { value: new THREE.Color('#ff8ae3') },
    contrast: { value: 1.04 },
    saturation: { value: 1.04 },
    vignetteStrength: { value: 0.16 },
    aberration: { value: 0.0008 },
    glowLift: { value: 0.04 },
    scanlineStrength: { value: 0.015 },
    time: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec3 shadowTint;
    uniform vec3 highlightTint;
    uniform vec3 midTint;
    uniform float contrast;
    uniform float saturation;
    uniform float vignetteStrength;
    uniform float aberration;
    uniform float glowLift;
    uniform float scanlineStrength;
    uniform float time;
    varying vec2 vUv;

    vec3 sampleRgbSplit(vec2 uv, vec2 direction) {
      float r = texture2D(tDiffuse, uv + direction * aberration).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv - direction * aberration).b;
      return vec3(r, g, b);
    }

    void main() {
      vec2 centeredUv = vUv - vec2(0.5);
      float dist = length(centeredUv);
      vec2 radialDir = dist > 0.0 ? centeredUv / dist : vec2(0.0, 0.0);
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 color = sampleRgbSplit(vUv, radialDir);
      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));

      color = mix(color, shadowTint, smoothstep(0.62, 0.05, luma) * 0.24);
      color = mix(color, midTint, smoothstep(0.16, 0.7, luma) * 0.1);
      color = mix(color, highlightTint, smoothstep(0.52, 1.0, luma) * 0.24);

      vec3 glow = vec3(0.0);
      glow += texture2D(tDiffuse, vUv + radialDir * 0.004).rgb;
      glow += texture2D(tDiffuse, vUv - radialDir * 0.004).rgb;
      glow += texture2D(tDiffuse, vUv + radialDir * 0.008).rgb;
      glow += texture2D(tDiffuse, vUv - radialDir * 0.008).rgb;
      glow += texture2D(tDiffuse, vUv + vec2(radialDir.y, -radialDir.x) * 0.003).rgb;
      glow += texture2D(tDiffuse, vUv - vec2(radialDir.y, -radialDir.x) * 0.003).rgb;
      glow *= 0.1667;
      color += glow * glowLift * smoothstep(0.12, 1.0, luma);

      float gray = dot(color, vec3(0.299, 0.587, 0.114));
      color = mix(vec3(gray), color, saturation);
      color = (color - 0.5) * contrast + 0.5;

      float scanline = sin((vUv.y + time * 0.035) * 900.0) * scanlineStrength;
      color += scanline * vec3(0.12, 0.18, 0.24);

      float vignette = smoothstep(0.22, 0.86, dist);
      color *= 1.0 - vignette * vignetteStrength;

      gl_FragColor = vec4(color, texel.a);
    }
  `,
};

export function PostProcessing() {
  const { gl, scene, camera, size } = useThree();

  const composer = React.useMemo(() => new EffectComposer(gl), [gl]);
  const renderPass = React.useMemo(() => new RenderPass(scene, camera), [scene, camera]);
  const bloomPass = React.useMemo(
    () => new UnrealBloomPass(new THREE.Vector2(size.width, size.height), 0.18, 0.28, 0.92),
    [size.height, size.width],
  );
  const gradePass = React.useMemo(() => new ShaderPass(cyberGradeShader), []);

  React.useEffect(() => {
    const previousToneMapping = gl.toneMapping;
    const previousExposure = gl.toneMappingExposure;

    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1;

    composer.addPass(renderPass);
    composer.addPass(bloomPass);
    composer.addPass(gradePass);

    return () => {
      gl.toneMapping = previousToneMapping;
      gl.toneMappingExposure = previousExposure;
      composer.removePass(renderPass);
      composer.removePass(bloomPass);
      composer.removePass(gradePass);
    };
  }, [bloomPass, composer, gl, gradePass, renderPass]);

  React.useEffect(() => {
    composer.setSize(size.width, size.height);
    composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    bloomPass.setSize(size.width, size.height);
  }, [bloomPass, composer, size.height, size.width]);

  useFrame(() => {
    gradePass.uniforms.time.value += 1;
    composer.render();
  }, 1);

  React.useEffect(() => () => composer.dispose(), [composer]);

  return null;
}
