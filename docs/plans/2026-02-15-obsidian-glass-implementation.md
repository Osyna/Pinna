# Obsidian Glass# Pinna App Implementation Plan
> Status: In Progress
> Date: 2026-02-15

## Overview
This document outlines the implementation plan for the **Pinna** application, focusing on the new "Obsidian Glass" design system. The goal is to create a visually stunning, premium, and highly interactive map-based application.

## 1. Project Setup & Foundation
- [x] Initialize Project
    - [x] Setup Vite + Vue 3 + Ionic Framework
    - [x] Configure Sass/SCSS
    - [x] Setup Directory Structure
- [x] Clean Slate
    - [x] Remove default Ionic boilerplate
    - [x] Set up custom `index.html` with correct meta tags
    - [x] Configure `vite.config.js` for alias resolution (`@/`)
- [x] Design System Tokens (`src/theme/variables.scss`)
    - [x] Define Color Palette (Obsidian, Glass variants, Neon accents)
    - [x] Define Typography (Inter/Outfit font families)
    - [x] Define Spacing & Shadows (Glassmorphism effects)
    - [x] Define Animations (Transitions, Keyframes) component. Keep all Vue component logic/templates stable except for minor class additions.

**Tech Stack:** Vue 3 Composition API, Ionic Vue (iOS mode), CSS custom properties, backdrop-filter, Plus Jakarta Sans + Inter fonts

---

### Task 1: Update index.html and theme infrastructure

**Files:**
- Modify: `index.html`
- Modify: `src/composables/useTheme.js:28-30`

**Step 1: Add Plus Jakarta Sans font to index.html**

In `index.html`, add inside `<head>` before `</head>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
```

Update `<meta name="theme-color">` from `#0a0a0f` to `#0D0D12`.

**Step 2: Update useTheme.js meta color**

In `src/composables/useTheme.js`, change line 29:
- From: `const metaColor = theme.value === 'dark' ? '#0a0a0f' : '#ffffff'`
- To: `const metaColor = theme.value === 'dark' ? '#0D0D12' : '#F8F8FC'`

**Step 3: Verify dev server runs**

Run: `npm run dev`
Expected: App loads with no errors

**Step 4: Commit**

```bash
git add index.html src/composables/useTheme.js
git commit -m "chore: update theme-color meta and font preconnect for Obsidian Glass"
```

---

### Task 2: Overhaul global CSS tokens (style.css)

**Files:**
- Modify: `src/style.css`

This is the foundation - replaces all CSS variables with Obsidian Glass values and adds new utility classes.

**Step 1: Replace the `:root` design tokens block (lines 1-51)**

Replace the Google Fonts import AND entire `:root` block with:

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');

/* ─── Obsidian Glass Design Tokens ─── */
:root {
  /* Backgrounds (never pure black) */
  --bg-void: #08080C;
  --bg-primary: #0D0D12;
  --bg-surface: #14141C;
  --bg-raised: #1A1A24;
  --bg-hover: #22222E;

  /* Glass effects */
  --bg-glass: rgba(30, 32, 44, 0.6);
  --bg-glass-light: rgba(40, 42, 56, 0.4);
  --glass-border: rgba(255, 255, 255, 0.08);
  --glass-border-hover: rgba(255, 255, 255, 0.12);
  --glass-highlight: rgba(255, 255, 255, 0.04);

  /* Legacy aliases (components still reference these) */
  --bg-secondary: var(--bg-surface);
  --bg-tertiary: var(--bg-raised);

  /* Accent - Coral */
  --accent: #FF7A5C;
  --accent-hover: #FF9B7A;
  --accent-light: rgba(255, 122, 92, 0.15);
  --accent-glow: rgba(255, 122, 92, 0.25);
  --accent-muted: rgba(255, 122, 92, 0.2);

  /* Semantic */
  --danger: #F87171;
  --danger-hover: #FCA5A5;
  --success: #4ADE80;
  --warning: #FBBF24;
  --info: #60A5FA;

  /* Text */
  --text-primary: #FFFFFF;
  --text-secondary: #A0A4B8;
  --text-muted: #6B6F80;
  --text-disabled: #4A4D5C;

  /* Borders */
  --border: var(--glass-border);
  --border-light: var(--glass-border-hover);

  /* Shadows */
  --shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
  --shadow-lg: 0 8px 40px rgba(0, 0, 0, 0.45);
  --shadow-glow: 0 0 24px rgba(255, 122, 92, 0.2);
  --shadow-elevated: 0 16px 48px rgba(0, 0, 0, 0.5);

  /* Atmospheric */
  --glow-coral: rgba(255, 122, 92, 0.4);
  --glow-ambient: rgba(100, 120, 255, 0.15);

  /* Blur */
  --blur: blur(24px);
  --blur-heavy: blur(40px);

  /* Radius */
  --radius-sm: 8px;
  --radius: 12px;
  --radius-lg: 20px;
  --radius-xl: 28px;
  --radius-2xl: 36px;
  --radius-full: 100px;

  /* Transitions */
  --transition: 200ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
  --transition-spring: 350ms cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);

  /* Spacing (8px grid) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;

  /* Safe areas */
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --safe-left: env(safe-area-inset-left, 0px);
  --safe-right: env(safe-area-inset-right, 0px);

  /* Ionic overrides */
  --ion-background-color: var(--bg-primary);
  --ion-text-color: var(--text-primary);
  --ion-font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif;
  --ion-color-primary: #FF7A5C;
  --ion-color-primary-rgb: 255, 122, 92;
  --ion-color-primary-shade: #E06A4F;
  --ion-color-primary-tint: #FF9B7A;
  --ion-toolbar-background: transparent;
  --ion-item-background: transparent;
}
```

**Step 2: Replace the light theme block (lines 54-115)**

```css
/* ─── Light theme ─── */
[data-theme="light"] {
  --bg-primary: #F8F8FC;
  --bg-surface: rgba(255, 255, 255, 0.92);
  --bg-raised: rgba(240, 240, 248, 0.8);
  --bg-hover: rgba(230, 230, 240, 0.7);
  --bg-glass: rgba(255, 255, 255, 0.75);
  --bg-glass-light: rgba(255, 255, 255, 0.5);
  --bg-secondary: var(--bg-surface);
  --bg-tertiary: var(--bg-raised);
  --glass-border: rgba(0, 0, 0, 0.06);
  --glass-border-hover: rgba(0, 0, 0, 0.1);
  --glass-highlight: rgba(255, 255, 255, 0.8);
  --text-primary: #1a1a2e;
  --text-secondary: #555570;
  --text-muted: #8888a0;
  --text-disabled: #b0b0c0;
  --accent: #FF7A5C;
  --accent-hover: #E06A4F;
  --accent-light: rgba(255, 122, 92, 0.1);
  --accent-glow: rgba(255, 122, 92, 0.2);
  --accent-muted: rgba(255, 122, 92, 0.15);
  --border: var(--glass-border);
  --border-light: var(--glass-border-hover);
  --shadow: 0 2px 16px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.1);
  --shadow-glow: 0 0 20px rgba(255, 122, 92, 0.15);
  --shadow-elevated: 0 16px 48px rgba(0, 0, 0, 0.12);
  --glow-coral: rgba(255, 122, 92, 0.3);

  --ion-background-color: #F8F8FC;
  --ion-text-color: #1a1a2e;
}

[data-theme="light"] ::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.1);
}
[data-theme="light"] ::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.18);
}

[data-theme="light"] .maplibregl-ctrl-group button {
  background: rgba(255, 255, 255, 0.9) !important;
  color: #1a1a2e !important;
  border-color: rgba(0, 0, 0, 0.1) !important;
}
[data-theme="light"] .maplibregl-ctrl-attrib {
  background: rgba(255, 255, 255, 0.85) !important;
  color: #8888a0 !important;
}
[data-theme="light"] .maplibregl-popup-content {
  background: rgba(255, 255, 255, 0.95) !important;
  color: #1a1a2e !important;
  border-color: rgba(0, 0, 0, 0.08) !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12) !important;
}
[data-theme="light"] .maplibregl-popup-anchor-bottom .maplibregl-popup-tip {
  border-top-color: rgba(255, 255, 255, 0.95) !important;
}
[data-theme="light"] .maplibregl-popup-anchor-top .maplibregl-popup-tip {
  border-bottom-color: rgba(255, 255, 255, 0.95) !important;
}
[data-theme="light"] .maplibregl-popup-anchor-left .maplibregl-popup-tip {
  border-right-color: rgba(255, 255, 255, 0.95) !important;
}
[data-theme="light"] .maplibregl-popup-anchor-right .maplibregl-popup-tip {
  border-left-color: rgba(255, 255, 255, 0.95) !important;
}
[data-theme="light"] .maplibregl-popup-close-button {
  color: rgba(0, 0, 0, 0.4) !important;
}
[data-theme="light"] .ambient-orb { opacity: 0.15; }
```

**Step 3: Update the body font-family to include Plus Jakarta Sans**

In the `body` rule, change font-family to:
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif;
```
(Keep Inter as body; Plus Jakarta Sans will be used for headings in components.)

**Step 4: Update ion-modal radius**

Change `--border-radius` from `var(--radius-xl) var(--radius-xl) 0 0` to `var(--radius-xl) var(--radius-xl) 0 0` (keep same reference, but now --radius-xl = 28px instead of 24px).

**Step 5: Update Ionic chip/segment accent references**

In `ion-segment-button`, update:
- `--color-checked: var(--accent);` (already correct, now coral)
- `--indicator-color: var(--accent-light);` (already correct, now coral-tinted)

**Step 6: Update map popup save button**

Change `.pp-save-btn` box-shadow from `rgba(99, 102, 241, 0.3)` to `var(--glow-coral)`.
Change `.pp-cuisine` color from `var(--accent)` to `var(--accent)` (no change needed, already references variable).

**Step 7: Add new global utility classes at the end of style.css**

Append after the `.contain-item` rule:

```css
/* ─── Glass card utility ─── */
.glass-card {
  background: var(--bg-glass);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow), inset 0 1px 0 var(--glass-highlight);
  transition: all 0.3s var(--ease-out);
}

.glass-card:hover {
  border-color: var(--glass-border-hover);
}

/* ─── Ambient glow orbs ─── */
.ambient-glow {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}

.ambient-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.3;
  animation: float 12s ease-in-out infinite;
}

.ambient-orb--coral {
  width: 350px;
  height: 350px;
  background: radial-gradient(circle, var(--accent) 0%, transparent 70%);
  top: -80px;
  right: -80px;
}

.ambient-orb--blue {
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, #4361EE 0%, transparent 70%);
  bottom: -120px;
  left: -120px;
  animation-delay: -4s;
}

@keyframes float {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(30px, -30px) scale(1.05); }
  66% { transform: translate(-20px, 20px) scale(0.95); }
}

/* ─── Staggered entry animation ─── */
.stagger-enter > * {
  opacity: 0;
  transform: translateY(16px);
  animation: stagger-in 0.4s var(--ease-out-expo) forwards;
}
.stagger-enter > *:nth-child(1) { animation-delay: 0ms; }
.stagger-enter > *:nth-child(2) { animation-delay: 50ms; }
.stagger-enter > *:nth-child(3) { animation-delay: 100ms; }
.stagger-enter > *:nth-child(4) { animation-delay: 150ms; }
.stagger-enter > *:nth-child(5) { animation-delay: 200ms; }
.stagger-enter > *:nth-child(6) { animation-delay: 250ms; }
.stagger-enter > *:nth-child(7) { animation-delay: 300ms; }
.stagger-enter > *:nth-child(8) { animation-delay: 350ms; }

@keyframes stagger-in {
  to { opacity: 1; transform: translateY(0); }
}

/* ─── Heading font ─── */
.heading-display {
  font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
  font-weight: 800;
  letter-spacing: -0.03em;
}

/* ─── Reduced motion ─── */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
  .ambient-orb { display: none; }
}
```

**Step 8: Verify build**

Run: `npm run dev`
Expected: App loads. Colors are now coral-accented. Backgrounds are deeper obsidian.

**Step 9: Commit**

```bash
git add src/style.css
git commit -m "feat: overhaul CSS tokens to Obsidian Glass design system with coral accents"
```

---

### Task 3: Redesign App.vue tab bar and add ambient orbs

**Files:**
- Modify: `src/App.vue`

**Step 1: Add ambient glow orbs to template**

In the template, inside `.app-root` div (after the ProfileView and before the offline banner), add:
```html
<!-- Ambient glow (non-map tabs only) -->
<div v-if="activeTab !== 'map'" class="ambient-glow">
  <div class="ambient-orb ambient-orb--coral"></div>
  <div class="ambient-orb ambient-orb--blue"></div>
</div>
```

**Step 2: Update the loading screen**

Change `.auth-loading-text` gradient from indigo to coral:
```css
.auth-loading-text { font-size: 28px; font-weight: 700; color: var(--accent); font-family: 'Plus Jakarta Sans', 'Inter', sans-serif; }
```

**Step 3: Update tab bar styles**

Replace the `.bottom-tabs` and related styles with the new glass tab bar:

```css
.bottom-tabs {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 1100;
  display: flex; align-items: stretch; justify-content: space-around;
  background: var(--bg-glass); backdrop-filter: var(--blur-heavy); -webkit-backdrop-filter: var(--blur-heavy);
  border-top: 1px solid var(--glass-border);
  padding-bottom: var(--safe-bottom); height: calc(64px + var(--safe-bottom));
  box-shadow: 0 -4px 30px rgba(0, 0, 0, 0.2);
}

.tab-btn {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 4px; padding: 8px 4px; background: transparent;
  color: var(--text-muted); font-size: 10px; font-weight: 600; letter-spacing: 0.3px;
  transition: color 0.25s var(--ease-out); position: relative;
}

.tab-btn.active { color: var(--accent); }
.tab-btn:active { transform: none; opacity: 0.7; }

.tab-btn svg {
  width: 24px;
  height: 24px;
  transition: color 0.25s var(--ease-out);
}

.tab-badge {
  position: absolute;
  top: 4px;
  right: calc(50% - 20px);
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  background: var(--danger);
  color: white;
  font-size: 9px;
  font-weight: 700;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(248, 113, 113, 0.4);
}

.tab-indicator {
  position: absolute;
  top: 0;
  width: 24px;
  height: 3px;
  background: var(--accent);
  border-radius: 0 0 3px 3px;
  transition: left 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 0 12px var(--glow-coral);
}
```

**Step 4: Update desktop tab bar styles**

```css
@media (min-width: 769px) {
  .bottom-tabs {
    max-width: 420px; left: 50%; transform: translateX(-50%);
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    border: 1px solid var(--glass-border); border-bottom: none;
  }
}
```

**Step 5: Verify**

Run: `npm run dev`
Expected: Tab bar has glass blur, coral active indicator with glow. Ambient orbs visible on non-map tabs.

**Step 6: Commit**

```bash
git add src/App.vue
git commit -m "feat: add ambient glow orbs and glass tab bar with coral accents"
```

---

### Task 4: Redesign AuthModal.vue

**Files:**
- Modify: `src/components/AuthModal.vue`

**Step 1: Update scoped styles**

Key changes:
- Auth card: glass background with backdrop-filter, `--radius-xl` (28px)
- Logo: coral color, Plus Jakarta Sans font
- Submit button: coral background with `color: #0D0D12` (dark text on coral), `--radius-full` (pill shape), glow shadow
- Inputs: `--bg-surface` background, coral focus ring `box-shadow: 0 0 0 3px var(--accent-muted)`
- Handle suggestions: coral pill chips
- Toggle button: coral color

Update `.auth-overlay` background to `var(--bg-void)`.
Update `.auth-card` background to `var(--bg-glass)`, add `backdrop-filter: blur(20px)`, border to `var(--glass-border)`, radius to `var(--radius-xl)`.
Update `.auth-logo` to `color: var(--accent); font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;`
Update `.auth-submit` to `background: var(--accent); color: #0D0D12; border-radius: var(--radius-full); box-shadow: 0 4px 16px var(--accent-muted);`
Update `.auth-submit:hover:not(:disabled)` to `background: var(--accent-hover); box-shadow: 0 6px 24px var(--glow-coral);`
Update `.field input:focus` to add `box-shadow: 0 0 0 3px var(--accent-muted);`
Update hardcoded indigo references (rgba(99,102,241,...)) to use `var(--accent-light)` and `var(--accent)`.

**Step 2: Verify**

Expected: Auth screen has glass card on void background, coral submit button, coral accents.

**Step 3: Commit**

```bash
git add src/components/AuthModal.vue
git commit -m "feat: redesign AuthModal with Obsidian Glass aesthetics"
```

---

### Task 5: Redesign SearchView.vue

**Files:**
- Modify: `src/components/SearchView.vue`

**Step 1: Update title gradient**

Change `.sv-title` background gradient from `linear-gradient(135deg, #6366f1, #a78bfa)` to `linear-gradient(135deg, #FF7A5C, #FF9B7A)`. Add `font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;`.

**Step 2: Update card styles**

- `.sv-card`: background to `var(--bg-glass)`, backdrop-filter to `blur(16px)`, border-radius to `var(--radius-lg)`, add `inset 0 1px 0 var(--glass-highlight)` to box-shadow
- `.sv-filter-chip.active`: update `rgba(99, 102, 241, 0.3)` to `rgba(255, 122, 92, 0.3)`
- `.sv-mode-chip.active`: same update
- `.sv-card-dist` background/color: already uses variables, will inherit coral

**Step 3: Update hardcoded indigo/orange references**

- `.sv-type-dot.food`: change `#f97316` to `var(--accent)`
- `.sv-type-label.food`: change `#f97316` to `var(--accent)`

**Step 4: Update search input focus**

`.sv-search:focus` border + shadow already references `var(--accent)` and `var(--accent-light)` - will automatically be coral.

**Step 5: Verify**

Expected: Search view has coral title gradient, glass cards, coral filter chips.

**Step 6: Commit**

```bash
git add src/components/SearchView.vue
git commit -m "feat: redesign SearchView with Obsidian Glass cards and coral accents"
```

---

### Task 6: Redesign PlacesView.vue

**Files:**
- Modify: `src/components/PlacesView.vue`

**Step 1: Update title gradient**

Same as SearchView - change `.pv-title` to coral gradient + Plus Jakarta Sans.

**Step 2: Update card styles**

- `.pv-card`: glass background, blur, `--radius-lg`, glass highlight inset
- `.pv-chip.active`: update `rgba(99,102,241,0.3)` to `rgba(255,122,92,0.3)`
- `.pv-action-btn`: glass background, `--radius-lg`

**Step 3: Update context menu**

`.ctx-menu`: glass background is already using variables. Update radius to `var(--radius-lg)`.

**Step 4: Verify**

Expected: Places list has glass cards, coral accents, premium feel.

**Step 5: Commit**

```bash
git add src/components/PlacesView.vue
git commit -m "feat: redesign PlacesView with Obsidian Glass cards"
```

---

### Task 7: Redesign PlaceDetail.vue

**Files:**
- Modify: `src/components/PlaceDetail.vue`

**Step 1: Update overlay and sheet**

- `.detail-overlay`: keep blur backdrop
- `.detail-sheet`: update border-radius to use `--radius-xl` (now 28px), update `background: var(--bg-glass)`, add stronger `backdrop-filter: blur(30px)`
- `.hero-accent` color: already uses `--cat-color` dynamic, keep as-is

**Step 2: Update action buttons**

- `.action-icon` (the purple/indigo show icon): change `rgba(99, 102, 241, 0.12)` to `var(--accent-light)`, color to `var(--accent)`
- `.btn-edit`: update `rgba(99, 102, 241, 0.15)` to `rgba(255, 122, 92, 0.15)`

**Step 3: Update cuisine badge**

`.cuisine-badge` already uses `var(--accent)` and `var(--accent-light)` - auto-updates.

**Step 4: Update tag pills**

`.tag-pill`: add glass border, increase border-radius to `var(--radius-full)`.

**Step 5: Update edit mode inputs**

`.edit-field input:focus`: already references `var(--accent)` - auto-updates to coral.
`.edit-tag`: already references `var(--accent-light)` and `var(--accent)`.

**Step 6: Verify**

Expected: Place detail sheet has deep glass background, coral accents, premium action cards.

**Step 7: Commit**

```bash
git add src/components/PlaceDetail.vue
git commit -m "feat: redesign PlaceDetail sheet with Obsidian Glass"
```

---

### Task 8: Redesign ProfileView.vue

**Files:**
- Modify: `src/components/ProfileView.vue`

**Step 1: Update hero section**

- `.pf-avatar-wrap.editable`: change `border-color: var(--accent)` (now coral)
- `.pf-avatar-fallback`: change gradient from `linear-gradient(135deg, #6366f1, #a78bfa)` to `linear-gradient(135deg, #FF7A5C, #FF9B7A)`
- `.pf-handle-btn`: update `rgba(99, 102, 241, 0.15)` border to `rgba(255, 122, 92, 0.15)`

**Step 2: Update stats section**

Give `.pf-stats` a glass card treatment:
```css
.pf-stats {
  display: flex; align-items: center; justify-content: center;
  margin: 0 20px 20px; padding: 20px;
  background: var(--bg-glass); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border); border-radius: var(--radius-lg);
  box-shadow: var(--shadow), inset 0 1px 0 var(--glass-highlight);
}
```

- `.pf-stat-num`: increase to `font-size: 22px`, add `color: var(--accent)` for place/friend counts (or keep white for joined date)

**Step 3: Update settings card**

`.pf-settings-card`: add glass treatment (backdrop-filter, glass border, `--radius-lg`).

**Step 4: Update buttons**

- `.pf-save-btn`: now coral, already using `var(--accent)`
- `.pf-chip`: update `rgba(99, 102, 241, 0.15)` to `rgba(255, 122, 92, 0.15)`
- `.pf-cuisine-chip.active`: update `var(--accent-glow)` border-color (auto-updates to coral)

**Step 5: Update avatar gradient for friends**

The `fv-avatar` gradient `linear-gradient(135deg, #6366f1, #a78bfa)` in FriendsView needs same coral update.

**Step 6: Verify**

Expected: Profile has glass stats card, coral avatar ring, coral accent throughout.

**Step 7: Commit**

```bash
git add src/components/ProfileView.vue
git commit -m "feat: redesign ProfileView with glass stats and coral accents"
```

---

### Task 9: Redesign FriendsView.vue

**Files:**
- Modify: `src/components/FriendsView.vue`

**Step 1: Update title gradient**

Change `.fv-title` from `linear-gradient(135deg, #6366f1, #a78bfa)` to `linear-gradient(135deg, #FF7A5C, #FF9B7A)` + Plus Jakarta Sans.

**Step 2: Update avatar gradients**

`.fv-avatar`: change from `linear-gradient(135deg, #6366f1, #a78bfa)` to `linear-gradient(135deg, #FF7A5C, #FF9B7A)`.

**Step 3: Update friend cards**

`.fv-friend-card`: glass background with backdrop-filter, `--radius-lg`.

**Step 4: Update tab active state**

`.fv-tab.active`: already uses `var(--accent)` - auto-updates.

**Step 5: Update accept/reject buttons**

Keep green accept, red reject. They already use semantic colors.

**Step 6: Verify**

Expected: Friends view has coral title, coral avatar gradients, glass friend cards.

**Step 7: Commit**

```bash
git add src/components/FriendsView.vue
git commit -m "feat: redesign FriendsView with Obsidian Glass"
```

---

### Task 10: Redesign FriendProfileView.vue

**Files:**
- Modify: `src/components/FriendProfileView.vue`

**Step 1: Update avatar gradient and card styles**

Change avatar gradient from indigo to coral. Update card backgrounds to glass.

**Step 2: Commit**

```bash
git add src/components/FriendProfileView.vue
git commit -m "feat: redesign FriendProfileView with coral accents"
```

---

### Task 11: Redesign AddPlaceModal.vue

**Files:**
- Modify: `src/components/AddPlaceModal.vue`

**Step 1: Update modal styles**

- `.modal`: update background to `var(--bg-glass)`, ensure `backdrop-filter: blur(30px)`, radius now `--radius-xl` (28px)
- `.btn-save`: add `box-shadow: 0 4px 16px var(--accent-muted)`, `border-radius: var(--radius-full)` (pill)
- `.btn-cancel`: `border-radius: var(--radius-full)` (pill)

**Step 2: Verify**

Expected: Add place modal has glass background, pill buttons, coral save button with glow.

**Step 3: Commit**

```bash
git add src/components/AddPlaceModal.vue
git commit -m "feat: redesign AddPlaceModal with Obsidian Glass"
```

---

### Task 12: Redesign AppToast.vue

**Files:**
- Modify: `src/components/AppToast.vue`

**Step 1: Update toast styles**

- `.toast`: update border-radius to `var(--radius-lg)`, add stronger glass effect
- `.toast.success svg`: change to `color: var(--success)` (already correct)
- `.toast.info svg`: change to `color: var(--accent)` (now coral)

**Step 2: Commit**

```bash
git add src/components/AppToast.vue
git commit -m "feat: redesign AppToast with Obsidian Glass"
```

---

### Task 13: Update SearchBar.vue map overlay styles

**Files:**
- Modify: `src/components/SearchBar.vue`

**Step 1: Update search bar glass effect**

Update the floating search bar to use stronger glass effect and coral focus ring. The component likely uses glass background variables already.

**Step 2: Commit**

```bash
git add src/components/SearchBar.vue
git commit -m "feat: update SearchBar with coral focus ring"
```

---

### Task 14: Update MapView.vue marker/control colors

**Files:**
- Modify: `src/components/MapView.vue`

**Step 1: Update marker colors**

Search for hardcoded `#6366f1` references in marker paint properties and update to `#FF7A5C`.

Update cluster circle colors from indigo to coral shades.

**Step 2: Update control button styles**

Map control buttons already use CSS variables and will inherit the new glass/coral values.

**Step 3: Verify**

Expected: Map markers are coral, clusters are coral gradient, controls have glass effect.

**Step 4: Commit**

```bash
git add src/components/MapView.vue
git commit -m "feat: update MapView markers and controls to coral accent"
```

---

### Task 15: Final verification and cleanup

**Step 1: Full visual verification**

Run: `npm run dev`
Check each tab (Map, Search, Places, Friends, Profile), all modals (Add Place, Place Detail, Auth).
Verify:
- Dark theme: obsidian backgrounds, coral accents, glass effects, ambient orbs on non-map tabs
- Light theme: cream backgrounds, coral accents, lighter glass effects
- No remaining indigo (#6366f1) references in component styles
- Reduced motion is respected

**Step 2: Search for remaining hardcoded indigo values**

Run: `grep -r "6366f1\|#6366f1\|99, 102, 241" src/`
Fix any remaining references.

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete Obsidian Glass redesign - coral accents, glass surfaces, ambient effects"
```
