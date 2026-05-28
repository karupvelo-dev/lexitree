# Design Spec: Eiffel Tower Assembly

**File:** `vocabulary-eiffel.html`
**Status:** Built — prototype with mock data

---

## Why it works

- **Instantly legible:** The most recognised French symbol in the world. A non-French person understands the metaphor in two seconds without a legend.
- **Positive framing:** Solves jenga's core failure — collapse = punishment. Here you are *building* an icon, not preventing a fall. Direction is always upward.
- **Natural CEFR mapping:** The tower's physical structure creates a bottom-to-top progression that mirrors difficulty. A1 at the base (widest, foundational), C2 at the antenna (narrow, rarefied).
- **Night aesthetic:** The "City of Light" framing — your vocabulary provides the light. Mastered words glow amber like the tower's famous twinkling lights. Dark mode native.
- **Density solution:** The varying width of the tower sections naturally accommodates the narrowing word count at higher CEFR levels. Legs hold 8 A1 words spread across two columns; the antenna tip holds a handful of C2 rarities.

---

## Tower structure — SVG sections mapped to CEFR levels

| Section | SVG y-range | CEFR | Description |
|---|---|---|---|
| Antenna | y=10–76 | C2 (partial) | Thin vertical rod, 6px wide. Blinking red nav light at tip. |
| Upper pyramid | y=76–158 | C2 | Triangular taper. Widest point ~68px. 8 word nodes inside. |
| Second platform | y=152–169 | — | Horizontal bar bridging pyramid to middle body. Decorative only. |
| Upper-middle body | y=169–254 | C1 | Parallel-sided rectangle, slight taper. Decorative cross-bracing. |
| Lower-middle bell | y=254–342 | B2 / B1 | Trapezoidal "bell" shape — widest section of the body. B1 nodes in upper third, B2 in lower. |
| First platform | y=338–358 | — | Wide horizontal bar spanning the legs. A2 nodes sit on/around it. |
| Left + right legs | y=354–588 | A1 / A2 | Curved bezier legs splaying outward to base. A1 nodes in lower leg sections. |

The first platform is the visual anchor — the horizontal bar where A2 lives creates a clear visual break between "foundational" (below) and "building" (above).

---

## Node design

Each vocabulary word is a circle node placed within its tower section.

### Mastery states

| State | Encounters | Fill | Stroke | Radius | Effect |
|---|---|---|---|---|---|
| Non vu | 0 | `#11112a` | `#252540` | 4.5 | None |
| Aperçu | 1–2× | `#2e1e08` | `#5a3a15` | 5 | None |
| Connu | 3–5× | `#7a4e10` | `#bb7820` | 6 | None |
| Maîtrisé | 6+× | `#ffaa30` | `#ffd070` | 7.5 | Amber glow + twinkle |

### Twinkle animation
Mastered nodes pulse with a CSS `animation` — opacity 1→0.6→1. Each node gets an individually randomised duration (1.8s–4s) and delay (0s–4s). No two mastered words twinkle in sync, creating the effect of the real Eiffel Tower's light show.

### Hover
All non-locked nodes scale to 1.7× on hover (cubic-bezier spring). Tooltip shows: word, POS tag, English definition, mastery pip bar (6 pips filled to mastery level), mastery label.

### Locked nodes
Ghost dots at 35% opacity inside a translucent dark overlay (`rgba(7,7,26,0.64)`). A dim level label (`— B2 —`, `— C1 —`, `— C2 —`) is centred in each locked zone. The user can see the density of what's locked without reading or interacting with it — creates anticipation.

---

## Visual details

**Background:** Deep navy `#07071a`. 200 randomised star points (0–1.1px radius, 15–70% opacity) in the upper 75% of the viewport. Drawn to `<canvas>` at load.

**Tower iron:** Dark charcoal gradient — `#181828` at top to `#0e0e1c` at base. Structural elements (platforms, antenna) slightly lighter (`#161626`, `#1e1e34`). Mimics real Eiffel iron without being literally grey.

**Decorative lattice:** Ghost lines on legs and cross-bracing on body at 12–15% opacity (`#5050a0`). Suggests the lattice structure without competing with word nodes.

**Ground glow:** `radialGradient` ellipse at base — warm orange-amber at 12% opacity. Suggests the Seine's reflection.

**Antenna nav light:** Red circle (`#ff4040`) pulsing opacity 0.7→0.2→0.7 on a 2s cycle. The real tower has an aviation warning light at the top.

**"Vous êtes ici" indicator:** Dashed horizontal line + filled triangle arrow pointing into the B1 zone. Blue (`#3a8fd0`). Label reads `VOUS ÊTES ICI` in 8px uppercase.

---

## Level axis

Left sidebar labels aligned to the tower's level boundaries.

| State | Badge style | Count |
|---|---|---|
| Unlocked | Muted white, grey border | `mastered/total` |
| Current (B1) | Blue (`#5ac8fa`), blue border | `mastered/total` |
| Locked | Near-invisible, low opacity | `–` |

---

## Header stats

Three live-computed values:

| Label | Computation |
|---|---|
| % maîtrisée | `mastered / non-locked total × 100` |
| Mots maîtrisés | Count of MASTERED state words |
| Rencontrés | Count of words with any exposure (not UNSEEN, not LOCKED) |

---

## Demo state

| Level | Maîtrisé | Connu | Aperçu | Non vu | Locked |
|---|---|---|---|---|---|
| A1 | 6 | 1 | 1 | 0 | — |
| A2 | 3 | 2 | 2 | 1 | — |
| B1 | 0 | 2 | 2 | 4 | — |
| B2 | — | — | — | — | All 8 |
| C1 | — | — | — | — | All 8 |
| C2 | — | — | — | — | All 8 |

Chosen to show all four mastery treatments simultaneously, with a clear visual gradient from the glowing base (A1 mostly mastered) to the dark locked top (C2 untouched).

---

## Decisions made

**Nodes inside the silhouette, not on the outline.** Words are packed into the body of the tower, not placed along its edges. Feels like the tower is *made of* words, not decorated with them.

**No labels on nodes by default.** Labels only appear in the hover tooltip. At 48 words across 6 levels, showing all labels simultaneously produces an illegible mesh.

**Legs split for A1.** The Eiffel Tower's legs are two separate physical structures below the first platform. A1 nodes are split 4/4 between left and right leg — reinforces the architecture and avoids cramming 8 nodes into a single column.

**Ghost dots inside locked zones.** The user can see the *density* of what's locked — C2 looks like 8 faint specks in a narrow pyramid — without being able to read or interact with them. Creates anticipation, not a hard wall.

**Twinkle is individual, not synchronised.** Each mastered node gets a random duration and delay. Synchronised twinkle looks mechanical; staggered twinkle looks alive.

**No click interaction (yet).** Hover is sufficient for a vocabulary map. Click-to-drill is V2 — requires integration with the session flow.

---

## V2 ideas

- Click a node → launches a targeted 3-question mini-session for that word
- Fadell temperature layer: recently-seen nodes glow warmer, unseen nodes cool over time
- Level completion burst: when all words in a section reach Maîtrisé, the whole section pulses once with a bright glow
- Mobile layout: tower rotates to horizontal scroll or compresses to a narrower viewport
- Real word data wired in from `vocabulary-map.js` instead of mock data
