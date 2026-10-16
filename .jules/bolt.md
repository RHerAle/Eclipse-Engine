## 2024-06-25 - V8 Math.min/Math.max overhead in inner loops
**Learning:** In image processing and math-heavy functions (like `scharr`), using `Math.min` and `Math.max` for array bounds clamping inside the innermost pixel loop adds significant V8 engine overhead.
**Action:** Instead of calling these clamping functions per pixel, split the loops into boundary regions (edges/corners) and an inner region. The inner region can access neighbor array indices directly without bounds checking, which yielded ~6x performance improvement in `scharr`.
