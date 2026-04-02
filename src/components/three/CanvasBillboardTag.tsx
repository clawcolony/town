import React from 'react';
import { Billboard } from '@react-three/drei';
import * as THREE from 'three';

interface TagLine {
  text: string;
  color?: string;
  fontSize?: number;
  fontWeight?: number | string;
}

interface CanvasBillboardTagProps {
  position?: [number, number, number];
  height: number;
  lines: TagLine[];
  backgroundColor?: string;
  borderColor?: string;
  shadowColor?: string;
  accentDotColor?: string | null;
  progress?: number | null;
  paddingX?: number;
  paddingY?: number;
  lineGap?: number;
  minWidth?: number;
  cornerRadius?: number;
}

interface CachedTexture {
  aspect: number;
  texture: THREE.CanvasTexture;
}

const FONT_FAMILY = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace';
const textureCache = new Map<string, CachedTexture>();

const makeFont = (line: TagLine) => `${line.fontWeight ?? 700} ${line.fontSize ?? 18}px ${FONT_FAMILY}`;

const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  const clampedRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + clampedRadius, y);
  ctx.lineTo(x + width - clampedRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + clampedRadius);
  ctx.lineTo(x + width, y + height - clampedRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - clampedRadius, y + height);
  ctx.lineTo(x + clampedRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - clampedRadius);
  ctx.lineTo(x, y + clampedRadius);
  ctx.quadraticCurveTo(x, y, x + clampedRadius, y);
  ctx.closePath();
};

const getOrCreateTexture = (
  cacheKey: string,
  {
    lines,
    backgroundColor,
    borderColor,
    shadowColor,
    accentDotColor,
    progress,
    paddingX,
    paddingY,
    lineGap,
    minWidth,
    cornerRadius,
  }: Required<Omit<CanvasBillboardTagProps, 'position' | 'height'>>,
) => {
  const cached = textureCache.get(cacheKey);
  if (cached) return cached;
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const lineHeights = lines.map((line) => Math.ceil((line.fontSize ?? 18) * 1.15));
  const measuredWidths = lines.map((line) => {
    ctx.font = makeFont(line);
    return ctx.measureText(line.text).width;
  });
  const dotWidth = accentDotColor ? 20 : 0;
  const contentWidth = Math.max(...measuredWidths.map((width, index) => width + (index === 0 ? dotWidth : 0)), 0);
  const progressHeight = progress !== null ? 10 : 0;
  const width = Math.ceil(Math.max(minWidth, contentWidth + paddingX * 2));
  const textHeight = lineHeights.reduce((sum, heightValue) => sum + heightValue, 0) + Math.max(0, lines.length - 1) * lineGap;
  const height = Math.ceil(textHeight + paddingY * 2 + progressHeight + (progress !== null ? 10 : 0));
  const dpr = 2;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);

  ctx.shadowColor = shadowColor;
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  drawRoundedRect(ctx, 0.5, 0.5, width - 1, height - 1, cornerRadius);
  ctx.fillStyle = backgroundColor;
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = borderColor;
  drawRoundedRect(ctx, 0.75, 0.75, width - 1.5, height - 1.5, cornerRadius);
  ctx.stroke();

  let currentY = paddingY;
  lines.forEach((line, index) => {
    const fontSize = line.fontSize ?? 18;
    const textWidth = measuredWidths[index];
    const rowWidth = textWidth + (index === 0 ? dotWidth : 0);
    const rowStartX = (width - rowWidth) / 2;

    if (index === 0 && accentDotColor) {
      ctx.beginPath();
      ctx.arc(rowStartX + 6, currentY + lineHeights[index] / 2, 4, 0, Math.PI * 2);
      ctx.fillStyle = accentDotColor;
      ctx.fill();
    }

    ctx.font = makeFont(line);
    ctx.fillStyle = line.color ?? '#ffffff';
    ctx.textBaseline = 'top';
    ctx.fillText(line.text, rowStartX + (index === 0 ? dotWidth : 0), currentY);
    currentY += lineHeights[index] + lineGap;
    void fontSize;
  });

  if (progress !== null) {
    const trackY = height - paddingY - 6;
    const trackWidth = width - paddingX * 2;
    drawRoundedRect(ctx, paddingX, trackY, trackWidth, 6, 999);
    ctx.fillStyle = 'rgba(251, 191, 36, 0.18)';
    ctx.fill();
    drawRoundedRect(ctx, paddingX, trackY, Math.max(10, trackWidth * THREE.MathUtils.clamp(progress, 0, 1)), 6, 999);
    ctx.fillStyle = 'rgba(252, 211, 77, 0.82)';
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  const created = { texture, aspect: width / height };
  textureCache.set(cacheKey, created);
  return created;
};

export function CanvasBillboardTag({
  position = [0, 0, 0],
  height,
  lines,
  backgroundColor = 'rgba(0, 0, 0, 0.72)',
  borderColor = 'rgba(251, 191, 36, 0.52)',
  shadowColor = 'rgba(0, 0, 0, 0.45)',
  accentDotColor = null,
  progress = null,
  paddingX = 22,
  paddingY = 14,
  lineGap = 4,
  minWidth = 0,
  cornerRadius = 16,
}: CanvasBillboardTagProps) {
  const normalizedLines = React.useMemo(
    () =>
      lines.map((line) => ({
        color: line.color ?? '#ffffff',
        fontSize: line.fontSize ?? 18,
        fontWeight: line.fontWeight ?? 700,
        text: line.text,
      })),
    [lines],
  );

  const cacheKey = React.useMemo(
    () =>
      JSON.stringify({
        accentDotColor,
        backgroundColor,
        borderColor,
        cornerRadius,
        lineGap,
        lines: normalizedLines,
        minWidth,
        paddingX,
        paddingY,
        progress,
        shadowColor,
      }),
    [accentDotColor, backgroundColor, borderColor, cornerRadius, lineGap, minWidth, normalizedLines, paddingX, paddingY, progress, shadowColor],
  );

  const textureInfo = React.useMemo(
    () =>
      getOrCreateTexture(cacheKey, {
        accentDotColor,
        backgroundColor,
        borderColor,
        cornerRadius,
        lineGap,
        lines: normalizedLines,
        minWidth,
        paddingX,
        paddingY,
        progress,
        shadowColor,
      }),
    [accentDotColor, backgroundColor, borderColor, cacheKey, cornerRadius, lineGap, minWidth, normalizedLines, paddingX, paddingY, progress, shadowColor],
  );

  if (!textureInfo) return null;

  return (
    <Billboard follow lockX={false} lockY={false} lockZ={false} position={position}>
      <mesh>
        <planeGeometry args={[height * textureInfo.aspect, height]} />
        <meshBasicMaterial
          map={textureInfo.texture}
          transparent
          alphaTest={0.08}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
    </Billboard>
  );
}
