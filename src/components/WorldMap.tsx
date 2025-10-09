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
    <section className="grid" style={{ gap: '1.5rem' }}>
      {nodes.map((node) => (
        <article key={node.key} className="card" style={{ position: 'relative' }}>
          <h3 style={{ marginTop: 0 }}>{node.title}</h3>
          <p style={{ opacity: 0.85 }}>{node.description}</p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
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
        </article>
      ))}
    </section>
  );
}
