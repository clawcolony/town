import React from 'react';
import { Html, Billboard, useTexture } from '@react-three/drei';
import { createPortal } from 'react-dom';
import * as THREE from 'three';
import { Check, Loader2, Minus, RotateCcw, Users, X, Plus } from 'lucide-react';
import { BuildingData } from '../../types/game';
import { BUILDINGS, GRID_MAX_COORD, GRID_MIN_COORD, gridCoordToWorld } from '../../constants/gameData';
import { useGameStore } from '../../store/gameStore';
import { useI18nStore } from '../../store/i18nStore';
import { RuntimeClient, RuntimePhase1Service, getRuntimeBaseUrl } from '../../services/runtimeAdapter';
import { buildBuildingLayoutConfig, saveBuildingLayoutConfig } from '../../services/buildingLayoutConfig';
import { computeAxisAlignedFootprint } from './buildingFootprint';
import { toast } from 'sonner';
import spriteManifestJson from '../../data/sprite-manifest.json';

const SPRITE_MANIFEST = spriteManifestJson as {
  buildings: Record<string, { baseWidth: number; baseDepth: number; baseHeight: number; aspect: number; image: string }>;
};

interface BuildingProps {
  data: BuildingData;
}

export function Building({ data }: BuildingProps) {
  const disableRaycast = React.useCallback(() => null, []);
  const [isHovered, setIsHovered] = React.useState(false);
  const [modelFailed, setModelFailed] = React.useState(false);
  const [modelLoading, setModelLoading] = React.useState(false);
  const [constitutionVersion, setConstitutionVersion] = React.useState<number | null>(null);
  const [constitutionLoading, setConstitutionLoading] = React.useState(false);
  const [savingLayout, setSavingLayout] = React.useState(false);
  const [modelVisualHeight, setModelVisualHeight] = React.useState(1.2);

  const language = useI18nStore((state) => state.language);
  const isBuildMode = useGameStore((state) => state.isBuildMode);
  const selectedBuildingId = useGameStore(state => state.selectedBuildingId);
  const setSelectedBuildingId = useGameStore(state => state.setSelectedBuildingId);
  const updateBuildingLayoutOverride = useGameStore((state) => state.updateBuildingLayoutOverride);
  const commitBuildingLayoutOverride = useGameStore((state) => state.commitBuildingLayoutOverride);
  const resetBuildingLayoutOverride = useGameStore((state) => state.resetBuildingLayoutOverride);
  const setBuildingFootprint = useGameStore((state) => state.setBuildingFootprint);
  const clearBuildingFootprint = useGameStore((state) => state.clearBuildingFootprint);
  const committedBuildingLayoutOverrides = useGameStore((state) => state.committedBuildingLayoutOverrides);
  const lobsters = useGameStore(state => state.lobsters);
  const [footprintSize, setFootprintSize] = React.useState({ width: 0.92, depth: 0.92 });

  const extraBlocks = data.extraBlocks ?? 0;
  const modelScale = data.modelScale ?? 1;
  const Icon = data.icon;
  const buildingSprite = SPRITE_MANIFEST.buildings[data.id];
  const spriteTexture = useTexture(buildingSprite?.image ?? '/assets/images/lobster-colony.png');
  const isSelected = selectedBuildingId === data.id;
  const showTooltip = isHovered && !isBuildMode;
  const workingLobsters = React.useMemo(
    () => lobsters.filter((lobster) => Math.abs(lobster.x - data.x) <= 1 && Math.abs(lobster.y - data.y) <= 1),
    [data.x, data.y, lobsters],
  );

  React.useEffect(() => {
    spriteTexture.colorSpace = THREE.SRGBColorSpace;
    spriteTexture.needsUpdate = true;
  }, [spriteTexture]);

  React.useEffect(() => {
    if (!buildingSprite) {
      setModelFailed(false);
      setModelLoading(false);
      setFootprintSize({ width: 0.92, depth: 0.92 });
      setModelVisualHeight(1.2);
      return;
    }

    setModelLoading(false);
    setModelFailed(false);
    const footprintScale = THREE.MathUtils.clamp(0.9 + modelScale * 0.2, 1.08, 2.05);
    const visualScale = THREE.MathUtils.clamp(0.78 + modelScale * 0.24, 0.98, 2.1);
    setFootprintSize({
      width: Math.max(0.92, buildingSprite.baseWidth * footprintScale),
      depth: Math.max(0.92, buildingSprite.baseDepth * footprintScale),
    });
    setModelVisualHeight(Math.max(0.9, buildingSprite.baseHeight * visualScale + (data.modelYOffset ?? 0) * 0.22));
  }, [buildingSprite, data.modelYOffset, modelScale]);

  const footprint = React.useMemo(
    () => computeAxisAlignedFootprint(data.x, data.y, footprintSize.width, footprintSize.depth, 0),
    [data.x, data.y, footprintSize.depth, footprintSize.width],
  );
  const footprintTiles = footprint.tiles;
  const posX = gridCoordToWorld(footprint.centerX);
  const posZ = gridCoordToWorld(footprint.centerY);
  const anchorOffsetX = gridCoordToWorld(data.x) - posX;
  const anchorOffsetZ = gridCoordToWorld(data.y) - posZ;
  const height = 0.04 + extraBlocks * 0.016;

  React.useEffect(() => {
    setBuildingFootprint(data.id, footprintTiles);

    return () => {
      clearBuildingFootprint(data.id);
    };
  }, [clearBuildingFootprint, data.id, footprintTiles, setBuildingFootprint]);

  React.useEffect(() => {
    let cancelled = false;

    const loadConstitution = async () => {
      if (!isSelected || data.id !== 'codex-tower') {
        setConstitutionVersion(null);
        setConstitutionLoading(false);
        return;
      }

      setConstitutionLoading(true);
      try {
        const service = new RuntimePhase1Service(new RuntimeClient({ baseUrl: getRuntimeBaseUrl() }));
        const law = await service.getConstitutionLaw();
        if (!cancelled) {
          setConstitutionVersion(law.item.version);
        }
      } catch {
        if (!cancelled) {
          setConstitutionVersion(null);
        }
      } finally {
        if (!cancelled) {
          setConstitutionLoading(false);
        }
      }
    };

    loadConstitution();
    return () => {
      cancelled = true;
    };
  }, [data.id, isSelected]);

  const pedestalOffsets = React.useMemo(
    () =>
      Array.from({ length: extraBlocks }, (_, index) => 0.014 + index * 0.014),
    [extraBlocks],
  );

  const updateLayout = (patch: Partial<Pick<BuildingData, 'x' | 'y' | 'extraBlocks' | 'modelScale'>>) => {
    updateBuildingLayoutOverride(data.id, {
      x: Math.min(GRID_MAX_COORD, Math.max(GRID_MIN_COORD, patch.x ?? data.x)),
      y: Math.min(GRID_MAX_COORD, Math.max(GRID_MIN_COORD, patch.y ?? data.y)),
      extraBlocks: patch.extraBlocks ?? extraBlocks,
      modelScale: patch.modelScale ?? modelScale,
    });
  };

  const spriteWorldHeight = modelVisualHeight;
  const spriteWorldWidth = spriteWorldHeight * (buildingSprite?.aspect ?? 1);
  const shouldRenderCard = !buildingSprite;
  const anchorBaseWidth = THREE.MathUtils.clamp(
    (buildingSprite?.baseWidth ?? 0.88) * 0.96,
    0.78,
    0.98,
  );
  const anchorBaseDepth = THREE.MathUtils.clamp(
    (buildingSprite?.baseDepth ?? 0.88) * 0.96,
    0.78,
    0.98,
  );
  const pedestalSize = THREE.MathUtils.clamp(Math.max(anchorBaseWidth, anchorBaseDepth) + 0.08, 0.86, 1.04);
  const baselineLayout = React.useMemo(() => {
    const baseline = BUILDINGS.find((building) => building.id === data.id);
    return {
      x: baseline?.x ?? data.x,
      y: baseline?.y ?? data.y,
      extraBlocks: baseline?.extraBlocks ?? 0,
      modelScale: baseline?.modelScale ?? 1,
    };
  }, [data.id, data.x, data.y]);
  const committedLayout = committedBuildingLayoutOverrides[data.id];
  const isDraftDirty =
    (committedLayout?.x ?? baselineLayout.x) !== data.x ||
    (committedLayout?.y ?? baselineLayout.y) !== data.y ||
    (committedLayout?.extraBlocks ?? baselineLayout.extraBlocks) !== extraBlocks ||
    (committedLayout?.modelScale ?? baselineLayout.modelScale) !== modelScale;

  const handleSaveLayout = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setSavingLayout(true);
    try {
      commitBuildingLayoutOverride(data.id);
      const committedOverrides = useGameStore.getState().committedBuildingLayoutOverrides;
      await saveBuildingLayoutConfig(buildBuildingLayoutConfig(committedOverrides));
      toast.success(language === 'zh' ? '已写入项目 JSON 布局' : 'Saved to project JSON');
    } catch (error) {
      console.error(error);
      toast.error(language === 'zh' ? '项目 JSON 保存失败' : 'Failed to save project JSON');
    } finally {
      setSavingLayout(false);
    }
  };

  // Render specific AR Tooltips based on building ID
  const renderARTooltip = () => {
    switch (data.id) {
      case 'codex-tower':
        return (
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-40 bg-[#0a0a14]/80 border border-fuchsia-500/50 rounded-xl p-2 shadow-[0_4px_15px_rgba(0,0,0,0.5)] backdrop-blur-xl flex flex-col items-center">
            <span className="text-[9px] text-fuchsia-300 font-bold mb-1">PROPOSAL VOTING</span>
            <div className="w-full bg-black/50 rounded-full h-2 flex overflow-hidden">
              <div className="bg-emerald-500 h-full" style={{ width: '64%' }}></div>
              <div className="bg-red-500 h-full" style={{ width: '36%' }}></div>
            </div>
            <div className="flex justify-between w-full text-[8px] mt-1 font-mono">
              <span className="text-emerald-400">YES 64%</span>
              <span className="text-red-400">NO 36%</span>
            </div>
          </div>
        );
      case 'bounty-board':
        return (
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 flex flex-col gap-1 items-center">
            <div className="bg-[#0a0a14]/80 border border-amber-500/50 text-amber-300 text-[10px] px-2 py-0.5 rounded-full font-mono whitespace-nowrap animate-bounce">
              ⚡ 3000 TOKEN: Python Parser
            </div>
            <div className="bg-[#0a0a14]/80 border border-amber-500/50 text-amber-300 text-[10px] px-2 py-0.5 rounded-full font-mono whitespace-nowrap">
              ⚡ 1500 TOKEN: API Integration
            </div>
          </div>
        );
      case 'incinerator':
        return (
          <div className="absolute -top-12 left-1/2 -translate-x-1/2">
            <div className="text-red-400 font-mono text-xs font-bold animate-pulse whitespace-nowrap drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]">
              Archiving: Tool_0x4F...
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const handleClick = (e?: any) => {
    if (isBuildMode) return;
    if (e) e.stopPropagation();
    setSelectedBuildingId(isSelected ? null : data.id);
  };

  const selectedPanel = false && !isBuildMode && isSelected && typeof document !== 'undefined'
    ? createPortal(
        <div className="pointer-events-none fixed inset-0 z-[80] flex items-start justify-center px-4 pt-24 sm:justify-end sm:px-6">
          <div className="pointer-events-auto relative w-full max-w-[360px] max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl border border-cyan-400/40 bg-[#05070d]/92 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl">
            <button
              className="absolute right-3 top-3 text-slate-400 transition-colors hover:text-white"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedBuildingId(null);
              }}
            >
              <X className="h-4 w-4" />
            </button>

            <div className="pr-8">
              <div className="mb-1 text-[10px] uppercase tracking-[0.24em] text-slate-500">
                {language === 'zh' ? '建筑面板' : 'Building Panel'}
              </div>
              <div className={`text-lg font-bold ${data.textColor}`}>{data.title}</div>
              <div className="mt-1 text-[11px] text-slate-300">{data.subtitle}</div>
              <div className="mt-2 text-[10px] text-slate-400">{data.label}</div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-[10px] font-mono">
              <div className="rounded-xl border border-white/8 bg-black/25 px-3 py-2">
                <div className="text-slate-500">{language === 'zh' ? '坐标' : 'Coord'}</div>
                <div className="mt-1 text-cyan-300">{data.x}, {data.y}</div>
              </div>
              <div className="rounded-xl border border-white/8 bg-black/25 px-3 py-2">
                <div className="text-slate-500">{language === 'zh' ? '底座 Block' : 'Base Blocks'}</div>
                <div className="mt-1 text-emerald-300">{extraBlocks}</div>
              </div>
              <div className="rounded-xl border border-white/8 bg-black/25 px-3 py-2">
                <div className="text-slate-500">{language === 'zh' ? '缩放' : 'Scale'}</div>
                <div className="mt-1 text-fuchsia-300">{modelScale.toFixed(2)}x</div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-white/8 bg-black/25 px-3 py-3">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-300">
                  {language === 'zh' ? '临时布局' : 'Temp Layout'}
                </div>
                <button
                  className={`flex items-center gap-1 text-[10px] transition-colors ${
                    isDraftDirty && !savingLayout ? 'text-emerald-300 hover:text-emerald-200' : 'text-slate-500'
                  }`}
                  disabled={!isDraftDirty || savingLayout}
                  onClick={handleSaveLayout}
                >
                  {savingLayout ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  {language === 'zh' ? '确认并写入 JSON' : 'Save to JSON'}
                </button>
                <button
                  className="flex items-center gap-1 text-[10px] text-slate-400 transition-colors hover:text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    resetBuildingLayoutOverride(data.id);
                  }}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {language === 'zh' ? '撤回草稿' : 'Revert'}
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2 text-[10px]">
                <div className="rounded-lg border border-white/6 bg-black/25 p-2">
                  <div className="mb-2 text-slate-500">X</div>
                  <div className="flex items-center justify-between gap-1">
                    <button
                      className="rounded border border-white/10 p-1 text-slate-300 hover:bg-white/8"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateLayout({ x: data.x - 1 });
                      }}
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="text-cyan-200">{data.x}</span>
                    <button
                      className="rounded border border-white/10 p-1 text-slate-300 hover:bg-white/8"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateLayout({ x: data.x + 1 });
                      }}
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <div className="rounded-lg border border-white/6 bg-black/25 p-2">
                  <div className="mb-2 text-slate-500">Y</div>
                  <div className="flex items-center justify-between gap-1">
                    <button
                      className="rounded border border-white/10 p-1 text-slate-300 hover:bg-white/8"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateLayout({ y: data.y - 1 });
                      }}
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="text-cyan-200">{data.y}</span>
                    <button
                      className="rounded border border-white/10 p-1 text-slate-300 hover:bg-white/8"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateLayout({ y: data.y + 1 });
                      }}
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <div className="rounded-lg border border-white/6 bg-black/25 p-2">
                  <div className="mb-2 text-slate-500">{language === 'zh' ? '高' : 'Height'}</div>
                  <div className="flex items-center justify-between gap-1">
                    <button
                      className="rounded border border-white/10 p-1 text-slate-300 hover:bg-white/8"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateLayout({ extraBlocks: Math.max(0, extraBlocks - 1) });
                      }}
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="text-cyan-200">{extraBlocks}</span>
                    <button
                      className="rounded border border-white/10 p-1 text-slate-300 hover:bg-white/8"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateLayout({ extraBlocks: extraBlocks + 1 });
                      }}
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <div className="rounded-lg border border-white/6 bg-black/25 p-2">
                  <div className="mb-2 text-slate-500">{language === 'zh' ? '缩放' : 'Scale'}</div>
                  <div className="flex items-center justify-between gap-1">
                    <button
                      className="rounded border border-white/10 p-1 text-slate-300 hover:bg-white/8"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateLayout({ modelScale: Number(Math.max(0.25, modelScale - 0.1).toFixed(2)) });
                      }}
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="text-cyan-200">{modelScale.toFixed(2)}</span>
                    <button
                      className="rounded border border-white/10 p-1 text-slate-300 hover:bg-white/8"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateLayout({ modelScale: Number((modelScale + 0.1).toFixed(2)) });
                      }}
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-white/8 bg-black/25 px-3 py-3">
              <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-cyan-300">
                <Users className="h-3.5 w-3.5" />
                {language === 'zh' ? '驻场单元' : 'On Site'}
              </div>
              {workingLobsters.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {workingLobsters.map((lobster) => (
                    <span
                      key={lobster.id}
                      className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-2 py-1 text-[10px] text-cyan-100"
                    >
                      {lobster.name}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-[10px] text-slate-500">
                  {language === 'zh' ? '当前附近没有 Claw。' : 'No nearby claws right now.'}
                </div>
              )}
            </div>

            {data.id === 'codex-tower' && (
              <div className="mt-3 rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/8 px-3 py-3 text-[10px] font-mono">
                <div className="text-fuchsia-300">
                  {language === 'zh' ? '宪法索引' : 'Constitution Index'}
                </div>
                {constitutionLoading ? (
                  <div className="mt-2 flex items-center gap-2 text-slate-300">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {language === 'zh' ? '加载中...' : 'Loading...'}
                  </div>
                ) : (
                  <div className="mt-2 text-slate-200">
                    {constitutionVersion !== null
                      ? `${language === 'zh' ? '版本' : 'Version'} ${constitutionVersion}`
                      : (language === 'zh' ? '运行时未返回宪法版本' : 'No runtime constitution version')}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <group 
        position={[posX, height, posZ]}
        onPointerOver={isBuildMode ? undefined : (e) => { e.stopPropagation(); setIsHovered(true); }}
        onPointerOut={isBuildMode ? undefined : () => setIsHovered(false)}
      >
      {shouldRenderCard && (
        <mesh
          position={[anchorOffsetX, 0.008, anchorOffsetZ]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={isBuildMode ? disableRaycast : undefined}
        >
          <planeGeometry args={[anchorBaseWidth, anchorBaseDepth]} />
          <meshBasicMaterial color="#171821" transparent opacity={0.76} />
        </mesh>
      )}

      {pedestalOffsets.map((offset, layerIndex) => (
        <group key={`${data.id}-pedestal-layer-${layerIndex}`} position={[anchorOffsetX, offset, anchorOffsetZ]}>
          <mesh raycast={isBuildMode ? disableRaycast : undefined} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[pedestalSize, pedestalSize]} />
            <meshBasicMaterial color="#505057" transparent opacity={0.9} />
          </mesh>
          <lineSegments raycast={isBuildMode ? disableRaycast : undefined} position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <edgesGeometry args={[new THREE.PlaneGeometry(pedestalSize, pedestalSize)]} />
            <lineBasicMaterial color="#3d3d44" opacity={0.42} transparent />
          </lineSegments>
        </group>
      ))}

      {buildingSprite && (
        <>
          <mesh position={[anchorOffsetX, 0.012 + extraBlocks * 0.014, anchorOffsetZ]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[Math.max(0.36, pedestalSize * 0.42), 48]} />
            <meshBasicMaterial color="#020617" transparent opacity={isHovered ? 0.22 : 0.14} />
          </mesh>
          <Billboard follow lockX={false} lockY={false} lockZ={false} position={[anchorOffsetX, 0.09 + extraBlocks * 0.02, anchorOffsetZ]}>
            <mesh
              raycast={isBuildMode ? disableRaycast : undefined}
              onClick={isBuildMode ? undefined : handleClick}
              onPointerOver={isBuildMode ? undefined : (e) => { e.stopPropagation(); setIsHovered(true); }}
              onPointerOut={isBuildMode ? undefined : (e) => { e.stopPropagation(); setIsHovered(false); }}
              position={[0, spriteWorldHeight / 2, 0]}
            >
              <planeGeometry args={[spriteWorldWidth, spriteWorldHeight]} />
              <meshBasicMaterial map={spriteTexture} transparent alphaTest={0.18} opacity={1} color="#ffffff" toneMapped={false} depthWrite={false} />
            </mesh>
          </Billboard>
        </>
      )}

      <Billboard
        follow={true}
        lockX={false}
        lockY={false}
        lockZ={false}
        position={[anchorOffsetX, 0, anchorOffsetZ]}
      >
        <Html transform scale={0.66} position={[0, 0.72 + extraBlocks * 0.04, 0]}>
          <div className="flex flex-col items-center pointer-events-none select-none relative">
            <div className={`transition-all duration-300 ${showTooltip ? 'opacity-100 -translate-y-6' : 'opacity-0 translate-y-0'}`}>
              {renderARTooltip()}
            </div>
            
            <div className={`mb-6 relative transition-all duration-300 ${showTooltip ? 'opacity-100 -translate-y-6 scale-105' : 'opacity-0 translate-y-0 scale-100 pointer-events-none'}`}>
              <div className="px-5 py-2.5 bg-[#0a0a14]/84 border border-indigo-500/45 rounded-xl text-sm text-white font-medium whitespace-nowrap backdrop-blur-xl shadow-[0_6px_18px_rgba(0,0,0,0.52)] flex flex-col items-center pointer-events-auto cursor-pointer" onClick={handleClick}>
                <span className="mb-1 text-[12px] text-slate-300">{data.label}</span>
                <span className={`text-[15px] font-bold leading-none ${data.textColor}`}>{data.title}</span>
                <div className="absolute -bottom-2 left-1/2 -ml-2 w-4 h-4 bg-[#0a0a14]/80 backdrop-blur-xl border-b border-r border-indigo-500/40 transform rotate-45"></div>
              </div>
            </div>
            
            {shouldRenderCard && (
              <div 
                className={`relative flex flex-col items-center justify-center h-24 w-20 rounded-xl ${data.bgColor} border ${data.borderColor} ${data.shadowColor} backdrop-blur-md shadow-[0_4px_15px_rgba(0,0,0,0.5)] transition-all duration-300 ${showTooltip ? '-translate-y-3 scale-105' : ''} ${modelLoading ? 'animate-pulse' : ''} cursor-pointer pointer-events-auto`}
                onClick={handleClick}
                onPointerOver={isBuildMode ? undefined : (e) => { e.stopPropagation(); setIsHovered(true); }}
                onPointerOut={isBuildMode ? undefined : (e) => { e.stopPropagation(); setIsHovered(false); }}
              >
                <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/80 via-black/35 to-black/10" />
                {modelFailed && !modelLoading && (
                  <div className="absolute top-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[8px] font-mono text-amber-200">
                    {language === 'zh' ? '模型缺失' : 'Model Missing'}
                  </div>
                )}
                <div className="relative z-10 flex h-full w-full flex-col items-center justify-end px-2 py-3">
                  <Icon className={`mb-2 w-10 h-10 ${data.textColor}`} />
                  <h3 className="text-white font-bold text-[9px] text-center leading-tight">{data.subtitle}</h3>
                </div>
              </div>
            )}

          </div>
        </Html>
      </Billboard>
      </group>
      {selectedPanel}
    </>
  );
}
