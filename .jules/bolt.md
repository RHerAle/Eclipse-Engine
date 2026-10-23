## 2025-10-24 - V8 Array access pattern
**Learning:** For multi-dimensional processing flattened into a 1D array, swapping loop orders such that the innermost loop writes non-contiguously (e.g. iterating y then x, but writing to `[y * w + x]`) reduces performance compared to contiguous access, even when replacing `Math.max` clamping. The data locality and cache friendliness is critical in V8 array processing.
**Action:** Always verify loop nesting order matches contiguous memory access patterns (row-major vs column-major) when rewriting image processing code.
