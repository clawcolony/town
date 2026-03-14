import React, { useRef } from 'react';
import { Upload, X, RotateCw, Maximize2 } from 'lucide-react';
import { useGameStore } from '../../store/gameStore';
import { motion } from 'motion/react';

export function AssetLoaderOverlay() {
  const isBuildMode = useGameStore(state => state.isBuildMode);
  const pendingAsset = useGameStore(state => state.pendingAsset);
  const buildBrushWidth = useGameStore(state => state.buildBrushWidth);
  const buildBrushLength = useGameStore(state => state.buildBrushLength);
  const setPendingAsset = useGameStore(state => state.setPendingAsset);
  const updateBuildBrushSize = useGameStore(state => state.updateBuildBrushSize);
  const updatePendingAssetSize = useGameStore(state => state.updatePendingAssetSize);
  const updatePendingAssetRotation = useGameStore(state => state.updatePendingAssetRotation);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isBuildMode) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 检查扩展名
      if (file.name.endsWith('.glb') || file.name.endsWith('.gltf')) {
        const url = URL.createObjectURL(file);
        setPendingAsset({
          name: file.name,
          url,
          width: 1,
          length: 1,
          rotation: 0
        });
      } else {
        alert("Please upload a .glb or .gltf file");
      }
      
      // Reset input so the same file can be selected again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSizeChange = (type: 'width' | 'length', delta: number) => {
    if (!pendingAsset) return;
    
    let newWidth = pendingAsset.width;
    let newLength = pendingAsset.length;
    
    if (type === 'width') {
      newWidth = Math.max(1, Math.min(12, newWidth + delta));
    } else {
      newLength = Math.max(1, Math.min(12, newLength + delta));
    }
    
    updatePendingAssetSize(newWidth, newLength);
  };

  const handleBrushSizeChange = (type: 'width' | 'length', delta: number) => {
    const nextWidth = type === 'width' ? buildBrushWidth + delta : buildBrushWidth;
    const nextLength = type === 'length' ? buildBrushLength + delta : buildBrushLength;
    updateBuildBrushSize(nextWidth, nextLength);
  };

  const getCost = () => {
    if (!pendingAsset) return 0;
    // Base cost is 100 TOKEN multiplied by the area it occupies
    const area = (pendingAsset.width || 1) * (pendingAsset.length || 1);
    return area * 100;
  };

  return (
    <div className="absolute bottom-[100px] left-[180px] z-40 pointer-events-auto flex flex-col items-start gap-4">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="bg-[#0a0a0f]/40 backdrop-blur-xl border border-emerald-500/35 rounded-xl p-4 shadow-[0_4px_15px_rgba(0,0,0,0.5)] w-64"
      >
        <div className="flex items-center gap-2 mb-3">
          <Maximize2 className="w-4 h-4 text-emerald-300" />
          <div className="flex flex-col">
            <span className="text-emerald-300 text-xs font-bold font-mono uppercase tracking-wider">Block Brush</span>
            <span className="text-slate-400 text-[10px] font-mono">Build on unlocked dirt. Locked grass unlocks one tile per click.</span>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="flex-1 bg-black/40 border border-white/5 rounded p-2 flex flex-col items-center">
            <span className="text-[10px] text-slate-500 mb-1">WIDTH (X)</span>
            <div className="flex items-center gap-2">
              <button onClick={() => handleBrushSizeChange('width', -1)} className="w-5 h-5 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded text-white">-</button>
              <span className="font-mono font-bold text-emerald-300 w-6 text-center">{buildBrushWidth}</span>
              <button onClick={() => handleBrushSizeChange('width', 1)} className="w-5 h-5 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded text-white">+</button>
            </div>
          </div>
          <div className="flex-1 bg-black/40 border border-white/5 rounded p-2 flex flex-col items-center">
            <span className="text-[10px] text-slate-500 mb-1">LENGTH (Z)</span>
            <div className="flex items-center gap-2">
              <button onClick={() => handleBrushSizeChange('length', -1)} className="w-5 h-5 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded text-white">-</button>
              <span className="font-mono font-bold text-emerald-300 w-6 text-center">{buildBrushLength}</span>
              <button onClick={() => handleBrushSizeChange('length', 1)} className="w-5 h-5 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded text-white">+</button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Upload Button */}
      {!pendingAsset && (
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="h-10 backdrop-blur-md border border-indigo-500/40 rounded-xl px-3 flex items-center justify-between bg-[#0a0a14]/70 hover:bg-indigo-950/50 transition-colors cursor-pointer group shadow-[0_4px_15px_rgba(0,0,0,0.5)] shrink-0 w-64"
          onClick={() => fileInputRef.current?.click()}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept=".glb,.gltf" 
            className="hidden" 
          />
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded flex items-center justify-center opacity-80 group-hover:opacity-100 transition-opacity">
              <Upload className="w-4 h-4 text-indigo-400" />
            </div>
            <span className="text-indigo-400 text-[10px] font-bold tracking-widest font-mono group-hover:text-indigo-300 transition-colors uppercase">
              LOAD ASSET (.GLB)
            </span>
          </div>
        </motion.div>
      )}

      {/* Asset Configuration Panel */}
      {pendingAsset && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[#0a0a0f]/40 backdrop-blur-xl border border-amber-500/40 rounded-xl p-4 shadow-[0_4px_15px_rgba(0,0,0,0.5)] w-64"
        >
          <div className="flex justify-between items-start mb-4 border-b border-white/10 pb-2">
            <div className="flex flex-col">
              <span className="text-amber-400 text-xs font-bold font-mono uppercase tracking-wider">Deploying Asset</span>
              <span className="text-slate-400 text-[10px] font-mono truncate max-w-[150px]">{pendingAsset.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-[10px] bg-amber-500/10 border border-amber-500/30 text-amber-400 px-1.5 py-0.5 rounded font-mono">
                -{getCost()} TOKEN
              </div>
              <button 
                onClick={() => setPendingAsset(null)}
                className="text-slate-400 hover:text-red-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {/* Size config */}
            <div>
              <div className="flex items-center gap-2 mb-2 text-slate-300 text-[10px] font-mono uppercase tracking-wider">
                <Maximize2 className="w-3 h-3 text-indigo-400" />
                Asset Footprint
              </div>
              
              <div className="flex gap-4">
                <div className="flex-1 bg-black/40 border border-white/5 rounded p-2 flex flex-col items-center">
                  <span className="text-[10px] text-slate-500 mb-1">WIDTH (X)</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleSizeChange('width', -1)} className="w-5 h-5 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded text-white">-</button>
                    <span className="font-mono font-bold text-amber-300 w-4 text-center">{pendingAsset.width}</span>
                    <button onClick={() => handleSizeChange('width', 1)} className="w-5 h-5 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded text-white">+</button>
                  </div>
                </div>
                
                <div className="flex-1 bg-black/40 border border-white/5 rounded p-2 flex flex-col items-center">
                  <span className="text-[10px] text-slate-500 mb-1">LENGTH (Z)</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleSizeChange('length', -1)} className="w-5 h-5 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded text-white">-</button>
                    <span className="font-mono font-bold text-amber-300 w-4 text-center">{pendingAsset.length}</span>
                    <button onClick={() => handleSizeChange('length', 1)} className="w-5 h-5 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded text-white">+</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Rotation */}
            <div>
              <button 
                onClick={updatePendingAssetRotation}
                className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded text-indigo-300 text-[10px] font-mono uppercase tracking-wider transition-colors"
              >
                <RotateCw className="w-3 h-3" />
                Rotate 90° (Current: {pendingAsset.rotation}°)
              </button>
            </div>
            
            <div className="text-center text-[10px] text-amber-500/70 font-mono italic mt-2">
              Hover over unlocked dirt to preview. Click to deploy.
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
