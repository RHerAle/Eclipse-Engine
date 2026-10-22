
## 2024-05-18 - Loop splitting for image processing
**Learning:** V8 engine bounds checking via `Math.min`/`Math.max` in hot inner loops (like image filters) dominates execution time.
**Action:** Always prefer loop splitting to handle edge cases separately from the core loop, which allows the core loop to run without bounds checks, yielding massive >5x speedups.
