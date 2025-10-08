import { useGame } from '../state/GameContext';

export function BattleView() {
  const {
    state: { hero, battle },
    heroMoves,
    performHeroMove,
    retreat
  } = useGame();

  if (!hero || !battle) {
    return null;
  }

  const moves = heroMoves();
  const heroActing = battle.turn === 'hero';

  return (
    <section className="card">
      <h2 style={{ marginTop: 0 }}>Battle!</h2>
      <div
        style={{
          display: 'grid',
          gap: '1rem',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))'
        }}
      >
        <article className="card" style={{ background: 'rgba(30, 12, 55, 0.65)' }}>
          <h3 style={{ marginTop: 0 }}>You</h3>
          <p style={{ margin: 0 }}>HP {battle.heroHp}/{hero.maxHp}</p>
          <p style={{ margin: 0 }}>STR {hero.str}</p>
          <p style={{ margin: 0 }}>AGI {hero.agi}</p>
          <p style={{ margin: 0 }}>WIS {hero.wis}</p>
        </article>
        <article className="card" style={{ background: 'rgba(30, 12, 55, 0.65)' }}>
          <h3 style={{ marginTop: 0 }}>{battle.enemy.name}</h3>
          <p style={{ margin: 0 }}>HP {battle.enemyHp}/{battle.enemy.maxHp}</p>
          <p style={{ margin: 0 }}>Species {battle.enemy.species}</p>
          <p style={{ margin: 0 }}>STR {battle.enemy.str + battle.enemyStrMod}</p>
          <p style={{ margin: 0 }}>AGI {battle.enemy.agi + battle.enemyAgiMod}</p>
        </article>
      </div>
      <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {moves.map((move) => (
          <button
            key={move.key}
            type="button"
            onClick={() => performHeroMove(move.key)}
            disabled={!heroActing}
            title={move.description}
          >
            {move.name}
          </button>
        ))}
        <button
          type="button"
          className="small-button"
          onClick={retreat}
          style={{ background: 'linear-gradient(135deg, #8a365f, #4d1731)' }}
        >
          Retreat
        </button>
      </div>
      <div className="log" style={{ marginTop: '1.5rem' }}>
        <strong>Battle Log</strong>
        <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0' }}>
          {battle.log.map((entry, index) => (
            <li key={`${entry}-${index}`} style={{ marginBottom: '0.5rem' }}>
              {entry}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
