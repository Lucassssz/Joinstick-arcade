import { useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { GameId } from './shared/types';
import { LandingView } from './components/LandingView';
import { HostMonitor } from './components/HostMonitor';
import { PhoneController } from './components/PhoneController';
import { LanguageProvider } from './lib/i18n';
import { arcadeAudio } from './lib/audio';

type AppMode = 'landing' | 'host' | 'controller';

const VIEW_TRANSITION_VARIANTS = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: {
      duration: 0.22,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.16,
      ease: [0.4, 0, 1, 1] as const,
    },
  },
};

function readInitialRoute(): { mode: AppMode; roomCode: string } {
  const params = new URLSearchParams(window.location.search);
  const modeParam = params.get('mode');
  const roomParam = (params.get('room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);

  if (modeParam === 'controller' || roomParam.length === 4) {
    return { mode: 'controller', roomCode: roomParam };
  }
  if (modeParam === 'host') {
    return { mode: 'host', roomCode: '' };
  }
  return { mode: 'landing', roomCode: '' };
}

export default function App() {
  const initial = readInitialRoute();
  const [mode, setMode] = useState<AppMode>(initial.mode);
  const [preferredGameId, setPreferredGameId] = useState<GameId>('bumper-brawl');
  const [initialRoomCode, setInitialRoomCode] = useState<string>(initial.roomCode);

  useEffect(() => {
    const onPopState = () => {
      const next = readInitialRoute();
      setMode(next.mode);
      setInitialRoomCode(next.roomCode);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigateHome = () => {
    const url = new URL(window.location.href);
    url.search = '';
    window.history.replaceState({}, '', url.toString());
    setMode('landing');
    setInitialRoomCode('');
  };

  const handleHostRoom = (gameId?: GameId) => {
    arcadeAudio.unlock();
    if (gameId) setPreferredGameId(gameId);
    const url = new URL(window.location.href);
    url.search = '?mode=host';
    window.history.pushState({}, '', url.toString());
    setMode('host');
  };

  const handleJoinController = (code?: string) => {
    const cleaned = (code || '').toUpperCase().slice(0, 4);
    setInitialRoomCode(cleaned);
    const url = new URL(window.location.href);
    url.search = cleaned ? `?mode=controller&room=${cleaned}` : '?mode=controller';
    window.history.pushState({}, '', url.toString());
    setMode('controller');
  };

  return (
    <LanguageProvider>
      <MotionConfig reducedMotion="user">
        <div className="min-h-dvh bg-[#121419]">
          <AnimatePresence
            mode="wait"
            initial={false}
            onExitComplete={() => {
              window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
            }}
          >
            <motion.div
              key={mode}
              variants={VIEW_TRANSITION_VARIANTS}
              initial="initial"
              animate="animate"
              exit="exit"
              className="min-h-dvh w-full will-change-[opacity]"
            >
              {mode === 'host' ? (
                <HostMonitor initialGameId={preferredGameId} onExit={navigateHome} />
              ) : mode === 'controller' ? (
                <PhoneController
                  initialRoomCode={initialRoomCode}
                  onExit={navigateHome}
                />
              ) : (
                <LandingView
                  onHostRoom={handleHostRoom}
                  onJoinController={handleJoinController}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </MotionConfig>
    </LanguageProvider>
  );
}
