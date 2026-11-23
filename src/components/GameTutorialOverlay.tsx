import { X, Play, Sparkles } from 'lucide-react';
import { useLanguage } from '../lib/i18n';
import { GameId } from '../shared/types';
import { RuleAnimationCard } from './RuleAnimationCard';

interface GameTutorialOverlayProps {
  gameId: GameId;
  gameName: string;
  accentHex: string;
  rules: string[];
  onClose: () => void;
  onPlayNow: () => void;
}

export function GameTutorialOverlay({
  gameId,
  gameName,
  accentHex,
  rules,
  onClose,
  onPlayNow,
}: GameTutorialOverlayProps) {
  const { lang, t } = useLanguage();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-overlay-title"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-[#0B0E14]/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-w-5xl w-full rounded-3xl bg-[#151B26] border-2 border-[#2A354A] shadow-2xl overflow-hidden my-auto"
      >
        {/* Header Bar */}
        <div className="relative flex items-center justify-between px-5 py-3.5 border-b border-[#20293B] bg-[#10141D]">
          <div className="flex items-center gap-3 min-w-0 pr-8">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg shrink-0"
              style={{
                backgroundColor: `${accentHex}20`,
                border: `1px solid ${accentHex}66`,
                color: accentHex,
              }}
            >
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#00C2FF]">
                {t('Watch & Play Guide', '边看边懂 · 玩法演示')}
              </div>
              <h2
                id="tutorial-overlay-title"
                className="font-display text-lg sm:text-xl font-extrabold text-white truncate"
              >
                {gameName}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t('Close', '关闭')}
            className="h-9 w-9 rounded-xl bg-[#1E2636] hover:bg-[#273145] text-[#9CA3AF] hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body with RuleAnimationCard */}
        <div className="p-4 sm:p-5">
          <RuleAnimationCard
            gameId={gameId}
            gameName={gameName}
            accentHex={accentHex}
            rules={rules}
          />
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 bg-[#10141D] border-t border-[#20293B] flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-5 rounded-xl bg-[#1E2636] hover:bg-[#273145] text-sm font-bold text-white cursor-pointer transition-colors"
          >
            {t('Close', '关闭')}
          </button>
          <button
            type="button"
            onClick={onPlayNow}
            className="tactile-btn h-10 px-6 rounded-xl bg-[#FF4D2E] hover:bg-[#FF6145] text-white font-display font-extrabold text-sm shadow-[0_3px_0_#B82E17] inline-flex items-center gap-2 cursor-pointer transition-transform active:translate-y-0.5"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{t("Got It! Let's Play", '明白了！开始游玩')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
