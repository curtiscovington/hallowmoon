import React from 'react';
import { useGame } from '../state/GameContext';

function formatModifier(label: string, value: number) {
  if (value === 0) {
    return null;
  }
  const sign = value > 0 ? '+' : '';
  return `${label} ${sign}${value}`;
}

function formatTurnCount(turns: number) {
  return `${turns} turn${turns === 1 ? '' : 's'}`;
}

export function BattleView() {
  const {
    state: { hero, battle },
    heroMoves,
    performHeroMove,
    retreat
  } = useGame();

  const logRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!battle?.log) {
      return;
    }
    if (logRef.current) {
      logRef.current.scrollTop = 0;
    }
  }, [battle?.log]);

  if (!hero || !battle) {
    return null;
  }

  const moves = heroMoves();
  const heroActing = battle.turn === 'hero';
  const heroHpPercent = Math.max(0, Math.round((battle.heroHp / hero.maxHp) * 100));
  const enemyHpPercent = Math.max(
    0,
    Math.round((battle.enemyHp / battle.enemy.maxHp) * 100)
  );
  const heroModifiers = [
    formatModifier('STR', battle.heroStrMod),
    formatModifier('AGI', battle.heroAgiMod),
    formatModifier('WIS', battle.heroWisMod)
  ].filter(Boolean) as string[];
  const enemyModifiers = [
    formatModifier('STR', battle.enemyStrMod),
    formatModifier('AGI', battle.enemyAgiMod)
  ].filter(Boolean) as string[];
  const heroStatuses = battle.heroStatuses;
  const enemyStatuses = battle.enemyStatuses;
  const heroPending = battle.pendingActions.filter((action) => action.owner === 'hero');
  const enemyPending = battle.pendingActions.filter((action) => action.owner === 'enemy');
  const turnMessage = heroActing
    ? 'Choose a move to press your advantage.'
    : `${battle.enemy.name} is preparing a response...`;

  return (
    <section className="card battle-card">
      <h2 style={{ marginTop: 0 }}>Battle!</h2>
      <div className="battle-turn">
        <span className="battle-turn__label" data-active={heroActing}>
          Your Turn
        </span>
        <span className="battle-turn__status">{turnMessage}</span>
        <span className="battle-turn__label" data-active={!heroActing}>
          Enemy Turn
        </span>
      </div>
      <div className="battle-entities">
        <article className="card battle-entity" data-active={heroActing}>
          <header className="battle-entity__header">
            <h3>You</h3>
            <span className="tag">Level {hero.level}</span>
          </header>
          <div className="battle-bar">
            <div className="battle-bar__labels">
              <span>HP</span>
              <span>
                {battle.heroHp}/{hero.maxHp}
              </span>
            </div>
            <div className="battle-bar__track">
              <div
                className="battle-bar__value"
                style={{ width: `${heroHpPercent}%` }}
              />
            </div>
          </div>
          <dl className="battle-entity__stats">
            <div>
              <dt>STR</dt>
              <dd>{hero.str}</dd>
            </div>
            <div>
              <dt>AGI</dt>
              <dd>{hero.agi}</dd>
            </div>
            <div>
              <dt>WIS</dt>
              <dd>{hero.wis}</dd>
            </div>
          </dl>
          {heroModifiers.length > 0 && (
            <div className="battle-modifiers">
              {heroModifiers.map((modifier) => (
                <span
                  key={modifier}
                  className={`tag ${modifier.includes('-') ? 'tag-negative' : 'tag-positive'}`}
                >
                  {modifier}
                </span>
              ))}
            </div>
          )}
          {heroStatuses.length > 0 && (
            <div className="battle-statuses">
              {heroStatuses.map((status) => (
                <span
                  key={status.key}
                  className={`tag battle-status battle-status--${status.type}`}
                  title={status.description}
                >
                  {status.label}
                  <span className="battle-status__timer">
                    {formatTurnCount(status.remainingTurns)}
                  </span>
                </span>
              ))}
            </div>
          )}
        </article>
        <article className="card battle-entity" data-active={!heroActing}>
          <header className="battle-entity__header">
            <h3>{battle.enemy.name}</h3>
            <span className="tag">{battle.enemy.species}</span>
          </header>
          <p className="battle-entity__description">{battle.enemy.description}</p>
          <div className="battle-bar">
            <div className="battle-bar__labels">
              <span>HP</span>
              <span>
                {battle.enemyHp}/{battle.enemy.maxHp}
              </span>
            </div>
            <div className="battle-bar__track">
              <div
                className="battle-bar__value battle-bar__value--enemy"
                style={{ width: `${enemyHpPercent}%` }}
              />
            </div>
          </div>
          <dl className="battle-entity__stats">
            <div>
              <dt>STR</dt>
              <dd>{battle.enemy.str + battle.enemyStrMod}</dd>
            </div>
            <div>
              <dt>AGI</dt>
              <dd>{battle.enemy.agi + battle.enemyAgiMod}</dd>
            </div>
            <div>
              <dt>WIS</dt>
              <dd>{battle.enemy.wis}</dd>
            </div>
          </dl>
          {enemyModifiers.length > 0 && (
            <div className="battle-modifiers">
              {enemyModifiers.map((modifier) => (
                <span
                  key={modifier}
                  className={`tag ${modifier.includes('-') ? 'tag-negative' : 'tag-positive'}`}
                >
                  {modifier}
                </span>
              ))}
            </div>
          )}
          {enemyStatuses.length > 0 && (
            <div className="battle-statuses">
              {enemyStatuses.map((status) => (
                <span
                  key={status.key}
                  className={`tag battle-status battle-status--${status.type}`}
                  title={status.description}
                >
                  {status.label}
                  <span className="battle-status__timer">
                    {formatTurnCount(status.remainingTurns)}
                  </span>
                </span>
              ))}
            </div>
          )}
        </article>
      </div>
      <div className="battle-timeline">
        <section className="battle-timeline__section" aria-label="Your preparations">
          <header>
            <h3>You</h3>
          </header>
          {heroPending.length > 0 ? (
            <ul className="pending-action-list">
              {heroPending.map((action) => {
                const progress = Math.max(
                  0,
                  Math.min(100, ((action.totalTurns - action.remainingTurns) / action.totalTurns) * 100)
                );
                return (
                  <li key={`hero-${action.key}`} className="pending-action">
                    <div className="pending-action__header">
                      <span>{action.name}</span>
                      <span>{formatTurnCount(action.remainingTurns)} left</span>
                    </div>
                    <div className="pending-action__progress" aria-hidden="true">
                      <div className="pending-action__progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                    <p>{action.description}</p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="pending-action__empty">No preparations underway.</p>
          )}
        </section>
        <section className="battle-timeline__section" aria-label={`${battle.enemy.name}'s preparations`}>
          <header>
            <h3>{battle.enemy.name}</h3>
          </header>
          {enemyPending.length > 0 ? (
            <ul className="pending-action-list">
              {enemyPending.map((action) => {
                const progress = Math.max(
                  0,
                  Math.min(100, ((action.totalTurns - action.remainingTurns) / action.totalTurns) * 100)
                );
                return (
                  <li key={`enemy-${action.key}`} className="pending-action">
                    <div className="pending-action__header">
                      <span>{action.name}</span>
                      <span>{formatTurnCount(action.remainingTurns)} left</span>
                    </div>
                    <div className="pending-action__progress" aria-hidden="true">
                      <div className="pending-action__progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                    <p>{action.description}</p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="pending-action__empty">No wind-ups detected.</p>
          )}
        </section>
      </div>
      <div className="battle-actions">
        {moves.map((move) => (
          <button
            key={move.key}
            type="button"
            className="battle-move"
            onClick={() => performHeroMove(move.key)}
            disabled={!heroActing}
            title={move.description}
          >
            <span className="battle-move__name">{move.name}</span>
            <span className="battle-move__type">
              {move.type}
              {typeof move.chargeTurns === 'number'
                ? ` • Charges ${formatTurnCount(move.chargeTurns)}`
                : ''}
            </span>
            <span className="battle-move__hint">{move.description}</span>
          </button>
        ))}
        <button
          type="button"
          className="small-button battle-retreat"
          onClick={retreat}
        >
          Retreat
        </button>
      </div>
      <div className="log battle-log" ref={logRef} aria-live="polite">
        <strong>Battle Log</strong>
        <ul>
          {battle.log.map((entry, index) => (
            <li
              key={`${entry}-${index}`}
              className={index === 0 ? 'battle-log__entry battle-log__entry--latest' : 'battle-log__entry'}
            >
              {entry}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
