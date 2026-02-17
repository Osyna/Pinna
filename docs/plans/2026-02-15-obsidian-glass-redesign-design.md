# Pinna - "Obsidian Glass" Design System
> Date: 2026-02-15
> Status: APPROVED

## 1. Brand Identity & Philosophy
**Name:** Pinna
**Core Philosophy:** "Darkness reveals light."
**Aesthetic:** Ultra-premium, futuristic yet grounded, tactile, depth-focused.
**Key Metaphor:** Obsidian stone viewed through smart glass. Use of deep blacks, glossy reflections, and vibrant neon accents that feel like light refraction.

## 2. Color Palette
The palette is built on deep, rich darks and vibrant, glowing accents.

### Primary (The Void)
- `Obsidian Black`: `#0a0a0a` (Backgrounds, base layers)
- `Charcoal Glass`: `#161616` (Cards, panels - 80% opacity)
- `Onyx Surface`: `#202020` (Hover states, secondary surfaces)

### Dark Theme Tokens

| Token | Old | New |
|-------|-----|-----|
| --bg-void | n/a | #08080C |
| --bg-deep (primary bg) | #0a0a0f | #0D0D12 |
| --bg-surface | rgba(22,22,30,0.92) | #14141C |
| --bg-raised | rgba(40,40,55,0.7) | #1A1A24 |
| --bg-hover | n/a | #22222E |
| --glass-bg | n/a | rgba(30,32,44,0.6) |
| --glass-bg-light | n/a | rgba(40,42,56,0.4) |
| --glass-border | n/a | rgba(255,255,255,0.08) |
| --glass-border-hover | n/a | rgba(255,255,255,0.12) |
| --glass-highlight | n/a | rgba(255,255,255,0.04) |
| --accent-primary | #6366f1 | #FF7A5C |
| --accent-secondary | #818cf8 | #FF9B7A |
| --accent-muted | n/a | rgba(255,122,92,0.2) |
| --text-primary | #f0f0f5 | #FFFFFF |
| --text-secondary | #a0a0b8 | #A0A4B8 |
| --text-tertiary | #606078 | #6B6F80 |
| --text-disabled | n/a | #4A4D5C |
| --glow-coral | n/a | rgba(255,122,92,0.4) |
| --glow-ambient | n/a | rgba(100,120,255,0.15) |

### Light Theme

Inverted: cream/white backgrounds, same coral accent, lighter glass effects with reduced blur.

### Border Radius

- Cards: 12px -> 20px
- Large panels/modals: 16px -> 28px
- Buttons: 12px -> 100px (pill)
- Small elements: 8px
- Inputs: 12px

## Component Design

### Tab Bar (Bottom Navigation)

- Frosted glass: rgba(30,32,44,0.6) + blur(20px) + top border rgba(255,255,255,0.08)
- Active: coral icon + coral glow dot
- Inactive: #6B6F80
- Icons: 24px, smooth color transition
- Active label: font-weight 600, coral
- Safe area padding preserved

### Map View (Minimal Changes)

- Search bar: glass card style, coral focus ring
- Control buttons: glass circles, coral active state
- Markers: coral with white stroke, glow on selected
- Clusters: coral gradient
- Bottom sheet: glass card, 28px top radius, spring animation

### Place Cards

- Glass card: backdrop-filter blur(20px), rgba(255,255,255,0.08) border
- 20px radius, inset top highlight
- Thumbnail: 12px radius
- Category tag: coral pill
- Hover: translateY(-2px) + elevated shadow
- Staggered entry: 50ms delay between cards

### Search

- Glass search input with coral focus ring
- Results: glass cards with stagger animation
- Recent searches: muted text, coral icon
- Category filters: glass pill chips, coral active

### Modals

- Backdrop: rgba(8,8,12,0.8) + blur(20px)
- Body: glass card, 28px top radius
- Handle: rgba(255,255,255,0.2) pill
- Inputs: #14141C bg, glass border, coral focus glow
- Primary buttons: solid coral, dark text, glow shadow
- Secondary buttons: glass outline, white text

### Profile & Friends

- Avatar: coral ring indicator
- Stats: glass stat cards, large coral numbers
- Settings: glass list rows, subtle separators
- Friends: glass cards, green glow online dot
- Actions: coral accept, glass decline

## Ambient Effects

- Floating gradient orbs on Search/Places/Friends/Profile tabs
- Coral orb (top-right) + blue orb (bottom-left)
- 12s float cycle, pointer-events: none, fixed position
- Hidden on Map tab

## Animations

- Card stagger: translateY(20px)->0, 50ms stagger
- Tab transitions: opacity + translate
- Button press: scale(0.97)
- Modal: slide up with spring easing
- Respect prefers-reduced-motion

## Typography

- Body: Inter (keep)
- Display: Plus Jakarta Sans (add)
- Large headings: letter-spacing -0.02em
- Labels: uppercase + letter-spacing 0.1em

## Files to Modify

1. **src/style.css** - Complete token overhaul, new global classes
2. **src/App.vue** - Tab bar redesign, ambient orbs component
3. **src/components/MapView.vue** - Map controls, search bar, markers styling
4. **src/components/SearchBar.vue** - Glass input styling
5. **src/components/SearchView.vue** - Glass cards, stagger animation
6. **src/components/PlacesView.vue** - Glass place cards, filters
7. **src/components/PlaceDetail.vue** - Glass modal, form inputs
8. **src/components/ProfileView.vue** - Stats cards, settings list
9. **src/components/FriendsView.vue** - Friend cards, request actions
10. **src/components/FriendProfileView.vue** - Glass profile card
11. **src/components/AuthModal.vue** - Glass auth form
12. **src/components/AddPlaceModal.vue** - Glass form modal
13. **src/components/AppToast.vue** - Glass toast notifications
14. **index.html** - Add Plus Jakarta Sans font
