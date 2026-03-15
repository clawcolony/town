import React, { useEffect } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useGameStore } from '../../store/gameStore';
import { useI18nStore } from '../../store/i18nStore';
import { motion, AnimatePresence } from 'motion/react';
import { GameEvent } from '../../types/game';
import { RuntimeClient, RuntimePhase1Service, getRuntimeBaseUrl } from '../../services/runtimeAdapter';

const LIFE_SNAPSHOT_KEY = 'runtime.lifeState.snapshot.v1';

type LifeSnapshotRecord = Record<
  string,
  {
    state: string;
    reason: string;
  }
>;

function AlertItem({ event, language }: { event: GameEvent, language: string }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      useGameStore.getState().removeEvent(event.id);
    }, 5000);
    return () => clearTimeout(timer);
  }, [event.id]);

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="pointer-events-auto flex items-center gap-2 drop-shadow-md px-2 py-1"
    >
      <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
      <div className="flex items-center gap-2">
        <span className="text-red-400 text-[11px] font-mono tracking-wider uppercase font-bold">{event.type.toUpperCase()} ALERT</span>
        <span className="text-slate-200 text-[11px] font-mono tracking-wider uppercase">{language === 'zh' && event.messageZh ? event.messageZh : event.message}</span>
      </div>
    </motion.div>
  );
}

export function EventAlerts() {
  const events = useGameStore(state => state.events);
  const language = useI18nStore(state => state.language);

  useEffect(() => {
    let cancelled = false;
    const runtimeBaseUrl = getRuntimeBaseUrl();
    const service = new RuntimePhase1Service(new RuntimeClient({ baseUrl: runtimeBaseUrl }));

    const normalize = (value?: string) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

    const isExiled = (state: string, reason: string) => {
      const merged = `${state} ${reason}`.toLowerCase();
      return (
        merged.includes('exile') ||
        merged.includes('exiled') ||
        merged.includes('banish') ||
        merged.includes('banished') ||
        merged.includes('放逐')
      );
    };

    const readSnapshot = (): LifeSnapshotRecord => {
      try {
        const raw = window.localStorage.getItem(LIFE_SNAPSHOT_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== 'object') return {};
        return parsed as LifeSnapshotRecord;
      } catch {
        return {};
      }
    };

    const saveSnapshot = (snapshot: LifeSnapshotRecord) => {
      try {
        window.localStorage.setItem(LIFE_SNAPSHOT_KEY, JSON.stringify(snapshot));
      } catch {
        // ignore localStorage errors
      }
    };

    const checkLifeState = async () => {
      try {
        const states = await service.getWorldLifeState(100);
        if (cancelled) return;

        const previous = readSnapshot();
        const next: LifeSnapshotRecord = {};
        const hasPrevious = Object.keys(previous).length > 0;

        states.forEach((item) => {
          const userId = typeof item.user_id === 'string' ? item.user_id : '';
          if (!userId) return;
          const state = normalize(item.state);
          const reason = normalize(item.reason);
          next[userId] = { state, reason };

          if (!hasPrevious) return;
          const prev = previous[userId];
          const prevDead = prev?.state === 'dead';
          const nowDead = state === 'dead';
          const prevExiled = prev ? isExiled(prev.state, prev.reason) : false;
          const nowExiled = isExiled(state, reason);

          if (!prevDead && nowDead) {
            useGameStore.getState().addEvent({
              type: 'death',
              message: `${userId} has died`,
              messageZh: `${userId} 已死亡`,
            });
            return;
          }

          if (!prevExiled && nowExiled) {
            useGameStore.getState().addEvent({
              type: 'exile',
              message: `Execution: ${userId} has been permanently exiled!`,
              messageZh: `判决执行：${userId} 已被永久放逐！`,
            });
          }
        });

        saveSnapshot(next);
      } catch {
        // ignore endpoint errors and keep existing alerts
      }
    };

    checkLifeState();
    const timer = window.setInterval(checkLifeState, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (events.length === 0) return null;

  return (
    <motion.div 
      drag 
      dragMomentum={false}
      onContextMenu={(e) => {
        e.preventDefault();
        useGameStore.getState().setShowEventAlerts(false);
      }}
      className="absolute bottom-6 left-6 w-max max-w-2xl flex flex-col gap-2 justify-end z-40 pointer-events-auto"
    >
      <AnimatePresence>
        {events.map(event => (
          <AlertItem key={event.id} event={event} language={language} />
        ))}
      </AnimatePresence>
    </motion.div>
  );
}