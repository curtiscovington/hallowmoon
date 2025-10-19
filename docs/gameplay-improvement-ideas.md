# Gameplay Review & Improvement Ideas

## Current Loop Snapshot
- **Character creation** currently offers only two species choices, Werewolf or Vampire, so the opening decision space is narrow.【F:src/components/CharacterCreation.tsx†L5-L55】
- **Base restoration** now starts at the shuttered manor: exploring The Manor reveals ruined rooms (sanctum, scriptorium, archive, circle, bedroom) that demand persona-driven repairs across multiple time pulses before their familiar stations unlock.【F:src/state/GameContext.tsx†L100-L208】【F:docs/manor-restoration.md†L4-L38】
- **World exploration** is limited to three static map nodes (village, forest, ruins) with a couple of fixed actions, which constrains variety between sessions.【F:src/components/WorldMap.tsx†L6-L50】
- **Hero kits** consist of a small, predefined move list per species, so abilities never evolve beyond the initial four actions you start with.【F:src/state/combat.ts†L12-L66】
- **Economy** now includes the Moonlit Market in Silverfen Village, letting players trade coins for restorative brews and permanent stat boons, but inventory is limited to a tiny rotating stock so long-term goals remain sparse.【F:src/components/WorldMap.tsx†L7-L27】【F:src/components/MoonlitMarket.tsx†L1-L79】【F:src/state/GameContext.tsx†L40-L135】
- **Enemy diversity** is thin: each location pulls from a single template that scales with level, keeping encounters predictable.【F:src/state/combat.ts†L82-L192】

## Improvement Opportunities

### 1. Deepen Character Identity & Buildcrafting
- Add new supernatural lineages (e.g., wraith, hunter) and let players unlock them through milestones, broadening replay value beyond the two current archetypes.【F:src/components/CharacterCreation.tsx†L5-L55】
- Introduce move progression or talent trees so heroes earn new abilities or modifiers every few levels instead of staying with the same static four skills.【F:src/state/combat.ts†L12-L66】
- Layer species-exclusive mechanics (rage meters, blood reserves, lunar blessings) that charge during battles and convert into powerful situational moves.

### 2. Create a Living Economy
- Expand the Moonlit Market with rotating rarities, lineage-specific gear, or services that unlock after notable victories to keep shopping exciting across runs.【F:src/components/MoonlitMarket.tsx†L1-L79】【F:src/state/GameContext.tsx†L40-L135】
- Let players invest coins into permanent upgrades (den improvements, familiars) or risk them in roguelite gambles to add push-your-luck decisions.【F:src/state/GameContext.tsx†L379-L410】
- Add resource sinks tied to rest or travel—e.g., paying for a healer to restore HP instantly versus taking a longer rest that advances world events.【F:src/state/GameContext.tsx†L287-L302】

### 3. Expand the World Map Into an Adventure Layer
- Seed additional locations with branching unlock criteria (scouting missions, completing prior encounters) so the overworld feels like a campaign instead of a menu.【F:src/components/WorldMap.tsx†L6-L50】
- Mix in dynamic events—ambushes, moon phases altering available actions, NPC requests—to make each visit to the map feel different.
- Allow multi-step journeys where entering a hostile zone chains a series of encounters, letting players choose routes that balance risk and reward.

### 4. Enrich Encounter Variety & Tactical AI
- Author multiple enemy templates per biome, including elites with bespoke move sets or support creatures that change how you prioritize targets.【F:src/state/combat.ts†L82-L192】
- Add encounter modifiers (misty night reduces visibility, blood moon boosts crit rates) that pull from a rotating deck to keep battles unpredictable.
- Teach enemies to respond to player buffs/debuffs—e.g., cleansing their debuffs or focusing on interrupting long-channel hero actions—so combat reads more reactive.【F:src/state/combat.ts†L132-L190】

### 5. Layered Training & Downtime Choices
- Break training into specialized drills with mini challenges or QTEs that grant bonus XP when performed skillfully, making downtime interactive.【F:src/state/GameContext.tsx†L226-L283】
- Offer alternative downtime activities (crafting, research, social scenes) that trade energy for unique boons instead of always yielding +1 to a stat.【F:src/state/GameContext.tsx†L226-L283】
- Introduce injuries or fatigue systems where overtraining risks temporary debuffs, nudging players to balance growth with recovery.【F:src/state/GameContext.tsx†L287-L302】

### 6. Add Combat Depth & Feedback
- Implement synergy systems (combo tags, status detonations) so stacking certain buffs/debuffs amplifies future moves, rewarding planning beyond single turns.【F:src/state/combat.ts†L238-L260】
- Provide counterplay tools like interrupts or reactive defenses that consume pending hero actions to block enemy wind-ups, making the timeline UI more strategic.【F:src/components/BattleView.tsx†L74-L143】【F:src/state/combat.ts†L400-L470】
- Expand the battle log with iconography or highlight animations to emphasize critical hits, evasions, and expiring statuses, reinforcing readability during longer fights.【F:src/components/BattleView.tsx†L30-L143】
