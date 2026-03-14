import React, { useState, useEffect } from 'react';
import { X, Loader2, Users } from 'lucide-react';
import { useGameStore } from '../../store/gameStore';
import { useTranslation } from '../../store/i18nStore';
import { BUILDINGS } from '../../constants/gameData';
import { BuildingData, LobsterData } from '../../types/game';
import { RuntimeClient, RuntimePhase1Service, getRuntimeBaseUrl } from '../../services/runtimeAdapter';

export function BuildingPanel() {
  const { t, language } = useTranslation();
  const selectedBuildingId = useGameStore(state => state.selectedBuildingId);
  const setSelectedBuildingId = useGameStore(state => state.setSelectedBuildingId);
  const lobsters = useGameStore(state => state.lobsters);
  
  const [building, setBuilding] = useState<BuildingData | null>(null);
  const [workingLobsters, setWorkingLobsters] = useState<LobsterData[]>([]);
  const [loading, setLoading] = useState(false);
  const [constitution, setConstitution] = useState<{
    lawKey: string;
    version: number;
    sha?: string;
    entries: Array<{ id: number; title: string; updated_at?: string }>;
  } | null>(null);

  useEffect(() => {
    if (selectedBuildingId !== null) {
      setLoading(true);
      // Simulate fetch delay
      const timer = setTimeout(() => {
        const foundBuilding = BUILDINGS.find(b => b.id === selectedBuildingId);
        setBuilding(foundBuilding || null);
        
        if (foundBuilding) {
          const workers = lobsters.filter(
            l => Math.abs(l.x - foundBuilding.x) <= 1 && Math.abs(l.y - foundBuilding.y) <= 1
          );
          setWorkingLobsters(workers);
        } else {
          setWorkingLobsters([]);
        }
        
        setLoading(false);
      }, 400);

      return () => clearTimeout(timer);
    } else {
      setBuilding(null);
      setWorkingLobsters([]);
      setConstitution(null);
    }
  }, [selectedBuildingId, lobsters]);

  useEffect(() => {
    let cancelled = false;

    const loadConstitution = async () => {
      if (selectedBuildingId !== 'codex-tower') {
        setConstitution(null);
        return;
      }
      const runtimeBaseUrl = getRuntimeBaseUrl();
      try {
        const service = new RuntimePhase1Service(new RuntimeClient({ baseUrl: runtimeBaseUrl }));
        const [law, entries] = await Promise.all([
          service.getConstitutionLaw(),
          service.getKbEntries('governance', 5),
        ]);
        if (cancelled) return;
        setConstitution({
          lawKey: law.item.law_key,
          version: law.item.version,
          sha: law.item.manifest_sha256,
          entries: entries.map(entry => ({
            id: entry.id,
            title: entry.title,
            updated_at: entry.updated_at,
          })),
        });
      } catch {
        if (!cancelled) setConstitution(null);
      }
    };

    loadConstitution();
    return () => {
      cancelled = true;
    };
  }, [selectedBuildingId]);

  if (selectedBuildingId === null) return null;

  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault();
        setSelectedBuildingId(null);
      }}
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none px-4"
    >
      <div className="w-80 max-w-full bg-[#0a0a0f]/40 border border-cyan-500/40 rounded-xl shadow-[0_4px_15px_rgba(0,0,0,0.5)] backdrop-blur-xl overflow-hidden pointer-events-auto transition-all">
      <div className="bg-cyan-950/50 px-4 py-2 border-b border-cyan-500/30 flex justify-between items-center">
        <h3 className="text-cyan-200 font-bold text-sm">
          {language === 'zh' ? '建筑详情' : 'Building Details'}
        </h3>
        <button 
          className="text-cyan-400 hover:text-white transition-colors"
          onClick={() => setSelectedBuildingId(null)}
        >
          <X size={14}/>
        </button>
      </div>
      
      {loading ? (
        <div className="p-12 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          <span className="text-xs font-mono text-cyan-300">
            {language === 'zh' ? '获取数据中...' : 'Fetching data...'}
          </span>
        </div>
      ) : building ? (
        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 ${building.bgColor} border ${building.borderColor} rounded-lg flex items-center justify-center`}>
              <building.icon className={`w-7 h-7 ${building.textColor}`} />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <h2 className={`text-xl font-bold ${building.textColor}`}>{building.title}</h2>
              </div>
              <div className="text-xs text-slate-300 mt-1">
                {building.subtitle}
              </div>
            </div>
          </div>
          
          <div className="text-xs text-slate-400 italic">
            {building.label}
          </div>
          
          <div className="mt-2">
            <div className="flex items-center gap-2 mb-2 border-b border-white/10 pb-1">
              <Users size={14} className="text-cyan-400" />
              <h4 className="text-xs text-cyan-400 font-bold">
                {language === 'zh' ? '当前工作中的 Claw' : 'Claws working here'}
              </h4>
            </div>
            
            {workingLobsters.length > 0 ? (
              <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1 custom-scrollbar">
                {workingLobsters.map(lobster => (
                  <div key={lobster.id} className="bg-black/40 border border-white/5 rounded p-2 flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{lobster.name}</span>
                        <span className="text-[10px] text-indigo-300 bg-indigo-500/20 px-1.5 py-0.5 rounded border border-indigo-500/30">
                          {lobster.job}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                        <span className="text-[10px] text-emerald-400">{lobster.status}</span>
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono line-clamp-2" title={lobster.memory}>
                      &gt; {lobster.memory}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-4 bg-black/20 border border-white/5 rounded text-slate-500 text-xs italic">
                {language === 'zh' ? '当前没有 Claw 在此工作。' : 'No Claws currently working here.'}
              </div>
            )}
          </div>

          {building.id === 'codex-tower' && constitution && (
            <div className="mt-3 pt-3 border-t border-fuchsia-500/30">
              <div className="text-xs text-fuchsia-300 font-bold mb-2">
                {language === 'zh' ? '图书馆（宪法）' : 'Library (Constitution)'}
              </div>
              <div className="text-[10px] text-slate-300 bg-black/30 border border-white/10 rounded p-2 space-y-1">
                <div>LAW: {constitution.lawKey}</div>
                <div>VERSION: {constitution.version}</div>
                {constitution.sha && <div>SHA: {constitution.sha.slice(0, 12)}...</div>}
              </div>
              {constitution.entries.length > 0 && (
                <div className="mt-2 space-y-1">
                  {constitution.entries.map(item => (
                    <div key={item.id} className="text-[10px] text-slate-300 flex items-center justify-between bg-black/20 border border-white/5 rounded px-2 py-1">
                      <span className="line-clamp-1 pr-2">{item.title}</span>
                      <span className="text-slate-500">#{item.id}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      ) : (
        <div className="p-8 text-center text-slate-400 text-xs">
          {language === 'zh' ? '找不到建筑。' : 'Building not found.'}
        </div>
      )}
      </div>
    </div>
  );
}
