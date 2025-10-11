import { useGame } from '../state/GameContext';

export function WorldMap() {
  const { startBattle, startTraining, rest, visitMarket } = useGame();

  const nodes = [
    {
      key: 'village',
      title: 'Silverfen Village',
      description: 'Home base for weary hunters. Recover and hone your craft.',
      actions: [
        { label: 'Train Stats', onClick: startTraining },
        { label: 'Rest & Recover', onClick: rest },
        { label: 'Visit Moonlit Market', onClick: visitMarket }
      ]
    },
    {
      key: 'forest',
      title: 'Whispering Forest',
      description: 'Feral howls echo through the boughs. Expect agile foes.',
      actions: [{ label: 'Enter Forest', onClick: () => startBattle('forest') }]
    },
    {
      key: 'ruins',
      title: 'Lunar Ruins',
      description: 'Forgotten altars hum with arcane vampires guarding secrets.',
      actions: [{ label: 'Explore Ruins', onClick: () => startBattle('ruins') }]
    }
  ];

  return (
    <section className="card world-card" aria-label="World destinations">
      <header className="world-card__header">
        <h2 className="card__title">Choose Your Next Hunt</h2>
        <p className="card__description">
          Each locale shifts the threats you face. Pick a route that suits your current momentum.
        </p>
      </header>
      <ul className="world-card__list">
        {nodes.map((node) => (
          <li key={node.key} className="world-card__node">
            <div>
              <h3 className="world-card__node-title">{node.title}</h3>
              <p className="world-card__node-detail">{node.description}</p>
            </div>
            <div className="world-card__actions">
              {node.actions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  className="small-button"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
