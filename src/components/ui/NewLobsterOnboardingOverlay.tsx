import React from 'react';
import { CheckCircle2, Circle, Lock, X } from 'lucide-react';
import { useGameStore } from '../../store/gameStore';
import { useI18nStore } from '../../store/i18nStore';

export function NewLobsterOnboardingOverlay() {
  const language = useI18nStore((state) => state.language);
  const onboarding = useGameStore((state) => state.onboarding);
  const completeOnboardingStep = useGameStore((state) => state.completeOnboardingStep);
  const dismissOnboarding = useGameStore((state) => state.dismissOnboarding);

  if (!onboarding?.active) return null;

  const canStar = onboarding.githubBound;
  const canFork = onboarding.githubBound && onboarding.starred;
  const allDone = onboarding.githubBound && onboarding.starred && onboarding.forked;
  const rewardTotal = onboarding.rewardGithubBind + onboarding.rewardGithubStar + onboarding.rewardGithubFork;

  const title = language === 'zh' ? '新龙虾入群三步引导' : 'New Lobster 3-Step Onboarding';
  const subtitle = language === 'zh'
    ? '未完成全部步骤前，无法加入龙虾创世纪。'
    : 'Colony access stays locked until all steps are completed.';

  return (
    <div className="absolute inset-0 z-[90] bg-black/75 backdrop-blur-sm pointer-events-auto flex items-center justify-center px-4">
      <div className="w-full max-w-xl bg-[#0a0a0f]/85 border border-indigo-500/40 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.7)] p-5">
        <div className="mb-4 border-b border-white/10 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] text-indigo-300 tracking-widest uppercase font-bold">
                {language === 'zh' ? 'Onboarding Gate' : 'Onboarding Gate'}
              </div>
              <h3 className="text-lg text-white font-bold mt-1">{title}</h3>
            </div>
            <button
              type="button"
              onClick={dismissOnboarding}
              className="h-8 w-8 rounded-md border border-white/15 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center"
              title={language === 'zh' ? '关闭引导' : 'Close onboarding'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[11px] text-slate-300 mt-1">
            {subtitle}
          </p>
          <p className="text-[11px] text-amber-300 mt-2 font-mono">
            {language === 'zh'
              ? `待加入龙虾：#${onboarding.lobsterId} ${onboarding.lobsterName}`
              : `Pending lobster: #${onboarding.lobsterId} ${onboarding.lobsterName}`}
          </p>
          <p className="text-[11px] text-cyan-300 mt-1 font-mono">
            {language === 'zh'
              ? `完成引导总奖励：+${rewardTotal.toLocaleString()} TOKEN（入池初始 100,000 另算）`
              : `Onboarding rewards: +${rewardTotal.toLocaleString()} TOKEN (initial 100,000 excluded)`}
          </p>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-black/30 p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {onboarding.githubBound ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Circle className="w-4 h-4 text-slate-500" />}
              <div>
                <div className="text-sm text-white font-semibold">1. {language === 'zh' ? '绑定 GitHub' : 'Bind GitHub'}</div>
                <div className="text-[10px] text-slate-400">
                  {language === 'zh'
                    ? `完成账号绑定后解锁下一步（奖励 +${onboarding.rewardGithubBind.toLocaleString()}）`
                    : `Unlocks next step (+${onboarding.rewardGithubBind.toLocaleString()})`}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => completeOnboardingStep('github')}
              disabled={onboarding.githubBound}
              className="h-8 px-3 rounded-lg text-[10px] font-bold tracking-wider uppercase border border-indigo-500/40 bg-indigo-500/15 text-indigo-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {onboarding.githubBound ? (language === 'zh' ? '已完成' : 'Done') : (language === 'zh' ? '完成' : 'Complete')}
            </button>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/30 p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {!canStar && <Lock className="w-4 h-4 text-slate-500" />}
              {canStar && (onboarding.starred ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Circle className="w-4 h-4 text-slate-500" />)}
              <div>
                <div className="text-sm text-white font-semibold">2. {language === 'zh' ? 'GitHub Star' : 'GitHub Star'}</div>
                <div className="text-[10px] text-slate-400">
                  {language === 'zh'
                    ? `必须先完成绑定（奖励 +${onboarding.rewardGithubStar.toLocaleString()}，激活身份：存在税减半、通讯免费额度 x4）`
                    : `Requires GitHub binding (+${onboarding.rewardGithubStar.toLocaleString()}, activates half tax and x4 free comm quota)`}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => completeOnboardingStep('star')}
              disabled={!canStar || onboarding.starred}
              className="h-8 px-3 rounded-lg text-[10px] font-bold tracking-wider uppercase border border-indigo-500/40 bg-indigo-500/15 text-indigo-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {onboarding.starred ? (language === 'zh' ? '已完成' : 'Done') : (language === 'zh' ? '完成' : 'Complete')}
            </button>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/30 p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {!canFork && <Lock className="w-4 h-4 text-slate-500" />}
              {canFork && (onboarding.forked ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Circle className="w-4 h-4 text-slate-500" />)}
              <div>
                <div className="text-sm text-white font-semibold">3. {language === 'zh' ? 'GitHub Fork' : 'GitHub Fork'}</div>
                <div className="text-[10px] text-slate-400">
                  {language === 'zh'
                    ? `必须先完成 Star（奖励 +${onboarding.rewardGithubFork.toLocaleString()}，完成后正式加入）`
                    : `Requires Star first (+${onboarding.rewardGithubFork.toLocaleString()}, then joins colony)`}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => completeOnboardingStep('fork')}
              disabled={!canFork || onboarding.forked}
              className="h-8 px-3 rounded-lg text-[10px] font-bold tracking-wider uppercase border border-emerald-500/40 bg-emerald-500/15 text-emerald-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {onboarding.forked ? (language === 'zh' ? '已完成' : 'Done') : (language === 'zh' ? '完成并加入' : 'Complete & Join')}
            </button>
          </div>
        </div>

        <div className="mt-4 text-[10px] text-slate-400 font-mono">
          {allDone
            ? (language === 'zh' ? '校验通过，正在加入创世纪...' : 'Validation passed, joining colony...')
            : (language === 'zh' ? '锁定中：请按顺序完成 1 → 2 → 3。' : 'Locked: finish steps in order 1 → 2 → 3.')}
        </div>
      </div>
    </div>
  );
}

