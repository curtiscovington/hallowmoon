import React from 'react';
import { useGame } from '../state/GameContext';
import { BattleRewardItem } from '../state/types';

function useAnimatedCount(target: number, duration = 700) {
  const [value, setValue] = React.useState(0);

  React.useEffect(() => {
    let rafId: number;
    let startTime: number | null = null;

    if (target === 0) {
      setValue(0);
      return undefined;
    }

    const step = (timestamp: number) => {
      if (startTime === null) {
        startTime = timestamp;
      }
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setValue(Math.round(progress * target));
      if (progress < 1) {
        rafId = window.requestAnimationFrame(step);
      }
    };

    setValue(0);
    rafId = window.requestAnimationFrame(step);

    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [target, duration]);

  return value;
}

const rarityLabels: Record<BattleRewardItem['rarity'], string> = {
  common: 'Common',
  rare: 'Rare',
  epic: 'Epic'
};

type ExperienceSegment = {
  level: number;
  xpStart: number;
  xpEnd: number;
  xpCap: number;
  startRatio: number;
  endRatio: number;
  levelled: boolean;
};

function xpToNext(level: number) {
  return 60 + (level - 1) * 25;
}

export function PostBattleSummary() {
  const { state, acknowledgeRewards } = useGame();
  const rewards = state.postBattleRewards;

  const hero = state.hero;

  const [revealedItems, setRevealedItems] = React.useState(0);
  const [segmentProgress, setSegmentProgress] = React.useState<number[]>([]);

  React.useEffect(() => {
    if (!rewards) {
      setRevealedItems(0);
      return;
    }
    if (rewards.items.length === 0) {
      setRevealedItems(0);
      return;
    }
    setRevealedItems(0);
    const timers = rewards.items.map((_, index) =>
      window.setTimeout(() => {
        setRevealedItems((current) => Math.max(current, index + 1));
      }, 600 + index * 220)
    );
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [rewards]);

  const xpSegments = React.useMemo<ExperienceSegment[]>(() => {
    if (!rewards) {
      return [];
    }
    const segments: ExperienceSegment[] = [];
    const {
      heroProgress: { before, after }
    } = rewards;

    const pushSegment = (
      level: number,
      xpStart: number,
      xpEnd: number,
      xpCap: number,
      levelled: boolean
    ) => {
      const clampedEnd = Math.min(xpEnd, xpCap);
      segments.push({
        level,
        xpStart,
        xpEnd: clampedEnd,
        xpCap,
        startRatio: xpCap === 0 ? 0 : Math.min(xpStart / xpCap, 1),
        endRatio: xpCap === 0 ? 0 : Math.min(clampedEnd / xpCap, 1),
        levelled
      });
    };

    if (before.level === after.level) {
      const cap = xpToNext(before.level);
      pushSegment(before.level, before.xp, after.xp, cap, false);
      return segments;
    }

    const initialCap = xpToNext(before.level);
    pushSegment(before.level, before.xp, initialCap, initialCap, true);

    for (let level = before.level + 1; level < after.level; level += 1) {
      const cap = xpToNext(level);
      pushSegment(level, 0, cap, cap, true);
    }

    const finalCap = xpToNext(after.level);
    pushSegment(after.level, 0, after.xp, finalCap, false);

    return segments;
  }, [rewards]);

  React.useEffect(() => {
    if (!rewards) {
      setSegmentProgress([]);
      return;
    }
    setSegmentProgress(xpSegments.map((segment) => segment.startRatio));
    if (xpSegments.length === 0) {
      return;
    }
    const timers = xpSegments.map((segment, index) =>
      window.setTimeout(() => {
        setSegmentProgress((current) => {
          const next = [...current];
          next[index] = segment.endRatio;
          return next;
        });
      }, 480 + index * 620)
    );
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [rewards, xpSegments]);

  const xpDisplay = useAnimatedCount(rewards?.xpEarned ?? 0);
  const coinDisplay = useAnimatedCount(rewards?.coinsEarned ?? 0, 620);

  if (!rewards || !hero) {
    return null;
  }

  const itemsToRender = rewards.items.slice(0, Math.min(revealedItems, rewards.items.length));
  const hasItems = rewards.items.length > 0;

  const levelMessages = rewards.heroProgress.levelUps;

  return (
    <section
      className="post-battle-screen"
      aria-label="Battle rewards summary"
    >
      <article className="post-battle-panel card">
        <header className="post-battle-header">
          <div>
            <p className="post-battle-header__eyebrow">Victory secured</p>
            <h2 className="post-battle-header__title">Spoils from {rewards.enemyName}</h2>
            <p className="post-battle-header__subtitle">
              {hero.name} stands triumphant. Gather your spoils and breathe in the moonlight.
            </p>
          </div>
          {rewards.enemyArtwork?.src ? (
            <figure className="post-battle-artwork" aria-hidden="true">
              <img src={rewards.enemyArtwork.src} alt="" className="post-battle-artwork__image" />
            </figure>
          ) : null}
        </header>

        <div className="post-battle-rewards" aria-label="Currency rewards">
          <div className="reward-tile" role="status" aria-live="polite">
            <span className="reward-tile__label">Experience</span>
            <span className="reward-tile__value">+{xpDisplay}</span>
            <span className="reward-tile__hint">Total: {hero.xp} XP toward level {hero.level}</span>
          </div>
          <div className="reward-tile" role="status" aria-live="polite">
            <span className="reward-tile__label">Moonlit Coin</span>
            <span className="reward-tile__value">+{coinDisplay}</span>
            <span className="reward-tile__hint">Purse now holds {hero.coins} coins</span>
          </div>
        </div>

        <div className="post-battle-level" aria-label="Hero progress">
          <div className="post-battle-level__row">
            <span className="post-battle-level__label">Hero Progress</span>
            <div className="post-battle-level__levels" aria-hidden="true">
              <span className="post-battle-level__badge">Lv {rewards.heroProgress.before.level}</span>
              <span className="post-battle-level__arrow" aria-hidden="true">
                →
              </span>
              <span className="post-battle-level__badge post-battle-level__badge--after">
                Lv {rewards.heroProgress.after.level}
              </span>
            </div>
          </div>
          {xpSegments.length > 0 ? (
            <div className="xp-progress" aria-label="Experience progress across levels">
              {xpSegments.map((segment, index) => {
                const widthRatio = Math.max(
                  segmentProgress[index] ?? segment.startRatio,
                  segment.startRatio
                );
                const widthPercent = Math.min(widthRatio, 1) * 100;
                const segmentComplete =
                  segment.levelled && segment.endRatio === 1 && widthRatio >= segment.endRatio;
                return (
                  <div
                    key={`xp-segment-${segment.level}-${index}`}
                    className="xp-progress__segment"
                    data-levelled={segment.levelled}
                    data-complete={segmentComplete}
                  >
                    <div className="xp-progress__meta">
                      <span className="xp-progress__level">Lv {segment.level}</span>
                      <span className="xp-progress__value">
                        {Math.round(index === xpSegments.length - 1 ? segment.xpEnd : segment.xpCap)} /{' '}
                        {segment.xpCap} XP
                      </span>
                    </div>
                    <div
                      className="xp-progress__track"
                      role="meter"
                      aria-valuemin={0}
                      aria-valuemax={segment.xpCap}
                      aria-valuenow={Math.round(segment.xpEnd)}
                      aria-label={`Level ${segment.level} experience`}
                    >
                      <div
                        className="xp-progress__fill"
                        data-complete={segmentComplete}
                        style={{ width: `${widthPercent}%` }}
                      />
                    </div>
                    {segment.levelled ? (
                      <span className="xp-progress__level-up" aria-hidden="true">
                        Level Up!
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
          <ul className="post-battle-level__notes">
            {levelMessages.length > 0 ? (
              levelMessages.map((message) => (
                <li key={message}>{message}</li>
              ))
            ) : (
              <li>Experience deepens your legend.</li>
            )}
          </ul>
        </div>

        <section className="post-battle-items" aria-label="Recovered items">
          <header className="post-battle-items__header">
            <span className="post-battle-items__title">Recovered items</span>
            <span className="post-battle-items__count">{rewards.items.length} found</span>
          </header>
          {hasItems ? (
            itemsToRender.length > 0 ? (
              <ul className="post-battle-items__list">
                {itemsToRender.map((item, index) => (
                  <li
                    key={item.id}
                    className={`post-battle-item post-battle-item--${item.rarity} post-battle-item--revealed`}
                    style={{ animationDelay: `${index * 80}ms` }}
                  >
                    <div className="post-battle-item__name">{item.name}</div>
                    <div className="post-battle-item__meta">{rarityLabels[item.rarity]}</div>
                    <p className="post-battle-item__description">{item.description}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="post-battle-items__pending">Moonlight gathers your spoils...</p>
            )
          ) : (
            <p className="post-battle-items__empty">No notable spoils were recovered this time.</p>
          )}
        </section>
      </article>

      <div className="post-battle-actions">
        <button type="button" onClick={acknowledgeRewards} className="post-battle-actions__button">
          Return to the hunt
        </button>
      </div>
    </section>
  );
}
