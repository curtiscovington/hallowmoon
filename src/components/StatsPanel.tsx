import { APP_VERSION } from '../version';
import { useGame } from '../state/GameContext';

export function StatsPanel() {
  const {
    state: { hero, view },
    goToMap,
    resetGame
  } = useGame();

  if (!hero) {
    return null;
  }

  const xpToNext = 60 + (hero.level - 1) * 25;

  const stats = [
    { label: 'Coins', value: hero.coins },
    { label: 'XP', value: `${hero.xp}/${xpToNext}` },
    { label: 'Strength', value: hero.str },
    { label: 'Agility', value: hero.agi },
    { label: 'Wisdom', value: hero.wis },
    { label: 'HP', value: `${hero.currentHp}/${hero.maxHp}` },
    { label: 'Energy', value: `${hero.energy}/${hero.maxEnergy}` }
  ];

  const showReturnToMap = view !== 'map';

  return (
    <section className="card hero-summary" aria-label="Hero overview">
      <header className="hero-summary__header">
        <div>
          <h2 className="hero-summary__name">{hero.name}</h2>
          <span className="hero-summary__species">{hero.species}</span>
        </div>
        <span className="hero-summary__level">Lv {hero.level}</span>
      </header>
      <div className="hero-summary__grid">
        {stats.map((stat) => (
          <div key={stat.label} className="hero-summary__stat">
            <span className="hero-summary__label">{stat.label}</span>
            <span className="hero-summary__value">{stat.value}</span>
          </div>
        ))}
      </div>
      <footer className="hero-summary__footer">
        <div className="hero-summary__meta">Version {APP_VERSION}</div>
        <div className="hero-summary__actions">
          {showReturnToMap && (
            <button type="button" className="small-button" onClick={goToMap}>
              Back to Map
            </button>
          )}
          <button type="button" className="small-button hero-summary__reset" onClick={resetGame}>
            Reset Run
          </button>
        </div>
      </footer>
    </section>
  );
}
