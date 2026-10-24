// The tags under a block's name that say what it holds (moves, clips, a round
// timer), so a coach can tell the kinds of block apart before opening one.

import { Film, Timer } from 'lucide-react';
import { KIND_TRAITS, type BlockKind, type BlockTrait } from '../lib/plan.ts';
import { t } from '../lib/i18n.ts';

const ICONS: Partial<Record<BlockTrait, typeof Film>> = { clips: Film, timer: Timer, rounds: Timer };

export function BlockTraits({ kind }: { kind: BlockKind }) {
  return (
    <span className="traits" aria-label={`${t('traitsLabel')}: ${KIND_TRAITS[kind].map((k) => t(`trait.${k}`)).join(', ')}`}>
      {KIND_TRAITS[kind].map((k) => {
        const Icon = ICONS[k];
        return (
          <span className={`trait${Icon ? ' trait-strong' : ''}`} key={k} aria-hidden>
            {Icon && <Icon size={12} />}
            {t(`trait.${k}`)}
          </span>
        );
      })}
    </span>
  );
}
