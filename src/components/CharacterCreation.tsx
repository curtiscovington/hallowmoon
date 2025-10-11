import React from 'react';
import { speciesCompendium } from '../content/compendium';
import { useGame } from '../state/GameContext';
import { Species } from '../state/types';

const speciesOptions = Object.keys(speciesCompendium) as Species[];

export function CharacterCreation() {
  const { createHero } = useGame();
  const [name, setName] = React.useState('');
  const [species, setSpecies] = React.useState<Species>('Werewolf');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      return;
    }
    createHero(name.trim(), species);
  };

  const selectedSpecies = speciesCompendium[species];

  return (
    <section className="card creation-card">
      <div className="creation-card__grid">
        <aside className="creation-card__preview" aria-live="polite">
          <figure className="visual-panel visual-panel--portrait">
            <img className="visual-panel__image" src={selectedSpecies.image.src} alt={selectedSpecies.image.alt} />
            <figcaption className="visual-panel__caption">{selectedSpecies.tagline}</figcaption>
            {selectedSpecies.image.credit ? (
              <span className="visual-panel__credit">Art: {selectedSpecies.image.credit}</span>
            ) : null}
          </figure>
        </aside>
        <div className="creation-card__form">
          <header className="creation-card__intro">
            <h2 className="card__title">Create Your Legend</h2>
            <p className="card__description">
              Choose your nature beneath the moon. Each path offers unique talents in battle.
            </p>
          </header>
          <form onSubmit={handleSubmit} className="creation-form">
            <label className="field-label" htmlFor="name">
              Name
            </label>
            <input
              id="name"
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Moonlit hero"
              required
              maxLength={24}
            />
            <fieldset className="creation-species">
              <legend className="field-label">Species</legend>
              <div className="creation-species__options">
                {speciesOptions.map((option) => (
                  <label key={option} className="creation-species__option">
                    <input
                      type="radio"
                      name="species"
                      value={option}
                      checked={species === option}
                      onChange={() => setSpecies(option)}
                    />
                    {speciesCompendium[option].name}
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="creation-species__summary">{selectedSpecies.summary}</p>
            <ul className="creation-species__traits">
              {selectedSpecies.traits.map((trait) => (
                <li key={trait}>{trait}</li>
              ))}
            </ul>
            <button type="submit">Begin Journey</button>
          </form>
        </div>
      </div>
    </section>
  );
}
