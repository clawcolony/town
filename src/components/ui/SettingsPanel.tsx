import React from 'react';
import { Sliders, X, Image as ImageIcon, Camera } from 'lucide-react';
import { motion } from 'motion/react';
import { useTranslation, useI18nStore } from '../../store/i18nStore';
import { useGameStore } from '../../store/gameStore';

interface SettingsPanelProps {
  onClose: () => void;
  bgImage: string | null;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  bgOpacity: number;
  setBgOpacity: (val: number) => void;
  uiOpacity: number;
  setUiOpacity: (val: number) => void;
}

export function SettingsPanel({ 
  onClose, 
  bgImage, 
  onImageUpload, 
  bgOpacity, 
  setBgOpacity, 
  uiOpacity, 
  setUiOpacity 
}: SettingsPanelProps) {
  const { t } = useTranslation();
  const language = useI18nStore((state) => state.language);
  const triggerSaveInitialCamera = useGameStore((state) => state.triggerSaveInitialCamera);

  return (
    <motion.div 
      drag 
      dragMomentum={false}
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="absolute top-[59px] right-6 w-80 bg-[#0a0a0f]/40 border border-indigo-500/40 rounded-xl shadow-[0_4px_15px_rgba(0,0,0,0.5)] backdrop-blur-xl p-5 z-50 pointer-events-auto"
    >
      <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-3">
        <h3 className="text-white text-[10px] uppercase tracking-wider font-bold font-mono flex items-center gap-2"><Sliders size={14} className="text-indigo-400"/> {t('settingsPanel.displaySettings')}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={14}/></button>
      </div>
      
      <div className="space-y-6">
        <div>
          <label className="text-[10px] text-slate-400 mb-2 block uppercase tracking-wider font-bold font-mono">{t('settingsPanel.uploadBg')}</label>
          <label className="flex items-center justify-center w-full h-24 border border-dashed border-indigo-500/30 rounded-lg hover:bg-indigo-500/10 cursor-pointer transition-colors relative overflow-hidden">
            {bgImage ? (
              <>
                <img src={bgImage} alt="Preview" className="absolute inset-0 w-full h-full object-cover opacity-50" />
                <div className="relative z-10 flex flex-col items-center text-white drop-shadow-md">
                  <ImageIcon className="w-5 h-5 mb-1" />
                  <span className="text-[10px] font-mono tracking-wider">{t('settingsPanel.changeImage')}</span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center text-indigo-400">
                <ImageIcon className="w-5 h-5 mb-2" />
                <span className="text-[10px] font-mono tracking-wider">{t('settingsPanel.clickToUpload')}</span>
              </div>
            )}
            <input type="file" className="hidden" accept="image/*" onChange={onImageUpload} />
          </label>
        </div>

        <div>
          <div className="flex justify-between text-[10px] mb-2 font-mono">
            <span className="text-slate-400 uppercase tracking-wider font-bold">{t('settingsPanel.bgOpacity')}</span>
            <span className="text-indigo-400">{bgOpacity}%</span>
          </div>
          <input 
            type="range" min="0" max="100" value={bgOpacity} 
            onChange={(e) => setBgOpacity(Number(e.target.value))}
            className="w-full accent-indigo-500 h-1.5 bg-slate-800/50 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between text-[10px] mb-2 font-mono">
            <span className="text-slate-400 uppercase tracking-wider font-bold">{t('settingsPanel.uiOpacity')}</span>
            <span className="text-indigo-400">{uiOpacity}%</span>
          </div>
          <input 
            type="range" min="0" max="100" value={uiOpacity} 
            onChange={(e) => setUiOpacity(Number(e.target.value))}
            className="w-full accent-indigo-500 h-1.5 bg-slate-800/50 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
          <div className="mb-2 text-[10px] uppercase tracking-wider font-bold font-mono text-cyan-200">
            {language === 'zh' ? '镜头预设' : 'Camera Preset'}
          </div>
          <button
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-500/40 bg-[#0a0a14]/70 px-3 py-2 text-[10px] font-bold tracking-wider text-cyan-300 transition-colors hover:bg-cyan-950/30 hover:text-cyan-100"
            onClick={triggerSaveInitialCamera}
            title={language === 'zh' ? '保存当前镜头和双指位移为默认初始镜头' : 'Save current camera and pan target as default'}
          >
            <Camera className="h-4 w-4" />
            <span>{language === 'zh' ? '定初镜头' : 'Save Default Camera'}</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
