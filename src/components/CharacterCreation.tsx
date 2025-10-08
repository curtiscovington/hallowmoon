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
    <section className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h2>Create Your Legend</h2>
      <p style={{ opacity: 0.8 }}>
        Choose your nature beneath the moon. Each path offers unique talents in battle.
      </p>
      <form onSubmit={handleSubmit} className="grid">
        <label htmlFor="name">Name</label>
        <input
          id="name"
          name="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Moonlit hero"
          required
          maxLength={24}
        />
        <div>
          <span style={{ display: 'block', marginBottom: '0.5rem' }}>Species</span>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {speciesOptions.map((option) => (
              <label key={option} style={{ cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="species"
                  value={option}
                  checked={species === option}
                  onChange={() => setSpecies(option)}
                  style={{ marginRight: '0.35rem' }}
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
