## 2024-05-24 - Scharr filter optimization
**Learning:** V8 engine overhead for `Math.min`/`Math.max` in hot inner loops like the `scharr` image filter can be significant (~4x slower). Loop splitting is highly effective here.
**Action:** Always prefer loop splitting to avoid bounds checking function overhead in hot inner loops for image processing algorithms.
