## 2024-05-24 - Image processing array accesses
**Learning:** Inner loop `Math.min`/`Math.max` for boundary checks inside 2D array convolution logic (`blur`, `scharr`) takes significant CPU time in v8. By separating edge pixel handling from interior pixel handling, we can avoid bounds checks for the vast majority of operations.
**Action:** When implementing custom convolution or kernel filters in JS, structure loops to process the "safe" interior without `Math` function bounds checks, then handle the 1-pixel borders separately.
