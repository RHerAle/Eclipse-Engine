## 2023-10-24 - Math.min/max inside hot loops causing performance bottleneck
**Learning:** V8 engine introduces significant overhead when `Math.min` and `Math.max` are called repeatedly inside nested loops (like image convolution/filters). The closure overhead and branch checking severely impact execution time.
**Action:** When implementing filters or matrix operations, split the iteration into boundary processing (where bounds checking/clamping is needed) and inner-loop processing. Use direct flat array indexing for the inner loop without calling bounds-checking functions.
