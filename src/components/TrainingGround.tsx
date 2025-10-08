import { useGame } from '../state/GameContext';
import { TrainableStat } from '../state/types';

const trainingOptions: Array<{
  key: TrainableStat;
  title: string;
  detail: string;
}> = [
  {
    key: 'str',
    title: 'Brutal Drills',
    detail: 'Sharpen claws and fangs to increase raw might.'
  },
  {
    key: 'agi',
    title: 'Moonlit Dashes',
    detail: 'Practice evasive footwork to act before foes.'
  },
  {
    key: 'wis',
    title: 'Occult Study',
    detail: 'Meditate with lunar tomes to empower special moves.'
  }
];

export function TrainingGround() {
  const {
    state: { hero },
    train,
    goToMap
  } = useGame();

  if (!hero) {
    return null;
  }

  return (
    <section className="card">
      <h2 style={{ marginTop: 0 }}>Training Grounds</h2>
      <p style={{ opacity: 0.85 }}>
        Each session consumes 1 energy. Rest in the village to recover if you tire.
      </p>
      <div className="grid">
        {trainingOptions.map((option) => (
          <article key={option.key} className="card" style={{ background: 'rgba(26, 12, 48, 0.75)' }}>
            <h3 style={{ marginTop: 0 }}>{option.title}</h3>
            <p style={{ opacity: 0.8 }}>{option.detail}</p>
            <button type="button" onClick={() => train(option.key)} disabled={hero.energy <= 0}>
              Train {option.title.split(' ')[0]}
            </button>
          </article>
        ))}
      </div>
      <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <span className="tag">Energy {hero.energy}/{hero.maxEnergy}</span>
        <button className="small-button" type="button" onClick={goToMap}>
          Back to Map
        </button>
      </div>
    </section>
  );
}
