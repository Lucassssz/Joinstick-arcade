import { useEffect, useState } from 'react';
import { GameId } from './shared/types';
import { LandingView } from './components/LandingView';
import { HostMonitor } from './components/HostMonitor';
import { PhoneController } from './components/PhoneController';

type AppMode = 'landing' | 'host' | 'controller';

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

  if (mode === 'host') {
    return <HostMonitor initialGameId={preferredGameId} onExit={navigateHome} />;
  }

  if (mode === 'controller') {
    return (
      <PhoneController
        initialRoomCode={initialRoomCode}
        onExit={navigateHome}
      />
    );
  }

  return (
    <LandingView
      onHostRoom={handleHostRoom}
      onJoinController={handleJoinController}
    />
  );
}
