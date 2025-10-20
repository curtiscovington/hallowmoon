# HallowMoon UI Design Guidelines

## Purpose
These guidelines capture the shared visual and interaction language for the HallowMoon progressive web app. They exist to keep future features consistent, accessible, and performant across desktop and mobile. Treat them as a living reference—when a new component or pattern emerges, extend this document rather than reinventing the wheel.

## Core Principles
1. **Portrait-first play.** Every primary experience must be operable without rotation on a 360×780 viewport. Design for thumb reach, short reach distances, and single-hand usage before scaling upward.
2. **Glanceable state.** Players should parse time-sensitive information (timers, resource deltas, enemy intent) in under two seconds. Use progressive disclosure to hide optional details behind toggles or sheets.
3. **Tactile feedback.** Animate changes with concise, purpose-driven motion (150–250 ms) that reinforces cause and effect—never purely decorative.
4. **Frictionless recovery.** Provide clear undo, cancel, and confirmation affordances. Modal disruptions are last resorts; prefer inline toasts or drawers that keep context visible.

## Accessibility & Legibility
- Maintain WCAG 2.1 AA contrast (4.5:1 for body text, 3:1 for large text/icons). Validate new palettes against both light and dark themes if offered.
- Base body text at 16 px (1 rem) minimum. Interactive labels (buttons, chips, timers) must reach 15 px (0.94 rem) or larger.
- Ensure tap targets are at least 44 px × 44 px and include a focused/active state for keyboard users.
- Announce time-based events (`aria-live="polite"`) only when they materially affect the user’s decisions; avoid noisy announcements every hidden time pulse.
- All motion must respect the `prefers-reduced-motion` media query. Provide non-animated fallbacks for critical affordances.

## Layout & Spacing
- Use a 4 px spacing grid. Space tokens, chips, and cards by multiples of 8 px on mobile, 12 px on desktop.
- Guard the main play field with 20 px horizontal padding on mobile, 24–32 px on desktop.
- Keep headers and sticky toolbars under 96 px tall to preserve vertical play space.
- Avoid nested scroll containers. When overflow is required, prefer full-height drawers or modals that respect safe-area insets.

## Typography
- Font scale: 12 px (caption), 14 px (meta), 16 px (body), 18 px (subhead), 22 px (section title). Deviate only for branding moments.
- Use sentence case for UI labels. Reserve uppercase for tokens or badges where brevity is essential.
- Align text left within cards and data tables; center only standalone numbers or icons.

## Color & Visual Language
- Reserve saturated accent colors for interactive elements (buttons, toggles, draggable items). Neutral tones (gray/blue slate) back structural containers.
- Communicate status via consistent hues:
  - Success/positive: emerald spectrum.
  - Warning/time pressure: amber.
  - Danger/blocked: crimson.
  - Passive/locked: desaturated lavender.
- Apply subtle depth (4 px blur, 10% opacity) for elevated cards. Avoid heavy drop shadows on mobile to reduce rendering cost.
- Outline interactive zones with 1 px borders at 30% opacity; increase to 2 px + glow for focused/keyboard state.

## Component Patterns
- **Header bars:** Split resource and control clusters. On mobile, collapse secondary clusters (settings, speed) into drawers or sticky footers.
- **Cards:** Use 12 px corner radius, 16 px internal padding, and a dedicated footer row for meta (duration, traits). Limit live text length to two lines before truncation.
- **Drawers & sheets:** Slide from edge corresponding to their context (chronicle/log from right on desktop, bottom on mobile). Provide a drag handle and close button. The player hand remains docked as a bottom drawer anchored to the viewport edge: keep the toggle pill visible when closed for instant reopening, and expose an inline close control when expanded.
- **Time controls:** Keep the floating timer bar to a single row. Pair a pause/resume icon button with inline speed chips, and avoid manual "advance" actions beyond unpausing.
- **Buttons & chips:** Primary buttons carry solid fill and drop shadow; secondary/tertiary use ghost or outline styles. Chips display icon + label; wrap overflow with ellipsis rather than stacking.
- **Timers:** Present both countdown text and visual progress when an action can expire. Freeze progress bars when time is paused.
- **Slot cards:** Prefix card headers with a type badge (icon + uppercase label) tinted to match the slot purpose—amber for work, cyan for study, rose for hearth, violet for ritual, and mint for expeditions. Mirror the tint inside empty dropzones so players can identify compatible slots at a glance while keeping occupied zones in a neutral indigo fill.
- **Location reveal overlay:** When a slot unlocks mid-session (e.g., new manor rooms), pause time, center the reveal in a modal card with its badge, and require a single confirmation to anchor it. Animate the card's return to its grid position; if the player prefers reduced motion, skip the travel animation but maintain the pause and acknowledgement step.

## Interaction Patterns
- Highlight drag sources with a shadow and scale (max 1.02). Drop targets should glow subtly once a compatible item hovers.
- Provide haptic-friendly cues: on mobile, align audio or vibration with significant events (interval completion, card unlock).
- Use optimistic UI updates for card assignments and slot upgrades, rolling back only when persistence fails.
- Surface destructive actions with confirmation dialogs and a secondary escape route (e.g., swipe to cancel).

## Responsiveness
- Define breakpoints at 600 px (compact), 900 px (medium), and 1200 px (wide). Components may reflow but should never hide critical actions.
- Maintain horizontal scrolling for dense inventories rather than multi-column grids below 600 px.
- Respect safe-area insets (`env(safe-area-inset-*)`) for notched devices when positioning headers/footers.
- Use CSS container queries for component-specific adjustments whenever possible instead of relying solely on global breakpoints.

## Asset & Iconography
- Export SVG icons optimized under 24 KB. Use strokes where possible to allow easy color inheritance.
- Raster art (backgrounds, hero portraits) should include 1× and 2× resolutions. Serve via `image-set` with lazy loading for non-critical assets.
- Keep animation spritesheets under 1 MB; prefer Lottie or CSS animations for lightweight effects.

## Documentation & Process
- Update this document whenever a new component or exception is introduced. Note the rationale and intended scope.
- Reference the relevant section in PR descriptions when introducing UI changes.
- Pair each significant UI change with before/after screenshots sized for mobile and desktop breakpoints.
- Schedule quarterly audits comparing shipped UI to these guidelines; log deviations and align the backlog accordingly.
