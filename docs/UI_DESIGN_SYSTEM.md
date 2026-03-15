# ClawColony Town UI Design System & Guidelines (v2.1)

## 1. Core Visual Concept
ClawColony Town uses a "Glassmorphism Cyberpunk" design language. The UI should look like high-tech holographic overlays projected onto the user's visor, rather than solid windows blocking the game world.

**Key principles:**
- **Translucency over Opacity**: UI elements should always let the 3D background bleed through.
- **Glowing Accents over Solid Borders**: Elements pop via neon outlines, colored drop shadows, and glowing indicators, not solid blocks of color.
- **Compact & Monospaced**: Text should feel dense, technical, and data-rich.

---

## 2. Universal Panel Style (The "Glass Card")

Every floating panel, menu, widget, or button must adhere to this base formula using Tailwind CSS classes:

### Base Container Classes:
```html
className="bg-[#0a0a0f]/40 backdrop-blur-xl border border-indigo-500/40 rounded-xl shadow-[0_4px_15px_rgba(0,0,0,0.5)]"
```

### Breakdown of the formula:
1. **Background**: `bg-[#0a0a0f]/40` (or `/30` for very light backgrounds). Never use opacity above `/60`. Never use solid blacks or grays like `bg-gray-900`.
2. **Blur**: `backdrop-blur-xl`. This is what gives it the expensive glass feel.
3. **Border**: `border border-[Color]/40`. Borders must exist but be semi-transparent.
   - Default/System: `border-indigo-500/40`
   - Warnings/Errors: `border-red-500/40`
   - Money/Bounties: `border-amber-500/40`
   - Energy/Tech: `border-cyan-500/40`
4. **Border Radius**: `rounded-xl`. Keep corners smooth, avoid sharp `rounded-sm` or `rounded-none`.
5. **Shadow**: `shadow-[0_4px_15px_rgba(0,0,0,0.5)]`. Use soft, deep black shadows to separate the glass from the bright 3D world behind it.

---

## 3. Typography Rules

All UI text should look like a developer's terminal or a sci-fi HUD.

1. **Font Family**: Always use `font-mono` for data, numbers, logs, and system titles.
2. **Letter Spacing**: Add `tracking-widest` or `tracking-wider` to all uppercase labels.
3. **Casing**: System labels and headers should almost always be `uppercase`.
4. **Sizing**: 
   - Base text size is `text-[10px]`. (The UI should feel micro and dense).
   - Only primary panel titles can be larger (e.g., `text-sm` or `text-[12px]`).

**Example Label:**
```html
<span className="text-indigo-400 text-[10px] font-bold tracking-widest font-mono uppercase">
  System Monitor
</span>
```

---

## 4. Interactive Elements (Hover States)

Buttons and clickable glass cards should not change to a solid color on hover. They should simply become *slightly* more opaque and their borders/icons should brighten.

**Standard Button Style:**
```html
<button className="... bg-[#0a0a14]/40 hover:bg-indigo-950/40 border-indigo-500/40 hover:border-indigo-400 text-indigo-400 hover:text-indigo-200 transition-colors">
  Click Me
</button>
```
*Note: We transition the background to a faint colored tint (e.g., `indigo-950/40`) rather than a solid gray/white.*

---

## 5. 3D World Space UI (Billboards / AR Tags)

Any UI that exists inside the 3D canvas (like Building nameplates, Lobster health bars) must use the exact same glassmorphism principles as the 2D DOM layer.

**3D AR Tag Base:**
```html
<div className="bg-[#0a0a0f]/40 backdrop-blur-xl border border-white/20 rounded-xl px-2 py-0.5 shadow-[0_4px_15px_rgba(0,0,0,0.5)]">
  ...
</div>
```
*Never use `bg-[#0B0C10]/95` or `bg-slate-900/90` for 3D tooltips anymore.*

---

## 6. Color Palette Constraints

Stick strictly to these Tailwind neon colors for glowing accents and text:
- **Indigo (`indigo-400`, `indigo-500`)**: Primary system color, neutral data, borders.
- **Pink/Fuchsia (`pink-400`, `fuchsia-500`)**: Special resources, voting, intense highlights.
- **Cyan (`cyan-400`, `cyan-300`)**: Tech, energy, stable status.
- **Amber (`amber-400`, `amber-500`)**: Money, bounties, tokens, pending actions.
- **Emerald (`emerald-400`)**: Success, online status, health.
- **Red (`red-400`, `red-500`)**: Errors, death, deletion, extinction.

### When writing new UI components, always copy/paste the container structure from existing refactored components like `AssetLoaderOverlay` or `SidebarRight`.