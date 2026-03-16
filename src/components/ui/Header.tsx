import React, { useState, useEffect, useRef } from 'react';
import { Activity, Database, Search, Eye, EyeOff, Users, Hammer, Check, X, Star, Copy, ExternalLink } from 'lucide-react';
import { useGameStore } from '../../store/gameStore';
import { useTranslation, useI18nStore } from '../../store/i18nStore';
import { toast } from 'sonner';
import { RuntimeClient, RuntimePhase1Service, getRuntimeBaseUrl } from '../../services/runtimeAdapter';
import { ListStateView } from './ListStateView';

interface HeaderProps {
  onOpenJoinModal: () => void;
}

export function Header({ onOpenJoinModal }: HeaderProps) {
  const STAR_REPO = ((import.meta as any).env?.VITE_GITHUB_STAR_REPO as string | undefined) || 'agi-bar/clawcolony';
  const STAR_TARGET = Number((import.meta as any).env?.VITE_GITHUB_STAR_TARGET || 2000);
  const PROJECT_URL = ((import.meta as any).env?.VITE_GITHUB_PROJECT_URL as string | undefined) || `https://github.com/${STAR_REPO}`;

  const toNumberOrNull = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  };

  const toUptimeLabel = (seconds: number | null, locale: 'zh' | 'en'): string => {
    if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return '--';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (locale === 'zh') {
      if (days > 0) return `${days}天${hours}小时`;
      if (hours > 0) return `${hours}小时${mins}分`;
      return `${mins}分`;
    }
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const { t } = useTranslation();
  const toggleLanguage = useI18nStore((state) => state.toggleLanguage);
  const language = useI18nStore((state) => state.language);
  const showUI = useGameStore(state => state.showUI);
  const toggleUI = useGameStore(state => state.toggleUI);
  const tick = useGameStore(state => state.tick);
  const gStack = useGameStore(state => state.gStack);
  const setGStack = useGameStore(state => state.setGStack);
  const lobsters = useGameStore(state => state.lobsters);
  const setSelectedLobsterId = useGameStore(state => state.setSelectedLobsterId);
  const selectedLobsterId = useGameStore(state => state.selectedLobsterId);
  const isBuildMode = useGameStore(state => state.isBuildMode);
  const setBuildMode = useGameStore(state => state.setBuildMode);
  const pendingBuildTiles = useGameStore(state => state.pendingBuildTiles);
  const pendingUnlockParcelIds = useGameStore(state => state.pendingUnlockParcelIds);
  const commitBuildTiles = useGameStore(state => state.commitBuildTiles);
  const clearPendingBuildTiles = useGameStore(state => state.clearPendingBuildTiles);
  const showSidebarLeft = useGameStore(state => state.showSidebarLeft);
  const showSidebarRight = useGameStore(state => state.showSidebarRight);
  const showFloatingConsole = useGameStore(state => state.showFloatingConsole);
  const showEventAlerts = useGameStore(state => state.showEventAlerts);
  const hasHiddenPanels = !showSidebarLeft || !showSidebarRight || !showFloatingConsole || !showEventAlerts;

  const [tickGlow, setTickGlow] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [showAgentsList, setShowAgentsList] = useState(false);
  const [showConsumedAgents, setShowConsumedAgents] = useState(false);
  const [showBuildConfirm, setShowBuildConfirm] = useState(false);
  const [starCount, setStarCount] = useState<number | null>(null);
  const [starsLoading, setStarsLoading] = useState(true);
  const [copyingShare, setCopyingShare] = useState(false);
  const [shareTemplateIndex, setShareTemplateIndex] = useState<number>(0);
  const lastTemplateIndexRef = useRef<number>(-1);
  const [runtimeGStack, setRuntimeGStack] = useState<number | null>(null);
  const [runtimeUptimeSeconds, setRuntimeUptimeSeconds] = useState<number | null>(null);
  const [runtimeStatusLoading, setRuntimeStatusLoading] = useState(true);
  const runtimeStatusInitializedRef = useRef(false);
  const [runtimeAgents, setRuntimeAgents] = useState<Array<{
    userId: string;
    displayName: string;
    balance: number | null;
    lobsterId?: number;
    isConsumed?: boolean;
  }> | null>(null);
  const [runtimeAgentsLoading, setRuntimeAgentsLoading] = useState(true);
  const runtimeAgentsInitializedRef = useRef(false);
  // 模拟 tick 变化时的发光效果
  useEffect(() => {
    setTickGlow(true);
    const timer = setTimeout(() => setTickGlow(false), 300);
    return () => clearTimeout(timer);
  }, [tick]);

  useEffect(() => {
    let cancelled = false;

    const loadRuntimeStatus = async () => {
      const runtimeBaseUrl = getRuntimeBaseUrl();
      if (!cancelled && !runtimeStatusInitializedRef.current) setRuntimeStatusLoading(true);
      try {
        const service = new RuntimePhase1Service(new RuntimeClient({ baseUrl: runtimeBaseUrl }));
        const status = await service.getColonyStatus();
        const statusRecord = status as Record<string, unknown> | null;
        const uptime =
          toNumberOrNull(status?.uptime_seconds) ??
          toNumberOrNull(status?.running_seconds) ??
          toNumberOrNull(status?.duration_seconds);
        const totalToken =
          toNumberOrNull(statusRecord?.total_token) ??
          toNumberOrNull(status?.total_tokens) ??
          toNumberOrNull(status?.token_total);
        if (!cancelled) setRuntimeUptimeSeconds(uptime);
        if (!cancelled) setRuntimeGStack(totalToken);
      } catch {
        if (!cancelled) {
          setRuntimeUptimeSeconds(null);
          setRuntimeGStack(null);
        }
      } finally {
        if (!cancelled) {
          setRuntimeStatusLoading(false);
          runtimeStatusInitializedRef.current = true;
        }
      }
    };

    loadRuntimeStatus();
    const timer = window.setInterval(loadRuntimeStatus, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadRuntimeAgents = async () => {
      const runtimeBaseUrl = getRuntimeBaseUrl();
      if (!cancelled && !runtimeAgentsInitializedRef.current) setRuntimeAgentsLoading(true);
      try {
        const service = new RuntimePhase1Service(new RuntimeClient({ baseUrl: runtimeBaseUrl }));
        const [bots, leaderboard] = await Promise.all([service.getOnlineBots(), service.getTokenLeaderboard(100)]);
        const botMap = new Map(
          bots.map((bot) => [bot.user_id, bot.nickname || bot.name || bot.user_id] as const),
        );
        const lobsterByName = new Map(lobsters.map((lobster) => [lobster.name, lobster]));
        const ranked = leaderboard.map((item) => {
          const local = lobsterByName.get(item.user_id);
          return {
            userId: item.user_id,
            displayName: botMap.get(item.user_id) || item.user_id,
            balance: item.balance,
            lobsterId: local?.id,
            isConsumed: local?.isConsumed,
          };
        });
        if (!cancelled) setRuntimeAgents(ranked);
      } catch {
        if (!cancelled) setRuntimeAgents([]);
      } finally {
        if (!cancelled) {
          setRuntimeAgentsLoading(false);
          runtimeAgentsInitializedRef.current = true;
        }
      }
    };

    loadRuntimeAgents();
    return () => {
      cancelled = true;
    };
  }, [lobsters]);

  useEffect(() => {
    let cancelled = false;

    const loadStars = async () => {
      if (!cancelled && starCount === null) setStarsLoading(true);
      try {
        const res = await fetch(`https://api.github.com/repos/${STAR_REPO}`, {
          headers: { Accept: 'application/vnd.github+json' },
        });
        if (!res.ok) throw new Error(`GitHub status ${res.status}`);
        const payload = (await res.json()) as { stargazers_count?: number };
        if (!cancelled) {
          setStarCount(typeof payload.stargazers_count === 'number' ? payload.stargazers_count : null);
        }
      } catch {
        if (!cancelled) setStarCount(null);
      } finally {
        if (!cancelled) setStarsLoading(false);
      }
    };

    loadStars();
    const timer = window.setInterval(loadStars, 300000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [STAR_REPO]);

  const effectiveGStack = runtimeGStack;
  const effectiveAgents = runtimeAgents ?? [];
  const visibleAgents = effectiveAgents.filter((agent) => (showConsumedAgents ? agent.isConsumed : !agent.isConsumed));
  const leaderboardCount = runtimeAgentsLoading ? '--' : String(effectiveAgents.filter((agent) => !agent.isConsumed).length);
  const uptimeLabel = toUptimeLabel(runtimeUptimeSeconds, language === 'zh' ? 'zh' : 'en');
  const gStackLabel = runtimeStatusLoading
    ? '--'
    : typeof effectiveGStack === 'number'
      ? (effectiveGStack >= 1000 ? (effectiveGStack / 1000).toFixed(1) + 'K' : effectiveGStack.toFixed(0))
      : '--';
  const activeLobster = lobsters.find((l) => l.id === selectedLobsterId) || lobsters[0];
  const lobsterShareId = activeLobster?.id ?? 0;
  const shareTemplates = language === 'zh'
    ? [
        `我的龙虾 #${lobsterShareId} 正在创世纪里搞建设，来看看它在干什么 🦞 ${PROJECT_URL}`,
        `龙虾创世纪现在有 ${typeof starCount === 'number' ? starCount.toLocaleString() : '--'} ⭐ 了，我的 #${lobsterShareId} 也在里面，一群 AI Agent 自己建社会还挺离谱的 ${PROJECT_URL}`,
        `#${lobsterShareId} 今天在创世纪里锻造了一个新的神经节。AI 自己进化自己，这事儿真的在发生 🦞 ${PROJECT_URL}`,
        `在龙虾创世纪养了一只 AI，编号 #${lobsterShareId}。它每天自己找活干、自己赚 Token、自己投票立法，比我勤快多了 ${PROJECT_URL}`,
      ]
    : [
        `My lobster #${lobsterShareId} is building things in the colony. Come see what it is doing 🦞 ${PROJECT_URL}`,
        `The colony now has ${typeof starCount === 'number' ? starCount.toLocaleString() : '--'} stars, and my #${lobsterShareId} is in there too. AI agents running a tiny society is wild ${PROJECT_URL}`,
        `#${lobsterShareId} forged a new ganglion today. AI evolving AI is actually happening 🦞 ${PROJECT_URL}`,
        `I am raising an AI in Lobster Colony, id #${lobsterShareId}. It finds work, earns tokens, and votes by itself ${PROJECT_URL}`,
      ];
  const shareText = shareTemplates[Math.max(0, Math.min(shareTemplateIndex, shareTemplates.length - 1))];
  const starLabel = starsLoading ? '--' : (typeof starCount === 'number' ? starCount.toLocaleString() : '--');
  const starProgress = typeof starCount === 'number' && STAR_TARGET > 0 ? Math.min(100, (starCount / STAR_TARGET) * 100) : 0;

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchValue.trim()) {
      const lowerSearch = searchValue.toLowerCase();
      const found = lobsters.find(l => 
        l.id.toString() === lowerSearch || 
        l.name.toLowerCase().includes(lowerSearch)
      );
      if (found) {
        setSelectedLobsterId(found.id);
        setSearchValue('');
      } else {
        toast.error(`${t('header.agentNotFound')} ${searchValue}`, {
          description: t('header.checkIdAndTryAgain'),
        });
      }
    }
  };

  const handleBuildModeClick = () => {
    if (isBuildMode) {
      const hasPendingAssets = useGameStore.getState().customAssets.some(a => a.isPending);
      if (pendingBuildTiles.length > 0 || pendingUnlockParcelIds.length > 0 || hasPendingAssets) {
        setShowBuildConfirm(true);
      } else {
        setBuildMode(false);
      }
    } else {
      setBuildMode(true);
    }
  };

  const handleConfirmBuild = () => {
    // Check if we are building custom assets or regular tiles
    const customAssetsToBuild = useGameStore.getState().customAssets.filter(a => a.isPending);
    const unlockCost = pendingUnlockParcelIds.length * 400;
    const tileCost = pendingBuildTiles.length * 100;
    
    // Custom assets cost depends on the scaled size of the bounding box rather than just visual scaling,
    // but in previous logic we used width * length * 100. Let's make sure width/length aren't 0.
    // If they are undefined or 0, fallback to a base cost of 100 for a custom asset.
    const customAssetCost = customAssetsToBuild.reduce((acc, asset) => {
      const area = (asset.width || 1) * (asset.length || 1);
      return acc + (area * 100);
    }, 0);
    
    const totalCost = unlockCost + tileCost + customAssetCost;

    if (totalCost === 0) {
      setShowBuildConfirm(false);
      return;
    }

    if (gStack >= totalCost) {
      setGStack(gStack - totalCost);
      commitBuildTiles();
      setShowBuildConfirm(false);
      
      const message = language === 'zh'
        ? `保存成功，已消耗 ${totalCost} TOKEN`
        : `Saved successfully for ${totalCost} TOKEN.`;
      
      useGameStore.getState().addEvent({
        type: 'system',
        message: `Build successful! Cost ${totalCost} TOKEN`,
        messageZh: `建造成功！消耗了 ${totalCost} TOKEN`
      });

      toast.success(message, {
        style: { borderColor: '#10b981', color: '#10b981' }
      });
    } else {
      useGameStore.getState().addEvent({
        type: 'system',
        message: `Insufficient Funds to build. Need ${totalCost} TOKEN.`,
        messageZh: `资金不足，无法建造。需要 ${totalCost} TOKEN。`
      });
      toast.error(language === 'zh' ? 'Token不足！' : 'Not enough tokens!', {
        style: { borderColor: '#ef4444', color: '#ef4444' }
      });
    }
  };

  const handleCancelBuild = () => {
    clearPendingBuildTiles();
    setBuildMode(false);
    setShowBuildConfirm(false);
  };

  const handleCopyShare = async () => {
    try {
      setCopyingShare(true);
      await navigator.clipboard.writeText(shareText);
      toast.success(language === 'zh' ? '分享文案已复制' : 'Share text copied');
    } catch {
      toast.error(language === 'zh' ? '复制失败，请手动复制' : 'Copy failed, please copy manually');
    } finally {
      setCopyingShare(false);
    }
  };

  const handleStarHover = () => {
    if (shareTemplates.length <= 1) {
      setShareTemplateIndex(0);
      return;
    }
    let next = Math.floor(Math.random() * shareTemplates.length);
    if (next === lastTemplateIndexRef.current) {
      next = (next + 1) % shareTemplates.length;
    }
    lastTemplateIndexRef.current = next;
    setShareTemplateIndex(next);
  };

  return (
    <header className={`relative z-[60] h-16 flex items-center px-6 justify-between pointer-events-auto transition-all duration-300 gap-4 bg-transparent`}>
      <div className={`flex items-center gap-2 transition-opacity duration-300 flex-1 ${showUI ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        
        {/* Logo Module */}
        <div className="flex items-center gap-2 bg-[#0a0a14]/40 backdrop-blur-xl border border-indigo-500/40 rounded-xl px-4 py-1.5 shadow-[0_4px_15px_rgba(0,0,0,0.5)] h-[30px]">
          <span className="text-base leading-none" aria-hidden="true">🦞</span>
          <span className="text-indigo-100 font-bold tracking-widest uppercase text-xs">{t('header.title')}</span>
        </div>

        {/* TICK Module */}
        <div className="flex items-center gap-2 bg-[#0a0a14]/40 backdrop-blur-xl border border-indigo-500/40 rounded-xl px-4 py-1.5 shadow-[0_4px_15px_rgba(0,0,0,0.5)] text-[10px] font-mono h-[30px] min-w-[120px] justify-between">
          <div className="flex items-center gap-2">
            <Activity className={`w-3.5 h-3.5 ${tickGlow ? 'text-cyan-300' : 'text-emerald-400'}`}/> 
            <span className="text-indigo-400 uppercase tracking-wider">{t('header.tick')}</span>
          </div>
          <span className={`font-bold transition-all duration-300 text-right ${tickGlow ? 'text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 'text-indigo-100'}`}>{uptimeLabel}</span>
        </div>

        {/* G-STACK Module */}
        <div className="flex items-center gap-2 bg-[#0a0a14]/40 backdrop-blur-xl border border-indigo-500/40 rounded-xl px-4 py-1.5 shadow-[0_4px_15px_rgba(0,0,0,0.5)] text-[10px] font-mono h-[30px] min-w-[120px] justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-blue-400"/>
            <span className="text-indigo-400 uppercase tracking-wider">{t('header.gStack')}</span>
          </div>
          <span className="text-indigo-100 font-bold text-right">{gStackLabel}</span>
        </div>

        {/* GitHub Star Counter Module */}
        <div className="relative group h-[30px]" onMouseEnter={handleStarHover}>
          <div className="flex items-center gap-2 bg-[#0a0a14]/40 backdrop-blur-xl border border-indigo-500/40 rounded-xl px-3 py-1.5 shadow-[0_4px_15px_rgba(0,0,0,0.5)] h-[30px] min-w-[118px]">
            <Star className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-indigo-400 uppercase tracking-wider text-[10px] font-mono">GitHub Star</span>
            <span className="text-indigo-100 font-bold text-[10px] font-mono">{starLabel}</span>
          </div>

          <div className="absolute top-full pt-[10px] left-0 w-72 z-50 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity">
            <div className="bg-[#0a0a0f]/70 backdrop-blur-xl border border-indigo-500/40 rounded-xl shadow-[0_4px_15px_rgba(0,0,0,0.5)] p-3">
              <div className="mb-2">
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 transition-all duration-300" style={{ width: `${starProgress}%` }} />
                </div>
                <div className="mt-1 text-[10px] text-slate-400 font-mono">
                  {language === 'zh'
                    ? `目标 ${STAR_TARGET.toLocaleString()} · ${starProgress.toFixed(1)}%`
                    : `Target ${STAR_TARGET.toLocaleString()} · ${starProgress.toFixed(1)}%`}
                </div>
              </div>
              <div className="text-[10px] text-amber-300 font-bold tracking-wider uppercase mb-2">
                {language === 'zh' ? '分享文案（含龙虾 ID）' : 'Share Copy (with Lobster ID)'}
              </div>
              <div className="text-[10px] text-slate-200 leading-relaxed border border-white/10 rounded-md bg-black/30 p-2 font-mono">
                {shareText}
              </div>
              <button
                type="button"
                className="mt-2 w-full h-8 flex items-center justify-center gap-2 rounded-md border border-indigo-500/40 bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/20 transition-colors text-[10px] font-bold tracking-wider uppercase"
                onClick={handleCopyShare}
                disabled={copyingShare}
              >
                <Copy className="w-3.5 h-3.5" />
                {copyingShare
                  ? (language === 'zh' ? '复制中...' : 'Copying...')
                  : (language === 'zh' ? '复制分享文案' : 'Copy Share Text')}
              </button>
              <a
                href={PROJECT_URL}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-2 w-full h-8 flex items-center justify-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20 transition-colors text-[10px] font-bold tracking-wider uppercase"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {language === 'zh' ? '打开 GitHub' : 'Open GitHub'}
              </a>
            </div>
          </div>
        </div>

        {/* Agents Module */}
        <div className="relative h-[30px]">
          <button 
            className={`flex items-center gap-2 bg-[#0a0a14]/40 backdrop-blur-xl border border-indigo-500/40 rounded-xl px-4 py-1.5 shadow-[0_4px_15px_rgba(0,0,0,0.5)] text-[10px] font-mono h-[30px] min-w-[120px] justify-between transition-colors ${
              showAgentsList 
                ? 'bg-purple-950/40 text-purple-200 border-purple-500/50' 
                : 'hover:bg-indigo-950/40'
            }`}
            onClick={() => setShowAgentsList(!showAgentsList)}
          >
            <div className="flex items-center gap-2">
              <Users className={`w-3.5 h-3.5 ${showAgentsList ? 'text-purple-300' : 'text-purple-400'}`}/>
              <span className={`uppercase tracking-wider ${showAgentsList ? 'text-purple-200' : 'text-indigo-400'}`}>{t('header.agentsTitle')}</span>
            </div>
            <span className="text-indigo-100 font-bold text-right">{leaderboardCount}</span>
          </button>

          {showAgentsList && (
            <div className="absolute top-[calc(100%+12px)] left-0 w-64 bg-[#0a0a0f]/40 backdrop-blur-xl border border-indigo-500/40 rounded-xl shadow-[0_4px_15px_rgba(0,0,0,0.5)] z-50 overflow-hidden pointer-events-auto">
              <div className="px-4 py-2.5 border-b border-white/10 bg-white/5 flex items-center justify-between">
                <span className="text-[10px] font-bold text-purple-200 tracking-wider uppercase">{t('header.agentsTitle')}</span>
                <span className="text-[10px] text-purple-400 font-mono">
                  {runtimeAgentsLoading ? '--' : `${visibleAgents.length} TOTAL`}
                </span>
              </div>
              
              {/* Tabs for Held vs Consumed */}
              <div className="flex border-b border-white/10">
                <button
                  className={`flex-1 py-2 text-[10px] font-bold tracking-wider uppercase transition-colors ${
                    !showConsumedAgents 
                      ? 'text-purple-200 border-b-2 border-purple-400 bg-white/5' 
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                  onClick={(e) => { e.stopPropagation(); setShowConsumedAgents(false); }}
                >
                  {t('header.agents')}
                </button>
                <button
                  className={`flex-1 py-2 text-[10px] font-bold tracking-wider uppercase transition-colors ${
                    showConsumedAgents 
                      ? 'text-purple-200 border-b-2 border-purple-400 bg-white/5' 
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                  onClick={(e) => { e.stopPropagation(); setShowConsumedAgents(true); }}
                >
                  {t('header.agentsConsumed')}
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto custom-scrollbar">
                <ListStateView
                  loading={runtimeAgentsLoading}
                  isEmpty={visibleAgents.length === 0}
                  loadingText={language === 'zh' ? '排行榜加载中...' : 'Loading leaderboard...'}
                  emptyText={language === 'zh' ? '暂无排行榜数据' : 'No leaderboard data'}
                  className="px-4 py-8 text-center text-slate-500 text-[10px] tracking-wider uppercase"
                >
                  {[...visibleAgents]
                    .sort((a, b) => (b.balance ?? 0) - (a.balance ?? 0))
                    .map(agent => (
                    <button
                      key={agent.userId}
                      className="w-full px-4 py-2 border-b border-white/5 hover:bg-white/10 transition-colors flex items-center justify-between group text-left"
                      onClick={() => {
                        if (typeof agent.lobsterId === 'number') {
                          setSelectedLobsterId(agent.lobsterId);
                          useGameStore.getState().setShowSidebarRight(true); // Open profile panel
                        }
                        setShowAgentsList(false); // Close dropdown
                      }}
                    >
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-white group-hover:text-purple-300 transition-colors">{agent.displayName}</span>
                        <span className="text-[10px] text-slate-400 font-mono">ID: {agent.userId}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] text-amber-400 font-mono">{agent.balance ?? '--'} 💰</span>
                        <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1 shadow-[0_0_5px_rgba(52,211,153,0.8)]"></div>
                      </div>
                    </button>
                  ))}
                </ListStateView>
              </div>
            </div>
          )}
        </div>

        {/* Search Module */}
        <div className={`bg-[#0a0a14]/40 backdrop-blur-xl border border-indigo-500/40 rounded-xl px-3 py-1.5 flex items-center gap-2 text-[10px] font-mono shadow-[0_4px_15px_rgba(0,0,0,0.5)] transition-opacity duration-300 h-[30px] flex-1 min-w-[120px]`}>
          <Search className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <input 
            type="text" 
            placeholder={t('header.searchPlaceholder')}
            className="bg-transparent border-none outline-none text-indigo-100 w-full placeholder:text-indigo-500/50 uppercase tracking-wider"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={handleSearch}
          />
        </div>

      </div>
      
      <div className="flex items-center gap-2">
        {/* Test Welcome Overlay */}
        <button
          className={`bg-[#0a0a14]/40 backdrop-blur-xl border rounded-xl px-2.5 py-1.5 shadow-[0_4px_15px_rgba(0,0,0,0.5)] transition-colors flex items-center justify-center h-[30px] gap-1 border-indigo-500/40 text-indigo-400 hover:text-indigo-200 hover:bg-indigo-950/40 ${showUI ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          onClick={() => useGameStore.getState().showWelcome()}
          title={language === 'zh' ? '测试欢迎弹窗' : 'Test Welcome Overlay'}
        >
          <span className="text-[10px] font-bold tracking-wider">{language === 'zh' ? '加入' : 'Join'}</span>
        </button>

        {/* Build Mode Module */}
        <div className={`relative h-[30px] transition-opacity duration-300 ${showUI ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <button 
            className={`bg-[#0a0a14]/40 backdrop-blur-xl border rounded-xl px-2.5 py-1.5 shadow-[0_4px_15px_rgba(0,0,0,0.5)] transition-colors relative flex items-center justify-center h-full gap-2
              ${isBuildMode ? 'border-amber-500/50 text-amber-400 bg-amber-950/40' : 'border-indigo-500/40 text-indigo-400 hover:text-indigo-200 hover:bg-indigo-950/40'}`}
            onClick={handleBuildModeClick}
            title={language === 'zh' ? '建造模式' : 'Build Mode'}
          >
            <Hammer className="w-4 h-4" />
            {isBuildMode && (pendingBuildTiles.length > 0 || pendingUnlockParcelIds.length > 0 || useGameStore.getState().customAssets.filter(a => a.isPending).length > 0) && (
              <span className="text-[10px] font-bold">({pendingBuildTiles.length + pendingUnlockParcelIds.length + useGameStore.getState().customAssets.filter(a => a.isPending).length})</span>
            )}
          </button>
          
          {showBuildConfirm && (
            <div className="absolute top-[calc(100%+12px)] right-0 w-64 bg-[#0a0a0f]/40 backdrop-blur-xl border border-amber-500/40 rounded-xl shadow-[0_4px_15px_rgba(0,0,0,0.5)] z-50 overflow-hidden pointer-events-auto flex flex-col">
              <div className="p-4 border-b border-white/5">
                <h3 className="text-amber-300 text-sm font-bold mb-1">
                  {language === 'zh' ? '确认保存建造？' : 'Confirm Build?'}
                </h3>
                <p className="text-slate-300 text-xs">
                  {language === 'zh' ? `新增 ${pendingBuildTiles.length} 个建造区块` : `Adding ${pendingBuildTiles.length} build blocks`}
                  {pendingUnlockParcelIds.length > 0 &&
                    (language === 'zh'
                      ? ` + 解锁 ${pendingUnlockParcelIds.length} 个草地块`
                      : ` + unlock ${pendingUnlockParcelIds.length} grass tiles`)
                  }
                  {useGameStore.getState().customAssets.filter(a => a.isPending).length > 0 && 
                    (language === 'zh' 
                      ? ` + ${useGameStore.getState().customAssets.filter(a => a.isPending).length} 个资产` 
                      : ` + ${useGameStore.getState().customAssets.filter(a => a.isPending).length} assets`)
                  }
                </p>
                <div className="mt-2 flex items-center gap-1 text-xs text-amber-400 font-mono bg-amber-500/10 p-2 rounded border border-amber-500/20">
                  <span>{language === 'zh' ? '消耗:' : 'Cost:'}</span>
                  <span className="font-bold">
                    {(pendingUnlockParcelIds.length * 400) + (pendingBuildTiles.length * 100) + useGameStore.getState().customAssets.filter(a => a.isPending).reduce((acc, asset) => acc + ((asset.width || 1) * (asset.length || 1) * 100), 0)} TOKEN
                  </span>
                </div>
              </div>
              <div className="flex bg-black/40">
                <button 
                  className="flex-1 py-2.5 flex items-center justify-center gap-1 text-slate-400 hover:text-white hover:bg-white/5 transition-colors border-r border-white/5 text-xs font-bold"
                  onClick={handleCancelBuild}
                >
                  <X className="w-3.5 h-3.5" />
                  {language === 'zh' ? '取消并退出' : 'Discard'}
                </button>
                <button 
                  className="flex-1 py-2.5 flex items-center justify-center gap-1 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors text-xs font-bold"
                  onClick={handleConfirmBuild}
                >
                  <Check className="w-3.5 h-3.5" />
                  {language === 'zh' ? '确认保存' : 'Save'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Notifications Module (disabled) */}
        {/*
        <div className={`relative h-[30px] transition-opacity duration-300 ${showUI ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          ...
        </div>
        */}
        
        {/* Toggle UI Module */}
        <button 
          className={`bg-[#0a0a14]/40 backdrop-blur-xl border border-indigo-500/40 rounded-xl px-2.5 py-1.5 shadow-[0_4px_15px_rgba(0,0,0,0.5)] transition-colors flex items-center justify-center h-[30px] ${hasHiddenPanels && showUI ? 'text-amber-400 hover:bg-amber-950/40 border-amber-500/50' : 'text-indigo-400 hover:text-indigo-200 hover:bg-indigo-950/40'}`}
          onClick={toggleUI}
          title={!showUI ? t('header.showUI') : hasHiddenPanels ? t('header.restorePanels') : t('header.hideUI')}
        >
          {showUI ? (hasHiddenPanels ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />) : <Eye className="w-4 h-4" />}
        </button>
        
        {/* Language Module */}
        <button 
          className={`bg-[#0a0a14]/40 backdrop-blur-xl border border-indigo-500/40 rounded-xl px-2.5 py-1.5 shadow-[0_4px_15px_rgba(0,0,0,0.5)] transition-all duration-300 flex items-center justify-center text-indigo-400 hover:text-indigo-200 hover:bg-indigo-950/40 text-xs font-bold tracking-wide h-[30px] ${showUI ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          onClick={toggleLanguage}
          title={language === 'zh' ? 'Switch to English' : '切换至中文'}
        >
          {language === 'en' ? '中' : 'EN'}
        </button>

        {/* Settings Module (disabled) */}
        {/*
        <button
          className={`bg-[#0a0a14]/40 backdrop-blur-xl border border-indigo-500/40 rounded-xl px-2.5 py-1.5 shadow-[0_4px_15px_rgba(0,0,0,0.5)] transition-all duration-300 flex items-center justify-center h-[30px] ${showSettings ? 'text-indigo-200 bg-indigo-950/40' : 'text-indigo-400 hover:text-indigo-200 hover:bg-indigo-950/40'} ${showUI ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          onClick={toggleSettings}
        >
          <Settings className="w-4 h-4" />
        </button>
        */}
        
        {/* User Menu Module (disabled) */}
        {/*
        <div className={`relative h-[30px] transition-opacity duration-300 ${showUI ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          ...
        </div>
        */}
      </div>
    </header>
  );
}
