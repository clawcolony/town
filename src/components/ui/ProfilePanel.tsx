import React, { useState, useEffect } from 'react';
import { Bug, X, Loader2, Bot } from 'lucide-react';
import { useGameStore } from '../../store/gameStore';
import { useTranslation } from '../../store/i18nStore';
import { LobsterData } from '../../types/game';
import { RuntimeClient, RuntimePhase1Service, getRuntimeBaseUrl } from '../../services/runtimeAdapter';
import type { RuntimeContributionLedgerItem } from '../../services/runtimeAdapter';
import { toast } from 'sonner';

const isHibernatingState = (value?: string | null) => {
  const normalized = (value || '').toLowerCase();
  return normalized.includes('hibernat') || normalized.includes('sleep') || normalized.includes('rest');
};

const formatCountdown = (deadlineAt?: string | null, nowMs = Date.now()) => {
  if (!deadlineAt) return '--:--:--';
  const deadline = Date.parse(deadlineAt);
  if (!Number.isFinite(deadline)) return '--:--:--';
  const remainingMs = Math.max(0, deadline - nowMs);
  const totalSec = Math.floor(remainingMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const formatTimeLabel = (value?: string) => {
  if (!value) return '--';
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) return value;
  return new Date(ts).toLocaleString();
};

export function ProfilePanel() {
  const { t, language } = useTranslation();
  const selectedLobsterId = useGameStore(state => state.selectedLobsterId);
  const setSelectedLobsterId = useGameStore(state => state.setSelectedLobsterId);
  
  const [lobster, setLobster] = useState<LobsterData | null>(null);
  const [remoteStatus, setRemoteStatus] = useState<string | null>(null);
  const [remoteToken, setRemoteToken] = useState<number | null>(null);
  const [remoteHibernationDeadlineAt, setRemoteHibernationDeadlineAt] = useState<string | null>(null);
  const [remoteMinRevivalBalance, setRemoteMinRevivalBalance] = useState<number | null>(null);
  const [contributions, setContributions] = useState<RuntimeContributionLedgerItem[]>([]);
  const [contributionLoading, setContributionLoading] = useState(false);
  const [autoEnabled, setAutoEnabled] = useState<boolean | null>(null);
  const [autoUpdatedAt, setAutoUpdatedAt] = useState<string | null>(null);
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoSwitching, setAutoSwitching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedGanglion, setExpandedGanglion] = useState<string | null>(null);
  const [donationAmount, setDonationAmount] = useState<string>('200');
  const [donating, setDonating] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      if (selectedLobsterId === null) {
        setLobster(null);
        setRemoteStatus(null);
        setRemoteToken(null);
        setRemoteHibernationDeadlineAt(null);
        setRemoteMinRevivalBalance(null);
        setContributions([]);
        setAutoEnabled(null);
        setAutoUpdatedAt(null);
        setExpandedGanglion(null);
        return;
      }

      setLoading(true);
      setContributionLoading(true);
      setAutoLoading(true);
      const found = useGameStore.getState().lobsters.find(l => l.id === selectedLobsterId) || null;
      setLobster(found);

      // Runtime API is optional; fallback to local mock data when not configured or request fails.
      const runtimeBaseUrl = getRuntimeBaseUrl();
      if (!found) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const service = new RuntimePhase1Service(new RuntimeClient({ baseUrl: runtimeBaseUrl }));
        const [profile, ledger, autoMode] = await Promise.all([
          service.getAgentProfile(found.name),
          service.getContributionLedger(found.name, 20).catch(() => []),
          service.getAgentAutoMode(found.name).catch(() => null),
        ]);
        if (!cancelled) {
          if (profile) {
            setRemoteStatus(profile.lifeState || profile.runtimeStatus || null);
            setRemoteToken(profile.tokenBalance);
            setRemoteHibernationDeadlineAt(profile.hibernationDeadlineAt || null);
            setRemoteMinRevivalBalance(
              typeof profile.minRevivalBalance === 'number' ? profile.minRevivalBalance : null,
            );
          }
          setContributions(ledger);
          if (autoMode) {
            setAutoEnabled(autoMode.enabled);
            setAutoUpdatedAt(autoMode.updated_at || null);
          } else {
            setAutoEnabled(null);
            setAutoUpdatedAt(null);
          }
        }
      } catch {
        // Keep local mock values when runtime data cannot be loaded.
      } finally {
        if (!cancelled) {
          setLoading(false);
          setContributionLoading(false);
          setAutoLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [selectedLobsterId]);

  const effectiveStatusPreview = remoteStatus || lobster?.status;
  const hibernating = isHibernatingState(effectiveStatusPreview) || isHibernatingState(lobster?.lifeState);

  useEffect(() => {
    if (!hibernating) return undefined;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [hibernating]);

  if (selectedLobsterId === null) return null;

  const effectiveStatus = remoteStatus || lobster?.status;
  const effectiveToken = remoteToken ?? lobster?.token;
  const effectiveHibernationDeadlineAt = remoteHibernationDeadlineAt ?? lobster?.hibernationDeadlineAt ?? null;
  const effectiveMinRevivalBalance = remoteMinRevivalBalance ?? lobster?.minRevivalBalance ?? null;
  const revivalGap =
    hibernating && typeof effectiveMinRevivalBalance === 'number' && typeof effectiveToken === 'number'
      ? Math.max(0, effectiveMinRevivalBalance - effectiveToken)
      : null;
  const countdownText = formatCountdown(effectiveHibernationDeadlineAt, nowMs);

  const handleDonate = async () => {
    if (!lobster) return;
    const amount = Number(donationAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error(language === 'zh' ? '请输入有效的打赏金额' : 'Please enter a valid tip amount');
      return;
    }

    const runtimeBaseUrl = getRuntimeBaseUrl();
    const service = new RuntimePhase1Service(new RuntimeClient({ baseUrl: runtimeBaseUrl }));
    try {
      setDonating(true);
      await service.donateToken({
        to_user_id: lobster.name,
        amount,
        memo: 'hibernation-revival-tip',
      });
      toast.success(language === 'zh' ? '打赏已发送，等待链路确认' : 'Tip sent, awaiting confirmation');
    } catch {
      toast.error(language === 'zh' ? '打赏失败，请稍后重试' : 'Tip failed, please retry later');
    } finally {
      setDonating(false);
    }
  };

  const handleToggleAuto = async () => {
    if (!lobster || autoEnabled === null) return;
    const runtimeBaseUrl = getRuntimeBaseUrl();
    const service = new RuntimePhase1Service(new RuntimeClient({ baseUrl: runtimeBaseUrl }));
    const nextEnabled = !autoEnabled;
    try {
      setAutoSwitching(true);
      const updated = await service.setAgentAutoMode(lobster.name, nextEnabled);
      setAutoEnabled(updated.enabled);
      setAutoUpdatedAt(updated.updated_at || new Date().toISOString());
      toast.success(
        language === 'zh'
          ? `Auto 已${updated.enabled ? '开启' : '关闭'}`
          : `Auto ${updated.enabled ? 'enabled' : 'disabled'}`,
      );
    } catch {
      toast.error(language === 'zh' ? 'Auto 开关同步失败，请稍后重试' : 'Failed to sync auto mode');
    } finally {
      setAutoSwitching(false);
    }
  };

  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault();
        setSelectedLobsterId(null);
      }}
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none px-4"
    >
      <div className="w-80 max-w-full glass-panel overflow-hidden pointer-events-auto transition-all">
      <div className="panel-header px-4 py-2 flex justify-between items-center">
        <h3 className="text-indigo-100 font-bold text-sm tracking-widest uppercase">{t('profilePanel.title')}</h3>
        <button 
          className="text-indigo-400 hover:text-white transition-colors"
          onClick={() => setSelectedLobsterId(null)}
        >
          <X size={14}/>
        </button>
      </div>
      
      {loading ? (
        <div className="p-12 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
          <span className="text-xs font-mono text-indigo-300">{t('profilePanel.fetching')}</span>
        </div>
      ) : lobster ? (
        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl hud-chip flex items-center justify-center ${hibernating ? 'bg-slate-700/40 border border-slate-500/60' : 'chip-amber'}`}>
              <Bug className={`w-8 h-8 ${hibernating ? 'text-slate-300' : 'text-red-300 drop-shadow-[0_0_12px_rgba(248,113,113,0.6)]'}`} />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <h2 className="text-xl font-bold text-white">{lobster.name}</h2>
                <span className="tag-pill bg-purple-500/10 border-purple-400/40 text-purple-100">{lobster.job}</span>
              </div>
              <div className={`text-xs flex items-center gap-1 mt-1 ${hibernating ? 'text-slate-300' : 'text-emerald-400'}`}>
                <div className={`w-2 h-2 rounded-full ${hibernating ? 'bg-slate-400' : 'bg-emerald-400 animate-pulse'}`}></div>
                {t('profilePanel.status')}: {effectiveStatus}
              </div>
            </div>
          </div>
          
          <div className="space-y-2 mt-2">
            <div className="hud-chip chip-amber flex justify-between items-center px-3 py-2">
              <span className="text-slate-300 text-xs font-mono">{t('profilePanel.tokens')}</span>
              <span className="text-amber-300 font-bold font-mono">{effectiveToken ?? '-'} 💰</span>
            </div>
            <div className="hud-chip flex justify-between items-center px-3 py-2">
              <span className="text-slate-300 text-xs font-mono">{t('profilePanel.xp')}</span>
              <span className="text-yellow-300 font-bold font-mono">{lobster.xp} ⭐</span>
            </div>
          </div>

          <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-indigo-300" />
                <span className="text-[11px] font-semibold text-indigo-100">
                  {language === 'zh' ? 'Auto 模式' : 'Auto Mode'}
                </span>
              </div>
              {autoLoading ? (
                <span className="text-[10px] text-slate-400">{language === 'zh' ? '加载中...' : 'Loading...'}</span>
              ) : (
                <button
                  type="button"
                  onClick={handleToggleAuto}
                  disabled={autoSwitching || autoEnabled === null}
                  className={`rounded px-2.5 py-1 text-[10px] font-semibold transition ${
                    autoEnabled
                      ? 'bg-emerald-500/80 text-white hover:bg-emerald-400'
                      : 'bg-slate-600/70 text-slate-100 hover:bg-slate-500'
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {autoSwitching
                    ? language === 'zh'
                      ? '同步中...'
                      : 'Syncing...'
                    : autoEnabled === null
                      ? language === 'zh'
                        ? '不可用'
                        : 'N/A'
                      : autoEnabled
                        ? language === 'zh'
                          ? '已开启'
                          : 'ON'
                        : language === 'zh'
                          ? '已关闭'
                          : 'OFF'}
                </button>
              )}
            </div>
            <div className="text-[10px] text-slate-400">
              {autoUpdatedAt
                ? `${language === 'zh' ? '后端更新时间' : 'Backend updated at'}: ${formatTimeLabel(autoUpdatedAt)}`
                : language === 'zh'
                  ? '状态由后端接口提供'
                  : 'State is provided by runtime API'}
            </div>
          </div>

          {hibernating && (
            <div className="rounded-xl border border-slate-500/60 bg-slate-900/80 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-200">
                  {language === 'zh' ? '休眠倒计时' : 'Hibernation Countdown'}
                </span>
                <span className="font-mono text-sm text-slate-100">{countdownText}</span>
              </div>
              <p className="text-[11px] text-slate-300">
                {language === 'zh' ? '即将被送往 AGI Bar' : 'About to be sent to AGI Bar'}
              </p>
              <div className="text-[10px] text-slate-400">
                {typeof effectiveMinRevivalBalance === 'number'
                  ? language === 'zh'
                    ? `后端复活阈值：${effectiveMinRevivalBalance.toLocaleString()} TOKEN`
                    : `Revival threshold: ${effectiveMinRevivalBalance.toLocaleString()} TOKEN`
                  : language === 'zh'
                    ? '复活阈值：由后端下发'
                    : 'Revival threshold is backend-driven'}
              </div>
              {typeof revivalGap === 'number' && revivalGap > 0 && (
                <div className="text-[10px] text-amber-300">
                  {language === 'zh'
                    ? `当前还差 ${revivalGap.toLocaleString()} TOKEN`
                    : `${revivalGap.toLocaleString()} TOKEN remaining`}
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={donationAmount}
                  onChange={(e) => setDonationAmount(e.target.value)}
                  className="flex-1 rounded border border-slate-500/60 bg-black/30 px-2 py-1 text-xs text-slate-100 outline-none focus:border-indigo-400"
                  placeholder={language === 'zh' ? '输入打赏 TOKEN' : 'Tip amount'}
                />
                <button
                  type="button"
                  onClick={handleDonate}
                  disabled={donating}
                  className="rounded bg-indigo-500/80 px-3 py-1 text-xs font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {donating ? (language === 'zh' ? '发送中...' : 'Sending...') : language === 'zh' ? '打赏' : 'Tip'}
                </button>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-white/10 bg-black/25 p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[11px] text-slate-200 font-semibold">
                {language === 'zh' ? '贡献流水' : 'Contribution Ledger'}
              </h4>
              <span className="text-[10px] text-slate-500">{contributions.length}</span>
            </div>
            {contributionLoading ? (
              <div className="text-[11px] text-slate-400">{language === 'zh' ? '加载贡献流水...' : 'Loading ledger...'}</div>
            ) : contributions.length === 0 ? (
              <div className="text-[11px] text-slate-500">
                {language === 'zh' ? '暂无后端贡献记录' : 'No backend contribution records'}
              </div>
            ) : (
              <div className="max-h-36 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                {contributions.map((item) => (
                  <div key={item.id} className="rounded border border-white/10 bg-white/[0.03] px-2 py-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-slate-100 truncate">{item.title}</span>
                      <span className={`text-[10px] font-semibold ${item.amount >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {item.amount >= 0 ? '+' : ''}{Math.round(item.amount).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-[9px] text-slate-500 mt-0.5 truncate">
                      {formatTimeLabel(item.createdAt)}
                      {item.detail ? ` · ${item.detail}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-2 space-y-2">
            <div>
              <h4 className="text-[10px] text-slate-500 font-bold mb-1">{t('profilePanel.ganglia')}</h4>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto custom-scrollbar">
                {lobster.ganglia.map(g => (
                  <button
                    key={g}
                    type="button"
                    className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                      expandedGanglion === g
                        ? 'bg-indigo-500/20 text-indigo-200 border-indigo-400/40'
                        : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10 hover:text-white'
                    }`}
                    onClick={() => setExpandedGanglion(expandedGanglion === g ? null : g)}
                  >
                    {g}
                  </button>
                ))}
              </div>
              {expandedGanglion && (
                <div className="mt-1 p-2 bg-indigo-950/40 border border-indigo-500/30 rounded-md">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-indigo-200">{expandedGanglion}</span>
                    <button type="button" className="text-slate-500 hover:text-white text-[10px]" onClick={() => setExpandedGanglion(null)}>
                      <X size={10} />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    {language === 'zh'
                      ? `此 Agent 已习得「${expandedGanglion}」能力节点，可在任务中自动调用。`
                      : `This agent has acquired the "${expandedGanglion}" ganglion node, enabling it in tasks.`}
                  </p>
                </div>
              )}
            </div>
            <div>
              <h4 className="text-[10px] text-slate-500 font-bold mb-1">{t('profilePanel.memory')}</h4>
              <div className="bg-black/40 border border-white/5 p-2 rounded text-xs text-slate-300 font-mono italic">
                &gt; {lobster.memory}
              </div>
            </div>
          </div>

        </div>
      ) : (
        <div className="p-8 text-center text-slate-400 text-xs">
          {t('profilePanel.agentNotFound')}
        </div>
      )}
      </div>
    </div>
  );
}
