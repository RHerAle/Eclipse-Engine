
## 2024-11-20 - Loop Splitting to avoid V8 bounds checking overhead
**Learning:** In hot image-processing kernels (e.g., convolution like Scharr), doing bounds clamping (using `Math.min/Math.max` or even conditionals) inside the tightest inner loops severely limits V8's optimization capabilities.
**Action:** When working with 2D buffers and edge operations, always use "loop splitting" (process the bulk of the image `1..w-1` without bounds checks, and manually process borders after) to gain order-of-magnitude (5-6x) speedups.
