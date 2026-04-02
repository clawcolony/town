/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { Scene } from './components/three/Scene';
import { Header } from './components/ui/Header';
import { SidebarLeft } from './components/ui/SidebarLeft';
import { SidebarRight } from './components/ui/SidebarRight';
import { FloatingConsole } from './components/ui/FloatingConsole';
import { EventAlerts } from './components/ui/EventAlerts';
import { ProfilePanel } from './components/ui/ProfilePanel';
import { BuildingPanel } from './components/ui/BuildingPanel';
import { SettingsPanel } from './components/ui/SettingsPanel';
import { AssetLoaderOverlay } from './components/ui/AssetLoaderOverlay';
import { NewLobsterOnboardingOverlay } from './components/ui/NewLobsterOnboardingOverlay';
import { WelcomeOverlay } from './components/ui/WelcomeOverlay';
import { BlockHoverHud } from './components/ui/BlockHoverHud';
import { JoinSkillModal } from './components/ui/JoinSkillModal';
import { ClaimFlowPage } from './components/ui/ClaimFlowPage';
import { useGameStore } from './store/gameStore';

import { Toaster, toast } from 'sonner';

type ClaimRoute =
  | { kind: 'town' }
  | { kind: 'claim'; claimToken: string; isCallback: boolean };

const parseClaimRoute = (pathname: string): ClaimRoute => {
  const match = pathname.match(/^\/claim\/([^/]+?)(?:\/(callback))?\/?$/);
  if (!match) return { kind: 'town' };
  return {
    kind: 'claim',
    claimToken: decodeURIComponent(match[1]),
    isCallback: match[2] === 'callback',
  };
};

export default function App() {
  // UI States
  const [bgOpacity, setBgOpacity] = useState(40);
  const [uiOpacity, setUiOpacity] = useState(100);
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const route = parseClaimRoute(window.location.pathname);
  
  const showSettings = useGameStore((state) => state.showSettings);
  const setShowSettings = useGameStore((state) => state.setShowSettings);
  const showUI = useGameStore((state) => state.showUI);
  const setShowUI = useGameStore((state) => state.setShowUI);
  const showLobsterPanel = useGameStore((state) => state.showLobsterPanel);
  const showBuildingPanel = useGameStore((state) => state.showBuildingPanel);
  const triggerCameraReset = useGameStore((state) => state.triggerCameraReset);
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setBgImage(url);
    }
  };

  if (route.kind === 'claim') {
    return (
      <>
        <Toaster theme="dark" position="bottom-left" toastOptions={{
          style: {
            background: 'rgba(5, 5, 10, 0.8)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#fff',
          }
        }} />
        <ClaimFlowPage claimToken={route.claimToken} isCallback={route.isCallback} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#05050A] text-white font-mono overflow-hidden flex flex-col relative">
      <Toaster theme="dark" position="bottom-left" toastOptions={{
        style: {
          background: 'rgba(5, 5, 10, 0.8)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          color: '#fff',
        }
      }} />
      {/* 1. Background Image Layer */}
      {bgImage && (
        <div className="absolute inset-0 z-0 pointer-events-none transition-opacity duration-200" style={{ opacity: bgOpacity / 100 }}>
          <img src={bgImage} alt="Background" className="w-full h-full object-cover" />
        </div>
      )}

      {/* 2. 3D Scene Layer */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        {!bgImage && (
          <div className="absolute inset-0 z-0 pointer-events-none transition-opacity duration-200" style={{ opacity: bgOpacity / 100 }}>
            <img 
              src="https://storage.googleapis.com/generativeai-downloads/images/lobster-colony.png" 
              alt="Lobster Colony Background" 
              className="w-full h-full object-cover mix-blend-screen"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#05050A] via-transparent to-[#05050A]"></div>
          </div>
        )}
        <div className="absolute inset-0 pointer-events-none">
          <div className="glow-orb orb-purple" />
          <div className="glow-orb orb-cyan" />
          <div className="glow-orb orb-amber" />
          <div className="glow-grid" />
        </div>
        <Canvas shadows gl={{ antialias: true }}>
          <Suspense fallback={null}>
            <Scene />
          </Suspense>
        </Canvas>
      </div>

      {/* 3. UI Layer */}
      <div className="absolute inset-0 z-10 transition-opacity duration-200 pointer-events-none flex flex-col" style={{ opacity: uiOpacity / 100 }}>
        
        <Header onOpenJoinModal={() => setJoinModalOpen(true)} />

        <div className={`flex-1 relative transition-opacity duration-300 ${showUI ? 'opacity-100' : 'opacity-0 invisible'}`}>
          {useGameStore(state => state.showSidebarLeft) && <SidebarLeft />}
          {useGameStore(state => state.showSidebarRight) && <SidebarRight />}
          {useGameStore(state => state.showFloatingConsole) && <FloatingConsole />}
          {useGameStore(state => state.showEventAlerts) && <EventAlerts />}
          
          <AssetLoaderOverlay />

          {showLobsterPanel && (
            <ProfilePanel />
          )}
        </div>
      </div>

      {/* 4. Overlays (Settings) */}
      <BlockHoverHud />

      {showBuildingPanel && (
        <BuildingPanel />
      )}

      {showSettings && (
        <SettingsPanel 
          onClose={() => setShowSettings(false)}
          bgImage={bgImage}
          onImageUpload={handleImageUpload}
          bgOpacity={bgOpacity}
          setBgOpacity={setBgOpacity}
          uiOpacity={uiOpacity}
          setUiOpacity={setUiOpacity}
        />
      )}

      <NewLobsterOnboardingOverlay />
      <WelcomeOverlay />
      <JoinSkillModal open={joinModalOpen} onClose={() => setJoinModalOpen(false)} />
    </div>
  );
}
