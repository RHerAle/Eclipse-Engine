# Bolt's Journal

## 2026-02-17 - Avoid modulo operations for index wrapping in tight grid loops
**Learning:** In V8, evaluating `((ii % nlon) + nlon) % nlon` on every iteration of a multi-thousand iteration inner grid loop introduces significant integer division overhead.
**Action:** Replaced modulo wrapping with sequential index incrementing (`i++; if (i === nlon) i = 0;`), reducing `obscurationGrid` execution time by ~35%.
