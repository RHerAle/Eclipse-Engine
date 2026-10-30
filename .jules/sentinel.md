## 2026-03-31 - Overpass QL Injection via String Interpolation
**Vulnerability:** Unsanitized string inputs `lat`, `lon`, and `radiusM` in `Terrain.buildings` were directly interpolated into Overpass QL query string.
**Learning:** String template literals formatting API queries (like Overpass QL) without explicit numeric coercion can allow attackers or bad caller inputs to break query syntax or execute unintended query commands.
**Prevention:** Always coerce API query parameters to numeric types using `Number()` and validate `Number.isFinite()` before string interpolation.
