# Agent Guidelines

- This repository hosts the HallowMoon PWA. All code should be TypeScript when possible.
- Use npm with a committed `package-lock.json` for dependency management.
- Maintain consistent formatting using Prettier defaults (2-space indentation, semicolons) and ensure ESLint remains clean.
- Ensure any routing or asset paths respect the `/hallowmoon` base path for GitHub Pages.
- When updating the game version, keep the manifest, visible UI version label, and service worker cache version in sync.
- Tests and build commands should be runnable via `npm run lint`, `npm run build`, and `npm run test` (when applicable).
- All screens (battle included) must comfortably fit within a portrait viewport without forcing the primary content below the fold.

