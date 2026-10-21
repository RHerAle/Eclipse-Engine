## 2024-10-24 - V8 engine overhead in inner loop bounds clamping
**Learning:** In hot image processing loops (like Scharr filters in stabilise.js), relying on a bounds-clamping helper `at(x, y)` which uses `Math.min`/`Math.max` for every pixel adds massive V8 engine overhead, making convolutions run 6.6x slower than a loop-splitted version.
**Action:** When working on pixel processing loops, separate the interior processing from boundary processing to avoid bounds checking `Math.max(0, x + i)` and `Math.min(w - 1, x + i)` per pixel for the entire array.
