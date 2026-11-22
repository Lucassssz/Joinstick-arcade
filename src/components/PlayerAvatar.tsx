import { AVATAR_PRESETS, getAvatarPreset } from '../shared/party';
import { useLanguage } from '../lib/i18n';

interface PlayerAvatarProps {
  avatarId?: string | null;
  colorHex: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<PlayerAvatarProps['size']>, string> = {
  xs: 'w-5 h-5 text-[12px] rounded-md',
  sm: 'w-7 h-7 text-[15px] rounded-lg',
  md: 'w-9 h-9 text-[20px] rounded-xl',
  lg: 'w-11 h-11 text-[24px] rounded-xl',
};

/**
 * Renders a player's selected preset arcade avatar with their color accent ring.
 */
export function PlayerAvatar({
  avatarId,
  colorHex,
  size = 'sm',
  className = '',
}: PlayerAvatarProps) {
  const preset = getAvatarPreset(avatarId);
  return (
    <span
      title={preset.label}
      aria-hidden="true"
      className={`inline-flex items-center justify-center shrink-0 select-none leading-none border-2 shadow-xs ${SIZE_CLASSES[size]} ${className}`}
      style={{
        backgroundColor: preset.bgHex,
        borderColor: colorHex,
      }}
    >
      <span className="translate-y-[0.5px]">{preset.emoji}</span>
    </span>
  );
}

interface AvatarPickerGridProps {
  selectedAvatarId: string;
  accentHex?: string;
  compact?: boolean;
  onSelect: (avatarId: string) => void;
}

/**
 * Curated preset avatar picker (selection only — no drawing).
 */
export function AvatarPickerGrid({
  selectedAvatarId,
  accentHex = '#00C2FF',
  compact = false,
  onSelect,
}: AvatarPickerGridProps) {
  const { lang } = useLanguage();

  return (
    <div
      role="radiogroup"
      aria-label={lang === 'zh' ? '选择预设头像' : 'Choose preset avatar'}
      className={`grid ${compact ? 'grid-cols-8 gap-1.5' : 'grid-cols-4 sm:grid-cols-8 gap-2'}`}
    >
      {AVATAR_PRESETS.map((preset) => {
        const selected = preset.id === selectedAvatarId;
        const name = lang === 'zh' ? preset.labelZh : preset.label;
        return (
          <button
            key={preset.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={name}
            title={name}
            onClick={() => onSelect(preset.id)}
            className={`relative flex flex-col items-center justify-center rounded-xl border-2 transition-all cursor-pointer select-none ${
              compact ? 'h-10' : 'h-11 sm:h-12'
            } ${
              selected
                ? 'scale-105 shadow-md ring-2 ring-white/85 ring-offset-1 ring-offset-[#121419]'
                : 'border-[#2A303D] opacity-85 hover:opacity-100 hover:border-[#4B5563]'
            }`}
            style={{
              backgroundColor: preset.bgHex,
              borderColor: selected ? accentHex : undefined,
            }}
          >
            <span className={compact ? 'text-lg leading-none' : 'text-xl sm:text-2xl leading-none'}>
              {preset.emoji}
            </span>
          </button>
        );
      })}
    </div>
  );
}
