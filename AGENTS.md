# Agent Guidelines
- This repository hosts the HallowMoon PWA. All code should be TypeScript when possible.
- Use npm with the committed `package-lock.json` for dependency management.
- Maintain consistent formatting using Prettier defaults (2-space indentation, semicolons) and ensure ESLint remains clean.
- Ensure any routing or asset paths respect the `/hallowmoon` base path for GitHub Pages.
- When updating the game version, keep the manifest, visible UI version label, and service worker cache version in sync.
- All screens (battle included) must comfortably fit within a portrait viewport without forcing the primary content below the fold.
- Follow the UI standards in `docs/design-guidelines.md` for any visual or interaction changes. Reference the relevant sections in your PR summaries and attach before/after screenshots for significant UI updates.
- Keep `docs/design-guidelines.md` current—extend it whenever a new reusable pattern or exception is introduced, and note why the addition is necessary.
- Ensure all game design documentation stays current whenever mechanics or loops change.
