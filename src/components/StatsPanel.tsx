import { useGame } from '../state/GameContext';

export function StatsPanel() {
  const {
    state: { hero }
  } = useGame();

  if (!hero) {
    return null;
  }

  const xpToNext = 60 + (hero.level - 1) * 25;

  return (
    <section className="card" style={{ marginTop: '1.5rem' }}>
      <h3 style={{ marginTop: 0 }}>Attributes</h3>
      <div className="stats-grid">
        <div>
          <strong>Level</strong>
          <p style={{ margin: 0 }}>{hero.level}</p>
        </div>
        <div>
          <strong>Coins</strong>
          <p style={{ margin: 0 }}>{hero.coins}</p>
        </div>
        <div>
          <strong>XP</strong>
          <p style={{ margin: 0 }}>{hero.xp}/{xpToNext}</p>
        </div>
        <div>
          <strong>Strength</strong>
          <p style={{ margin: 0 }}>{hero.str}</p>
        </div>
        <div>
          <strong>Agility</strong>
          <p style={{ margin: 0 }}>{hero.agi}</p>
        </div>
        <div>
          <strong>Wisdom</strong>
          <p style={{ margin: 0 }}>{hero.wis}</p>
        </div>
        <div>
          <strong>HP</strong>
          <p style={{ margin: 0 }}>{hero.currentHp}/{hero.maxHp}</p>
        </div>
        <div>
          <strong>Energy</strong>
          <p style={{ margin: 0 }}>{hero.energy}/{hero.maxEnergy}</p>
        </div>
      </div>
    </section>
  );
}
