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
      <li key={item.key} className="market-card__item">
        {item.artwork ? (
          <figure className="visual-panel visual-panel--wide market-card__art">
            <img className="visual-panel__image" src={item.artwork.src} alt={item.artwork.alt} />
            <figcaption className="visual-panel__caption">{item.flavor ?? item.description}</figcaption>
            {item.artwork.credit ? (
              <span className="visual-panel__credit">Art: {item.artwork.credit}</span>
            ) : null}
          </figure>
        ) : null}
        <div className="market-card__item-body">
          <div>
            <h3 className="market-card__item-title">{item.name}</h3>
            <p className="market-card__item-detail">{item.description}</p>
          </div>
          <div className="market-card__item-actions">
            <span className="market-card__item-cost">Cost: {item.cost} coins</span>
            <button
              type="button"
              className="small-button"
              disabled={!affordable}
              onClick={() => buyFromMarket(item.key)}
            >
              {affordable ? 'Purchase' : 'Need more coins'}
            </button>
          </div>
        </div>
      </li>
    );
  };

  return (
    <section className="card market-card" aria-label="Moonlit market">
      <header className="market-card__header">
        <div>
          <h2 className="card__title">Moonlit Market</h2>
          <p className="card__description">
            Lanterns sway in the midnight breeze. Spend your hard-won coins on boons to shape your hunt.
          </p>
        </div>
        <div className="market-card__summary">
          <span className="market-card__purse">Purse: {hero.coins} coins</span>
          <button type="button" className="small-button" onClick={goToMap}>
            Return to Map
          </button>
        </div>
      </header>
      {marketInventory.length > 0 ? (
        <ul className="market-card__list">{marketInventory.map(renderItem)}</ul>
      ) : (
        <div className="market-card__empty">
          <h3 className="market-card__empty-title">Stalls Closed</h3>
          <p className="market-card__empty-detail">
            The merchants have packed up for now. Rest or return later to see fresh curiosities.
          </p>
        </div>
      )}
    </section>
  );
}
