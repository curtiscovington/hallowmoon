import { useGame } from '../state/GameContext';
import { GameView } from '../state/types';

type NavTarget = Extract<GameView, 'hero' | 'map' | 'training' | 'market'>;

type NavItem = {
  key: NavTarget;
  label: string;
  action: () => void;
};

export function StageNavigation() {
  const {
    state: { view, hero },
    viewHero,
    goToMap,
    startTraining,
    visitMarket
  } = useGame();

  if (!hero || view === 'battle') {
    return null;
  }

  const items: NavItem[] = [
    { key: 'map', label: 'Map', action: goToMap },
    { key: 'hero', label: 'Hero', action: viewHero },
    { key: 'training', label: 'Training', action: startTraining },
    { key: 'market', label: 'Market', action: visitMarket }
  ];

  const handleClick = (item: NavItem) => {
    if (view === item.key) {
      return;
    }
    item.action();
  };

  return (
    <nav className="stage-nav" aria-label="Game screens">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => handleClick(item)}
          className={`small-button stage-nav__button${
            view === item.key ? ' stage-nav__button--active' : ''
          }`}
          aria-current={view === item.key ? 'page' : undefined}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
