import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { useI18nStore } from '../../store/i18nStore';

export function BlockHoverHud() {
  const hoverBlockInfo = useGameStore((state) => state.hoverBlockInfo);
  const language = useI18nStore((state) => state.language);

  return (
    <div className="pointer-events-none fixed bottom-6 left-6 z-[8] bg-[#05070d]/80 px-4 py-3 font-mono text-[11px] text-slate-100">
      <div>
        {language === 'zh' ? '当前 Block' : 'Current Block'}:{' '}
        <span className="text-cyan-300">{hoverBlockInfo?.blockLabel ?? '--'}</span>
      </div>
      <div>
        {language === 'zh' ? '地块序号' : 'Tile No.'}:{' '}
        <span className="text-emerald-300">
          {hoverBlockInfo ? `${String(hoverBlockInfo.tileNo).padStart(2, '0')}/64` : '--/64'}
        </span>
      </div>
    </div>
  );
}
