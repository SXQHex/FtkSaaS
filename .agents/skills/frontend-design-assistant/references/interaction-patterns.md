# Interaction Patterns: Physics, Texture, and "The Feel"

## The Anti-Slop Philosophy of Motion

AI-generated interfaces feel "flat" because they treat screens like paper.
**Human-designed interfaces feel "tactile" because they treat screens like objects.**

### Blacklist: The "Dead Fish" Interactions
Avoid these default behaviors that signal low effort:

| Pattern | Why it feels cheap |
|---------|-------------------|
| `transition: all 0.3s ease` | The "default drift." No weight, no snap. |
| Instant color changes | Jarring. Real objects don't teleport states. |
| Default browser outline | Ugly, breaks immersion. |
| Linear animations | Robots move linearly. Humans move with curves. |

---

## 1. The Squeeze (Tactile Feedback)

Things in the real world deform when you press them. Buttons should too.

**The Concept**:
Instead of just changing color, the element physically responds to pressure.

**CSS Recipe**:
```css
.tactile-btn {
  transition: transform 0.1s cubic-bezier(0.4, 0, 0.2, 1);
}

.tactile-btn:active {
  transform: scale(0.96); /* The Squeeze */
}
```

---

## 2. The Spotlight (Cursor Awareness)

Static borders are boring. Borders that know where you are feel alive.

**The Concept**:
Use radial gradients that track the mouse position to reveal borders or backgrounds.

**CSS Recipe (Tailwind-ish approach)**:
```css
/* Container needs relative positioning */
.spotlight-card {
  position: relative;
  background: #1a1a1a;
  overflow: hidden;
}

/* The glow effect */
.spotlight-card::before {
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: radial-gradient(
    800px circle at var(--mouse-x) var(--mouse-y),
    rgba(255, 255, 255, 0.06),
    transparent 40%
  );
  opacity: 0;
  transition: opacity 0.5s;
}

.spotlight-card:hover::before {
  opacity: 1;
}
```
*Note: Requires tiny JS snippet to update `--mouse-x` and `--mouse-y`.*

---

## 3. The Texture (Digital Grain)

Flat solid colors look like plastic. Grain adds atmosphere and "air."

**The Concept**:
Overlay a subtle noise texture to break up large flat areas. It mimics film grain or high-quality paper.

**CSS Recipe**:
```css
.with-grain {
  position: relative;
}

.with-grain::after {
  content: "";
  position: absolute;
  inset: 0;
  opacity: 0.05;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
}
```

---

## 4. The Stagger (Orchestrated Entry)

Don't show everything at once. It's overwhelming.

**The Concept**:
Reveal content in a sequence, like a director guiding the eye.

**CSS Recipe**:
```css
/* Define the keyframe once */
@keyframes slide-up-fade {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Apply with index-based delays */
.stagger-item {
  animation: slide-up-fade 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  opacity: 0; /* Start hidden */
}

.stagger-item:nth-child(1) { animation-delay: 0.1s; }
.stagger-item:nth-child(2) { animation-delay: 0.2s; }
.stagger-item:nth-child(3) { animation-delay: 0.3s; }
```

---

## 5. The Blur (Contextual Depth)

Shadows are okay. Blurs are modern.

**The Concept**:
Use `backdrop-filter` to show that UI elements are floating *above* the content, not just sitting on top of it.

**CSS Recipe**:
```css
.glass-panel {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.3);
}

/* Dark mode version */
.dark .glass-panel {
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
```

---

## 6. The Snappy Transition (Cubic Bezier)

Stop using `ease-in-out`. It's mushy.

**The Concept**:
Real objects accelerate fast and decelerate smoothly (friction).

**The "Apple" Curve**:
```css
/* Fast start, smooth stop */
transition-timing-function: cubic-bezier(0.25, 0.1, 0.25, 1);
```

**The "Bouncy" Curve (Use sparingly)**:
```css
/* Overshoots slightly */
transition-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
```

---

## Checklist for "The Feel"

Before shipping, ask:
1.  **Does it respond?** (Hover states, active states)
2.  **Does it have weight?** (Non-linear easing)
3.  **Is it flat?** (Add grain, gradients, or blurs)
4.  **Is it abrupt?** (Stagger entrances, smooth exits)
