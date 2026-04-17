# Product Requirements Document: OpticAI
**Status:** Version 1.0 (Official Release Build)  
**Product Owner:** Ayan Jyoti Dutta  

---

## 1. Executive Summary
OpticAI is a high-fidelity perceptual benchmarking tool designed to quantify human color perception. By combining a "pressure-cooker" game loop with a high-precision HSL engine, it serves as both a training platform for visual professionals and a status-driven social experience.

## 2. Problem Statement
Visual professionals (Brand Managers, UI Designers) lack a quantitative method to test and improve their "eye" for color accuracy. Existing online tools are either too technical (lacking engagement) or too casual (lacking perception-based precision).

## 3. Core Product Pillars
* **Precision Branding:** A minimalist, "Old Money" aesthetic that focuses 100% on color targets using a #000 (Pure Black) canvas.
* **Tactile UX:** Utilizing Neomorphic design principles and hardware-style depth to simulate high-end physical equipment.
* **Viral Status:** Gamifying accuracy through social proof and "Wordle-style" competitive sharing.

## 4. Key Feature Set
### 4.1 The Perception Engine (HSL Logic)
* **Algorithm:** 3D Euclidean distance with a **1.8x Cubic Decay** scoring model. This ensures a steep difficulty curve where "close" is an Apprentice score, and only "perfect" is Divine.
* **Themed Rounds:** 5 rounds of escalating difficulty (Neon → Pastels → Muted/Dark Earth).

### 4.2 The "Pressure Cooker" Loop
* **Memorise Phase:** 5-second window with decimal-based centisecond timing. Includes a specific "Memorise the Colour" header for cognitive anchoring.
* **Guess Phase:** 30-second match window with a pulsing "Heartbeat" UI to induce user stress and an explicit "Guess the Colour" header.

### 4.3 Visual Calibration (Post-Game Analysis)
* **Comparison Cards:** A split-view display of 'Target' vs 'Guess' for every round, allowing users to audit specific perceptual biases (e.g., over-saturating greens).
* **Benchmark Context:** The final score is displayed with a **"/50" suffix** to provide immediate professional scale.

### 4.4 Technical Reliability (Elite Patches)
* **Ghost-Timer Logic:** Implemented `setResultTimer(-2)` within the transition logic to ensure manual "Next Round" clicks immediately terminate background countdowns, preventing round-skipping.
* **Mobile Touch-Protection:** Integrated `touch-action: pan-x` on HSL sliders and `touch-action: none` on the body to prevent viewport "bounce" or accidental zooming during high-precision tasks.
* **Adaptive Fluid Architecture:** Implemented breakpoint-aware HSL control panels and result grids (Grid-to-Stack transitions). Optimized for high-DPI mobile devices (iPhone 15 Pro Max) including Dynamic Island safe-area margins and `touch-action: pan-x` slider protection.

### 4.5 Social Equity (Viral Loop)
* **Universal Glow CTA:** High-intensity radiant white glow on "Start" and "Share" buttons to drive conversion.
* **The Elite Floor:** Retention logic forces a **Minimum 25-point target** (*"Try Beating 25 Score"*), establishing a prestige baseline for competitive play.

## 5. Chronometer Logic
* **Timer:** Utilizes a *decimal-based centisecond timer* (Base-100). This ensures a smoother visual "scroll" and aligns with digital high-precision timing standards.

## 6. Success Metrics (KPIs)
* **K-Factor:** Frequency of result sharing per unique user session.
* **Completion Rate:** Percentage of users who finish all 5 rounds (Target: >70%).
* **Replay Rate:** Driven by the prestige-locked "Try Beating X Score" CTA.

---

### 💼 Brand Manager's Final Note:
> "OpticAI represents a 'Product-First' approach to technical development. By stripping away the noise of modern web design, we created a tool that is as intellectually demanding as it is visually clean—a definitive benchmark for the visually elite."

**Final Audit & Build by Ayan Jyoti Dutta 😇**
