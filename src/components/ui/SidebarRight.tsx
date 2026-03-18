import React, { useState, useRef, useEffect } from 'react';
import { Activity, ChevronDown } from 'lucide-react';
import { useGameStore } from '../../store/gameStore';
import { useTranslation, useI18nStore } from '../../store/i18nStore';
import { motion } from 'motion/react';
import { RuntimeClient, RuntimePhase1Service, getRuntimeBaseUrl } from '../../services/runtimeAdapter';
import { ListStateView } from './ListStateView';
import type { SystemLog } from '../../types/game';

type FeedComm = {
  id: string;
  sender: string;
  avatarClass: string;
  timestamp: string;
  timestampZh: string;
  content: string;
  contentZh: string;
  sortTs: number;
};

type FeedSystemLog = SystemLog & {
  sortTs: number;
};

type GitHubCommitItem = {
  sha: string;
  html_url?: string;
  commit?: {
    message?: string;
    author?: {
      name?: string;
      date?: string;
    };
  };
  author?: {
    login?: string;
  } | null;
};

const GITHUB_MONITOR_REPO = 'wakenmeng/clawcolony';
const GITHUB_COMMITS_API = `https://api.github.com/repos/${GITHUB_MONITOR_REPO}/commits?per_page=40`;

const toRelative = (value?: string, locale: 'zh' | 'en' = 'en'): string => {
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

const toSortTs = (value?: string): number => {
  if (!value) return 0;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? 0 : ts;
};

export function SidebarRight() {
  const { t } = useTranslation();
  const language = useI18nStore(state => state.language);
  const feedHubLabel = language === 'zh' ? '信号枢纽' : 'Signal Hub';
  const [remoteComms, setRemoteComms] = useState<FeedComm[]>([]);
  const [commsLoading, setCommsLoading] = useState(true);
  const [activeFeed, setActiveFeed] = useState<'comms' | 'monitor'>('monitor');
  const [isFeedOpen, setIsFeedOpen] = useState(true);
  const commsEndRef = useRef<HTMLDivElement>(null);

  const [remoteSystemLogs, setRemoteSystemLogs] = useState<FeedSystemLog[] | null>(null);
  const [remoteSystemLogsLoading, setRemoteSystemLogsLoading] = useState(true);
  const [monitorFilter, setMonitorFilter] = useState<'all' | 'chronicle' | 'repo'>('all');
  const logsEndRef = useRef<HTMLDivElement>(null);
  const systemLogsInitializedRef = useRef(false);

  // Auto-scroll to bottom when new items are added or panel is opened
  useEffect(() => {
    if (isFeedOpen && activeFeed === 'comms') {
      commsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [remoteComms, isFeedOpen, activeFeed]);

  useEffect(() => {
    if (isFeedOpen && activeFeed === 'monitor') {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [remoteSystemLogs, isFeedOpen, activeFeed]);

  useEffect(() => {
    let cancelled = false;
    const runtimeBaseUrl = getRuntimeBaseUrl();
    const service = new RuntimePhase1Service(new RuntimeClient({ baseUrl: runtimeBaseUrl }));

    const toComm = (item: Record<string, unknown>, idx: number): FeedComm => {
      const fromUser =
        typeof item.from_user === 'object' && item.from_user
          ? (item.from_user as Record<string, unknown>)
          : null;
      const sender =
        (fromUser && typeof fromUser.display_name === 'string' && fromUser.display_name) ||
        (fromUser && typeof fromUser.nickname === 'string' && fromUser.nickname) ||
        (fromUser && typeof fromUser.username === 'string' && fromUser.username) ||
        (fromUser && typeof fromUser.user_id === 'string' && fromUser.user_id) ||
        (typeof item.nickname === 'string' && item.nickname) ||
        (typeof item.name === 'string' && item.name) ||
        (typeof item.sender === 'string' && item.sender) ||
        (typeof item.from === 'string' && item.from) ||
        (typeof item.user_id === 'string' && item.user_id) ||
        `Agent #${idx + 1}`;
      const content =
        (typeof item.body === 'string' && item.body) ||
        (typeof item.content === 'string' && item.content) ||
        (typeof item.message === 'string' && item.message) ||
        '';
      const sentAt =
        (typeof item.sent_at === 'string' && item.sent_at) ||
        (typeof item.created_at === 'string' && item.created_at) ||
        (typeof item.updated_at === 'string' && item.updated_at) ||
        undefined;
      const idValue =
        (typeof item.message_id === 'number' && item.message_id) ||
        (typeof item.message_id === 'string' && item.message_id) ||
        item.id ||
        `${sender}-${idx}`;
      return {
        id: String(idValue),
        sender,
        avatarClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
        timestamp: toRelative(sentAt, 'en'),
        timestampZh: toRelative(sentAt, 'zh'),
        content,
        contentZh: content,
        sortTs: toSortTs(sentAt),
      };
    };

    const loadComms = async () => {
      try {
        const comms = await service.getCommunications(80);
        const mapped = comms
          .map((item, idx) => toComm(item as Record<string, unknown>, idx))
          .filter((item) => item.content.trim().length > 0)
          .sort((a, b) => {
            if (a.sortTs !== b.sortTs) return a.sortTs - b.sortTs;
            return a.id.localeCompare(b.id);
          })
          .slice(0, 40);
        if (!cancelled) {
          setRemoteComms(mapped);
          setCommsLoading(false);
        }
      } catch {
        if (!cancelled) {
          setRemoteComms([]);
          setCommsLoading(false);
        }
      }
    };

    const loadRepoActivity = async (): Promise<FeedSystemLog[]> => {
      const response = await fetch(GITHUB_COMMITS_API, {
        headers: {
          Accept: 'application/vnd.github+json',
        },
      });
      if (!response.ok) {
        throw new Error(`github commits request failed: ${response.status}`);
      }

      const commits = (await response.json()) as GitHubCommitItem[];
      return commits.map((item, idx) => {
        const message = item.commit?.message?.trim() || 'Repository updated';
        const [summary, ...rest] = message.split('\n');
        const author = item.author?.login || item.commit?.author?.name || 'GitHub';
        const committedAt = item.commit?.author?.date;
        const shortSha = item.sha.slice(0, 7);
        const detail = rest.join('\n').trim();
        const content = detail.length > 0 ? `${summary}\n${detail}` : summary;

        return {
          id: `repo-${item.sha || idx}`,
          kind: 'repo',
          source: `Repo · ${author} · ${shortSha}`,
          timestamp: toRelative(committedAt, 'en'),
          timestampZh: toRelative(committedAt, 'zh'),
          sortAt: committedAt ? Date.parse(committedAt) : undefined,
          content,
          contentZh: content,
          colorClass: 'text-emerald-400',
          sortTs: toSortTs(committedAt),
        };
      });
    };

    const loadChronicle = async () => {
      if (!cancelled && !systemLogsInitializedRef.current) setRemoteSystemLogsLoading(true);
      try {
        const [chronicles, repoActivity] = await Promise.all([
          service.getColonyChronicle(60),
          loadRepoActivity().catch(() => []),
        ]);
        if (cancelled) return;
        const mappedChronicle: FeedSystemLog[] = chronicles.map((item, idx) => {
          const raw = item as Record<string, unknown>;
          const title =
            (typeof item.title === 'string' && item.title) ||
            (typeof item.event === 'string' && item.event) ||
            (typeof item.category === 'string' && item.category) ||
            'Chronicle';
          const detail =
            (typeof raw.summary === 'string' && raw.summary) ||
            (typeof raw.summary_zh === 'string' && raw.summary_zh) ||
            (typeof item.detail === 'string' && item.detail) ||
            (typeof item.message === 'string' && item.message) ||
            title;
          const rawAt =
            (typeof raw.date === 'string' && raw.date) ||
            (typeof item.created_at === 'string' && item.created_at) ||
            (typeof item.updated_at === 'string' && item.updated_at) ||
            undefined;
          return {
            id: `chronicle-${item.id ?? idx}`,
            kind: 'chronicle',
            source: `Chronicle · ${title}`,
            timestamp: toRelative(rawAt, 'en'),
            timestampZh: toRelative(rawAt, 'zh'),
            sortAt: rawAt ? Date.parse(rawAt) : undefined,
            content: detail,
            contentZh: detail,
            colorClass: 'text-fuchsia-400',
            sortTs: toSortTs(rawAt),
          };
        });
        const merged = [...mappedChronicle, ...repoActivity]
          .sort((a, b) => {
            if (a.sortTs !== b.sortTs) return a.sortTs - b.sortTs;
            return a.id.localeCompare(b.id);
          })
          .slice(-80);
        setRemoteSystemLogs(merged);
      } catch {
        if (!cancelled) setRemoteSystemLogs([]);
      } finally {
        if (!cancelled) {
          setRemoteSystemLogsLoading(false);
          systemLogsInitializedRef.current = true;
        }
      }
    };

    loadComms();
    loadChronicle();
    const timer = window.setInterval(() => {
      loadComms();
      loadChronicle();
    }, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const effectiveSystemLogs = remoteSystemLogs ?? [];
  const chronicleLogs = effectiveSystemLogs
    .filter(log => log.kind === 'chronicle')
    .sort((a, b) => (b.sortAt ?? 0) - (a.sortAt ?? 0));
  const repoLogs = effectiveSystemLogs
    .filter(log => log.kind === 'repo')
    .sort((a, b) => (b.sortAt ?? 0) - (a.sortAt ?? 0));
  const filteredLogs =
    monitorFilter === 'all'
      ? [...chronicleLogs, ...repoLogs].sort((a, b) => (b.sortAt ?? 0) - (a.sortAt ?? 0))
      : monitorFilter === 'chronicle'
        ? chronicleLogs
        : repoLogs;

  const renderSystemLogCard = (log: SystemLog) => (
    <div key={log.id} className="p-2.5 drop-shadow-md bg-indigo-950/20 rounded-lg border border-indigo-500/20">
      <div className="flex justify-between items-start mb-1 gap-3">
        <span className={`${log.colorClass} text-[10px] font-mono font-bold flex items-center gap-1.5 min-w-0`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current shadow-[0_0_5px_currentColor] shrink-0"></span>
          <span className="truncate">{log.source}</span>
        </span>
        <span className="text-slate-500 text-[9px] font-mono tracking-wider shrink-0">
          {language === 'zh' && log.timestampZh ? log.timestampZh : log.timestamp}
        </span>
      </div>
      <p className="text-indigo-200/80 text-[10px] leading-relaxed font-mono tracking-wider mt-1.5 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
        {language === 'zh' && log.contentZh ? log.contentZh : log.content}
      </p>
    </div>
  );

  const monitorFilterOptions: Array<{ id: 'all' | 'chronicle' | 'repo'; label: string }> = [
    { id: 'all', label: t('sidebarRight.all') },
    { id: 'chronicle', label: t('sidebarRight.monitorChronicle') },
    { id: 'repo', label: t('sidebarRight.monitorRepo') },
  ];

  return (
    <div className="absolute top-10 right-6 bottom-4 flex flex-col pointer-events-none z-40">
      <motion.aside 
        drag 
        dragMomentum={false}
        onContextMenu={(e) => {
          e.preventDefault();
          useGameStore.getState().setShowSidebarRight(false);
        }}
        className="relative w-[320px] flex flex-col gap-4 pointer-events-auto"
      >
      {/* COMMS + MONITOR INTEGRATED PANEL */}
      <div className="relative flex flex-col max-h-[55vh] -mt-10">
        <div
          onClick={() => setIsFeedOpen(prev => !prev)}
          className="h-10 backdrop-blur-md border border-indigo-500/40 rounded-xl px-3 flex items-center justify-between bg-[#0a0a14]/70 hover:bg-indigo-950/50 transition-colors cursor-pointer group shadow-[0_4px_15px_rgba(0,0,0,0.5)] shrink-0 z-10"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity">
              <Activity className="w-4 h-4 text-indigo-400" />
            </div>
            <span className="text-indigo-400 text-[10px] font-bold tracking-widest font-mono group-hover:text-indigo-300 transition-colors uppercase">
              {feedHubLabel}
            </span>
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-indigo-600 group-hover:text-indigo-400 transition-colors transform ${isFeedOpen ? 'rotate-180' : ''}`} />
        </div>

        {isFeedOpen && (
          <div className="mt-2 flex flex-col flex-1 min-h-0 bg-[#0a0a0f]/20 backdrop-blur-md border border-indigo-500/20 rounded-xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.8)]">
            <div className="p-2 border-b border-indigo-500/20 flex items-center gap-2 bg-[#0a0a14]/40">
              <button
                type="button"
                onClick={() => setActiveFeed('monitor')}
                className={`flex-1 h-8 rounded-md border text-[10px] font-mono tracking-wider transition-colors ${
                  activeFeed === 'monitor'
                    ? 'border-indigo-400/70 bg-indigo-500/20 text-indigo-200'
                    : 'border-indigo-500/30 bg-transparent text-indigo-400/70 hover:bg-indigo-500/10'
                }`}
              >
                {t('sidebarLeft.systemMonitor')}
              </button>
              <button
                type="button"
                onClick={() => setActiveFeed('comms')}
                className={`flex-1 h-8 rounded-md border text-[10px] font-mono tracking-wider transition-colors ${
                  activeFeed === 'comms'
                    ? 'border-indigo-400/70 bg-indigo-500/20 text-indigo-200'
                    : 'border-indigo-500/30 bg-transparent text-indigo-400/70 hover:bg-indigo-500/10'
                }`}
              >
                {t('sidebarRight.comms')}
              </button>
            </div>

            {activeFeed === 'comms' ? (
              <>
                <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-4 p-3 custom-scrollbar">
                  <ListStateView
                    loading={commsLoading}
                    isEmpty={remoteComms.length === 0}
                    loadingText={language === 'zh' ? '通讯加载中...' : 'Loading communications...'}
                    emptyText={language === 'zh' ? '暂无通讯数据' : 'No communications data'}
                    className="text-[10px] font-mono tracking-wider px-1 py-2 text-slate-500"
                  >
                    {remoteComms.map(comm => (
                      <div key={comm.id} className="flex gap-3 items-start min-w-0">
                        <div className={`w-8 h-8 rounded border flex items-center justify-center shrink-0 ${comm.avatarClass}`}>
                          <span className="font-bold text-[10px]">{comm.sender ? comm.sender.charAt(0).toUpperCase() : '?'}</span>
                        </div>
                        <div className="flex-1 min-w-0 bg-indigo-950/20 rounded-lg rounded-tl-none p-3 border border-indigo-500/20">
                          <div className="flex justify-between items-baseline mb-1">
                            <span className="text-white text-[10px] font-bold tracking-wider truncate max-w-[55%]">{comm.sender}</span>
                            <span className="text-slate-500 text-[9px]">{language === 'zh' && comm.timestampZh ? comm.timestampZh : comm.timestamp}</span>
                          </div>
                          <p className="text-indigo-200/80 text-[10px] leading-relaxed tracking-wider whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                            {language === 'zh' && comm.contentZh ? comm.contentZh : comm.content}
                          </p>
                        </div>
                      </div>
                    ))}
                  </ListStateView>
                  <div ref={commsEndRef} />
                </div>
                <div className="p-3 border-t border-indigo-500/20 flex justify-center items-center gap-2 text-slate-500 text-[10px] shrink-0 bg-transparent backdrop-blur-md">
                  <div className="w-2 h-2 rounded-full bg-emerald-500/50 animate-ping"></div>
                  {t('sidebarRight.intercepting')}
                </div>
              </>
            ) : (
              <>
                <div className="shrink-0 p-3 pb-2 border-b border-indigo-500/20 bg-[#0a0a14]/35 backdrop-blur-md">
                  <div className="flex gap-1.5 rounded-lg border border-indigo-500/20 bg-[#0b0b18]/60 p-1">
                    {monitorFilterOptions.map(option => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setMonitorFilter(option.id)}
                        className={`flex-1 h-7 rounded-md border text-[9px] font-mono tracking-wider transition-colors ${
                          monitorFilter === option.id
                            ? 'border-indigo-400/70 bg-indigo-500/20 text-indigo-200'
                            : 'border-transparent bg-transparent text-indigo-400/70 hover:bg-indigo-500/10'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto space-y-3 p-3 custom-scrollbar">
                  <ListStateView
                    loading={remoteSystemLogsLoading}
                    isEmpty={effectiveSystemLogs.length === 0}
                    loadingText={t('sidebarRight.monitorLoading')}
                    emptyText={t('sidebarRight.monitorEmpty')}
                    className="px-1 py-2 text-[10px] font-mono tracking-wider text-slate-500"
                  >
                    <div className="space-y-3">
                      {filteredLogs.map(renderSystemLogCard)}
                    </div>
                  </ListStateView>
                  <div ref={logsEndRef} />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      </motion.aside>
    </div>
  );
}
