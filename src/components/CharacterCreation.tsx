import React from 'react';
import { useGame } from '../state/GameContext';
import { Species } from '../state/types';

const speciesOptions: Species[] = ['Werewolf', 'Vampire'];

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

  return (
    <section className="card creation-card">
      <div>
        <h2 className="card__title">Create Your Legend</h2>
        <p className="card__description">
          Choose your nature beneath the moon. Each path offers unique talents in battle.
        </p>
      </div>
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
        <div className="creation-species">
          <span className="field-label">Species</span>
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
                {option}
              </label>
            ))}
          </div>
        </div>
        <button type="submit">Begin Journey</button>
      </form>
    </section>
  );
}
