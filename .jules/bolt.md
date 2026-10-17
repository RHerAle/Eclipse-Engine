## 2023-10-17 - Fast Array Clamping vs Loop Splitting
**Learning:** `Math.min`/`Math.max` used for clamping bounds inside inner loops (like Gaussian blur) is heavily optimized in V8, but loop splitting to avoid bounds checking altogether provides roughly a ~45% performance improvement over using `Math.min`/`Math.max`.
**Action:** When working on math-heavy convolutions like `blur` inside `stabilise.js`, split loops for the inner image area vs edges instead of checking bounds on every iteration if it fits within reasonable line count constraints.

## 2023-10-17 - `Math.hypot` vs `Math.sqrt`
**Learning:** In hot loops, `Math.hypot(dx, dy)` is ~7x slower than `Math.sqrt(dx * dx + dy * dy)` in V8 due to variable arguments parsing and overflow protections.
**Action:** Replace `Math.hypot(dx, dy)` with `Math.sqrt(dx * dx + dy * dy)` where overflow is not a concern, taking care to check memory instructions (e.g. besselian.js states Math.hypot is needed for overflow).
