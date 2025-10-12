import { useGame } from '../state/GameContext';
import { RunOption } from '../state/types';

function OptionCard({ option, onChoose }: { option: RunOption; onChoose: (option: RunOption) => void }) {
  const isRetreat = option.type === 'retreat';
  const typeLabel =
    option.type === 'battle' ? 'Battle' : option.type === 'event' ? 'Event' : 'Return';
  return (
    <li className={`run-card__option${isRetreat ? ' run-card__option--retreat' : ''}`}>
      <button
        type="button"
        className="run-card__option-button"
        onClick={() => onChoose(option)}
      >
        <span className="run-card__option-label">{option.label}</span>
        <span className="run-card__option-type">{typeLabel}</span>
      </button>
      <p className="run-card__option-description">{option.description}</p>
    </li>
  );
}

export function RunView() {
  const {
    state: { run, hero },
    chooseRunOption,
    abandonRun
  } = useGame();

  if (!hero || !run) {
    return null;
  }

  const handleChoose = (option: RunOption) => {
    chooseRunOption(option.id);
  };

  const logEntries = [...run.log].reverse().slice(0, 5);

  return (
    <div className="run-layout">
      <section className="card run-card" aria-label="Forest run choices">
        <header className="run-card__header">
          <h2 className="card__title">Whispering Forest Run</h2>
          <p className="card__description">
            Depth {run.depth} · Victories {run.victoryCount}. Each decision reshapes this moonlit expedition.
          </p>
        </header>
        <section className="run-card__section" aria-label="Available paths">
          <h3 className="run-card__section-title">Choose your next path</h3>
          <ul className="run-card__options">
            {run.options.map((option) => (
              <OptionCard key={option.id} option={option} onChoose={handleChoose} />
            ))}
          </ul>
        </section>
        <footer className="run-card__footer">
          <button type="button" className="small-button" onClick={abandonRun}>
            Abandon Run
          </button>
        </footer>
      </section>
      <aside className="card run-card run-card__sidebar" aria-label="Run modifiers">
        <section className="run-card__section" aria-label="Equipped relics">
          <h3 className="run-card__section-title">Equipped Relics</h3>
          {run.relics.length === 0 ? (
            <p className="run-card__empty">No relics yet. Discover them in events or victories.</p>
          ) : (
            <ul className="run-card__relics">
              {run.relics.map((relic) => (
                <li key={relic.id} className="run-card__relic">
                  <h4 className="run-card__relic-name">{relic.name}</h4>
                  <p className="run-card__relic-description">{relic.description}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="run-card__section" aria-label="Recent run log">
          <h3 className="run-card__section-title">Recent Echoes</h3>
          {logEntries.length === 0 ? (
            <p className="run-card__empty">Your story in the forest is just beginning.</p>
          ) : (
            <ol className="run-card__log">
              {logEntries.map((entry) => (
                <li key={`${entry.depth}-${entry.choice}`} className="run-card__log-entry">
                  <span className="run-card__log-depth">Depth {entry.depth}</span>
                  <span className="run-card__log-choice">{entry.choice}</span>
                  <p className="run-card__log-summary">{entry.summary}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </aside>
    </div>
  );
}
