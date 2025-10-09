import { useGame } from '../state/GameContext';
import { MarketItem } from '../state/types';

export function MoonlitMarket() {
  const {
    state: { marketInventory, hero },
    buyFromMarket,
    goToMap
  } = useGame();

  if (!hero) {
    return null;
  }

  const renderItem = (item: MarketItem) => {
    const affordable = hero.coins >= item.cost;
    return (
      <article key={item.key} className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <div>
          <h3 style={{ margin: '0 0 0.25rem 0' }}>{item.name}</h3>
          <p style={{ margin: 0, opacity: 0.85 }}>{item.description}</p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600 }}>Cost: {item.cost} coins</span>
          <button
            type="button"
            className="small-button"
            disabled={!affordable}
            onClick={() => buyFromMarket(item.key)}
            style={{ opacity: affordable ? 1 : 0.6 }}
          >
            {affordable ? 'Purchase' : 'Need more coins'}
          </button>
        </div>
      </article>
    );
  };

  return (
    <section className="grid" style={{ gap: '1.5rem' }}>
      <article className="card" style={{ display: 'grid', gap: '0.75rem' }}>
        <h2 style={{ margin: 0 }}>Moonlit Market</h2>
        <p style={{ margin: 0 }}>
          Lanterns sway in the midnight breeze. Spend your hard-won coins on boons to shape your
          hunt.
        </p>
        <div
          style={{
            display: 'flex',
            gap: '1rem',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <span style={{ fontWeight: 600 }}>Your purse: {hero.coins} coins</span>
          <button type="button" className="small-button" onClick={goToMap}>
            Return to Map
          </button>
        </div>
      </article>

      {marketInventory.length > 0 ? (
        marketInventory.map(renderItem)
      ) : (
        <article className="card" style={{ display: 'grid', gap: '0.75rem' }}>
          <h3 style={{ margin: 0 }}>Stalls Closed</h3>
          <p style={{ margin: 0, opacity: 0.85 }}>
            The merchants have packed up for now. Rest or return later to see fresh curiosities.
          </p>
        </article>
      )}
    </section>
  );
}
