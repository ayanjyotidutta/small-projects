# 👁️ OpticAI | Version 1.0 
### **High-Fidelity Perceptual Benchmarking & Visual Memory Engine**

OpticAI is a minimalist, high-stakes vision benchmark designed to quantify the limits of human color perception. By bridging the gap between brand strategy and technical execution, it challenges users to recreate complex HSL spectrums under high-velocity constraints.

**Live Benchmark:** [https://opticalgame.vercel.app/]  
**Product Lead:** Ayan Jyoti Dutta 😇

---

## 🎯 1. Executive Summary & Strategic Vision
Developed as a "Perceptual Audit" tool, OpticAI explores the intersection of **Computer Vision** and **Human Cognition**. It gamifies the principles of the Munsell Color System to quantify how accurately we retain visual equity (color) under psychological and temporal pressure. It serves as a definitive benchmark for Brand Managers, Designers, and visual purists.

---

## 🛠️ 2. Product Requirements Document (PRD)

### 2.1 Core Product Pillars
* **Precision Branding:** A minimalist, "Old Money" aesthetic that focuses 100% on color targets using a #000 (Pure Black) canvas.
* **Tactile UX:** Utilizing Neomorphic design principles and hardware-style depth to simulate high-end physical equipment.
* **Viral Status:** Gamifying accuracy through social proof and "Wordle-style" competitive sharing.

### 2.2 Key Feature Set
* **The Perception Engine:** Uses 3D Euclidean distance with a **1.8x Cubic Decay** scoring model. Includes 5 themed rounds (Neon → Pastels → Muted Earth).
* **The "Pressure Cooker" Loop:** 5s "Memorise" phase (decimal-based centisecond timer) followed by a 30s "Guess" phase with heartbeat-synced UI pulse.
* **Visual Calibration:** Post-game split-view comparison cards for auditing specific perceptual biases.
* **Technical Reliability:** * **Ghost-Timer Fix:** Manual progression kills background loops via `setResultTimer(-2)`.
    * **Touch Protection:** Integrated `touch-action: pan-x` to prevent mobile viewport "bounce."

---

## 📈 3. Comprehensive Iteration Log

| Phase | Milestone | Challenge / Friction Point | Strategic Intervention | Result & Product Impact |
| :--- | :--- | :--- | :--- | :--- |
| **Alpha** | **Logic Foundation** | RGB matching felt like "math," not "art." | **Shift to HSL Logic.** | Aligned engine with human artistic intuition. |
| **Beta** | **The Game Loop** | Tool felt static; no stakes or urgency. | **Split 5s/30s Timer Engine.** | Created a high-stakes "Pressure Cooker" feel. |
| **v0.5** | **UX Stress** | Users lost focus during the 30s window. | **Heartbeat Pulse Animation.** | Induced visceral urgency during execution. |
| **v0.7** | **Scoring Curve** | Scores were too easy; rounds felt random. | **1.8x Cubic Decay Algorithm.** | Elevated the skill ceiling; 45+ is now Elite. |
| **v0.9** | **Viral Hook** | Users played once and closed the tab. | **Adaptive "Beat It" CTA.** | Triggered the Zeigarnik Effect via social proof. |
| **v1.0** | **Final Launch** | Lacked brand authority and "finish." | **Universal Glow & /50 Benchmark.** | Positioned as a Premium Perceptual Audit tool. |

---

## 🗺️ 4. User Journey Map

1. **The Entry Point (Benchmark Initiation):** User meets the **Radiant Glow CTA**. A pre-flight calibration tip (*Brightness > 80% / Disable Night Shift*) ensures hardware is optimized.
2. **The Core Loop (Perceptual Audit):** * **Memorise (5s):** Total retinal focus anchored by the "Memorise the Colour" header.
    * **Guess (30s):** Precision calibration via the **Glassmorphic Control Panel**. 
3. **The Climax (The Visual Audit):** Results are audited on a **50.00 Point Scale**. Split-view cards reveal specific biases (e.g., a tendency to over-saturate).
4. **The Exit (Social Equity):** The prestige-locked retention logic enforced by the **25-point Elite Floor** (*"Try Beating 25 Score"*) drives the next session.

---

## 🧬 5. Technical Appendix: The Scoring Engine

### 5.1 The Distance Formula
Colors are converted to RGB space to calculate the 3D Euclidean Distance ($d$):
$$d = \sqrt{(R_1 - R_2)^2 + (G_1 - G_2)^2 + (B_1 - B_2)^2}$$

### 5.2 1.8x Cubic Decay
To separate the "Apprentice" from the "Visionary," we apply a Power-Law Decay:
$$S = 10 \cdot \left(1 - \frac{d}{441.67}\right)^{1.8}$$
The **1.8x exponent** aggressively penalizes minor deviations. A 95% visual match yields only a ~9.1 score, ensuring that only true perfection reaches the "Divine" tier.

### 5.3 Aggregate Benchmarking (/50)
The final result is an aggregate of 5 difficulty-tiered rounds, presented as a score out of **50.00**.
* **Prestige Floor:** If Total < 25, CTA defaults to *"Try Beating 25 Score"* to maintain the benchmark's elite status.

---

### 💼 Product Lead Reflection
> "OpticAI Version 1.0 represents a 'Product-First' approach to technical development. By stripping away the noise of modern web design, we created a tool that is as intellectually demanding as it is visually clean—a definitive benchmark for the visually elite."

**Released March 2026**
**Ayan Jyoti Dutta | Brand Manager & Product Lead**
