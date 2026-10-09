
## 2024-05-18 - Hot Loop Image Processing Anti-Pattern
**Learning:** Using a closure (`const at = (x, y) => ...`) and `Math.min`/`Math.max` bounds checks inside a per-pixel image processing loop (like `scharr`) creates massive overhead in JavaScript due to function call overhead and repeated bound calculation.
**Action:** Always inline array boundary clamping and hoist Y-axis calculations outside the X-axis loop in high-throughput kernel functions.
