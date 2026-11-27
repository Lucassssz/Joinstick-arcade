import { useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { GameId } from './shared/types';
import { LandingView } from './components/LandingView';
import { HostMonitor } from './components/HostMonitor';
import { PhoneController } from './components/PhoneController';
import { TutorialView } from './components/TutorialView';
import { RuleChatbotFloatingButton } from './components/RuleChatbotDrawer';
import { LanguageProvider } from './lib/i18n';
import { arcadeAudio } from './lib/audio';

type AppMode = 'landing' | 'host' | 'controller' | 'pocket' | 'tutorial';

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
  if (modeParam === 'pocket') {
    return { mode: 'pocket', roomCode: '' };
  }
  if (modeParam === 'host') {
    return { mode: 'host', roomCode: '' };
  }
  if (modeParam === 'tutorial') {
    return { mode: 'tutorial', roomCode: '' };
  }
  return { mode: 'landing', roomCode: '' };
}

export default function App() {
  const initial = readInitialRoute();
  const [mode, setMode] = useState<AppMode>(initial.mode);
  const [preferredGameId, setPreferredGameId] = useState<GameId>('bumper-brawl');
  const [initialRoomCode, setInitialRoomCode] = useState<string>(initial.roomCode);
  const [guideBotOpen, setGuideBotOpen] = useState(false);
  const [guideBotGameId, setGuideBotGameId] = useState<GameId | null>(null);

  const openGuideBot = (gameId?: GameId) => {
    setGuideBotGameId(gameId ?? null);
    setGuideBotOpen(true);
  };

  useEffect(() => {
    const onPopState = () => {
      const next = readInitialRoute();
      setMode(next.mode);
      setInitialRoomCode(next.roomCode);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const exitBrowserFullscreen = () => {
    if (typeof document === 'undefined') return;
    try {
      const orientation = screen.orientation as ScreenOrientation & { unlock?: () => void };
      orientation?.unlock?.();
    } catch {
      // Ignore orientation unlock errors
    }
    try {
      const doc = document as Document & {
        webkitFullscreenElement?: Element;
        webkitExitFullscreen?: () => Promise<void> | void;
        msExitFullscreen?: () => Promise<void> | void;
      };
      if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
        document.exitFullscreen().catch(() => {});
      } else if (doc.webkitFullscreenElement && typeof doc.webkitExitFullscreen === 'function') {
        doc.webkitExitFullscreen();
      } else if (typeof doc.msExitFullscreen === 'function') {
        doc.msExitFullscreen();
      }
    } catch {
      // Ignore exitFullscreen errors
    }
  };

  useEffect(() => {
    if (mode === 'landing' || mode === 'tutorial') {
      exitBrowserFullscreen();
    }
  }, [mode]);

  const navigateHome = () => {
    exitBrowserFullscreen();
    const url = new URL(window.location.href);
    url.search = '';
    window.history.replaceState({}, '', url.toString());
    setMode('landing');
    setInitialRoomCode('');
  };

  const forceBrowserFullscreen = () => {
    if (typeof document === 'undefined') return;
    try {
      const doc = document as Document & { webkitFullscreenElement?: Element };
      if (document.fullscreenElement || doc.webkitFullscreenElement) return;
      const el = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void> | void;
        msRequestFullscreen?: () => Promise<void> | void;
      };
      if (typeof el.requestFullscreen === 'function') {
        el.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions).catch(() => {});
      } else if (typeof el.webkitRequestFullscreen === 'function') {
        el.webkitRequestFullscreen();
      } else if (typeof el.msRequestFullscreen === 'function') {
        el.msRequestFullscreen();
      }
    } catch {
      // Ignore if blocked by browser policy
    }
  };

  const handleHostRoom = (gameId?: GameId) => {
    forceBrowserFullscreen();
    arcadeAudio.unlock();
    if (gameId) setPreferredGameId(gameId);
    const url = new URL(window.location.href);
    url.search = '?mode=host';
    window.history.pushState({}, '', url.toString());
    setMode('host');
  };

  const handleStartPocket = (gameId?: GameId) => {
    arcadeAudio.unlock();
    if (gameId) setPreferredGameId(gameId);
    const url = new URL(window.location.href);
    url.search = '?mode=pocket';
    window.history.pushState({}, '', url.toString());
    setMode('pocket');
  };

  const handleJoinController = (code?: string) => {
    const cleaned = (code || '').toUpperCase().slice(0, 4);
    setInitialRoomCode(cleaned);
    const url = new URL(window.location.href);
    url.search = cleaned ? `?mode=controller&room=${cleaned}` : '?mode=controller';
    window.history.pushState({}, '', url.toString());
    setMode('controller');
  };

  const handleOpenTutorial = () => {
    exitBrowserFullscreen();
    const url = new URL(window.location.href);
    url.search = '?mode=tutorial';
    window.history.pushState({}, '', url.toString());
    setMode('tutorial');
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
              ) : mode === 'pocket' ? (
                <PhoneController
                  initialMode="pocket"
                  preferredGameId={preferredGameId}
                  onExit={navigateHome}
                />
              ) : mode === 'controller' ? (
                <PhoneController
                  initialRoomCode={initialRoomCode}
                  onExit={navigateHome}
                />
              ) : mode === 'tutorial' ? (
                <TutorialView
                  onBack={navigateHome}
                  onHostRoom={handleHostRoom}
                  onStartPocket={handleStartPocket}
                  onJoinController={handleJoinController}
                  onOpenGuideBot={() => openGuideBot()}
                />
              ) : (
                <LandingView
                  onHostRoom={handleHostRoom}
                  onStartPocket={handleStartPocket}
                  onJoinController={handleJoinController}
                  onOpenTutorial={handleOpenTutorial}
                  onOpenGuideBot={openGuideBot}
                />
              )}
            </motion.div>
          </AnimatePresence>
          {(mode === 'landing' || mode === 'tutorial') && (
            <RuleChatbotFloatingButton
              activeGameId={guideBotGameId}
              isOpen={guideBotOpen}
              onOpen={() => openGuideBot()}
              onClose={() => {
                setGuideBotOpen(false);
                setGuideBotGameId(null);
              }}
            />
          )}
        </div>
      </MotionConfig>
    </LanguageProvider>
  );
}
