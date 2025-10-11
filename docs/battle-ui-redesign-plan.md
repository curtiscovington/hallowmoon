# Battle System Redesign Plan

## Vision
- Deliver a **portrait-first battle experience** that feels fast, legible, and tactile on a single mobile screen.
- Reward planning and adaptation through layered mechanics (momentum, reactions, statuses) that create varied turn outcomes.
- Showcase each hero form and enemy archetype with distinctive playstyles, audiovisual feedback, and pacing cues.

## Current System Assessment
- **Linear move sets.** Hero toolkits contain four static moves with minimal mechanical differentiation beyond charge times, limiting decision depth from turn one.【F:src/state/combat.ts†L13-L46】
- **Predictable enemies.** Encounters roll from a small template list and reuse the same three attacks, so repeat battles feel identical aside from stat scaling.【F:src/state/combat.ts†L56-L117】
- **Statuses as quiet math.** Buff/debuff application only adjusts STR/AGI/WIS modifiers and expires silently, providing little player feedback besides log lines.【F:src/state/combat.ts†L208-L284】
- **Queue transparency but little drama.** Pending actions simply count down with identical cards for hero and enemy, missing windows for counterplay or risk-reward choices.【F:src/components/BattleView.tsx†L214-L255】
- **Tall, sequential layout.** The current BattleView stacks entities, timelines, buttons, and full log in one column, exceeding mobile height and burying key info like active turn context.【F:src/components/BattleView.tsx†L40-L303】

## Experience Pillars
1. **Plan the swing.** Telegraphs, momentum, and stance choices should let players set up multi-turn plays and react to enemy tells.
2. **Read at a glance.** A layered UI surfaces turn order, intents, and move tags without scrolling.
3. **Feel the impact.** Critical actions deliver audiovisual and haptic responses, with log details available but not required.
4. **Evolve over time.** Unlocks and enemy archetypes introduce new mechanics (rituals, multi-target, environmental hazards) as players progress.

## Battle Loop (Turn Structure)
1. **Scout Phase (0.5s pause).** Reveal enemy intent badge (attack, setup, disrupt) and any countdowns on the shared timeline.
2. **Planning Phase (player input).** Player selects an action, reaction, or stance adjustment. Momentum bar previews projected swing if conditions are met.
3. **Commit Phase (simultaneous resolution).** Actions resolve based on initiative order, reactions trigger if their conditions occur, and timeline events tick.
4. **Aftermath Phase (auto).** Status durations tick down, momentum swings update, loot/escape prompts trigger if thresholds met.

## Core Systems Redesign
- **Momentum Track.** Replace the binary "your/enemy turn" banner with a tug-of-war meter influenced by action speed, damage dealt, and successful counters. Hitting thresholds unlocks empowered moves or interrupts.
- **Stances & Guard.** Heroes gain three stances (Aggressive, Balanced, Guarded) modifying damage, initiative, and resource gain. Enemy attacks may punish staying in one stance too long.
- **Dual Resources.**
  - *Vigor* fuels physical techniques, regenerating via aggressive stances and combo hits.
  - *Essence* fuels mystical abilities, regenerated on defended turns or via drain effects.
- **Reactions Window.** Moves can slot a reaction (e.g., Parry, Shadow Veil) that auto-triggers if conditions occur within the next turn cycle, trading initiative for defense or utility.
- **Expanded Status Families.** Add visual categories (Boon, Hex, Ailment, Terrain) with unique rules—Terrain effects occupy the middle timeline row, influencing both combatants until cleansed.
- **Dynamic Timeline.** Timeline badges display ETA, target, and effect icon. Players can drag to inspect future turns and long-press to queue counteractions (e.g., spend Essence to disrupt an enemy ritual).

## Player Toolkit Evolution
- **Techniques Grid.** Each hero form equips six moves: three core, two unlockable techniques, and one ultimate. Moves carry tags (Burst, Sustain, Control) to guide combos.
- **Combo Strings.** Landing certain tag sequences within three turns grants a Finisher prompt that consumes Momentum for amplified payoff (e.g., Werewolf executes "Rend + Lunge" to trigger Maul).
- **Reaction Slots.** Two reaction slots shared across encounters allow situational picks (e.g., Quickstep: dodge next physical attack; Blood Ward: reflect next debuff).
- **Signature Ultimates.** Momentum threshold enables a one-per-battle ultimate with cinematic feedback and temporary UI takeover (full-screen vignette, large text overlay, optional vibration).

## Enemy & Encounter Design
- **Archetypes.**
  - *Bruiser:* Builds power over turns; vulnerable to interrupts.
  - *Assassin:* Rapid initiatives with weak defenses; punishable by guards.
  - *Controller:* Applies terrain hazards and debuffs; encourages cleansing and reactions.
  - *Boss:* Multi-phase intent shifts with breakpoint mechanics (e.g., shield break).
- **Intent Variety.** Enemies broadcast upcoming moves with clarity (icon + short verb). Telegraph intensity colors (yellow/orange/red) map to expected damage or disruption.
- **Adaptive AI.** Enemies evaluate hero stance usage and adjust targeting—if player turtles, Controllers deploy pierce debuffs; if aggressive, Bruisers channel counter-crushes.
- **Encounter Modifiers.** Area-specific modifiers (moonlight surges, fog) alter base rules, keeping repeat fights fresh.

## UI & Feedback Blueprint
1. **Header Strip (top 25%).**
   - Hero & enemy portraits flank the momentum track; HP/resources wrap beneath with animated chips.
   - Status carousel scrolls horizontally with color-coded category frames and timers.
2. **Middle Layer Tabs (mid 40%).**
   - `Timeline` tab hosts horizontal initiative bar with drag-to-scrub interactions; telegraphed moves enlarge on hover/press.
   - `Battlefield` tab visualizes terrain effects and reactions queued (cards pinned to their owners).
   - `Log` tab condenses last three events with gesture to expand full modal.
3. **Action & Reaction Tray (bottom 35%).**
   - 2x3 grid for six techniques; long-press reveals detail sheet, tap commits.
   - Reaction slots float above tray with cooldown rings.
   - Retreat/settings buttons sit in a safe-area-aware footer.
4. **Feedback Layer.**
   - Momentum swings pulse the track; interrupts shake telegraphs; ultimates trigger vignette overlay and optional vibration (`navigator.vibrate`).

## Progression & Content Hooks
- **Unlock Flow.** Side quests grant new techniques or reactions; players choose loadouts before battle to emphasize planning.
- **Loot Impact.** Equipment modifies stance effects or resource gains (e.g., Moonstone Charm: +1 Essence on parry success).
- **Narrative Beats.** Story encounters can inject conversation snippets into Scout Phase, giving context before action.

## Implementation Roadmap
1. **System Foundations**
   - Refactor combat state to track momentum, dual resources, stances, and reaction queues.
   - Expand move/status typing to include tags, resource costs, and trigger conditions.
   - Update enemy definitions with archetype metadata and intent scripts.
2. **UI Framework**
   - Split `BattleView` into modular components (header, timeline, battlefield, tray, feedback overlay) with portrait-locked layout.
   - Implement momentum track, technique grid, and reaction slots with responsive CSS variables.
   - Introduce condensed log toast and modal history.
3. **Content Pass**
   - Design hero loadouts per form, including ultimates and reactions.
   - Build enemy archetypes with varied telegraphs, terrain effects, and adaptive logic.
   - Craft encounter modifiers and tutorial surfacing new mechanics.
4. **Polish & Testing**
   - Integrate haptics, SFX cues, and animation states for major events.
   - Conduct accessibility review (contrast, voiceover announcements, vibration toggles).
   - Playtest pacing, ensuring battles resolve in ~6–8 turns with meaningful decision points each round.
