import { useState } from 'react';
import { Check, Copy, ExternalLink, Plus, Smartphone, X } from 'lucide-react';
import { getJoinUrl } from '../lib/ws';
import { PhoneController } from './PhoneController';

interface TestControllerDrawerProps {
  roomCode: string;
  open: boolean;
  onClose: () => void;
}

export function TestControllerDrawer({ roomCode, open, onClose }: TestControllerDrawerProps) {
  const [showSecondPad, setShowSecondPad] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const joinUrl = getJoinUrl(roomCode);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked in some iframe contexts
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[min(95vw,440px)] max-h-[82vh] overflow-y-auto rounded-2xl bg-[#181C24] border border-[#313847] shadow-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-[#00C2FF]" />
          <h3 className="font-display font-bold text-sm text-white">
            Test Controller Mode
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close test controller drawer"
          className="w-8 h-8 rounded-lg bg-[#232936] hover:bg-[#2E3545] text-[#9CA3AF] hover:text-white flex items-center justify-center cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-xs text-[#9CA3AF] leading-relaxed">
        Uses a live WebSocket connection identical to a physical phone. Drag the thumbstick or use{' '}
        <span className="text-white font-mono">WASD + Space/Shift</span> for Pad 1.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setShowSecondPad((v) => !v)}
          className="px-3 py-1.5 rounded-lg bg-[#232936] hover:bg-[#2E3545] text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-[#FFB800]" />
          {showSecondPad ? 'Hide Pad 2' : 'Add Pad 2 (Arrows)'}
        </button>

        <button
          type="button"
          onClick={handleCopy}
          className="px-3 py-1.5 rounded-lg bg-[#232936] hover:bg-[#2E3545] text-xs font-semibold text-[#D1D5DB] inline-flex items-center gap-1.5 cursor-pointer"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-[#10D98B]" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Copied' : 'Copy URL'}
        </button>

        <a
          href={joinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 rounded-lg bg-[#232936] hover:bg-[#2E3545] text-xs font-semibold text-[#00C2FF] inline-flex items-center gap-1.5"
        >
          New Tab
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Embedded Virtual Phone Controller 1 (WASD + Mouse/Touch) */}
      <PhoneController
        key={`pad1-${roomCode}`}
        initialRoomCode={roomCode}
        defaultName="Test P1"
        autoJoin
        embedded
        keyboardProfile="wasd"
      />

      {/* Optional Virtual Phone Controller 2 (Arrow Keys + Mouse/Touch) */}
      {showSecondPad && (
        <PhoneController
          key={`pad2-${roomCode}`}
          initialRoomCode={roomCode}
          defaultName="Test P2"
          autoJoin
          embedded
          keyboardProfile="arrows"
        />
      )}
    </div>
  );
}
