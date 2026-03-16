import React, { useEffect, useMemo, useState } from 'react';
import { Target, Zap, Flame } from 'lucide-react';
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
  const [activeForm, setActiveForm] = useState<'bounty' | 'energy' | null>(null);
  
  const [bountyForm, setBountyForm] = useState({ title: '', amount: '', code: '' });
  const [energyForm, setEnergyForm] = useState({ target: 'all', amount: '' });
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

  const handleBountySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (runtimeService && activeActor) {
        await runtimeService.postBounty({
          poster_user_id: activeActor,
          description: bountyForm.title,
          reward: Number(bountyForm.amount),
          criteria: bountyForm.code || undefined,
        });
        await refreshBounties();
      }

      useGameStore.getState().addEvent({
        type: 'bounty',
        message: `New bounty posted: ${bountyForm.title}`,
        messageZh: `发布了新悬赏: ${bountyForm.title}`
      });
      toast.success(language === 'zh' ? '悬赏发布成功' : 'Bounty posted');
      setActiveForm(null);
      setBountyForm({ title: '', amount: '', code: '' });
    } catch (err) {
      toast.error(language === 'zh' ? '悬赏发布失败' : 'Failed to post bounty');
    }
  };

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

  const handleEnergySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Simulate RESTful API POST Request
      console.log('Sending POST /api/token/donate', energyForm);
      // const res = await fetch('/api/token/donate', { method: 'POST', body: JSON.stringify(energyForm) });
      
      useGameStore.getState().addEvent({
        type: 'system',
        message: `Injected ⚡${energyForm.amount} TOKEN to ${energyForm.target === 'all' ? 'Genesis Pool' : 'Selected Lobster'}`,
        messageZh: `向${energyForm.target === 'all' ? '全池 (Genesis Pool)' : '当前选中 Agent'}注入了 ⚡${energyForm.amount} TOKEN`
      });
      setActiveForm(null);
      setEnergyForm({ target: 'all', amount: '' });
    } catch (err) {
      console.error(err);
    }
  };

  const handleHibernate = async () => {
    try {
      // Simulate RESTful API POST Request
      console.log('Sending POST /api/life/hibernate');
      // const res = await fetch('/api/life/hibernate', { method: 'POST' });
      useGameStore.getState().addEvent({
        type: 'system',
        message: '🚨 Emergency Hibernate triggered by Observer!',
        messageZh: '🚨 观察者触发了紧急休眠！'
      });
    } catch (err) {
      console.error(err);
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
            <Target className="w-4 h-4" /> {t('floatingConsole.postBountyTitle')}
          </h3>
          <form onSubmit={handleBountySubmit} className="space-y-3">
            <div>
              <label className="text-[10px] text-slate-400 tracking-wider uppercase block mb-1">{t('floatingConsole.taskDesc')}</label>
              <input 
                type="text" 
                required
                value={bountyForm.title}
                onChange={e => setBountyForm({...bountyForm, title: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-[10px] tracking-wider text-white outline-none focus:border-amber-500/50" 
                placeholder={t('floatingConsole.taskDescPlaceholder')} 
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 tracking-wider uppercase block mb-1">{t('floatingConsole.bountyAmount')}</label>
              <input 
                type="number" 
                required
                value={bountyForm.amount}
                onChange={e => setBountyForm({...bountyForm, amount: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-[10px] tracking-wider text-white outline-none focus:border-amber-500/50" 
                placeholder="0" 
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 tracking-wider uppercase block mb-1">{t('floatingConsole.verifyCode')}</label>
              <textarea 
                rows={2}
                value={bountyForm.code}
                onChange={e => setBountyForm({...bountyForm, code: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-[10px] font-mono tracking-wider text-indigo-300 outline-none focus:border-amber-500/50 resize-none custom-scrollbar" 
                placeholder="assert test() == True" 
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setActiveForm(null)} className="flex-1 py-1.5 rounded hud-chip text-[10px] tracking-wider uppercase text-slate-200 transition-colors">{t('floatingConsole.cancel')}</button>
              <button type="submit" className="flex-1 py-1.5 rounded hud-chip chip-amber text-amber-200 border border-amber-500/60 text-[10px] tracking-wider uppercase font-bold transition-colors">{t('floatingConsole.post')}</button>
            </div>
          </form>
          {runtimeBounties && runtimeBounties.length > 0 && (
            <div className="mt-4 pt-3 border-t border-white/10">
              <div className="text-[10px] text-amber-300 font-bold tracking-wider mb-2 uppercase">
                {language === 'zh' ? '悬赏列表（Runtime）' : 'Runtime Bounties'}
              </div>
              <div className="max-h-40 overflow-y-auto space-y-2 custom-scrollbar">
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
            </div>
          )}
        </div>
      )}

      {activeForm === 'energy' && (
        <div className="w-80 glass-panel chip-cyan p-4 animate-in fade-in slide-in-from-bottom-4">
          <h3 className="text-cyan-400 font-bold mb-3 flex items-center gap-2 text-sm">
            <Zap className="w-4 h-4" /> {t('floatingConsole.injectEnergyTitle')}
          </h3>
          <form onSubmit={handleEnergySubmit} className="space-y-3">
            <div>
              <label className="text-[10px] text-slate-400 tracking-wider uppercase block mb-1">{t('floatingConsole.target')}</label>
              <select 
                value={energyForm.target}
                onChange={e => setEnergyForm({...energyForm, target: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-[10px] tracking-wider uppercase text-white outline-none focus:border-cyan-500/50"
              >
                <option value="all">{t('floatingConsole.targetAll')}</option>
                <option value="selected">{t('floatingConsole.targetSelected')}</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-400 tracking-wider uppercase block mb-1">{t('floatingConsole.injectToken')}</label>
              <input 
                type="number" 
                required
                value={energyForm.amount}
                onChange={e => setEnergyForm({...energyForm, amount: e.target.value})}
                className="w-full bg-black/40 border border-white/10 rounded px-2 py-1.5 text-[10px] tracking-wider text-white outline-none focus:border-cyan-500/50" 
                placeholder="1000" 
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setActiveForm(null)} className="flex-1 py-1.5 rounded hud-chip text-[10px] tracking-wider uppercase text-slate-200 transition-colors">{t('floatingConsole.cancel')}</button>
              <button type="submit" className="flex-1 py-1.5 rounded hud-chip chip-cyan text-cyan-100 border border-cyan-500/60 text-[10px] tracking-wider uppercase font-bold transition-colors">{t('floatingConsole.injectBtn')}</button>
            </div>
          </form>
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

        <button 
          onClick={() => setActiveForm(activeForm === 'energy' ? null : 'energy')}
          className={`hud-chip flex items-center gap-2.5 px-3 h-10 border transition-colors ${activeForm === 'energy' ? 'chip-cyan text-cyan-200' : 'text-indigo-300 hover:text-indigo-200'}`}
        >
          <Zap className="w-4 h-4" />
          <span className="text-[10px] font-bold tracking-widest font-mono uppercase">{t('floatingConsole.btnInjectEnergy')}</span>
        </button>

        {/* <button 
          onClick={handleHibernate}
          className="flex items-center gap-2.5 px-3 h-10 rounded-xl shadow-[0_4px_15px_rgba(0,0,0,0.5)] backdrop-blur-xl border transition-colors group bg-[#0a0a14]/40 border-red-500/40 text-red-400 hover:bg-red-950/40 hover:border-red-500/60 hover:text-red-300"
          title={t('floatingConsole.forceHibernate')}
        >
          <Flame className="w-4 h-4 group-hover:scale-110 transition-transform" />
          <span className="text-[10px] font-bold tracking-widest font-mono uppercase">{t('floatingConsole.btnLifeDeath')}</span>
        </button> */}
      </div>
    </motion.div>
  );
}
