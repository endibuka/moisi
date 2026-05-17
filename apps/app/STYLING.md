# STYLING.md

Styling guide for this project. Follow it when building or editing any UI so
the site stays visually consistent. The design is a dark, music-app marketing
site (Moises-style) built from Figma.

## Stack

- **Next.js 16 App Router** + React 19 + TypeScript.
- **Tailwind CSS v4** (configured via `@import "tailwindcss"` in
  `app/globals.css`; theme tokens live in the `@theme inline` block).
- **`motion`** (framer-motion) for animation — count-ups, in-view reveals,
  slide transitions.
- No component/UI library. Build with plain elements + Tailwind classes.

## Theme

The app is **always dark** — there is no light mode. Do not add
`prefers-color-scheme` overrides.

- App background: `#000000`.
- Default text: `--foreground` = `#ededed`.

## Color tokens

| Use                          | Value                                    |
| ---------------------------- | ---------------------------------------- |
| Page background              | `#000000`                                |
| Card / surface               | `#0e0f11`                                |
| Glassy surface               | `rgba(14,15,17,0.8)` + `backdrop-blur`   |
| Faint inner surface          | `rgba(252,252,253,0.05)`                 |
| Primary text                 | `#ffffff` / `#fcfcfd`                    |
| Muted text                   | `rgba(252,252,253,0.6)` / `rgba(255,255,255,0.6)` |
| Very dim text                | `rgba(252,252,253,0.3)`                  |
| Card border                  | `rgba(252,252,253,0.1)`                  |
| Faint border                 | `rgba(252,252,253,0.03)`                 |
| Divider line                 | `#3b3b3b`                                |
| Accent — cyan                | `#00dae8` (primary), `#00efff` (glow)    |
| Accent — green               | `#0affa7`                                |
| Text on cyan accent          | `#001316`                                |

Accent slider/progress fill uses the gradient `from-[#00dae8] to-[#0affa7]`.

## Typography

- Font: **Geist Sans** (`var(--font-geist-sans)`), loaded in `app/layout.tsx`.
- Display headings: `73px` (hero), `59px` (section titles) — regular weight,
  tight tracking (`-1.6px` / `-1.28px`), line-height ~`64–80px`.
- Sub-headings: `30–37px`, tracking `-0.8px`.
- Body / nav / labels: `15–18px`, `font-medium`.
- Small print: `12–13px`.
- Muted body copy uses the muted-text colors above.
- For oversized hero numbers/headings prefer fluid sizing:
  `text-[clamp(min,vw,max)]`.

## Layout

- Page max width: `max-w-[1920px]`, centered with `mx-auto`.
- Section horizontal padding: `px-8` (footer uses `px-20`).
- Vertical rhythm: sections use `py-10`/`py-16`; the gap below the hero is `33px`.
- Multi-card rows: CSS grid, `gap-6`, collapse to one/two columns below `lg`.

## Shape & surfaces

- Large cards / hero: `rounded-[32px]`.
- Medium panels: `rounded-[24px]`.
- Inner blocks: `rounded-[20px]`.
- Buttons, chips, pills, dots: `rounded-full`.
- Cards carry a `1px` border in `rgba(252,252,253,0.1)`.

## Buttons

- **Primary (light):** `bg-white text-black rounded-full`, ~`h-10`–`h-[52px]`,
  `hover:opacity-90`.
- **Accent:** `bg-[#00dae8] text-[#001316] rounded-full`.
- **Outline:** `border border-[rgba(255,255,255,0.15)] text-white rounded-full`,
  `hover:bg-white/5`.
- All interactive elements get a `transition` + subtle hover (opacity or color).

## Effects

- **Header:** sticky, `backdrop-blur-[12px]`, soft top-to-transparent gradient,
  hides on scroll-down / reveals on scroll-up.
- **Ambient glows:** cyan mesh built from layered `radial-gradient`s, low
  opacity (`~0.1–0.3`) and heavy `blur` (`120px`+). Keep them soft — never a
  hard-edged block.
- **Gradients:** prefer multi-stop fades to transparent rather than sharp stops.
- Motion: ease-out curves (`[0.22, 1, 0.36, 1]`), durations `0.3–0.5s`;
  scroll-triggered animations use `useInView` and run `once`.

## Component conventions

- One component per file in `components/`, `PascalCase` name, default export.
- Add `"use client"` only when the component needs state/effects/animation.
- Imports use the `@/` alias (e.g. `@/components/Header`).
- **Images:** raster (`.jpg`/`.png`) via `next/image`; SVGs via a plain
  `<img>` tag (with the eslint-disable comment) or inline `<svg>`.
  `next.config.ts` sets `images.dangerouslyAllowSVG: true`.
- Local assets live in `public/` (grouped in sub-folders, e.g.
  `public/awards/`, `public/community/`, `public/icons/`).

## Figma-to-code

When translating a Figma node: keep the exact colors, radii, fonts and
spacing, but **convert absolute-positioned Figma layouts into responsive
flex/grid** — never ship the raw absolute coordinates.
