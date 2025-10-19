# Manor Restoration & Dream Scribing

## Overview
- The starting board now offers a single slot, **The Manor**, which only accepts persona cards and is used to explore the estate.
- Exploring the manor reveals five damaged sub-rooms. Each is represented by a `manor`-type slot in disrepair and must be restored before its specialist function is available.
- Damaged rooms begin repairs only after a persona activates the slot; progress now advances with each hidden time pulse (≈1 minute) while that persona remains committed.
- Slot actions impose visible downtime: after activation, each room remains busy for its listed recovery period before it can be triggered again.

## Damaged Rooms & Repair Windows
| Damaged Room | Restored Slot | Slot Type | Persona Requirement | Approx. Restoration Time |
| --- | --- | --- | --- | --- |
| Ruined Sanctum | Veiled Sanctum | hearth | Persona must begin repairs and stay assigned | ≈ 2 minutes |
| Ruined Scriptorium | Moonlit Scriptorium | work | Persona must begin repairs and stay assigned | ≈ 3 minutes |
| Ruined Archive | Night Archive Desk | study | Persona must begin repairs and stay assigned | ≈ 2 minutes |
| Ruined Circle | Echoing Circle | ritual | Persona must begin repairs and stay assigned | ≈ 3 minutes |
| Ruined Bedroom | Moonlit Bedroom | bedroom | Persona must begin repairs and stay assigned | ≈ 2 minutes |

> _Time pulses remain hidden during play. Each interval maps to roughly one minute at normal speed; pausing stops the countdown._

## Slot Action Downtimes

| Slot | Action Label | Busy Duration |
| --- | --- | --- |
| Veiled Sanctum (hearth) | Rest | ≈ 1 minute |
| Moonlit Scriptorium (work) | Work | ≈ 2 minutes |
| Night Archive Desk (study) | Study | ≈ 1.5 minutes |
| Echoing Circle (ritual) | Conduct Rite | ≈ 3 minutes |
| Umbral Gate (expedition) | Venture | ≈ 4 minutes |
| The Manor (explore) | Explore | ≈ 1 minute |
| Damaged Manor Rooms (repairs) | Clear/Begins repair | ≈ 2 minutes |
| Moonlit Bedroom (bedroom) | Slumber | ≈ 1.5 minutes |

These downtimes are recalculated whenever game speed changes and pause/resume controls freeze or resume the countdowns.

When a repair completes, the slot transforms into its restored counterpart while retaining the occupying persona. Damaged rooms cannot be upgraded until they are fully restored.

## Moonlit Bedroom & Fleeting Dreams
- Once restored, the **Moonlit Bedroom** lets an assigned persona slumber to create a **Fleeting Dream** card.
- Fleeting Dreams are inspiration cards tagged with `dream` and `fleeting`, lasting for roughly three intervals (≈3 minutes) before they fade.
- Dreams are automatically added to the player’s hand when produced, encouraging rapid follow-up actions before they expire.

## Documenting Dreams in the Night Archive
- The **Night Archive Desk** (study slot) now supports collaborative study: a dream card must share the slot with a persona to unlock special handling.
- Dragging a dream onto the study slot while a persona occupies it assigns that persona as an assistant rather than displacing them.
- Activating the study with a dream-plus-persona pair consumes the fleeting dream and creates a permanent **Private Journal** card tagged with `journal`, `dream-record`, and a `dream:<title>` marker describing the recorded vision.
- Private Journals are added to the hand without a lifetime limit, preserving the dream’s insight for future play.

## Logging & Feedback
- Activating a damaged room logs whether repairs have just begun or are continuing, reinforcing the remaining restoration time.
- Progress and completion of repairs are recorded at the start of each hidden interval, providing feedback on restoration pacing.
- Dream creation and documentation both append flavorful log entries so players can trace the origin of journals in the chronicle.
