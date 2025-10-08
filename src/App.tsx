import { Route, Routes } from 'react-router-dom';
import { BattleView } from './components/BattleView';
import { CharacterCreation } from './components/CharacterCreation';
import { Header } from './components/Header';
import { MessageBanner } from './components/MessageBanner';
import { StatsPanel } from './components/StatsPanel';
import { TrainingGround } from './components/TrainingGround';
import { WorldMap } from './components/WorldMap';
import { useGame } from './state/GameContext';

function GameScreen() {
  const { state } = useGame();

  let content: JSX.Element | null = null;

  if (state.view === 'create') {
    content = <CharacterCreation />;
  } else if (state.view === 'map') {
    content = (
      <>
        <WorldMap />
        <StatsPanel />
      </>
    );
  } else if (state.view === 'training') {
    content = (
      <>
        <TrainingGround />
        <StatsPanel />
      </>
    );
  } else if (state.view === 'battle') {
    content = <BattleView />;
  }

  return (
    <main>
      <Header />
      <MessageBanner />
      {content}
    </main>
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
