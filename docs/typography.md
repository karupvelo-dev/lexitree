# Typography — parler app

Two typefaces form the typographic system: **Playfair Display** for editorial and French-language moments, **DM Sans** for all UI chrome and body copy. The pairing works because they sit at opposite ends of the personality spectrum — one historical and expressive, the other neutral and geometric — which mirrors the product's own duality: warmth of language learning, clarity of a modern app.

---

## Playfair Display

| Property | Value |
|---|---|
| Category | Serif (transitional) |
| Designer | Claus Eggers Sørensen |
| Foundry | — |
| Released | 2011 |
| Source | Google Fonts |
| License | SIL Open Font License 1.1 (free, commercial use permitted) |
| Google Fonts URL | https://fonts.google.com/specimen/Playfair+Display |

### Background

Playfair Display is a transitional serif rooted in the European Enlightenment. In the late 18th century, broad-nib quills gave way to pointed steel pens, enabling finer hairlines and sharper contrast between thick and thin strokes — that shift in writing tools is exactly what Playfair captures. The result is a typeface that feels classical and literary without being stiff.

The italic cut is particularly expressive, with elegant swash characters that make it well-suited for quoting French phrases — which is precisely how we use it in the app.

### Available weights

| Weight | Style | Usage in parler |
|---|---|---|
| 400 Regular | Upright + Italic | Primary weight for French phrases, lesson rules, exercise questions |
| 500 Medium | Upright | Hero titles on home screen |
| 700 Bold | Upright + Italic | Rarely used — reserved for emphasis if needed |
| 800 ExtraBold | Upright + Italic | Not used |
| 900 Black | Upright + Italic | Not used |

### How we use it

Playfair Display appears exclusively where French language content lives:

- **Exercise questions** — the sentence with the blank or error
- **Lesson rule cards** — the grammar principle stated in large type
- **French example sentences** — always in italic to signal "this is the language, not the UI"
- **Hero greeting on home screen** — e.g. *le subjonctif?* in italic terracotta

It is never used for buttons, labels, navigation, or any functional UI element. The rule is: if it's something the user *reads as content*, it's Playfair. If it's something they *act on*, it's DM Sans.

### Google Fonts import

```css
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400&display=swap');
```

### CSS usage

```css
font-family: 'Playfair Display', Georgia, serif;
```

---

## DM Sans

| Property | Value |
|---|---|
| Category | Sans-serif (geometric) |
| Designer | Colophon Foundry (Jonny Pinhorn), Indian Type Foundry |
| Released | 2019; updated 2023 |
| Source | Google Fonts |
| License | SIL Open Font License 1.1 (free, commercial use permitted) |
| Google Fonts URL | https://fonts.google.com/specimen/DM+Sans |

### Background

DM Sans was commissioned by Google Fonts and designed by Colophon Foundry, a London and Los Angeles-based type foundry. Its design is derived from Poppins and the broader DM type system, which also includes DM Serif Display and DM Mono — making it an unusually cohesive family if the system ever needs to expand.

It is a low-contrast geometric sans-serif with open counters, a large x-height, and wide proportions — all characteristics that optimise it for small text on screen. The 2023 update expanded the weight range from 100 to 1000 and added an optical size axis, making it even more adaptable across typographic scales.

### Available weights

| Weight | Style | Usage in parler |
|---|---|---|
| 300 Light | Upright | Subtle labels, captions |
| 400 Regular | Upright | Body copy, descriptions, story context bar |
| 500 Medium | Upright | Buttons, nav labels, stat values, option text |
| 600 SemiBold | Upright | Not used (too heavy for our system) |
| 700 Bold | Upright | Not used |
| 100–200 (Thin/ExtraLight) | Upright | Not used |

We deliberately limit to three weights (300, 400, 500) to keep the visual hierarchy tight and avoid the UI feeling busy.

### How we use it

DM Sans is the workhorse of the interface:

- **All navigation** — tab bar labels, progress indicators
- **Buttons and CTAs** — "Start today's session", "Next →"
- **Stat chips and metric cards** — XP count, accuracy %, streak count
- **Feedback copy** — the explanation text shown after answering
- **Body descriptions** — story context bar, AI insight card
- **Small labels** — level tags, exercise type badges, section headers

It is never used for French-language content. The moment a French phrase appears, control passes to Playfair Display.

### Google Fonts import

```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&display=swap');
```

### CSS usage

```css
font-family: 'DM Sans', system-ui, sans-serif;
```

---

## Combined import

Both fonts in a single Google Fonts request:

```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=Playfair+Display:ital,wght@0,400;0,500;1,400&display=swap');
```

Or as an HTML `<link>` tag:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=Playfair+Display:ital,wght@0,400;0,500;1,400&display=swap" rel="stylesheet">
```

---

## Type scale

| Role | Font | Size | Weight | Usage |
|---|---|---|---|---|
| Hero title | Playfair Display | 28px | 500 | Home screen greeting |
| Lesson rule | Playfair Display | 19px | 400 | Grammar rule on lesson card |
| Exercise question | Playfair Display | 17px | 400 | The question sentence |
| French example | Playfair Display italic | 16px | 400 | Example sentences |
| Section heading | DM Sans | 11px | 500 | All-caps, 0.8px tracking |
| Body | DM Sans | 14px | 400 | Descriptions, feedback, story bar |
| UI label | DM Sans | 12px | 400 | Captions, sub-labels |
| Badge / tag | DM Sans | 10–11px | 500 | Level tags, exercise type pills |
| Stat value | DM Sans | 20px | 500 | XP, accuracy, streak numbers |

---

## Pairing rationale

The editorial tension between a high-contrast serif and a low-contrast geometric sans is a well-established pairing strategy. In parler's case it does something extra: it creates a visual register system. Users learn to read Playfair as "this is French content — pay attention" and DM Sans as "this is the app talking to me." The typography itself becomes a teaching tool.
