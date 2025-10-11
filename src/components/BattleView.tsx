import React from 'react';
import { useGame } from '../state/GameContext';

type BattleSheet = 'timeline' | 'log' | null;

type BattleTabEntry = {
  owner: 'hero' | 'enemy';
  key: string;
  name: string;
  description: string;
  remainingTurns: number;
  totalTurns: number;
};

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

function clampPercent(value: number) {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function BattleView() {
  const {
    state: { hero, battle },
    heroMoves,
    performHeroMove,
    retreat
  } = useGame();

  const [activeSheet, setActiveSheet] = React.useState<BattleSheet>(null);
  const logRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!battle?.log) {
      return;
    }
    if (logRef.current) {
      logRef.current.scrollTop = 0;
    }
  }, [battle?.log]);

  React.useEffect(() => {
    setActiveSheet(null);
  }, [battle?.enemy.id]);

  if (!hero || !battle) {
    return null;
  }

  const moves = heroMoves();
  const heroActing = battle.turn === 'hero';
  const heroHpPercent = clampPercent((battle.heroHp / hero.maxHp) * 100);
  const enemyHpPercent = clampPercent((battle.enemyHp / battle.enemy.maxHp) * 100);
  const heroVigorPercent = clampPercent((hero.energy / hero.maxEnergy) * 100);
  const heroEssencePercent = clampPercent(
    ((hero.wis + battle.heroWisMod) / (hero.wis + 5)) * 100
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

  const timelineEntries: BattleTabEntry[] = [...heroPending, ...enemyPending]
    .map((action) => ({ ...action, owner: action.owner }))
    .sort((a, b) => a.remainingTurns - b.remainingTurns);

  const momentumSwing = clampPercent(
    50 + (heroHpPercent - enemyHpPercent) * 0.6 + (heroActing ? 12 : -12)
  );
  const momentumState =
    momentumSwing >= 66 ? 'Advantage' : momentumSwing <= 34 ? 'Peril' : 'Poise';
  const tempoState = heroActing ? 'Your initiative' : `${battle.enemy.name} pressing`;

  const statusStrip = [
    ...heroStatuses.map((status) => ({ ...status, owner: 'hero' as const })),
    ...enemyStatuses.map((status) => ({ ...status, owner: 'enemy' as const }))
  ];

  const timelinePeek = timelineEntries.slice(0, 2);
  const logPreview = battle.log.slice(0, 2);

  const heroNextAction = heroPending[0] ?? null;
  const enemyNextAction = enemyPending[0] ?? null;
  const reactionSlots = [heroPending[0] ?? null, heroPending[1] ?? null];
  const heroInitial = hero.name.slice(0, 1).toUpperCase() || '?';
  const enemyInitial = battle.enemy.name.slice(0, 1).toUpperCase() || '?';

  return (
    <section className="screen-shell battle-shell" aria-label="Battle interface">
      <header className="battle-top card battle-layout__top" aria-label="Combatants summary">
        <div className="battle-top__row">
          <article className="combatant-card combatant-card--hero" aria-label={`${hero.name} vitals`}>
            <header className="combatant-card__header">
              <span className="combatant-card__name">{hero.name}</span>
              <span className="combatant-card__tag">Lv {hero.level}</span>
            </header>
            <div className="combatant-card__gauges">
              <div
                className="combatant-card__gauge"
                role="meter"
                aria-label="Hero health"
                aria-valuenow={battle.heroHp}
                aria-valuemin={0}
                aria-valuemax={hero.maxHp}
              >
                <div className="combatant-card__gauge-header">
                  <span>HP</span>
                  <span>{battle.heroHp}/{hero.maxHp}</span>
                </div>
                <div className="gauge-track">
                  <div className="gauge-fill gauge-fill--hero" style={{ width: `${heroHpPercent}%` }} />
                </div>
              </div>
              <div
                className="combatant-card__gauge"
                role="meter"
                aria-label="Hero vigor"
                aria-valuenow={hero.energy}
                aria-valuemin={0}
                aria-valuemax={hero.maxEnergy}
              >
                <div className="combatant-card__gauge-header">
                  <span>Vigor</span>
                  <span>{hero.energy}/{hero.maxEnergy}</span>
                </div>
                <div className="gauge-track">
                  <div className="gauge-fill gauge-fill--vigor" style={{ width: `${heroVigorPercent}%` }} />
                </div>
              </div>
              <div
                className="combatant-card__gauge"
                role="meter"
                aria-label="Hero essence"
                aria-valuenow={heroEssencePercent}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="combatant-card__gauge-header">
                  <span>Essence</span>
                  <span>{heroEssencePercent}%</span>
                </div>
                <div className="gauge-track">
                  <div className="gauge-fill gauge-fill--essence" style={{ width: `${heroEssencePercent}%` }} />
                </div>
              </div>
            </div>
            {heroModifiers.length > 0 && (
              <div className="combatant-card__modifiers" aria-label="Hero modifiers">
                {heroModifiers.map((modifier) => (
                  <span
                    key={modifier}
                    className={`modifier-chip ${modifier.includes('-') ? 'modifier-chip--negative' : 'modifier-chip--positive'}`}
                  >
                    {modifier}
                  </span>
                ))}
              </div>
            )}
          </article>

          <div className="battle-top__center" aria-label="Momentum">
            <span className="battle-top__label">Momentum</span>
            <div
              className="momentum-track"
              role="meter"
              aria-valuenow={momentumSwing}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Momentum toward the hero"
            >
              <div className="momentum-track__fill" style={{ width: `${momentumSwing}%` }} />
            </div>
            <span className="battle-top__momentum" data-state={momentumState.toLowerCase()}>
              {momentumState}
            </span>
            <span className="battle-top__phase">
              {heroActing ? 'Plan your next technique' : `${battle.enemy.name} is acting`}
            </span>
          </div>

          <article className="combatant-card combatant-card--enemy" aria-label={`${battle.enemy.name} vitals`}>
            <header className="combatant-card__header">
              <span className="combatant-card__name">{battle.enemy.name}</span>
              <span className="combatant-card__tag">{battle.enemy.species}</span>
            </header>
            <div className="combatant-card__gauges">
              <div
                className="combatant-card__gauge"
                role="meter"
                aria-label="Enemy health"
                aria-valuenow={battle.enemyHp}
                aria-valuemin={0}
                aria-valuemax={battle.enemy.maxHp}
              >
                <div className="combatant-card__gauge-header">
                  <span>HP</span>
                  <span>{battle.enemyHp}/{battle.enemy.maxHp}</span>
                </div>
                <div className="gauge-track">
                  <div className="gauge-fill gauge-fill--enemy" style={{ width: `${enemyHpPercent}%` }} />
                </div>
              </div>
              <div className="combatant-card__gauge">
                <div className="combatant-card__gauge-header">
                  <span>Intent</span>
                  <span>{enemyNextAction ? formatTurnCount(enemyNextAction.remainingTurns) : 'Now'}</span>
                </div>
                <div className="intent-badge">{enemyNextAction?.name ?? 'Unknown'}</div>
              </div>
            </div>
            {enemyModifiers.length > 0 && (
              <div className="combatant-card__modifiers" aria-label="Enemy modifiers">
                {enemyModifiers.map((modifier) => (
                  <span
                    key={modifier}
                    className={`modifier-chip ${modifier.includes('-') ? 'modifier-chip--negative' : 'modifier-chip--positive'}`}
                  >
                    {modifier}
                  </span>
                ))}
              </div>
            )}
          </article>
        </div>
      </header>

      <section className="battle-quick card battle-layout__quick" aria-label="Battle overview">
        <div className="battle-quick__headline" aria-label="Combat tempo overview">
          <div className="battle-quick__matchup">
            <strong>{hero.name}</strong>
            <span>vs</span>
            <strong>{battle.enemy.name}</strong>
          </div>
          <span className="battle-quick__tempo" data-turn={heroActing ? 'hero' : 'enemy'}>
            {tempoState}
          </span>
        </div>
        <div className="battle-status-strip" aria-label="Active effects">
          {statusStrip.length > 0 ? (
            statusStrip.map((status) => (
              <span
                key={`${status.owner}-${status.key}`}
                className={`status-chip status-chip--${status.owner} status-chip--${status.type}`}
                title={status.description}
              >
                <span className="status-chip__label">{status.label}</span>
                <span className="status-chip__timer">{formatTurnCount(status.remainingTurns)}</span>
              </span>
            ))
          ) : (
            <span className="status-chip status-chip--empty">No effects in play</span>
          )}
        </div>

        <div className="battle-glance" aria-label="Combatants at a glance">
          <div className="battle-glance__side battle-glance__side--hero">
            <span className="battle-glance__avatar" aria-hidden="true">
              {heroInitial}
            </span>
            <div className="battle-glance__meta">
              <span className="battle-glance__label">Next technique</span>
              <strong>
                {heroNextAction
                  ? heroNextAction.name
                  : heroActing
                  ? 'Awaiting command'
                  : 'Ready'}
              </strong>
              <span className="battle-glance__detail">
                {heroNextAction
                  ? `Resolves in ${formatTurnCount(heroNextAction.remainingTurns)}`
                  : heroActing
                  ? 'Select an action below'
                  : 'All moves resolved'}
              </span>
            </div>
          </div>
          <div className="battle-glance__burst" aria-hidden="true">
            <span>vs</span>
          </div>
          <div className="battle-glance__side battle-glance__side--enemy">
            <span className="battle-glance__avatar" aria-hidden="true">
              {enemyInitial}
            </span>
            <div className="battle-glance__meta">
              <span className="battle-glance__label">Foe intent</span>
              <strong>{enemyNextAction ? enemyNextAction.name : 'Unclear'}</strong>
              <span className="battle-glance__detail">
                {enemyNextAction
                  ? `Strikes in ${formatTurnCount(enemyNextAction.remainingTurns)}`
                  : 'React to maintain advantage'}
              </span>
            </div>
          </div>
        </div>

        <div className="battle-peek">
          <div className="battle-peek__column">
            <span className="battle-peek__label">Timeline peek</span>
            <ul>
              {timelinePeek.length > 0 ? (
                timelinePeek.map((entry) => (
                  <li key={`${entry.owner}-${entry.key}`}>
                    <strong>{entry.owner === 'hero' ? 'You' : battle.enemy.name}</strong>
                    <span>{entry.name}</span>
                    <span>{formatTurnCount(entry.remainingTurns)}</span>
                  </li>
                ))
              ) : (
                <li>No actions queued</li>
              )}
            </ul>
          </div>
          <div className="battle-peek__column">
            <span className="battle-peek__label">Recent log</span>
            <ul>
              {logPreview.length > 0 ? (
                logPreview.map((entry, index) => <li key={`${entry}-${index}`}>{entry}</li>)
              ) : (
                <li>No events recorded</li>
              )}
            </ul>
          </div>
        </div>

        <div className="battle-quick__controls">
          <button type="button" className="chip-button" onClick={() => setActiveSheet('timeline')}>
            View timeline
          </button>
          <button type="button" className="chip-button" onClick={() => setActiveSheet('log')}>
            View log
          </button>
        </div>
      </section>

      <section className="battle-actions card battle-layout__actions" aria-label="Actions and reactions">
        <div className="battle-reactions" aria-label="Reaction slots">
          <span className="battle-reactions__title">Reactions</span>
          <div className="battle-reactions__slots">
            {reactionSlots.map((reaction, index) => (
              <div key={index} className="reaction-slot" data-filled={Boolean(reaction)}>
                <span className="reaction-slot__label">{`Slot ${index + 1}`}</span>
                {reaction ? (
                  <>
                    <strong>{reaction.name}</strong>
                    <span>{reaction.description}</span>
                  </>
                ) : (
                  <span>Assign before battle</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="battle-action-grid" role="group" aria-label="Hero techniques">
          {moves.map((move) => (
            <button
              key={move.key}
              type="button"
              className="battle-action-button"
              onClick={() => performHeroMove(move.key)}
              disabled={!heroActing}
              title={move.description}
            >
              <span className="battle-action-button__name">{move.name}</span>
              <span className="battle-action-button__meta">
                {move.type}
                {typeof move.chargeTurns === 'number'
                  ? ` · ${formatTurnCount(move.chargeTurns)} charge`
                  : ''}
              </span>
              <span className="battle-action-button__hint">{move.description}</span>
            </button>
          ))}
          {moves.length < 6 &&
            Array.from({ length: 6 - moves.length }).map((_, index) => (
              <div key={`placeholder-${index}`} className="battle-action-button battle-action-button--empty">
                Locked slot
              </div>
            ))}
        </div>

        <div className="battle-actions__footer">
          <button type="button" className="small-button battle-retreat" onClick={retreat}>
            Retreat
          </button>
        </div>
      </section>

      {activeSheet && (
        <div
          className="battle-sheet"
          role="dialog"
          aria-modal="true"
          aria-label={activeSheet === 'timeline' ? 'Full turn timeline' : 'Battle log'}
        >
          <div className="battle-sheet__content">
            <header className="battle-sheet__header">
              <h2>{activeSheet === 'timeline' ? 'Turn Timeline' : 'Battle Log'}</h2>
              <button type="button" className="small-button" onClick={() => setActiveSheet(null)}>
                Close
              </button>
            </header>
            {activeSheet === 'timeline' ? (
              <div className="battle-sheet__body">
                <ol>
                  {timelineEntries.length > 0 ? (
                    timelineEntries.map((entry) => {
                      const progress = clampPercent(
                        ((entry.totalTurns - entry.remainingTurns) / entry.totalTurns) * 100
                      );
                      return (
                        <li key={`${entry.owner}-${entry.key}`}>
                          <div className={`timeline-entry timeline-entry--${entry.owner}`}>
                            <header>
                              <span>{entry.owner === 'hero' ? 'You' : battle.enemy.name}</span>
                              <span>{formatTurnCount(entry.remainingTurns)}</span>
                            </header>
                            <strong>{entry.name}</strong>
                            <p>{entry.description}</p>
                            <div className="timeline-entry__progress" aria-hidden="true">
                              <div style={{ width: `${progress}%` }} />
                            </div>
                          </div>
                        </li>
                      );
                    })
                  ) : (
                    <li>No actions queued.</li>
                  )}
                </ol>
              </div>
            ) : (
              <div className="battle-sheet__body" ref={logRef}>
                <ol>
                  {battle.log.length > 0 ? (
                    battle.log.map((entry, index) => <li key={`${entry}-${index}`}>{entry}</li>)
                  ) : (
                    <li>No events recorded yet.</li>
                  )}
                </ol>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
