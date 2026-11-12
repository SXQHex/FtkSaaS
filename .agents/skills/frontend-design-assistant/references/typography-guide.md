# Typography Guide: Breaking Free from AI Defaults

## Blacklist: Never Use as Primary Font

These fonts are AI-slop indicators. Seeing them immediately signals "generated, not designed":

| Font | Why to Avoid |
|------|--------------|
| Inter | The #1 AI default. Everywhere. |
| Roboto | Google's safe choice, now overused |
| Open Sans | Corporate default since 2010 |
| Arial | System font, zero character |
| Helvetica | Overused to meaninglessness |
| Space Grotesk | Was distinctive, now AI's "unique" default |
| Outfit | Same fate as Space Grotesk |
| Poppins | Geometric sans that lost its charm |

## Font Categories by Character

### 1. Elegant & Refined

For luxury, editorial, sophisticated contexts.

**Display / Headlines:**
| Font | Character | Google Fonts | Pairs With |
|------|-----------|--------------|------------|
| Playfair Display | Classic serif with dramatic contrast | Yes | Source Sans 3, Lato |
| Cormorant | Delicate, high-contrast garalde | Yes | Proza Libre, Fira Sans |
| Bodoni Moda | Fashion-forward, extreme contrast | Yes | Josefin Sans |
| Fraunces | Soft serif with warmth | Yes | Commissioner |
| Libre Caslon Display | Bookish elegance | Yes | Source Sans 3 |

**Body Text:**
| Font | Character | Google Fonts | Pairs With |
|------|-----------|--------------|------------|
| Crimson Pro | Warm, readable serif | Yes | Work Sans |
| Source Serif 4 | Adobe's refined workhorse | Yes | Source Sans 3 |
| Spectral | Designed for screens, elegant | Yes | Karla |
| Newsreader | Editorial clarity | Yes | Inter (OK for body only) |

**CSS Example:**
```css
/* Elegant Editorial */
:root {
  --font-display: 'Cormorant', serif;
  --font-body: 'Crimson Pro', serif;
  --font-ui: 'Source Sans 3', sans-serif;
}

h1, h2, h3 { font-family: var(--font-display); font-weight: 600; }
body { font-family: var(--font-body); }
button, input, label { font-family: var(--font-ui); }
```

---

### 2. Technical & Precise

For developer tools, dashboards, data-heavy interfaces.

**Display / Headlines:**
| Font | Character | Google Fonts | Pairs With |
|------|-----------|--------------|------------|
| IBM Plex Sans | Industrial precision | Yes | IBM Plex Mono |
| JetBrains Mono | Developer-focused, ligatures | Yes | IBM Plex Sans |
| Overpass | Highway signage clarity | Yes | Overpass Mono |
| Azeret Mono | Modern monospace with personality | Yes | Manrope |
| Martian Mono | Sci-fi technical feel | Yes | General Sans* |

**Body/UI Text:**
| Font | Character | Google Fonts | Pairs With |
|------|-----------|--------------|------------|
| Atkinson Hyperlegible | Accessibility-first, distinctive | Yes | Any monospace |
| Lexend | Optimized for reading speed | Yes | Fira Code |
| Commissioner | Variable, technical sans | Yes | JetBrains Mono |

*General Sans available via Fontshare (free)

**CSS Example:**
```css
/* Technical Dashboard */
:root {
  --font-display: 'IBM Plex Sans', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --font-body: 'Atkinson Hyperlegible', sans-serif;
}

h1, h2 { font-family: var(--font-display); font-weight: 700; letter-spacing: -0.02em; }
code, pre, .data { font-family: var(--font-mono); }
body { font-family: var(--font-body); }
```

---

### 3. Warm & Friendly

For consumer apps, community platforms, approachable brands.

**Display / Headlines:**
| Font | Character | Google Fonts | Pairs With |
|------|-----------|--------------|------------|
| Nunito | Rounded, welcoming | Yes | Nunito Sans |
| Quicksand | Geometric, soft | Yes | Hind |
| Comfortaa | Playful roundness | Yes | Cabin |
| Baloo 2 | Chunky friendliness | Yes | Hind Siliguri |
| Grandstander | Handwritten energy | Yes | Nunito |

**Body Text:**
| Font | Character | Google Fonts | Pairs With |
|------|-----------|--------------|------------|
| Cabin | Humanist warmth | Yes | Lora |
| Hind | Clean with personality | Yes | Merriweather |
| Karla | Quirky grotesque | Yes | Lora, Spectral |

**CSS Example:**
```css
/* Friendly App */
:root {
  --font-display: 'Grandstander', cursive;
  --font-body: 'Cabin', sans-serif;
  --font-accent: 'Baloo 2', cursive;
}

h1 { font-family: var(--font-display); font-weight: 700; }
body { font-family: var(--font-body); line-height: 1.6; }
.badge, .tag { font-family: var(--font-accent); }
```

---

### 4. Bold & Impactful

For marketing, hero sections, statements.

**Display Only:**
| Font | Character | Google Fonts | Pairs With |
|------|-----------|--------------|------------|
| Bebas Neue | Condensed, bold | Yes | Source Sans 3 |
| Anton | Ultra-bold, tight | Yes | Roboto Flex (body OK) |
| Righteous | Retro-futuristic | Yes | Outfit |
| Archivo Black | Industrial weight | Yes | Archivo |
| Oswald | Tall, condensed | Yes | Lato |
| Big Shoulders Display | Wide, architectural | Yes | Epilogue |

**CSS Example:**
```css
/* Bold Marketing */
:root {
  --font-hero: 'Big Shoulders Display', sans-serif;
  --font-body: 'Epilogue', sans-serif;
}

.hero-text {
  font-family: var(--font-hero);
  font-weight: 900;
  font-size: clamp(3rem, 10vw, 8rem);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
```

---

### 5. Creative & Unconventional

For portfolios, art projects, unique brands.

**Display / Headlines:**
| Font | Character | Google Fonts | Pairs With |
|------|-----------|--------------|------------|
| Syne | Art deco meets brutalism | Yes | Space Mono |
| Darker Grotesque | High contrast grotesque | Yes | Instrument Serif* |
| Climate Crisis | Variable, distorted | Yes | Any clean sans |
| Gloock | Chunky, irregular serif | Yes | Epilogue |
| Young Serif | Nostalgic, warm serif | Yes | Figtree |
| Bricolage Grotesque | Quirky, expressive | Yes | Lora |

*Instrument Serif available via Fontshare

**CSS Example:**
```css
/* Creative Portfolio */
:root {
  --font-display: 'Syne', sans-serif;
  --font-body: 'Young Serif', serif;
  --font-mono: 'Space Mono', monospace;
}

h1 {
  font-family: var(--font-display);
  font-weight: 800;
  font-variation-settings: 'wght' 800;
}
```

---

### 6. Minimalist & Geometric

For clean, modern interfaces without being generic.

**All-Purpose:**
| Font | Character | Google Fonts | Pairs With |
|------|-----------|--------------|------------|
| Manrope | Geometric with warmth | Yes | DM Serif Display |
| Figtree | Fresh geometric | Yes | Any serif |
| Epilogue | Variable, precise | Yes | Fraunces |
| Plus Jakarta Sans | Indonesian design heritage | Yes | Lora |
| Onest | Russian constructivism influence | Yes | Bitter |
| Urbanist | Low contrast geometric | Yes | Source Serif 4 |

**CSS Example:**
```css
/* Clean Minimal */
:root {
  --font-primary: 'Figtree', sans-serif;
  --font-accent: 'DM Serif Display', serif;
}

body { font-family: var(--font-primary); font-weight: 400; }
h1, blockquote { font-family: var(--font-accent); font-style: italic; }
```

---

## Font Loading Best Practices

### Google Fonts Optimization

```html
<!-- Preconnect for faster loading -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

<!-- Load only needed weights -->
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=Crimson+Pro:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
```

### Font Display Strategy

```css
/* Use font-display: swap for text visibility during load */
@font-face {
  font-family: 'Custom Font';
  src: url('font.woff2') format('woff2');
  font-display: swap;
}
```

### Variable Fonts (Modern Approach)

```css
/* Variable fonts = one file, infinite weights */
@font-face {
  font-family: 'Inter Variable'; /* Only use Inter if truly needed */
  src: url('Inter-Variable.woff2') format('woff2-variations');
  font-weight: 100 900;
}

h1 {
  font-family: 'Inter Variable';
  font-weight: 847; /* Any value between 100-900 */
}
```

---

## Quick Reference: Mood → Font

| Mood | Primary Font | Secondary | Load URL |
|------|-------------|-----------|----------|
| Luxury | Cormorant | Crimson Pro | `family=Cormorant:wght@600;700&family=Crimson+Pro` |
| Technical | IBM Plex Sans | JetBrains Mono | `family=IBM+Plex+Sans:wght@400;600&family=JetBrains+Mono` |
| Friendly | Nunito | Cabin | `family=Nunito:wght@400;700&family=Cabin` |
| Bold | Bebas Neue | Source Sans 3 | `family=Bebas+Neue&family=Source+Sans+3` |
| Creative | Syne | Space Mono | `family=Syne:wght@400;800&family=Space+Mono` |
| Minimal | Figtree | DM Serif Display | `family=Figtree:wght@400;600&family=DM+Serif+Display` |

---

## Beyond Google Fonts

Free alternatives with unique offerings:

| Source | Notable Fonts | URL |
|--------|---------------|-----|
| Fontshare | Satoshi, General Sans, Clash Display, Instrument Serif | fontshare.com |
| The League of Moveable Type | Junction, Blackout, League Gothic | theleagueofmoveabletype.com |
| Font Squirrel | Huge curated library | fontsquirrel.com |
| Adobe Fonts | Premium options (CC subscription) | fonts.adobe.com |
