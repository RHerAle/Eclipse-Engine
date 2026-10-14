## 2024-11-20 - Scharr loop splitting
**Learning:** In image processing loops like Scharr gradient calculations, doing `Math.min` / `Math.max` bounds clamping for every single pixel creates enormous overhead in JavaScript.
**Action:** Always consider loop splitting for boundary conditions (handling borders separately from the bulk interior region) when doing heavy pixel-by-pixel array processing to achieve significant (4-5x) speedups without sacrificing output correctness.
