import { APP_VERSION } from '../version';
import { useGame } from '../state/GameContext';

export function Header() {
  const {
    state: { hero },
    resetGame,
    goToMap
  } = useGame();

  return (
    <header
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        marginBottom: '1.5rem'
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}
      >
        <div>
          <h1 style={{ margin: 0, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            HallowMoon
          </h1>
          <p style={{ margin: 0, opacity: 0.75 }}>Version {APP_VERSION}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {hero && (
            <button className="small-button" type="button" onClick={goToMap}>
              Return to Map
            </button>
          )}
          <button
            className="small-button"
            type="button"
            onClick={resetGame}
            style={{ background: 'linear-gradient(135deg, #8a365f, #4d1731)' }}
          >
            Reset Save
          </button>
        </div>
      </div>
      {hero && (
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div className="tag">{hero.name}</div>
          <div className="tag">{hero.species}</div>
          <div className="tag">Lv. {hero.level}</div>
          <div className="tag">XP: {hero.xp}</div>
          <div className="tag">Coins: {hero.coins}</div>
          <div className="tag">HP: {hero.currentHp}/{hero.maxHp}</div>
          <div className="tag">Energy: {hero.energy}/{hero.maxEnergy}</div>
        </div>
      )}
    </header>
  );
}
