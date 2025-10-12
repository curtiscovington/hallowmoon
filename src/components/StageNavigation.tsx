import { useGame } from '../state/GameContext';
import { GameView } from '../state/types';

type NavTarget = Extract<GameView, 'hero' | 'map' | 'training' | 'market'>;

type NavItem = {
  key: NavTarget;
  label: string;
  icon: string;
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

  if (!hero || view === 'battle' || view === 'run') {
    return null;
  }

  const items: NavItem[] = [
    { key: 'map', label: 'Map', icon: '🗺️', action: goToMap },
    { key: 'hero', label: 'Hero', icon: '⚔️', action: viewHero },
    { key: 'training', label: 'Training', icon: '🏋️', action: startTraining },
    { key: 'market', label: 'Market', icon: '🛒', action: visitMarket }
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
          <span aria-hidden="true" className="stage-nav__icon">
            {item.icon}
          </span>
          <span className="stage-nav__label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
