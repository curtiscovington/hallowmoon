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
    <section className="card training-card" aria-label="Training grounds">
      <header className="training-card__header">
        <h2 className="card__title">Training Grounds</h2>
        <p className="card__description">
          Each session consumes 1 energy. Rest in the village to recover if you tire.
        </p>
      </header>
      <ul className="training-card__options">
        {trainingOptions.map((option) => (
          <li key={option.key} className="training-card__option">
            <div>
              <h3 className="training-card__option-title">{option.title}</h3>
              <p className="training-card__option-detail">{option.detail}</p>
            </div>
            <button
              type="button"
              onClick={() => train(option.key)}
              disabled={hero.energy <= 0}
              className="small-button"
            >
              Train {option.title.split(' ')[0]}
            </button>
          </li>
        ))}
      </ul>
      <footer className="training-card__footer">
        <span className="tag">Energy {hero.energy}/{hero.maxEnergy}</span>
        <button className="small-button" type="button" onClick={goToMap}>
          Back to Map
        </button>
      </footer>
    </section>
  );
}
