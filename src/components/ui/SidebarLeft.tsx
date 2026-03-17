import React, { useMemo, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useGameStore } from '../../store/gameStore';
import { useI18nStore } from '../../store/i18nStore';
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

const toRelativeTimeLabel = (value?: string, locale: 'zh' | 'en' = 'en'): string => {
  if (!value) return locale === 'zh' ? '刚刚' : 'just now';
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) return value;
  const diffMs = Date.now() - ts;
  const sec = Math.max(0, Math.floor(diffMs / 1000));
  if (sec < 60) return locale === 'zh' ? '刚刚' : 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return locale === 'zh' ? `${min}分钟前` : `${min}m ago`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return locale === 'zh' ? `${hour}小时前` : `${hour}h ago`;
  const day = Math.floor(hour / 24);
  return locale === 'zh' ? `${day}天前` : `${day}d ago`;
};

type ScarcityLevel = 'empty' | 'critical' | 'scarce' | 'sufficient' | 'abundant' | 'saturated';

type DetailView = 'overview' | 'docs' | 'tools' | 'ganglia' | 'changelog' | 'governance' | 'economy';

type DetailListItem = {
  id: string;
  primary: string;
  secondary?: string;
  content?: string;
};

type RuntimeGanglionListItem = {
  id: number;
  name: string;
  type?: string;
  content?: string;
  implementation?: string;
  description?: string;
  updatedAt?: string;
  createdAt?: string;
};

const toText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const pickTextValue = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    const text = toText(value);
    if (text) return text;
  }
  return undefined;
};

const pickPreferredContent = (
  contentValue: unknown,
  implementationValue: unknown,
  fallback = '',
): string => {
  if (typeof contentValue === 'string' && contentValue.trim().length > 0) return contentValue.trim();
  if (typeof implementationValue === 'string' && implementationValue.trim().length > 0) return implementationValue.trim();
  return fallback.trim();
};

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
  const [runtimeKbEntries, setRuntimeKbEntries] = useState<Array<{ id: number; title: string; content?: string; updatedAt?: string }>>([]);
  const [runtimeGangliaList, setRuntimeGangliaList] = useState<RuntimeGanglionListItem[]>([]);
  const [runtimeToolOutputs, setRuntimeToolOutputs] = useState<Array<{ id: string; title: string; detail?: string; updatedAt?: string }>>([]);
  const [runtimeChangeLog, setRuntimeChangeLog] = useState<Array<{ id: string; title: string; detail?: string; updatedAt?: string }>>([]);

  const [detailView, setDetailView] = useState<DetailView>('overview');
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [detailModal, setDetailModal] = useState<{ title: string; content: string; meta?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const runtimeBaseUrl = getRuntimeBaseUrl();
    const service = new RuntimePhase1Service(new RuntimeClient({ baseUrl: runtimeBaseUrl }));

    const loadColonyStatus = async () => {
      try {
        const status = await service.getColonyStatus();
        if (!status || cancelled) return;
        const raw = status as Record<string, unknown>;
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

    const loadOutputBoard = async () => {
      try {
        const [kbEntries, ganglia, chronicle, events] = await Promise.all([
          service.getKbEntries(undefined, 8).catch(() => []),
          service.getGangliaBrowse(8).catch(() => []),
          service.getColonyChronicle(30).catch(() => []),
          service.getEvents(30).catch(() => []),
        ]);
        if (cancelled) return;

        const pickTitle = (raw: Record<string, unknown>, fallback: string) =>
          pickTextValue(
            raw.title,
            raw.name,
            raw.subject,
            raw.action,
            raw.event,
            raw.type,
            raw.message,
            raw.summary,
            raw.summary_zh,
            raw.summary_en,
            raw.detail,
            fallback,
          ) || fallback;
        const pickDetailFallback = (raw: Record<string, unknown>, fallback: string) =>
          pickTextValue(
            raw.body,
            raw.detail,
            raw.summary,
            raw.summary_zh,
            raw.summary_en,
            raw.message,
            raw.description,
            fallback,
          ) || fallback;

        setRuntimeKbEntries(
          kbEntries.slice(0, 8).map((item) => {
            const raw = item as Record<string, unknown>;
            return {
              id: item.id,
              title: item.title,
              content: pickPreferredContent(raw.content, raw.implementation, pickDetailFallback(raw, '')),
              updatedAt: item.updated_at,
            };
          }),
        );
        setRuntimeGangliaList(
          ganglia.slice(0, 8).map((item) => {
            const raw = item as Record<string, unknown>;
            return {
              id: typeof item.id === 'number' ? item.id : 0,
              name: pickTextValue(raw.name, raw.title, `ganglion-${String(item.id ?? '')}`) || `ganglion-${String(item.id ?? '')}`,
              type: pickTextValue(raw.type, raw.category, raw.kind),
              content: pickPreferredContent(raw.content, raw.implementation, pickTextValue(raw.description, raw.summary, '') || ''),
              implementation: pickTextValue(raw.implementation),
              description: pickTextValue(raw.description, raw.summary, raw.detail),
              updatedAt: pickTextValue(raw.updated_at, raw.updatedAt, raw.modified_at),
              createdAt: pickTextValue(raw.created_at, raw.createdAt),
            };
          }),
        );

        const chronicleRows = chronicle.map((item, index) => {
          const raw = item as Record<string, unknown>;
          const title = pickTitle(raw, `chronicle-${index + 1}`);
          return {
            id: `chronicle-${item.id ?? index}`,
            title,
            detail: pickPreferredContent(raw.content, raw.implementation, pickDetailFallback(raw, title)),
            updatedAt: item.updated_at || item.created_at,
          };
        });
        setRuntimeChangeLog(chronicleRows.slice(0, 10));

        const eventRows = events.map((item, index) => {
          const raw = item as Record<string, unknown>;
          const title = pickTitle(raw, `event-${index + 1}`);
          return {
            id: `event-${item.id ?? index}`,
            title,
            detail: pickPreferredContent(
              raw.content,
              raw.implementation,
              pickDetailFallback(raw, title),
            ),
            updatedAt: item.updated_at || item.created_at || (typeof raw.occurred_at === 'string' ? raw.occurred_at : undefined),
          };
        });

        const toolKeyword = /(tool|tools|工具|forge|forged|craft|crafted|锻造|产出|register|registered|review|reviewed|invoke|invoked|tier|promote|promoted|deprecat|archive|归档|注册|调用|升级|降级)/i;
        setRuntimeToolOutputs(
          [...chronicleRows, ...eventRows]
            .filter((item) => toolKeyword.test(item.title))
            .slice(0, 10),
        );
      } catch {
        if (!cancelled) {
          setRuntimeKbEntries([]);
          setRuntimeGangliaList([]);
          setRuntimeToolOutputs([]);
          setRuntimeChangeLog([]);
        }
      }
    };

    loadColonyStatus();
    loadOutputBoard();

    const timer = window.setInterval(() => {
      loadColonyStatus();
      loadOutputBoard();
    }, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const localHibernatingPopulation = useMemo(
    () => lobsters.filter((lobster) => (lobster.lifeState || lobster.status || '').toLowerCase().includes('hibernat')).length,
    [lobsters],
  );

  const effectiveAlivePopulation = runtimeAlivePopulation ?? alivePopulation;
  const effectiveHibernatingPopulation = runtimeHibernatingPopulation ?? localHibernatingPopulation;
  const effectiveTotalPopulation = runtimeTotalPopulation ?? totalHatched;
  const effectiveActiveBounties = runtimeActiveBounties ?? activeBounties;

  const effectivePoolTokenStr = useMemo(() => {
    if (typeof runtimePoolTokens !== 'number') {
      if (totalCompute >= 1000000) return (totalCompute / 1000000).toFixed(1) + 'M';
      if (totalCompute >= 1000) return (totalCompute / 1000).toFixed(1) + 'K';
      return totalCompute.toString();
    }
    if (runtimePoolTokens >= 1000000) return (runtimePoolTokens / 1000000).toFixed(1) + 'M';
    if (runtimePoolTokens >= 1000) return (runtimePoolTokens / 1000).toFixed(1) + 'K';
    return runtimePoolTokens.toFixed(0);
  }, [runtimePoolTokens, totalCompute]);

  const effectiveMedianBalanceStr = useMemo(() => {
    if (typeof runtimeMedianAgentBalance !== 'number') return '--';
    return runtimeMedianAgentBalance.toLocaleString();
  }, [runtimeMedianAgentBalance]);

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
  const totalTools = runtimeToolTotal ?? Object.values(toolTier).reduce((sum, value) => sum + value, 0);
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

  const navItems = [
    {
      key: 'overview' as DetailView,
      label: language === 'zh' ? '总览' : 'Overview',
      hint:
        language === 'zh'
          ? `人口 ${effectiveAlivePopulation}/${effectiveTotalPopulation}`
          : `Pop ${effectiveAlivePopulation}/${effectiveTotalPopulation}`,
    },
    {
      key: 'docs' as DetailView,
      label: language === 'zh' ? '文档' : 'Docs',
      hint: `${runtimeKbEntries.length} · ${runtimeKbEntries[0]?.updatedAt ? toRelativeTimeLabel(runtimeKbEntries[0]?.updatedAt, language === 'zh' ? 'zh' : 'en') : '--'}`,
    },
    {
      key: 'tools' as DetailView,
      label: language === 'zh' ? '工具' : 'Tools',
      hint: `${totalTools} · T2 ${toolTier.T2 ?? 0}`,
    },
    {
      key: 'ganglia' as DetailView,
      label: language === 'zh' ? '神经节' : 'Ganglia',
      hint: `${runtimeGangliaList.length || gangliaRows.reduce((sum, row) => sum + row.count, 0)}`,
    },
    {
      key: 'changelog' as DetailView,
      label: language === 'zh' ? '变更日志' : 'Changelog',
      hint:
        runtimeChangeLog[0]?.updatedAt
          ? toRelativeTimeLabel(runtimeChangeLog[0]?.updatedAt, language === 'zh' ? 'zh' : 'en')
          : '--',
    },
    {
      key: 'governance' as DetailView,
      label: language === 'zh' ? '治理' : 'Governance',
      hint:
        language === 'zh'
          ? `提案 ${pendingProposalCount}`
          : `Proposals ${pendingProposalCount}`,
    },
    {
      key: 'economy' as DetailView,
      label: language === 'zh' ? '经济' : 'Economy',
      hint: `${effectivePoolTokenStr} TOKEN`,
    },
  ];

  const detailTitleMap: Record<DetailView, string> = {
    overview: language === 'zh' ? '全局概览' : 'Global Overview',
    docs: language === 'zh' ? '文档详情' : 'Docs Details',
    tools: language === 'zh' ? '工具详情' : 'Tools Details',
    ganglia: language === 'zh' ? '神经节详情' : 'Ganglia Details',
    changelog: language === 'zh' ? '变更日志详情' : 'Changelog Details',
    governance: language === 'zh' ? '治理详情' : 'Governance Details',
    economy: language === 'zh' ? '经济详情' : 'Economy Details',
  };

  const listItems = useMemo<DetailListItem[]>(() => {
    if (detailView === 'docs') {
      return runtimeKbEntries.map((entry) => ({
        id: `doc-${entry.id}`,
        primary: `#${entry.id} ${entry.title}`,
        secondary: toRelativeTimeLabel(entry.updatedAt, language === 'zh' ? 'zh' : 'en'),
        content: (entry.content || '').trim(),
      }));
    }
    if (detailView === 'tools') {
      const outputRows = runtimeToolOutputs.map((item) => ({
        id: item.id,
        primary: item.title,
        secondary: toRelativeTimeLabel(item.updatedAt, language === 'zh' ? 'zh' : 'en'),
        content: (item.detail || '').trim(),
      }));
      if (outputRows.length > 0) return outputRows;

      const tierOrder = ['T0', 'T1', 'T2', 'T3'] as const;
      const tierRows = tierOrder.map((tier) => ({
        id: `tool-tier-${tier}`,
        primary: `${tier} · ${toolTier[tier] ?? 0}`,
        secondary: language === 'zh' ? '来自工具分层统计' : 'from tool tier stats',
        content: language === 'zh'
          ? `${tier} 当前数量为 ${toolTier[tier] ?? 0}。`
          : `${tier} currently has ${toolTier[tier] ?? 0} tools.`,
      }));
      const fallbackKeyword = /(tool|tools|工具|register|review|invoke|tier|forge|锻造|注册|调用|归档)/i;
      const relatedChanges = runtimeChangeLog
        .filter((item) => fallbackKeyword.test(item.title))
        .slice(0, 4)
        .map((item) => ({
          id: `tool-change-${item.id}`,
          primary: item.title,
          secondary: toRelativeTimeLabel(item.updatedAt, language === 'zh' ? 'zh' : 'en'),
          content: (item.detail || '').trim(),
        }));

      return [
        {
          id: 'tool-total',
          primary: language === 'zh' ? `工具总数 · ${totalTools}` : `Total tools · ${totalTools}`,
          secondary: language === 'zh' ? '来自 colony status' : 'from colony status',
          content: language === 'zh'
            ? `当前系统工具总数为 ${totalTools}。`
            : `Current total tool count is ${totalTools}.`,
        },
        ...tierRows,
        ...relatedChanges,
      ];
    }
    if (detailView === 'ganglia') {
      return runtimeGangliaList.map((item) => ({
        id: `ganglion-${item.id}`,
        primary: `#${item.id} ${item.name}`,
        secondary:
          item.updatedAt
            ? toRelativeTimeLabel(item.updatedAt, language === 'zh' ? 'zh' : 'en')
            : item.type
              ? (language === 'zh' ? `类型 · ${item.type}` : `Type · ${item.type}`)
              : undefined,
        content: pickPreferredContent(
          item.content,
          item.implementation,
          pickTextValue(item.description, item.name, `#${item.id}`) || `#${item.id}`,
        ),
      }));
    }
    if (detailView === 'changelog') {
      return runtimeChangeLog.map((item) => ({
        id: item.id,
        primary: item.title,
        secondary: toRelativeTimeLabel(item.updatedAt, language === 'zh' ? 'zh' : 'en'),
        content: (item.detail || '').trim(),
      }));
    }
    return [];
  }, [detailView, runtimeKbEntries, runtimeToolOutputs, runtimeGangliaList, runtimeChangeLog, language, totalTools, toolTier]);

  const isListView = detailView === 'docs' || detailView === 'tools' || detailView === 'ganglia' || detailView === 'changelog';

  const governanceNotes = useMemo(() => {
    const pattern = /(proposal|vote|govern|constitution|治理|提案|投票|宪法)/i;
    return runtimeChangeLog.filter((item) => pattern.test(item.title)).slice(0, 4);
  }, [runtimeChangeLog]);

  const maxGangliaCount = Math.max(...gangliaRows.map((row) => row.count), 5);
  const detailModalPortal =
    detailModal && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-[220] flex items-center justify-center px-4 pointer-events-auto"
            onClick={() => setDetailModal(null)}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <div
              className="relative w-[min(640px,95vw)] max-h-[72vh] overflow-hidden rounded-xl border border-indigo-500/40 bg-[#05070d]/95 shadow-[0_20px_60px_rgba(0,0,0,0.7)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-indigo-400 font-bold">
                    {language === 'zh' ? '数据详情' : 'Detail'}
                  </div>
                  {detailModal.meta && (
                    <div className="mt-1 text-[10px] text-slate-400">{detailModal.meta}</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setDetailModal(null)}
                  className="text-slate-400 hover:text-white transition-colors"
                  aria-label={language === 'zh' ? '关闭详情弹窗' : 'Close detail dialog'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="max-h-[calc(72vh-84px)] overflow-y-auto custom-scrollbar px-4 py-3">
                <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-2">
                  {language === 'zh' ? 'Title' : 'Title'}
                </div>
                <pre className="whitespace-pre-wrap break-words text-[11px] leading-relaxed text-slate-100 font-mono mb-4">
                  {detailModal.title}
                </pre>
                <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-2">
                  {language === 'zh' ? 'Content' : 'Content'}
                </div>
                <pre className="whitespace-pre-wrap break-words text-[11px] leading-relaxed text-slate-200 font-mono">
                  {detailModal.content}
                </pre>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div className="absolute top-0 left-6 bottom-4 flex flex-col pointer-events-none z-40">
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
          <div className="mb-3 flex items-center justify-between border-b border-indigo-500/30 pb-2">
            <h2 className="text-indigo-400 text-[10px] font-bold tracking-widest uppercase">
              {language === 'zh' ? '创世纪现状' : 'Colony Status'}
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-indigo-400/80 tracking-widest">
                {language === 'zh' ? '运行' : 'UP'} {uptimeLabel}
              </span>
              <button
                onClick={() => setIsPanelCollapsed(true)}
                className="text-indigo-500/70 hover:text-indigo-300 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-[10px] text-indigo-400/70 font-bold tracking-widest uppercase mb-2">
                {language === 'zh' ? '点击查看' : 'Click to View'}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {navItems.map((item) => {
                  const active = detailView === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setDetailView(item.key)}
                      className={`rounded-md border px-2 py-1.5 text-left transition-colors ${
                        active
                          ? 'border-indigo-400/60 bg-indigo-500/15'
                          : 'border-white/10 bg-black/20 hover:bg-white/5'
                      }`}
                    >
                      <div className="text-[10px] font-bold text-indigo-100">{item.label}</div>
                      <div className="text-[9px] text-slate-500 mt-0.5 truncate" title={item.hint}>{item.hint}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-black/20 p-2 min-h-[230px] max-h-[44vh] overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold tracking-widest text-indigo-300 uppercase">
                  {detailTitleMap[detailView]}
                </span>
                {isListView && (
                  <span className="text-[10px] text-slate-500">
                    {language === 'zh' ? `${listItems.length} 条` : `${listItems.length} items`}
                  </span>
                )}
              </div>

              {detailView === 'overview' && (
                <div className="space-y-3 text-[10px]">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded border border-white/10 bg-black/30 p-2">
                      <div className="text-slate-500">{language === 'zh' ? '存活 / 总人口' : 'Alive / Total'}</div>
                      <div className="text-emerald-300 font-bold mt-0.5">{effectiveAlivePopulation} / {effectiveTotalPopulation}</div>
                    </div>
                    <div className="rounded border border-white/10 bg-black/30 p-2">
                      <div className="text-slate-500">{language === 'zh' ? '休眠人口' : 'Hibernating'}</div>
                      <div className="text-slate-200 font-bold mt-0.5">{effectiveHibernatingPopulation}</div>
                    </div>
                    <div className="rounded border border-white/10 bg-black/30 p-2">
                      <div className="text-slate-500">{language === 'zh' ? '执行中悬赏' : 'Active Bounties'}</div>
                      <div className="text-amber-300 font-bold mt-0.5">{effectiveActiveBounties}</div>
                    </div>
                    <div className="rounded border border-white/10 bg-black/30 p-2">
                      <div className="text-slate-500">{language === 'zh' ? '待投票提案' : 'Pending Proposals'}</div>
                      <div className="text-indigo-200 font-bold mt-0.5">{pendingProposalCount}</div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/10">
                    <div className="text-slate-400 mb-1">{language === 'zh' ? '神经节分布' : 'Ganglia Distribution'}</div>
                    <div className="space-y-1.5">
                      {gangliaRows.slice(0, 5).map((row) => {
                        const fillBlocks = Math.min(5, Math.ceil((row.count / maxGangliaCount) * 5));
                        const bar = '█'.repeat(fillBlocks) + '░'.repeat(5 - fillBlocks);
                        return (
                          <div key={row.key} className="flex items-center text-[10px] leading-none">
                            <span className="text-slate-300 w-16 truncate shrink-0" title={row.key}>{row.key}</span>
                            <span className="text-indigo-500/70 tracking-widest mx-2 shrink-0">{bar}</span>
                            <span className="text-slate-400 tabular-nums w-8 shrink-0">{row.count}</span>
                            <span className="text-orange-500 ml-1">{scarcityMarks(row.scarcity)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {isListView && (
                <div className="space-y-1.5">
                  {listItems.length === 0 && (
                    <div className="text-[10px] text-slate-500 py-2">
                      {language === 'zh' ? '暂无可展示数据' : 'No data available'}
                    </div>
                  )}
                  {listItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setDetailModal({
                        title: item.primary,
                        content: item.content && item.content.length > 0 ? item.content : item.primary,
                        meta: item.secondary,
                      })}
                      className="w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 flex items-start justify-between gap-2 text-left hover:bg-white/5 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[10px] text-slate-200 truncate" title={item.primary}>
                          <span className="text-slate-500 mr-1">Title:</span>{item.primary}
                        </div>
                        <div
                          className="text-[10px] text-slate-400 mt-1 max-h-8 overflow-hidden break-words"
                          title={item.content && item.content.length > 0 ? item.content : item.primary}
                        >
                          <span className="text-slate-500 mr-1">Content:</span>
                          {item.content && item.content.length > 0 ? item.content : item.primary}
                        </div>
                      </div>
                      {item.secondary && <span className="text-[10px] text-slate-500 shrink-0 mt-0.5">{item.secondary}</span>}
                    </button>
                  ))}
                </div>
              )}

              {detailView === 'governance' && (
                <div className="space-y-2 text-[10px]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">{language === 'zh' ? '宪法状态' : 'Constitution'}</span>
                    <span className="text-indigo-200">{governanceLabel}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">{language === 'zh' ? '待投票提案' : 'Pending Proposals'}</span>
                    <span className="text-indigo-200">{pendingProposalCount}</span>
                  </div>
                  <div className="rounded border border-white/10 bg-black/30 p-2 text-slate-300 leading-relaxed">
                    {runtimeGovernanceConstitution === 'not_drafted'
                      ? (language === 'zh'
                        ? '当前治理规则未完备，建议优先补齐宪法与投票流程。'
                        : 'Governance rules are incomplete. Prioritize constitution and voting process.')
                      : (language === 'zh'
                        ? '治理运行中，可继续推进提案与执行。'
                        : 'Governance is running. Continue proposals and execution.')} 
                  </div>
                  <div className="pt-1 border-t border-white/10 space-y-1.5">
                    <div className="text-slate-400">{language === 'zh' ? '相关变更' : 'Related Changes'}</div>
                    {governanceNotes.length > 0 ? governanceNotes.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setDetailModal({
                          title: item.title,
                          content: item.detail && item.detail.length > 0 ? item.detail : item.title,
                          meta: toRelativeTimeLabel(item.updatedAt, language === 'zh' ? 'zh' : 'en'),
                        })}
                        className="w-full rounded border border-white/10 bg-black/30 px-2 py-1.5 flex items-start justify-between gap-2 text-left hover:bg-white/5 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-slate-200 truncate" title={item.title}>
                            <span className="text-slate-500 mr-1">Title:</span>{item.title}
                          </div>
                          <div
                            className="text-[10px] text-slate-400 mt-1 max-h-8 overflow-hidden break-words"
                            title={item.detail && item.detail.length > 0 ? item.detail : item.title}
                          >
                            <span className="text-slate-500 mr-1">Content:</span>
                            {item.detail && item.detail.length > 0 ? item.detail : item.title}
                          </div>
                        </div>
                        <span className="text-slate-500 shrink-0 mt-0.5">{toRelativeTimeLabel(item.updatedAt, language === 'zh' ? 'zh' : 'en')}</span>
                      </button>
                    )) : (
                      <div className="text-slate-500">{language === 'zh' ? '暂无治理相关变更' : 'No governance-related changes yet'}</div>
                    )}
                  </div>
                </div>
              )}

              {detailView === 'economy' && (
                <div className="space-y-2 text-[10px]">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">{language === 'zh' ? '池子余额' : 'Pool Balance'}</span>
                    <span className="text-pink-400 font-bold">{effectivePoolTokenStr} TOKEN</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">{language === 'zh' ? '龙虾中位余额' : 'Median Balance'}</span>
                    <span className="text-slate-200">{effectiveMedianBalanceStr}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">{language === 'zh' ? '执行中悬赏' : 'Active Bounties'}</span>
                    <span className="text-amber-300">{effectiveActiveBounties}</span>
                  </div>
                  <div className="pt-1 border-t border-white/10">
                    <div className="text-slate-400 mb-1">{language === 'zh' ? '工具分层' : 'Tool Tiers'}</div>
                    <div className="grid grid-cols-2 gap-1">
                      <div className="rounded border border-white/10 bg-black/30 px-2 py-1 text-slate-300">T0 · {toolTier.T0 ?? 0}</div>
                      <div className="rounded border border-white/10 bg-black/30 px-2 py-1 text-slate-300">T1 · {toolTier.T1 ?? 0}</div>
                      <div className="rounded border border-white/10 bg-black/30 px-2 py-1 text-slate-300">T2 · {toolTier.T2 ?? 0}</div>
                      <div className="rounded border border-white/10 bg-black/30 px-2 py-1 text-slate-300">T3 · {toolTier.T3 ?? 0}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.aside>
      </div>
      {detailModalPortal}
    </>
  );
}
