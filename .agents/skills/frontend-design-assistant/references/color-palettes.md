# Color Palettes: Distinctive Schemes for Non-Generic Designs

## Blacklist: Overused Color Patterns

These combinations scream "AI-generated":

| Pattern | Why to Avoid |
|---------|--------------|
| Purple gradient on white | The quintessential AI slop |
| Blue (#3B82F6) + Gray | Every SaaS default |
| Teal + Coral accents | 2019 Dribbble aesthetic, overused |
| Pastel everything | Safe = boring |
| Rainbow gradients | Meaningless visual noise |
| Black + Neon accent | Lazy "dark mode" |

## Palette Principles

1. **Commit to dominance**: One color should clearly own 60%+ of the palette
2. **Sharp accents**: Accent colors should contrast dramatically, not blend
3. **Functional hierarchy**: Colors should communicate importance
4. **Context-appropriate**: Draw from the domain's visual language

---

## IDE & Developer Themes

Proven palettes from code editors, optimized for long viewing.

### Dracula

Dark, purple-tinted with vibrant accents.

```css
:root {
  --bg-primary: #282a36;
  --bg-secondary: #44475a;
  --fg-primary: #f8f8f2;
  --fg-muted: #6272a4;
  --accent-cyan: #8be9fd;
  --accent-green: #50fa7b;
  --accent-orange: #ffb86c;
  --accent-pink: #ff79c6;
  --accent-purple: #bd93f9;
  --accent-red: #ff5555;
  --accent-yellow: #f1fa8c;
}
```

**Use for**: Developer tools, technical dashboards, coding platforms

---

### Nord

Arctic, blue-tinted palette with muted tones.

```css
:root {
  /* Polar Night */
  --nord0: #2e3440;
  --nord1: #3b4252;
  --nord2: #434c5e;
  --nord3: #4c566a;
  /* Snow Storm */
  --nord4: #d8dee9;
  --nord5: #e5e9f0;
  --nord6: #eceff4;
  /* Frost */
  --nord7: #8fbcbb;
  --nord8: #88c0d0;
  --nord9: #81a1c1;
  --nord10: #5e81ac;
  /* Aurora */
  --nord11: #bf616a; /* red */
  --nord12: #d08770; /* orange */
  --nord13: #ebcb8b; /* yellow */
  --nord14: #a3be8c; /* green */
  --nord15: #b48ead; /* purple */
}
```

**Use for**: Calm productivity apps, documentation, reading interfaces

---

### Catppuccin Mocha

Warm, pastel-on-dark with excellent contrast.

```css
:root {
  --ctp-rosewater: #f5e0dc;
  --ctp-flamingo: #f2cdcd;
  --ctp-pink: #f5c2e7;
  --ctp-mauve: #cba6f7;
  --ctp-red: #f38ba8;
  --ctp-maroon: #eba0ac;
  --ctp-peach: #fab387;
  --ctp-yellow: #f9e2af;
  --ctp-green: #a6e3a1;
  --ctp-teal: #94e2d5;
  --ctp-sky: #89dceb;
  --ctp-sapphire: #74c7ec;
  --ctp-blue: #89b4fa;
  --ctp-lavender: #b4befe;
  --ctp-text: #cdd6f4;
  --ctp-subtext: #a6adc8;
  --ctp-overlay: #6c7086;
  --ctp-surface: #313244;
  --ctp-base: #1e1e2e;
  --ctp-mantle: #181825;
  --ctp-crust: #11111b;
}
```

**Use for**: Creative tools, community platforms, cozy aesthetic

---

### Gruvbox

Retro, earthy with high contrast.

```css
:root {
  /* Dark mode base */
  --gruvbox-bg: #282828;
  --gruvbox-bg1: #3c3836;
  --gruvbox-bg2: #504945;
  --gruvbox-fg: #ebdbb2;
  --gruvbox-fg-muted: #a89984;
  /* Accents */
  --gruvbox-red: #fb4934;
  --gruvbox-green: #b8bb26;
  --gruvbox-yellow: #fabd2f;
  --gruvbox-blue: #83a598;
  --gruvbox-purple: #d3869b;
  --gruvbox-aqua: #8ec07c;
  --gruvbox-orange: #fe8019;
}
```

**Use for**: Retro computing aesthetic, warm technical interfaces

---

## Cultural & Regional Aesthetics

### Japanese Zen (和風)

Muted, nature-inspired, intentional emptiness.

```css
:root {
  --zen-sumi: #1c1c1c;      /* Ink black */
  --zen-kuro: #2d2d2d;      /* Soft black */
  --zen-hai: #7d7d7d;       /* Ash gray */
  --zen-shiro: #f5f5f0;     /* Rice paper white */
  --zen-kinari: #fbfaf5;    /* Natural white */
  --zen-aonibi: #535953;    /* Blue-gray green */
  --zen-cha: #b5a642;       /* Tea green */
  --zen-shu: #eb6238;       /* Vermillion (accent) */
  --zen-ai: #264348;        /* Indigo */
}
```

**Use for**: Mindfulness apps, minimalist portfolios, tea/craft brands

---

### Scandinavian Modern

Clean, bright, functional with warm wood tones.

```css
:root {
  --scandi-white: #fafaf8;
  --scandi-cream: #f5f2eb;
  --scandi-sand: #e8e4db;
  --scandi-stone: #c4bfb6;
  --scandi-charcoal: #3d3d3d;
  --scandi-black: #1a1a1a;
  --scandi-oak: #c9a86c;
  --scandi-terracotta: #c1666b;
  --scandi-forest: #4a5a4a;
  --scandi-sky: #a8c5c5;
}
```

**Use for**: Interior design, furniture, lifestyle brands, e-commerce

---

### Mediterranean

Warm, sun-baked, earthy with vibrant accents.

```css
:root {
  --med-terracotta: #c1440e;
  --med-sand: #e6d2b5;
  --med-olive: #708238;
  --med-sea: #1e6f8a;
  --med-white: #faf6f0;
  --med-ochre: #cc7722;
  --med-clay: #8b4513;
  --med-azure: #4a90a4;
  --med-sunset: #e07b39;
}
```

**Use for**: Travel, food, hospitality, outdoor brands

---

### Cyberpunk / Neo-Tokyo

High contrast, neon-on-dark, futuristic.

```css
:root {
  --cyber-void: #0a0a0f;
  --cyber-dark: #12121a;
  --cyber-surface: #1a1a2e;
  --cyber-muted: #4a4a6a;
  --cyber-text: #e0e0ff;
  --cyber-neon-pink: #ff2a6d;
  --cyber-neon-cyan: #05d9e8;
  --cyber-neon-yellow: #d1f7ff;
  --cyber-neon-purple: #9d4edd;
  --cyber-chrome: #c0c0c0;
}
```

**Use for**: Gaming, tech startups, futuristic brands, music

---

### Art Deco

Luxurious, geometric, 1920s glamour.

```css
:root {
  --deco-black: #1a1a1a;
  --deco-charcoal: #2d2d2d;
  --deco-gold: #d4af37;
  --deco-bronze: #cd7f32;
  --deco-cream: #f5f5dc;
  --deco-emerald: #046307;
  --deco-navy: #000080;
  --deco-burgundy: #722f37;
  --deco-silver: #c0c0c0;
}
```

**Use for**: Luxury brands, hotels, cocktail bars, event sites

---

### Bauhaus

Primary colors, geometric clarity, modernist.

```css
:root {
  --bauhaus-white: #f4f1e9;
  --bauhaus-black: #1a1a1a;
  --bauhaus-red: #be1e2d;
  --bauhaus-yellow: #f7d417;
  --bauhaus-blue: #21409a;
  --bauhaus-gray: #8c8c8c;
}
```

**Use for**: Design studios, architecture, education, museums

---

## Functional Palettes

### Dashboard: Data-Heavy Interface

Optimized for charts, tables, and dense information.

```css
:root {
  /* Backgrounds */
  --dash-bg: #0f172a;
  --dash-card: #1e293b;
  --dash-elevated: #334155;

  /* Text */
  --dash-text: #f1f5f9;
  --dash-text-muted: #94a3b8;
  --dash-text-dim: #64748b;

  /* Status colors */
  --dash-success: #22c55e;
  --dash-warning: #eab308;
  --dash-error: #ef4444;
  --dash-info: #3b82f6;

  /* Chart colors (high contrast set) */
  --chart-1: #8b5cf6;
  --chart-2: #06b6d4;
  --chart-3: #f59e0b;
  --chart-4: #ec4899;
  --chart-5: #10b981;
  --chart-6: #f97316;
}
```

---

### E-Commerce: Trust & Conversion

Balanced for readability and action.

```css
:root {
  /* Base */
  --shop-bg: #ffffff;
  --shop-surface: #f8f9fa;
  --shop-border: #e9ecef;

  /* Text */
  --shop-text: #212529;
  --shop-text-muted: #6c757d;

  /* Actions */
  --shop-primary: #2563eb;     /* Trust blue */
  --shop-primary-hover: #1d4ed8;
  --shop-cta: #dc2626;         /* Urgency red */
  --shop-cta-hover: #b91c1c;

  /* Feedback */
  --shop-success: #059669;
  --shop-sale: #dc2626;
  --shop-rating: #f59e0b;
}
```

---

### Light Mode: Warm Paper

Comfortable for long reading, not sterile white.

```css
:root {
  --paper-bg: #fdfcfa;
  --paper-surface: #f7f5f2;
  --paper-border: #e8e4dd;
  --paper-text: #2d2a26;
  --paper-text-muted: #6b6560;
  --paper-accent: #b45309;
  --paper-link: #1d4ed8;
  --paper-link-visited: #6b21a8;
}
```

---

## Gradient Recipes

### Mesh Gradient (Modern Hero)

```css
.hero-bg {
  background-color: #0f0f23;
  background-image:
    radial-gradient(at 40% 20%, #4f46e5 0px, transparent 50%),
    radial-gradient(at 80% 0%, #06b6d4 0px, transparent 50%),
    radial-gradient(at 0% 50%, #8b5cf6 0px, transparent 50%),
    radial-gradient(at 80% 50%, #ec4899 0px, transparent 50%),
    radial-gradient(at 0% 100%, #14b8a6 0px, transparent 50%);
}
```

### Subtle Gradient (Background Depth)

```css
.subtle-bg {
  background: linear-gradient(
    135deg,
    #f5f7fa 0%,
    #e4e8ec 100%
  );
}
```

### Aurora Gradient

```css
.aurora-bg {
  background: linear-gradient(
    125deg,
    #1a1a2e 0%,
    #16213e 25%,
    #0f3460 50%,
    #1a1a2e 75%,
    #16213e 100%
  );
  background-size: 400% 400%;
  animation: aurora 15s ease infinite;
}

@keyframes aurora {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}
```

---

## Quick Reference: Context → Palette

| Context | Palette Name | Dominant Color | Key Accent |
|---------|--------------|----------------|------------|
| Developer Tool | Dracula | #282a36 | #ff79c6 |
| Calm Productivity | Nord | #2e3440 | #88c0d0 |
| Creative Platform | Catppuccin | #1e1e2e | #f5c2e7 |
| Retro Tech | Gruvbox | #282828 | #fe8019 |
| Minimalist | Japanese Zen | #f5f5f0 | #eb6238 |
| Lifestyle Brand | Scandinavian | #fafaf8 | #c1666b |
| Travel/Food | Mediterranean | #faf6f0 | #c1440e |
| Gaming/Future | Cyberpunk | #0a0a0f | #ff2a6d |
| Luxury | Art Deco | #1a1a1a | #d4af37 |
| Design/Art | Bauhaus | #f4f1e9 | #be1e2d |

---

## Color Tools

| Tool | Purpose | URL |
|------|---------|-----|
| Realtime Colors | Preview palette on live UI | realtimecolors.com |
| Coolors | Generate harmonious palettes | coolors.co |
| Colour Contrast Checker | WCAG accessibility testing | colourcontrast.cc |
| Happy Hues | Curated palette inspiration | happyhues.co |
| UI Colors | Tailwind-style shade generation | uicolors.app |
