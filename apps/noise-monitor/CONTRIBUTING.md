# Contributing to Noise Monitor

This app is `apps/noise-monitor` inside the [Teacher Toolkit](../../README.md)
monorepo. **Repo-wide process lives in the root
[CONTRIBUTING.md](../../CONTRIBUTING.md)** — setup, code standards, testing
requirements, PR and release process all apply here. This file only covers what
is specific to this app.

## Why this app has a build step

Every other tool in the toolkit is plain static HTML. Noise Monitor earns
React + Vite + TypeScript because it does real-time microphone analysis and
drives eight animated SVG themes off that signal. Don't take it as licence to
add a framework to a new tool — see
[docs/CODEMAPS/tool-pattern.md](../../docs/CODEMAPS/tool-pattern.md).

## Setup

Run from the **repository root**; the npm workspace owns the install.

```bash
npm install                  # installs all workspaces
npm run dev:noise-monitor    # http://localhost:3000
npm run build                # builds the whole toolkit into ../../dist
npm test                     # Playwright suite, against dist/
```

## Layout

```
src/
├── main.tsx                 entry
├── App.tsx                  top-level state
├── types.ts                 shared types + the tuned defaults (see below)
├── components/
│   ├── NoiseMonitor.tsx     the main screen
│   ├── ThemeSelector.tsx    theme registry + previews
│   ├── Settings.tsx         thresholds, delays, alert options
│   └── SoundSelector.tsx    alarm sound picker
├── hooks/
│   ├── useAudio.ts          microphone capture and level
│   ├── useTTS.ts            spoken alerts
│   └── useSettings.ts       persistence
├── themes/                  one component per visual theme
└── utils/
    ├── noiseCalculator.ts   dB calculation
    └── soundGenerator.ts    built-in alarm tones
```

## Things in `types.ts` that are tuned, not arbitrary

Change these only with a reason, and say what it is in the PR:

- `WHO_RECOMMENDATIONS` — threshold dB values taken from WHO classroom
  guidance, which is also what `apps/research/index.html` cites for this tool.
  Changing them changes a claim the research page makes.
- `DEFAULT_DELAYS` (`upDelay: 2`, `downDelay: 4`) — hysteresis so a single
  cough doesn't trip the alarm and the display doesn't flicker. A past bug had
  the delay timer gating only the too-loud alert and not the theme visuals, and
  another left an orphaned timer that let the monitor commit early.
- `AlertType` (`'sound' | 'voice' | 'both'`) — exists because the original
  behaviour fired both with no way to choose.

## Adding a theme

Themes are React components in `src/themes/`. There are two prop shapes, for
historical reasons:

- `ThemeProps` — raw `noiseLevel`, `threshold`, `isTooLoud`, plus `customImages`
  and optional `backgroundColor`. Used by Egg, Egg Classic, Glass, Custom.
- `NewThemeProps` — a bucketed `level: 'quiet' | 'moderate' | 'loud' | 'tooLoud'`
  and optional `intensity`. Used by Thermometer, Battery, Weather, Volcano.

Prefer `NewThemeProps` for anything new: the bucketing already respects the
configured thresholds and delays, so your theme can't disagree with the rest of
the UI about how loud the room is.

```tsx
export function YourTheme({ level, intensity }: NewThemeProps) {
  return <svg>{/* animation driven by level */}</svg>
}
```

Then:

1. Add your id to the `Theme` union in `src/types.ts`.
2. Import it in `src/components/ThemeSelector.tsx`, add an entry to the `themes`
   array (id, name, description, preview), and add a `case` to
   `renderMiniTheme()` so the picker preview works.
3. Render it where the active theme is switched on.

Check it at all four levels — a theme that is beautiful when quiet and
illegible at `tooLoud` is worse than no theme, because the moment it matters is
the moment it stops communicating.

## Testing this app

The repo's smoke test loads the built app and fails on any uncaught exception.
Beyond that, test by hand in a real room:

- Mic permission denied, and permission granted then revoked mid-session.
- Projector/fullscreen, where this normally runs.
- A sustained spike versus a one-second bang — the delays should swallow the bang.
- Several alarms in a row, confirming audio does not die (see `TKAudio` in the
  root contributing guide for why that failure mode exists).

## Good areas to contribute

- New visual themes
- Additional alarm sounds
- Accessibility: contrast, motion sensitivity, screen-reader labels
- Translations
- Mobile/tablet layout
