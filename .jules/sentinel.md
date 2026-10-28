## 2026-03-30 - Overpass QL Injection via String Interpolation
**Vulnerability:** Constructing Overpass QL queries via raw template string interpolation without input validation/coercion allowed malicious parameters (e.g. `lat`, `lon`, or `radiusM`) to break out of the QL context and inject arbitrary Overpass QL statements.
**Learning:** External API query languages (like Overpass QL) construct queries via text templates. Unsanitized user inputs can lead to API query injection.
**Prevention:** Always explicitly coerce inputs to numbers using `Number()` and validate using `Number.isFinite()` before interpolating into string queries.
