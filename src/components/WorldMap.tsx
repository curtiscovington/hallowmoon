import {
  LocationActionDefinition,
  locationCompendium,
  locationOrder
} from '../content/compendium';
import {
  MAX_BLESSING_LEVEL,
  describeBlessingLevel,
  getBlessingUpgradeCost,
  useGame
} from '../state/GameContext';

export function WorldMap() {
  const {
    state: { townProgress },
    startBattle,
    startTraining,
    rest,
    visitMarket,
    beginForestRun,
    purchaseTownBlessing
  } = useGame();

  const destinations = locationOrder.map((key) => locationCompendium[key]);

  const handleAction = (actionKey: LocationActionDefinition) => {
    if (actionKey.type === 'training') {
      startTraining();
    } else if (actionKey.type === 'rest') {
      rest();
    } else if (actionKey.type === 'market') {
      visitMarket();
    } else if (actionKey.type === 'battle') {
      if (actionKey.encounter === 'forest') {
        beginForestRun();
      } else {
        startBattle(actionKey.encounter);
      }
    }
  };

  const { moonShards, blessingLevel } = townProgress;
  const nextCost = getBlessingUpgradeCost(blessingLevel);
  const atMaxBlessing = blessingLevel >= MAX_BLESSING_LEVEL;
  const nextBlessingDescription = describeBlessingLevel(
    Math.min(blessingLevel + 1, MAX_BLESSING_LEVEL)
  );

  return (
    <div className="world-layout">
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
      <section className="card town-card" aria-label="Town progression">
        <header className="town-card__header">
          <h2 className="card__title">Sanctuary Ledger</h2>
          <p className="card__description">
            Invest moonshards to awaken blessings that empower future runs.
          </p>
        </header>
        <dl className="town-card__stats">
          <div className="town-card__stat">
            <dt>Stored Moonshards</dt>
            <dd>{moonShards}</dd>
          </div>
          <div className="town-card__stat">
            <dt>Blessing Tier</dt>
            <dd>{blessingLevel}</dd>
          </div>
        </dl>
        <p className="town-card__summary">{describeBlessingLevel(blessingLevel)}</p>
        <p className="town-card__next">
          {atMaxBlessing
            ? 'The sanctuary hums with every blessing currently known.'
            : `Next boon: ${nextBlessingDescription}`}
        </p>
        <button
          type="button"
          className="small-button town-card__button"
          onClick={purchaseTownBlessing}
          disabled={atMaxBlessing || moonShards < nextCost}
        >
          {atMaxBlessing
            ? 'All Blessings Awakened'
            : `Invest ${nextCost} Moonshards`}
        </button>
        {!atMaxBlessing && moonShards < nextCost ? (
          <p className="town-card__hint">
            You need {nextCost - moonShards} more moonshards to empower the sanctuary.
          </p>
        ) : null}
      </section>
    </div>
  );
}
