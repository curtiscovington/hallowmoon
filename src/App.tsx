import { Route, Routes } from 'react-router-dom';
import { BattleView } from './components/BattleView';
import { CharacterCreation } from './components/CharacterCreation';
import { MessageBanner } from './components/MessageBanner';
import { MoonlitMarket } from './components/MoonlitMarket';
import { StageNavigation } from './components/StageNavigation';
import { StatsPanel } from './components/StatsPanel';
import { TrainingGround } from './components/TrainingGround';
import { WorldMap } from './components/WorldMap';
import { useGame } from './state/GameContext';

function GameScreen() {
  const { state } = useGame();

  let content: JSX.Element | null = null;

  if (state.view === 'create') {
    content = <CharacterCreation />;
  } else if (state.view === 'hero') {
    content = <StatsPanel />;
  } else if (state.view === 'map') {
    content = <WorldMap />;
  } else if (state.view === 'training') {
    content = <TrainingGround />;
  } else if (state.view === 'market') {
    content = <MoonlitMarket />;
  } else if (state.view === 'battle') {
    content = <BattleView />;
  }

  return (
    <div className="game-stage">
      <MessageBanner />
      {state.hero && state.view !== 'battle' ? <StageNavigation /> : null}
      {content}
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
