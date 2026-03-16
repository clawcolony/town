import React, { useEffect, useMemo, useState } from 'react';
import { Target } from 'lucide-react';
import { useGameStore } from '../../store/gameStore';
import { useTranslation, useI18nStore } from '../../store/i18nStore';
import { motion } from 'motion/react';
import { RuntimeClient, RuntimePhase1Service, getRuntimeBaseUrl } from '../../services/runtimeAdapter';
import { toast } from 'sonner';

export function FloatingConsole() {
  const { t } = useTranslation();
  const language = useI18nStore(state => state.language);
  const lobsters = useGameStore(state => state.lobsters);
  const selectedLobsterId = useGameStore(state => state.selectedLobsterId);
  const [activeForm, setActiveForm] = useState<'bounty' | null>(null);
  const [runtimeBounties, setRuntimeBounties] = useState<Array<{
    bounty_id: number;
    description: string;
    reward: number;
    status: string;
    poster_user_id: string;
    claimed_by?: string;
  }> | null>(null);

  const runtimeService = useMemo(() => {
    const runtimeBaseUrl = getRuntimeBaseUrl();
    return new RuntimePhase1Service(new RuntimeClient({ baseUrl: runtimeBaseUrl }));
  }, []);

  const activeActor = useMemo(() => {
    const selected = lobsters.find(l => l.id === selectedLobsterId);
    return selected?.name || lobsters[0]?.name || null;
  }, [lobsters, selectedLobsterId]);

  const refreshBounties = async () => {
    if (!runtimeService) {
      setRuntimeBounties(null);
      return;
    }
    try {
      const list = await runtimeService.getBountyList();
      setRuntimeBounties(
        list.slice(0, 8).map(item => ({
          bounty_id: item.bounty_id,
          description: item.description,
          reward: item.reward,
          status: item.status,
          poster_user_id: item.poster_user_id,
          claimed_by: item.claimed_by,
        })),
      );
    } catch {
      setRuntimeBounties(null);
    }
  };

  useEffect(() => {
    if (activeForm === 'bounty') {
      refreshBounties();
    }
  }, [activeForm]);

  const handleClaim = async (bountyId: number) => {
    if (!runtimeService || !activeActor) return;
    try {
      await runtimeService.claimBounty({
        bounty_id: bountyId,
        user_id: activeActor,
      });
      await refreshBounties();
      toast.success(language === 'zh' ? '已认领悬赏' : 'Bounty claimed');
    } catch {
      toast.error(language === 'zh' ? '认领失败' : 'Claim failed');
    }
  };

  const handleVerify = async (bountyId: number, approved: boolean) => {
    if (!runtimeService || !activeActor) return;
    try {
      await runtimeService.verifyBounty({
        bounty_id: bountyId,
        approver_user_id: activeActor,
        approved,
      });
      await refreshBounties();
      toast.success(
        approved
          ? language === 'zh'
            ? '验收通过并已结算'
            : 'Approved and paid'
          : language === 'zh'
            ? '验收驳回，已退回开放'
            : 'Rejected and reopened',
      );
    } catch {
      toast.error(language === 'zh' ? '验收操作失败' : 'Verify failed');
    }
  };

  return (
    <motion.div 
      drag 
      dragMomentum={false}
      onContextMenu={(e) => {
        e.preventDefault();
        useGameStore.getState().setShowFloatingConsole(false);
      }}
      className="absolute bottom-6 right-6 z-40 flex flex-col items-end gap-4 pointer-events-auto"
    >
      
      {/* Forms Area */}
      {activeForm === 'bounty' && (
        <div className="w-80 glass-panel chip-amber p-4 animate-in fade-in slide-in-from-bottom-4">
          <h3 className="text-amber-400 font-bold mb-3 flex items-center gap-2 text-sm">
            <Target className="w-4 h-4" /> {language === 'zh' ? '悬赏列表（Runtime）' : 'Runtime Bounties'}
          </h3>
          <div className="flex justify-end pb-2">
            <button
              type="button"
              onClick={() => setActiveForm(null)}
              className="rounded hud-chip px-3 py-1.5 text-[10px] tracking-wider uppercase text-slate-200 transition-colors"
            >
              {t('floatingConsole.cancel')}
            </button>
          </div>
          {runtimeBounties && runtimeBounties.length > 0 ? (
            <div className="max-h-56 overflow-y-auto space-y-2 custom-scrollbar">
              {runtimeBounties.map(item => (
                <div key={item.bounty_id} className="p-2 rounded border border-white/10 bg-black/30">
                  <div className="text-[10px] text-white font-bold">{item.description}</div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    #{item.bounty_id} · {item.poster_user_id} · {item.reward} TOKEN · {item.status}
                  </div>
                  <div className="flex gap-1 mt-2">
                    {item.status === 'open' && (
                      <button
                        type="button"
                        onClick={() => handleClaim(item.bounty_id)}
                        className="px-2 py-1 text-[10px] rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40"
                      >
                        {language === 'zh' ? '认领' : 'Claim'}
                      </button>
                    )}
                    {item.status === 'claimed' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleVerify(item.bounty_id, true)}
                          className="px-2 py-1 text-[10px] rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        >
                          {language === 'zh' ? '通过' : 'Approve'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleVerify(item.bounty_id, false)}
                          className="px-2 py-1 text-[10px] rounded bg-red-500/20 text-red-300 border border-red-500/40"
                        >
                          {language === 'zh' ? '驳回' : 'Reject'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded border border-white/10 bg-black/30 px-3 py-4 text-[10px] text-slate-400">
              {language === 'zh' ? '当前没有可显示的 runtime 悬赏。' : 'No runtime bounties available right now.'}
            </div>
          )}
        </div>
      )}

      {/* Main Buttons */}
      <div className="flex items-center gap-3">
        <button 
          onClick={() => setActiveForm(activeForm === 'bounty' ? null : 'bounty')}
          className={`hud-chip flex items-center gap-2.5 px-3 h-10 border transition-colors ${activeForm === 'bounty' ? 'chip-amber text-amber-300' : 'text-indigo-300 hover:text-indigo-200'}`}
        >
          <Target className="w-4 h-4" />
          <span className="text-[10px] font-bold tracking-widest font-mono uppercase">{t('floatingConsole.btnPostBounty')}</span>
        </button>
      </div>
    </motion.div>
  );
}
