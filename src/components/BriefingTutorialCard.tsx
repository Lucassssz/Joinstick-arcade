import { RuleAnimationCard } from './RuleAnimationCard';
import { GameId } from '../shared/types';

interface BriefingTutorialCardProps {
  gameId: GameId;
  gameName: string;
  accentHex: string;
  rules: string[];
}

export function BriefingTutorialCard({
  gameId,
  gameName,
  accentHex,
  rules,
}: BriefingTutorialCardProps) {
  return (
    <RuleAnimationCard
      gameId={gameId}
      gameName={gameName}
      accentHex={accentHex}
      rules={rules}
    />
  );
}
