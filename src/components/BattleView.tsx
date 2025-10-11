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

  const heroNextAction = heroPending[0] ?? null;
  const enemyNextAction = enemyPending[0] ?? null;
  const reactionSlots = [heroPending[0] ?? null, heroPending[1] ?? null];

  return (
    <section className="screen-shell battle-shell" aria-label="Battle interface">
      <header className="battle-hud card" aria-label={`${battle.enemy.name} status`}>
        <div className="battle-hud__top">
          <div className="battle-hud__identity">
            <span className="battle-hud__label">Foe</span>
            <strong className="battle-hud__name">{battle.enemy.name}</strong>
            <span className="battle-hud__tag">{battle.enemy.species}</span>
          </div>
          <div className="battle-hud__intent">
            <span className="battle-hud__intent-label">Intent</span>
            <strong>{enemyNextAction ? enemyNextAction.name : 'Unknown'}</strong>
            <span className="battle-hud__intent-detail">
              {enemyNextAction
                ? `Strikes in ${formatTurnCount(enemyNextAction.remainingTurns)}`
                : 'Acting now'}
            </span>
          </div>
        </div>
        <div
          className="battle-bar"
          role="meter"
          aria-label="Enemy health"
          aria-valuenow={battle.enemyHp}
          aria-valuemin={0}
          aria-valuemax={battle.enemy.maxHp}
        >
          <div className="battle-bar__header">
            <span>HP</span>
            <span className="battle-bar__value">
              {battle.enemyHp}/{battle.enemy.maxHp}
            </span>
          </div>
          <div className="gauge-track">
            <div className="gauge-fill gauge-fill--enemy" style={{ width: `${enemyHpPercent}%` }} />
          </div>
        </div>
        {(enemyModifiers.length > 0 || enemyStatuses.length > 0) && (
          <div className="battle-hud__tags">
            {enemyModifiers.map((modifier) => (
              <span
                key={modifier}
                className={`modifier-chip ${
                  modifier.includes('-') ? 'modifier-chip--negative' : 'modifier-chip--positive'
                }`}
              >
                {modifier}
              </span>
            ))}
            {enemyStatuses.length > 0 &&
              enemyStatuses.map((status) => (
                <span
                  key={`enemy-${status.key}`}
                  className={`status-chip status-chip--enemy status-chip--${status.type}`}
                  title={status.description}
                >
                  <span className="status-chip__label">{status.label}</span>
                  <span className="status-chip__timer">{formatTurnCount(status.remainingTurns)}</span>
                </span>
              ))}
          </div>
        )}
      </header>

      <section className="battle-command card" aria-label="Choose your action">
        <header className="battle-command__top">
          <div className="battle-command__identity">
            <span className="battle-command__label">Hero</span>
            <strong className="battle-command__name">{hero.name}</strong>
            <span className="battle-command__tag">Lv {hero.level}</span>
          </div>
          <div className="battle-command__tempo" aria-live="polite">
            <span className="battle-command__tempo-label">Turn</span>
            <strong data-turn={heroActing ? 'hero' : 'enemy'}>
              {heroActing ? 'Your move' : `${battle.enemy.name} attacks`}
            </strong>
            <span className="battle-command__tempo-detail">
              {heroActing ? 'Choose a technique below.' : 'Brace for impact or trigger a reaction.'}
            </span>
          </div>
        </header>

        <div className="battle-command__bars">
          <div
            className="battle-bar"
            role="meter"
            aria-label="Hero health"
            aria-valuenow={battle.heroHp}
            aria-valuemin={0}
            aria-valuemax={hero.maxHp}
          >
            <div className="battle-bar__header">
              <span>HP</span>
              <span className="battle-bar__value">
                {battle.heroHp}/{hero.maxHp}
              </span>
            </div>
            <div className="gauge-track">
              <div className="gauge-fill gauge-fill--hero" style={{ width: `${heroHpPercent}%` }} />
            </div>
          </div>

          <div
            className="battle-bar"
            role="meter"
            aria-label="Hero vigor"
            aria-valuenow={hero.energy}
            aria-valuemin={0}
            aria-valuemax={hero.maxEnergy}
          >
            <div className="battle-bar__header">
              <span>Vigor</span>
              <span className="battle-bar__value">
                {hero.energy}/{hero.maxEnergy}
              </span>
            </div>
            <div className="gauge-track">
              <div className="gauge-fill gauge-fill--vigor" style={{ width: `${heroVigorPercent}%` }} />
            </div>
          </div>

          <div
            className="battle-bar"
            role="meter"
            aria-label="Hero essence"
            aria-valuenow={heroEssencePercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="battle-bar__header">
              <span>Essence</span>
              <span className="battle-bar__value">{heroEssencePercent}%</span>
            </div>
            <div className="gauge-track">
              <div className="gauge-fill gauge-fill--essence" style={{ width: `${heroEssencePercent}%` }} />
            </div>
          </div>
        </div>

        {(heroModifiers.length > 0 || heroStatuses.length > 0) && (
          <div className="battle-command__tags">
            {heroModifiers.map((modifier) => (
              <span
                key={modifier}
                className={`modifier-chip ${
                  modifier.includes('-') ? 'modifier-chip--negative' : 'modifier-chip--positive'
                }`}
              >
                {modifier}
              </span>
            ))}
            {heroStatuses.length > 0 &&
              heroStatuses.map((status) => (
                <span
                  key={`hero-${status.key}`}
                  className={`status-chip status-chip--hero status-chip--${status.type}`}
                  title={status.description}
                >
                  <span className="status-chip__label">{status.label}</span>
                  <span className="status-chip__timer">{formatTurnCount(status.remainingTurns)}</span>
                </span>
              ))}
          </div>
        )}

        <div className="battle-command__summary">
          <div>
            <span className="battle-command__label">Your action</span>
            <strong>
              {heroNextAction
                ? heroNextAction.name
                : heroActing
                ? 'Awaiting command'
                : 'Resolved'}
            </strong>
            <span className="battle-command__detail">
              {heroNextAction
                ? `Resolves in ${formatTurnCount(heroNextAction.remainingTurns)}`
                : heroActing
                ? 'Select an action below'
                : 'All moves have completed'}
            </span>
          </div>
          <div>
            <span className="battle-command__label">Enemy intent</span>
            <strong>{enemyNextAction ? enemyNextAction.name : 'Unclear'}</strong>
            <span className="battle-command__detail">
              {enemyNextAction
                ? `Strikes in ${formatTurnCount(enemyNextAction.remainingTurns)}`
                : 'React or press your attack'}
            </span>
          </div>
        </div>

        <div className="battle-command__grid" role="group" aria-label="Hero techniques">
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

        <div className="battle-command__footer">
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

          <button type="button" className="small-button battle-retreat" onClick={retreat}>
            Retreat
          </button>
        </div>
      </section>
    </section>
  );
}
