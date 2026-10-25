
## 2024-05-24 - V8 Trigonometric Identities and NaN Edge Cases
**Learning:** Expanding `Math.cos(Math.atan2(px, H_x))` into the algebraic equivalent `H_x / Math.sqrt(px*px + H_x*H_x)` provides a measurable 15% speedup on hot paths. However, this creates a dangerous edge case: if both inputs are zero, `Math.atan2(0, 0)` is 0 and `Math.cos(0)` is 1, but the algebraic form results in `0 / 0` (NaN), which propagates silently and causes severe regressions.
**Action:** When converting transcendental functions to algebraic identities, explicitly handle the origin (e.g., `const nrm = Math.sqrt(px*px + H_x*H_x); const cosH = nrm > 0 ? H_x / nrm : 1;`) to prevent zero-division `NaN` poisoning.
