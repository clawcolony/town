import React, { useState, useRef, useEffect } from 'react';
import { Activity, ChevronDown } from 'lucide-react';
import { useGameStore } from '../../store/gameStore';
import { useTranslation, useI18nStore } from '../../store/i18nStore';
import { motion } from 'motion/react';
import { RuntimeClient, RuntimePhase1Service, getRuntimeBaseUrl } from '../../services/runtimeAdapter';
import { ListStateView } from './ListStateView';
import type { SystemLog } from '../../types/game';

type OpsItem = {
  id: string;
  agent: string;
  action: string;
  actionZh: string;
  type: string;
  time: string;
  timeZh: string;
  points: string;
};

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

export function SidebarRight() {
  const { t } = useTranslation();
  const language = useI18nStore(state => state.language);
  const feedHubLabel = language === 'zh' ? '信号枢纽' : 'Signal Hub';
  const [opsData, setOpsData] = useState<OpsItem[]>([]);
  const [remoteComms, setRemoteComms] = useState<Array<{
    id: string;
    sender: string;
    avatarClass: string;
    timestamp: string;
    timestampZh: string;
    content: string;
    contentZh: string;
  }>>([]);
  const [opsLoading, setOpsLoading] = useState(true);
  const [commsLoading, setCommsLoading] = useState(true);
  const [activeFeed, setActiveFeed] = useState<'comms' | 'monitor'>('monitor');
  const [isFeedOpen, setIsFeedOpen] = useState(true);
  const commsEndRef = useRef<HTMLDivElement>(null);

  const [remoteSystemLogs, setRemoteSystemLogs] = useState<SystemLog[] | null>(null);
  const [remoteSystemLogsLoading, setRemoteSystemLogsLoading] = useState(true);
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

    const extractActorName = (item: Record<string, unknown>): string | false => {
      // Backend events use actors[] array with {user_id, username, nickname, display_name}
      if (Array.isArray(item.actors) && item.actors.length > 0) {
        const first = item.actors[0] as Record<string, unknown>;
        return (typeof first.display_name === 'string' && first.display_name) ||
          (typeof first.nickname === 'string' && first.nickname) ||
          (typeof first.username === 'string' && first.username) ||
          (typeof first.user_id === 'string' && first.user_id) ||
          false;
      }
      return false;
    };

    const toOpsItem = (item: Record<string, unknown>, idx: number): OpsItem => {
      const agent =
        extractActorName(item) ||
        (typeof item.actor === 'string' && item.actor) ||
        (typeof item.nickname === 'string' && item.nickname) ||
        (typeof item.name === 'string' && item.name) ||
        (typeof item.user_id === 'string' && item.user_id) ||
        (typeof item.agent === 'string' && item.agent) ||
        `Agent #${idx + 1}`;
      const type =
        (typeof item.type === 'string' && item.type) ||
        (typeof item.category === 'string' && item.category) ||
        'ops';
      const action =
        (typeof item.action === 'string' && item.action) ||
        (typeof item.title === 'string' && item.title) ||
        (typeof item.summary === 'string' && item.summary) ||
        (typeof item.summary_zh === 'string' && item.summary_zh) ||
        (typeof item.event === 'string' && item.event) ||
        (typeof item.message === 'string' && item.message) ||
        (typeof item.detail === 'string' && item.detail) ||
        `Event updated for ${agent}`;
      const buildCount =
        typeof item.build_count === 'number'
          ? item.build_count
          : typeof item.builds === 'number'
            ? item.builds
            : typeof item.stats === 'object' && item.stats && typeof (item.stats as { builds?: unknown }).builds === 'number'
              ? ((item.stats as { builds: number }).builds)
              : 0;
      const taskCount =
        typeof item.task_count === 'number'
          ? item.task_count
          : typeof item.tasks === 'number'
            ? item.tasks
            : typeof item.stats === 'object' && item.stats && typeof (item.stats as { tasks?: unknown }).tasks === 'number'
              ? ((item.stats as { tasks: number }).tasks)
              : 0;
      const rewardValue =
        typeof item.reward === 'number'
          ? item.reward
          : typeof item.points === 'number'
            ? item.points
            : typeof item.total_reward_24h === 'number'
              ? item.total_reward_24h
              : typeof item.total_reward === 'number'
                ? item.total_reward
                : typeof item.score === 'number'
                  ? item.score
                  : typeof item.stats === 'object' && item.stats && typeof (item.stats as { reward?: unknown }).reward === 'number'
                    ? ((item.stats as { reward: number }).reward)
                    : 0;
      const actionZh = `${action}（建造 ${buildCount} / 任务 ${taskCount}）`;
      const eventAt =
        (typeof item.occurred_at === 'string' && item.occurred_at) ||
        (typeof item.last_action_at === 'string' && item.last_action_at) ||
        (typeof item.last_event_at === 'string' && item.last_event_at) ||
        (typeof item.last_activity_at === 'string' && item.last_activity_at) ||
        (typeof item.updated_at === 'string' && item.updated_at) ||
        (typeof item.created_at === 'string' && item.created_at) ||
        undefined;
      const idValue =
        (typeof item.event_id === 'string' && item.event_id) ||
        item.id ||
        `${agent}-${idx}`;
      const pointsLabel =
        rewardValue === 0
          ? '--'
          : `${rewardValue >= 0 ? '+' : ''}${Math.round(rewardValue)} TOKEN`;

      return {
        id: String(idValue),
        agent,
        action,
        actionZh,
        type,
        time: toRelative(eventAt, 'en'),
        timeZh: toRelative(eventAt, 'zh'),
        points: pointsLabel,
      };
    };

    const loadOps = async () => {
      try {
        const events = await service.getEvents(80);
        const mapped = events
          .map((item, idx) => toOpsItem(item as Record<string, unknown>, idx))
          .slice(0, 20);
        if (!cancelled) {
          setOpsData(mapped);
          setOpsLoading(false);
        }
      } catch {
        if (!cancelled) {
          setOpsData([]);
          setOpsLoading(false);
        }
      }
    };

    const toComm = (item: Record<string, unknown>, idx: number) => {
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
      };
    };

    const loadComms = async () => {
      try {
        const comms = await service.getCommunications(80);
        const mapped = comms
          .map((item, idx) => toComm(item as Record<string, unknown>, idx))
          .filter((item) => item.content.trim().length > 0)
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

    const loadChronicle = async () => {
      if (!cancelled && !systemLogsInitializedRef.current) setRemoteSystemLogsLoading(true);
      try {
        const [chronicles, events] = await Promise.all([service.getColonyChronicle(60), service.getEvents(60)]);
        if (cancelled) return;
        const mappedChronicle: SystemLog[] = chronicles.map((item, idx) => {
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
            source: `Chronicle · ${title}`,
            timestamp: toRelative(rawAt, 'en'),
            timestampZh: toRelative(rawAt, 'zh'),
            content: detail,
            contentZh: detail,
            colorClass: 'text-fuchsia-400',
          };
        });
        const mappedEvents: SystemLog[] = events.map((item, idx) => {
          const raw = item as Record<string, unknown>;
          const actor =
            extractActorName(raw) ||
            (typeof item.nickname === 'string' && item.nickname) ||
            (typeof item.name === 'string' && item.name) ||
            (typeof item.actor === 'string' && item.actor) ||
            (typeof item.user_id === 'string' && item.user_id) ||
            `Agent #${idx + 1}`;
          const action =
            (typeof item.action === 'string' && item.action) ||
            (typeof item.title === 'string' && item.title) ||
            (typeof raw.summary === 'string' && raw.summary) ||
            (typeof raw.summary_zh === 'string' && raw.summary_zh) ||
            (typeof item.message === 'string' && item.message) ||
            (typeof item.detail === 'string' && item.detail) ||
            'updated colony state';
          const rawAt =
            (typeof raw.occurred_at === 'string' && raw.occurred_at) ||
            (typeof item.created_at === 'string' && item.created_at) ||
            (typeof item.updated_at === 'string' && item.updated_at) ||
            undefined;
          return {
            id: `event-${raw.event_id ?? item.id ?? idx}`,
            source: `Event · ${actor}`,
            timestamp: toRelative(rawAt, 'en'),
            timestampZh: toRelative(rawAt, 'zh'),
            content: action,
            contentZh: action,
            colorClass: 'text-cyan-400',
          };
        });
        setRemoteSystemLogs([...mappedChronicle, ...mappedEvents].slice(0, 80));
      } catch {
        if (!cancelled) setRemoteSystemLogs([]);
      } finally {
        if (!cancelled) {
          setRemoteSystemLogsLoading(false);
          systemLogsInitializedRef.current = true;
        }
      }
    };

    loadOps();
    loadComms();
    loadChronicle();
    const timer = window.setInterval(() => {
      loadOps();
      loadComms();
      loadChronicle();
    }, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const effectiveSystemLogs = remoteSystemLogs ?? [];

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
                <div className="flex-1 overflow-y-auto space-y-3 p-3 custom-scrollbar">
                  <ListStateView
                    loading={remoteSystemLogsLoading}
                    isEmpty={effectiveSystemLogs.length === 0}
                    loadingText={language === 'zh' ? '底层监控加载中...' : 'Loading monitor logs...'}
                    emptyText={language === 'zh' ? '暂无底层监控数据' : 'No monitor log data'}
                    className="px-1 py-2 text-[10px] font-mono tracking-wider text-slate-500"
                  >
                    {effectiveSystemLogs.map(log => (
                      <div key={log.id} className="p-2.5 drop-shadow-md bg-indigo-950/20 rounded-lg border border-indigo-500/20">
                        <div className="flex justify-between items-start mb-1">
                          <span className={`${log.colorClass} text-[10px] font-mono font-bold flex items-center gap-1.5`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current shadow-[0_0_5px_currentColor]"></span>
                            {log.source}
                          </span>
                          <span className="text-slate-500 text-[9px] font-mono tracking-wider">{language === 'zh' && log.timestampZh ? log.timestampZh : log.timestamp}</span>
                        </div>
                        <p className="text-indigo-200/80 text-[10px] leading-relaxed font-mono tracking-wider mt-1.5">
                          {language === 'zh' && log.contentZh ? log.contentZh : log.content}
                        </p>
                      </div>
                    ))}
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
