import { LocationActionDefinition, locationCompendium, locationOrder } from '../content/compendium';
import { useGame } from '../state/GameContext';

export function WorldMap() {
  const { startBattle, startTraining, rest, visitMarket } = useGame();

  const destinations = locationOrder.map((key) => locationCompendium[key]);

  const handleAction = (actionKey: LocationActionDefinition) => {
    if (actionKey.type === 'training') {
      startTraining();
    } else if (actionKey.type === 'rest') {
      rest();
    } else if (actionKey.type === 'market') {
      visitMarket();
    } else if (actionKey.type === 'battle') {
      startBattle(actionKey.encounter);
    }
  };

  return (
    <section className="card world-card" aria-label="World destinations">
      <header className="world-card__header">
        <h2 className="card__title">Choose Your Next Hunt</h2>
        <p className="card__description">
          Each locale shifts the threats you face. Pick a route that suits your current momentum.
        </p>
      </header>
      <ul className="world-card__list">
        {destinations.map((destination) => (
          <li key={destination.key} className="world-card__node">
            <figure className="visual-panel visual-panel--wide world-card__art">
              <img
                className="visual-panel__image"
                src={destination.image.src}
                alt={destination.image.alt}
              />
              <figcaption className="visual-panel__caption">{destination.summary}</figcaption>
              {destination.image.credit ? (
                <span className="visual-panel__credit">Art: {destination.image.credit}</span>
              ) : null}
            </figure>
            <div className="world-card__content">
              <h3 className="world-card__node-title">{destination.name}</h3>
              <p className="world-card__node-detail">{destination.description}</p>
              <div className="world-card__actions">
                {destination.actions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => handleAction(action)}
                    className="small-button"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
