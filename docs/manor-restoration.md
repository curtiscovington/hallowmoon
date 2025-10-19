# Manor Restoration & Dream Scribing

## Overview
- The starting board now offers a single slot, **The Manor**, which only accepts persona cards and is used to explore the estate.
- Exploring the manor reveals five damaged sub-rooms. Each is represented by a `manor`-type slot in disrepair and must be restored before its specialist function is available.
- Damaged rooms begin repairs only after a persona activates the slot; progress then advances once per cycle while that persona remains committed.

## Damaged Rooms & Repair Windows
| Damaged Room | Restored Slot | Slot Type | Persona Requirement | Cycles to Restore |
| --- | --- | --- | --- | --- |
| Ruined Sanctum | Veiled Sanctum | hearth | Persona must begin repairs and stay assigned | 2 cycles |
| Ruined Scriptorium | Moonlit Scriptorium | work | Persona must begin repairs and stay assigned | 3 cycles |
| Ruined Archive | Night Archive Desk | study | Persona must begin repairs and stay assigned | 2 cycles |
| Ruined Circle | Echoing Circle | ritual | Persona must begin repairs and stay assigned | 3 cycles |
| Ruined Bedroom | Moonlit Bedroom | bedroom | Persona must begin repairs and stay assigned | 2 cycles |

When a repair completes, the slot transforms into its restored counterpart while retaining the occupying persona. Damaged rooms cannot be upgraded until they are fully restored.

## Moonlit Bedroom & Fleeting Dreams
- Once restored, the **Moonlit Bedroom** lets an assigned persona slumber to create a **Fleeting Dream** card.
- Fleeting Dreams are inspiration cards tagged with `dream` and `fleeting`, carrying a three-cycle lifespan before they fade.
- Dreams are automatically added to the player’s hand when produced, encouraging rapid follow-up actions before they expire.

## Documenting Dreams in the Night Archive
- The **Night Archive Desk** (study slot) now supports collaborative study: a dream card must share the slot with a persona to unlock special handling.
- Dragging a dream onto the study slot while a persona occupies it assigns that persona as an assistant rather than displacing them.
- Activating the study with a dream-plus-persona pair consumes the fleeting dream and creates a permanent **Private Journal** card tagged with `journal`, `dream-record`, and a `dream:<title>` marker describing the recorded vision.
- Private Journals are added to the hand without a lifetime limit, preserving the dream’s insight for future play.

## Logging & Feedback
- Activating a damaged room logs whether repairs have just begun or are continuing, reinforcing the number of remaining cycles.
- Progress and completion of repairs are recorded at the start of each cycle, providing feedback on restoration pacing.
- Dream creation and documentation both append flavorful log entries so players can trace the origin of journals in the chronicle.
