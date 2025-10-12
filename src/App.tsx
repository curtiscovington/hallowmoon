import { Route, Routes } from 'react-router-dom';
import { BattleView } from './components/BattleView';
import { CharacterCreation } from './components/CharacterCreation';
import { MessageBanner } from './components/MessageBanner';
import { MoonlitMarket } from './components/MoonlitMarket';
import { PostBattleSummary } from './components/PostBattleSummary';
import { RunView } from './components/RunView';
import { StageNavigation } from './components/StageNavigation';
import { StatsPanel } from './components/StatsPanel';
import { TrainingGround } from './components/TrainingGround';
import { WorldMap } from './components/WorldMap';
import { locationCompendium } from './content/compendium';
import { useGame } from './state/GameContext';
import { GameView } from './state/types';

const viewMeta: Record<GameView, { title: string; tagline: string }> = {
  create: {
    title: 'Hunter Forge',
    tagline: 'Channel lunar blessings to craft your legend.'
  },
  hero: {
    title: 'Hunter Codex',
    tagline: 'Track your growing power beneath the waxing moon.'
  },
  map: {
    title: 'World Expedition',
    tagline: 'Choose the next moonlit frontier to scout.'
  },
  run: {
    title: 'Whispering Run',
    tagline: 'Forge your path through shifting moonlit choices.'
  },
  training: {
    title: 'Training Ritual',
    tagline: 'Sharpen talents with guild mentors and sparring rites.'
  },
  market: {
    title: 'Moonlit Market',
    tagline: 'Barter relics and tonics pulled from silverlight vaults.'
  },
  battle: {
    title: 'Active Encounter',
    tagline: 'React swiftly as foe and moon weave the tempo of battle.'
  },
  'post-battle': {
    title: 'Afterglow Report',
    tagline: 'Reckon the spoils earned beneath the hollow moon.'
  }
};

function GameScreen() {
  const { state } = useGame();
  const hero = state.hero;
  const meta = viewMeta[state.view];
  const locationName = locationCompendium[state.location]?.name ?? 'Uncharted Wilds';
  const showFooterNav = Boolean(
    hero && !['battle', 'post-battle', 'run'].includes(state.view)
  );

  let content: JSX.Element | null = null;

  if (state.view === 'create') {
    content = <CharacterCreation />;
  } else if (state.view === 'hero') {
    content = <StatsPanel />;
  } else if (state.view === 'map') {
    content = <WorldMap />;
  } else if (state.view === 'run') {
    content = <RunView />;
  } else if (state.view === 'training') {
    content = <TrainingGround />;
  } else if (state.view === 'market') {
    content = <MoonlitMarket />;
  } else if (state.view === 'battle') {
    content = <BattleView />;
  } else if (state.view === 'post-battle') {
    content = <PostBattleSummary />;
  }

  const heroHpPercent = hero
    ? Math.round((Math.max(0, hero.currentHp) / Math.max(1, hero.maxHp)) * 100)
    : 0;
  const heroEnergyPercent = hero
    ? Math.round((Math.max(0, hero.energy) / Math.max(1, hero.maxEnergy)) * 100)
    : 0;

  return (
    <div className="app-shell">
      <div className="app-shell__glow" aria-hidden="true" />
      <div className="app-shell__frame">
        <header className="app-hud">
          <div className="app-hud__identity">
            <span className="app-hud__badge">HallowMoon</span>
            <div className="app-hud__title-row">
              <h1 className="app-hud__title">
                {hero ? hero.name : 'Awaken a Lunar Hunter'}
              </h1>
              {hero ? (
                <span className="app-hud__level" aria-label="Hunter level">
                  Lv {hero.level}
                </span>
              ) : null}
            </div>
            <div className="app-hud__meta" aria-live="polite">
              <span className="app-hud__meta-pill">{meta.title}</span>
              {hero ? (
                <span className="app-hud__meta-pill app-hud__meta-pill--accent">
                  {locationName}
                </span>
              ) : null}
            </div>
            <p className="app-hud__descriptor">{meta.tagline}</p>
          </div>
          {hero ? (
            <dl className="app-hud__stats" aria-label="Hunter status bars">
              <div className="app-hud__stat">
                <dt>Vitality</dt>
                <dd>
                  <div className="app-hud__bar" role="presentation">
                    <div
                      className="app-hud__bar-fill app-hud__bar-fill--hp"
                      style={{ width: `${heroHpPercent}%` }}
                    />
                  </div>
                  <span className="app-hud__bar-value">
                    {hero.currentHp} / {hero.maxHp} HP
                  </span>
                </dd>
              </div>
              <div className="app-hud__stat">
                <dt>Essence</dt>
                <dd>
                  <div className="app-hud__bar" role="presentation">
                    <div
                      className="app-hud__bar-fill app-hud__bar-fill--energy"
                      style={{ width: `${heroEnergyPercent}%` }}
                    />
                  </div>
                  <span className="app-hud__bar-value">
                    {hero.energy} / {hero.maxEnergy} Energy
                  </span>
                </dd>
              </div>
              <div className="app-hud__stat app-hud__stat--economy">
                <dt>Spoils</dt>
                <dd>
                  <div className="app-hud__stat-tags">
                    <span className="app-hud__stat-tag">✦ {hero.coins} Coins</span>
                    <span className="app-hud__stat-tag">XP {hero.xp}</span>
                  </div>
                </dd>
              </div>
            </dl>
          ) : (
            <p className="app-hud__intro">
              Bind claw and curse into a champion ready to brave the hollow moon.
            </p>
          )}
        </header>
        <main className="app-main">
          <div className="game-stage">
            <MessageBanner />
            {content}
          </div>
        </main>
        {showFooterNav ? (
          <footer className="app-footer">
            <StageNavigation />
          </footer>
        ) : null}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<GameScreen />} />
      <Route path="*" element={<GameScreen />} />
    </Routes>
  );
}
