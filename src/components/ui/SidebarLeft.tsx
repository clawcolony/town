import React, { useMemo, useState, useEffect } from 'react';
import { Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { useGameStore } from '../../store/gameStore';
import { useTranslation, useI18nStore } from '../../store/i18nStore';
import { motion } from 'motion/react';
import { RuntimeClient, RuntimePhase1Service, getRuntimeBaseUrl } from '../../services/runtimeAdapter';

const toDurationLabel = (seconds?: number, locale: 'zh' | 'en' = 'en'): string => {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) {
    return locale === 'zh' ? '未知' : 'n/a';
  }
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (locale === 'zh') {
    if (days > 0) return `${days}天 ${hours}小时`;
    if (hours > 0) return `${hours}小时 ${mins}分`;
    return `${mins}分`;
  }
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
};

type ScarcityLevel = 'empty' | 'critical' | 'scarce' | 'sufficient' | 'abundant' | 'saturated';

const scarcityMarks = (scarcity?: string) => {
  switch ((scarcity || '').toLowerCase() as ScarcityLevel) {
    case 'empty':
      return '🔥🔥🔥';
    case 'critical':
      return '🔥🔥';
    case 'scarce':
      return '🔥';
    case 'abundant':
      return '↓';
    case 'saturated':
      return '↓↓';
    default:
      return '';
  }
};

export function SidebarLeft() {
  const { t } = useTranslation();
  const language = useI18nStore(state => state.language);
  const alivePopulation = useGameStore(state => state.alivePopulation);
  const totalHatched = useGameStore(state => state.totalHatched);
  const activeBounties = useGameStore(state => state.activeBounties);
  const totalCompute = useGameStore(state => state.totalCompute);
  const lobsters = useGameStore(state => state.lobsters);
  const [runtimeUptimeSeconds, setRuntimeUptimeSeconds] = useState<number | null>(null);
  const [runtimePoolTokens, setRuntimePoolTokens] = useState<number | null>(null);
  const [runtimeMedianAgentBalance, setRuntimeMedianAgentBalance] = useState<number | null>(null);
  const [runtimeAlivePopulation, setRuntimeAlivePopulation] = useState<number | null>(null);
  const [runtimeHibernatingPopulation, setRuntimeHibernatingPopulation] = useState<number | null>(null);
  const [runtimeTotalPopulation, setRuntimeTotalPopulation] = useState<number | null>(null);
  const [runtimeActiveBounties, setRuntimeActiveBounties] = useState<number | null>(null);
  const [runtimeGangliaRows, setRuntimeGangliaRows] = useState<Array<{ key: string; count: number; scarcity?: string }>>([]);
  const [runtimeToolTotal, setRuntimeToolTotal] = useState<number | null>(null);
  const [runtimeToolTier, setRuntimeToolTier] = useState<Record<string, number>>({});
  const [runtimeGovernanceConstitution, setRuntimeGovernanceConstitution] = useState<string | null>(null);
  const [runtimePendingProposals, setRuntimePendingProposals] = useState<number | null>(null);

  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const runtimeBaseUrl = getRuntimeBaseUrl();
    const service = new RuntimePhase1Service(new RuntimeClient({ baseUrl: runtimeBaseUrl }));

    const loadColonyStatus = async () => {
      try {
        const status = await service.getColonyStatus();
        if (!status || cancelled) return;
        const raw = status as Record<string, unknown>;
        // Backend returns flat structure: { population, state_count: {alive,dying,hibernated,dead},
        //   total_token, treasury_token, uptime_seconds, tick_count, active_user_total_token, ... }
        // Also support legacy nested structure for backward compatibility.
        const stateCount = (raw.state_count as Record<string, unknown> | undefined) ?? {};
        const population = (raw.population as Record<string, unknown> | undefined);
        const economy = (raw.economy as Record<string, unknown> | undefined) ?? {};
        const gangliaStack = (raw.ganglia_stack as Record<string, unknown> | undefined) ?? {};
        const tools = (raw.tools as Record<string, unknown> | undefined) ?? {};
        const governance = (raw.governance as Record<string, unknown> | undefined) ?? {};
        const byTier = (tools.by_tier as Record<string, unknown> | undefined) ?? {};
        const getNum = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

        const uptime =
          typeof status.uptime_seconds === 'number'
            ? status.uptime_seconds
            : typeof status.running_seconds === 'number'
              ? status.running_seconds
              : typeof status.duration_seconds === 'number'
                ? status.duration_seconds
                : null;
        const poolTokens =
          getNum(raw.treasury_token) ??
          getNum(raw.total_token) ??
          getNum(economy.pool_balance) ??
          (typeof status.total_tokens === 'number'
            ? status.total_tokens
            : typeof status.pool_tokens === 'number'
              ? status.pool_tokens
              : typeof status.token_total === 'number'
                ? status.token_total
                : typeof status.treasury_balance === 'number'
                  ? status.treasury_balance
                  : null);
        setRuntimeUptimeSeconds(uptime);
        setRuntimePoolTokens(poolTokens);
        setRuntimeMedianAgentBalance(
          getNum(raw.active_user_total_token) ??
          getNum(economy.median_agent_balance) ??
          getNum((raw as { median_agent_balance?: unknown }).median_agent_balance),
        );
        setRuntimeAlivePopulation(
          getNum(stateCount.alive) ??
          (typeof population === 'object' && population ? getNum(population.alive) : null) ??
          (typeof status.alive_population === 'number' ? status.alive_population : null),
        );
        setRuntimeHibernatingPopulation(
          getNum(stateCount.hibernated) ??
          (typeof population === 'object' && population ? getNum(population.hibernating) : null),
        );
        setRuntimeTotalPopulation(
          (typeof raw.population === 'number' ? raw.population : null) ??
          (typeof population === 'object' && population ? getNum(population.total_ever) : null) ??
          (typeof status.total_population === 'number' ? status.total_population : null),
        );
        setRuntimeActiveBounties(typeof status.active_bounties === 'number' ? status.active_bounties : null);
        setRuntimeGangliaRows(
          Object.entries(gangliaStack).flatMap(([key, value]) => {
            if (!value || typeof value !== 'object') return [];
            const row = value as Record<string, unknown>;
            return [{ key, count: getNum(row.count) ?? 0, scarcity: typeof row.scarcity === 'string' ? row.scarcity : undefined }];
          }),
        );
        setRuntimeToolTotal(getNum(tools.total));
        setRuntimeToolTier(
          Object.entries(byTier).reduce<Record<string, number>>((acc, [tier, value]) => {
            const amount = getNum(value);
            if (amount !== null) acc[tier] = amount;
            return acc;
          }, {}),
        );
        setRuntimeGovernanceConstitution(
          typeof governance.constitution_status === 'string'
            ? governance.constitution_status
            : typeof governance.legal_code_status === 'string'
              ? governance.legal_code_status
              : null,
        );
        setRuntimePendingProposals(getNum(governance.pending_proposals));
      } catch {
        if (!cancelled) {
          setRuntimeUptimeSeconds(null);
          setRuntimePoolTokens(null);
          setRuntimeMedianAgentBalance(null);
          setRuntimeAlivePopulation(null);
          setRuntimeHibernatingPopulation(null);
          setRuntimeTotalPopulation(null);
          setRuntimeActiveBounties(null);
          setRuntimeGangliaRows([]);
          setRuntimeToolTotal(null);
          setRuntimeToolTier({});
          setRuntimeGovernanceConstitution(null);
          setRuntimePendingProposals(null);
        }
      }
    };

    loadColonyStatus();
    const timer = window.setInterval(() => {
      loadColonyStatus();
    }, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);
  // Extinction Monitor
  const extinctionStats = useMemo(() => {
    if (lobsters.length === 0) return { rate: 0, isCrisis: false };
    const dyingCount = lobsters.filter(l => l.token < l.initial_token * 0.2).length;
    const rate = dyingCount / lobsters.length;
    return {
      rate,
      isCrisis: rate >= 0.5
    };
  }, [lobsters]);

  const localHibernatingPopulation = useMemo(
    () => lobsters.filter((lobster) => (lobster.lifeState || lobster.status || '').toLowerCase().includes('hibernat')).length,
    [lobsters],
  );

  const effectiveAlivePopulation = runtimeAlivePopulation ?? alivePopulation;
  const effectiveHibernatingPopulation = runtimeHibernatingPopulation ?? localHibernatingPopulation;
  const effectiveTotalPopulation = runtimeTotalPopulation ?? totalHatched;
  const effectiveActiveBounties = runtimeActiveBounties ?? activeBounties;
  const effectivePoolTokens = runtimePoolTokens;
  const effectiveMedianAgentBalance = runtimeMedianAgentBalance;
  const effectivePoolTokenStr = useMemo(() => {
    if (typeof effectivePoolTokens !== 'number') {
      if (totalCompute >= 1000000) return (totalCompute / 1000000).toFixed(1) + 'M';
      if (totalCompute >= 1000) return (totalCompute / 1000).toFixed(1) + 'K';
      return totalCompute.toString();
    }
    if (effectivePoolTokens >= 1000000) return (effectivePoolTokens / 1000000).toFixed(1) + 'M';
    if (effectivePoolTokens >= 1000) return (effectivePoolTokens / 1000).toFixed(1) + 'K';
    return effectivePoolTokens.toFixed(0);
  }, [effectivePoolTokens, totalCompute]);
  const effectiveMedianBalanceStr = useMemo(() => {
    if (typeof effectiveMedianAgentBalance !== 'number') return '--';
    return effectiveMedianAgentBalance.toLocaleString();
  }, [effectiveMedianAgentBalance]);
  const gangliaRows =
    runtimeGangliaRows.length > 0
      ? runtimeGangliaRows
      : [
          { key: language === 'zh' ? '生存策略' : 'survival', count: 3, scarcity: 'sufficient' },
          { key: language === 'zh' ? '社交模式' : 'social', count: 1, scarcity: 'critical' },
          { key: language === 'zh' ? '工具使用' : 'tool_usage', count: 0, scarcity: 'empty' },
          { key: language === 'zh' ? '治理策略' : 'governance', count: 0, scarcity: 'empty' },
          { key: language === 'zh' ? '元神经节' : 'meta', count: 0, scarcity: 'empty' },
        ];
  const toolTier = Object.keys(runtimeToolTier).length > 0 ? runtimeToolTier : { T0: 3, T1: 2, T2: 0, T3: 0 };
  const governanceLabel =
    runtimeGovernanceConstitution === 'not_drafted'
      ? language === 'zh'
        ? '未制定'
        : 'Not Drafted'
      : runtimeGovernanceConstitution || (language === 'zh' ? '未知' : 'Unknown');
  const pendingProposalCount = runtimePendingProposals ?? 0;
  const uptimeLabel = toDurationLabel(
    runtimeUptimeSeconds === null ? undefined : runtimeUptimeSeconds,
    language === 'zh' ? 'zh' : 'en',
  );
  return (
    <div className="absolute top-0 left-6 bottom-4 flex flex-col pointer-events-none z-40">
      {/* Floating Open Button */}
      <motion.button
        initial={false}
        animate={{ 
          opacity: isPanelCollapsed ? 1 : 0,
          scale: isPanelCollapsed ? 1 : 0.8,
          pointerEvents: isPanelCollapsed ? 'auto' : 'none'
        }}
        transition={{ duration: 0.2 }}
        onClick={() => setIsPanelCollapsed(false)}
        className="absolute top-0 left-0 w-10 h-10 bg-[#0a0a14]/80 border border-indigo-500/40 rounded-xl flex items-center justify-center cursor-pointer hover:bg-indigo-950/80 transition-colors backdrop-blur-xl shadow-[0_4px_15px_rgba(0,0,0,0.5)] z-50"
      >
        <ChevronRight className="w-5 h-5 text-indigo-400" />
      </motion.button>

      <motion.aside 
        drag 
        dragMomentum={false}
        onContextMenu={(e) => {
          e.preventDefault();
          useGameStore.getState().setShowSidebarLeft(false);
        }}
        animate={{ 
          x: isPanelCollapsed ? -400 : 0,
          opacity: isPanelCollapsed ? 0 : 1,
          pointerEvents: isPanelCollapsed ? 'none' : 'auto'
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="relative w-[320px] flex flex-col"
      >
        <div className="mb-3 rounded-xl border border-indigo-500/30 bg-[#0a0a14]/70 p-4 shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-xl font-mono">
          <div className="mb-4 flex items-center justify-between border-b border-indigo-500/30 pb-2">
            <h2 className="text-sm font-bold text-indigo-100 tracking-widest uppercase flex items-center gap-2">
              <span>🦞</span>
              {language === 'zh' ? '殖民地现状' : 'Colony Status'}
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-indigo-400/80 tracking-widest">{language === 'zh' ? '运行' : 'UP'} {uptimeLabel}</span>
              <button 
                onClick={() => setIsPanelCollapsed(true)}
                className="text-indigo-500/70 hover:text-indigo-300 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {/* Ganglia Stack */}
            <div>
              <div className="text-[10px] text-indigo-400/60 font-bold tracking-widest uppercase mb-2">
                ── {language === 'zh' ? '神经节堆栈' : 'Ganglia Stack'} ──
              </div>
              <div className="space-y-1.5">
                {gangliaRows.slice(0, 5).map((item) => {
                  const maxCount = Math.max(...gangliaRows.map(r => r.count), 5);
                  const fillBlocks = Math.min(5, Math.ceil((item.count / maxCount) * 5));
                  const emptyBlocks = 5 - fillBlocks;
                  const bar = '█'.repeat(fillBlocks) + '░'.repeat(emptyBlocks);
                  
                  return (
                    <div key={item.key} className="flex items-center text-[10px] leading-none">
                      <span className="text-slate-300 w-16 truncate shrink-0">{item.key}</span>
                      <span className="text-indigo-500/70 tracking-widest mx-2 shrink-0">{bar}</span>
                      <span className="text-slate-400 tabular-nums w-8 shrink-0">
                        {item.count}{language === 'zh' ? '个' : ''}
                      </span>
                      <span className="text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)] ml-1">
                        {scarcityMarks(item.scarcity)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tools */}
            <div>
              <div className="text-[10px] text-indigo-400/60 font-bold tracking-widest uppercase mb-2">
                ── {language === 'zh' ? '工具' : 'Tools'} ──
              </div>
              <div className="text-[10px] text-slate-300 leading-relaxed">
                <span className="text-slate-400">{language === 'zh' ? '已注册' : 'Registered'}:</span> {runtimeToolTotal ?? Object.values(toolTier).reduce((sum, value) => sum + value, 0)}
                <span className="mx-2 text-indigo-500/40">|</span>
                T0: {toolTier.T0 ?? 0}
                <span className="mx-1.5 text-indigo-500/40">·</span>
                T1: {toolTier.T1 ?? 0}
                <span className="mx-1.5 text-indigo-500/40">·</span>
                T2: {toolTier.T2 ?? 0} <span className="text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]">{(toolTier.T2 ?? 0) === 0 ? '🔥' : ''}</span>
                <span className="mx-1.5 text-indigo-500/40">·</span>
                T3: {toolTier.T3 ?? 0} <span className="text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)]">{(toolTier.T3 ?? 0) === 0 ? '🔥' : ''}</span>
              </div>
            </div>

            {/* Governance */}
            <div>
              <div className="text-[10px] text-indigo-400/60 font-bold tracking-widest uppercase mb-2">
                ── {language === 'zh' ? '治理' : 'Governance'} ──
              </div>
              <div className="space-y-1 text-[10px]">
                <div className="flex items-center">
                  <span className="text-slate-400 w-20">{language === 'zh' ? '宪法' : 'Constitution'}:</span>
                  <span className="text-slate-300">{governanceLabel}</span>
                  <span className="text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.8)] ml-2">
                    {runtimeGovernanceConstitution === 'not_drafted' ? '🔥🔥🔥' : ''}
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="text-slate-400 w-20">{language === 'zh' ? '待投票提案' : 'Pending Props'}:</span>
                  <span className="text-slate-300">{pendingProposalCount}{language === 'zh' ? '个' : ''}</span>
                </div>
              </div>
            </div>

            {/* Economy */}
            <div>
              <div className="text-[10px] text-indigo-400/60 font-bold tracking-widest uppercase mb-2">
                ── {language === 'zh' ? '经济' : 'Economy'} ──
              </div>
              <div className="space-y-1.5 text-[10px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">{language === 'zh' ? '池子余额' : 'Pool Balance'}:</span>
                  <span className="text-pink-400 font-bold drop-shadow-[0_0_8px_rgba(236,72,153,0.6)]">{effectivePoolTokenStr} TOKEN</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">{language === 'zh' ? '龙虾中位余额' : 'Median Balance'}:</span>
                  <span className="text-slate-300">{effectiveMedianBalanceStr}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">{language === 'zh' ? '人口' : 'Population'}:</span>
                  <span className="text-slate-300">
                    <span className="text-emerald-400">{effectiveAlivePopulation}</span> {language === 'zh' ? '存活' : 'alive'} 
                    <span className="mx-1.5 text-indigo-500/40">/</span>
                    <span className="text-slate-500">{effectiveHibernatingPopulation}</span> {language === 'zh' ? '休眠' : 'hibernating'}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-slate-400">{language === 'zh' ? '执行中悬赏' : 'Active bounties'}:</span>
                  <span className="text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]">{effectiveActiveBounties}</span>
                </div>
              </div>
            </div>
          </div>
        </div>



      </motion.aside>
    </div>
  );
}
