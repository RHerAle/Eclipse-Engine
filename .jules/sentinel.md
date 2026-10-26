## 2024-10-26 - [Overpass QL String Injection]
**Vulnerability:** String injection in Overpass QL query where `lat`, `lon`, and `radiusM` are interpolated directly into the query string without sanitization or type coercion.
**Learning:** String interpolation can be exploited if values are passed directly into query strings without validating their types.
**Prevention:** Explicitly coerce values using `Number()` and check for `NaN` via `Number.isNaN()` before using them in string interpolation.