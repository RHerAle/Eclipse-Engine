## 2024-10-27 - [Math.hypot Overhead]
**Learning:** `Math.hypot` carries significant overhead in V8 engine compared to manual pythagorean calculation `Math.sqrt(dx*dx + dy*dy)`, making it a bottleneck in tight math loops.
**Action:** Replace `Math.hypot` with `Math.sqrt` in performance-critical sections while ignoring overflow/underflow safeguards if the values involved won't reach precision extremes.
