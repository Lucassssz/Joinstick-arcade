import { useState } from 'react';
import { Check, Copy, ExternalLink, Plus, Smartphone, X } from 'lucide-react';
import { getJoinUrl } from '../lib/ws';
import { useLanguage } from '../lib/i18n';
import { PhoneController } from './PhoneController';

interface TestControllerDrawerProps {
  roomCode: string;
  open: boolean;
  onClose: () => void;
}

export function TestControllerDrawer({ roomCode, open, onClose }: TestControllerDrawerProps) {
  const { lang, t } = useLanguage();
  const [showSecondPad, setShowSecondPad] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const joinUrl = getJoinUrl(roomCode, lang);

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
    <div className="fixed bottom-3 right-3 sm:bottom-4 sm:right-4 z-50 w-[min(calc(100vw-1.5rem),440px)] max-h-[82dvh] overflow-y-auto arcade-scrollbar rounded-2xl bg-[#1A1E26] border border-[#2A303D] shadow-2xl p-3.5 sm:p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-[#00C2FF]" />
          <h3 className="font-display font-bold text-sm text-white">
            {t('Test Controller Mode', '虚拟测试手柄')}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('Close test controller drawer', '关闭测试手柄')}
          className="w-8 h-8 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-[#9CA3AF] hover:text-white flex items-center justify-center cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-xs text-[#9CA3AF] leading-relaxed">
        {t(
          'Uses a live WebSocket connection identical to a physical phone. Drag the thumbstick or use ',
          '与真实手机完全一致的实时连接。拖动摇杆或使用 '
        )}
        <span className="text-white font-mono">WASD + {t('Space/Shift', '空格/Shift')}</span>
        {t(' for Pad 1.', ' 控制 1 号手柄。')}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setShowSecondPad((v) => !v)}
          className="px-3 py-1.5 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 text-[#FFB800]" />
          {showSecondPad
            ? t('Hide Pad 2', '隐藏 2 号手柄')
            : t('Add Pad 2 (Arrows)', '添加 2 号手柄 (方向键)')}
        </button>

        <button
          type="button"
          onClick={handleCopy}
          className="px-3 py-1.5 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-xs font-semibold text-[#D1D5DB] inline-flex items-center gap-1.5 cursor-pointer"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-[#10D98B]" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? t('Copied', '已复制') : t('Copy URL', '复制链接')}
        </button>

        <a
          href={joinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 rounded-lg bg-[#242A36] hover:bg-[#2E3646] text-xs font-semibold text-[#00C2FF] inline-flex items-center gap-1.5"
        >
          {t('New Tab', '新标签页')}
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
