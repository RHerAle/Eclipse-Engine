# Eclipse-Engine

The calculation engine behind [eclipseradar.com](https://eclipseradar.com): the
local circumstances of the solar eclipses of 2026 to 2050, the sunlight and the
ocular exposure during them, the terrain horizon, and the stabilisation of
eclipse video. Plain JavaScript with no dependencies: these are the files the
site serves.

| File | What it computes |
|---|---|
| `js/besselian.js` | Besselian shadow geometry: contacts, obscuration, magnitude, the central line, the limits, the shadow outline at any instant and the obscuration bands |
| `js/radiometry.js` | Spectral irradiance of the direct beam through a declared atmosphere, with limb darkening, and the ICNIRP blue-light and retinal thermal limits |
| `js/terrain.js` | The skyline towards the Sun from a public elevation model, the observer's elevation, and buildings from OpenStreetMap on request |
| `js/stabilise.js` | Tracking of the solar limb, to hold the eclipsed Sun still in a video |

`data/eclipses.json` is the catalogue of Besselian elements, fitted to the JPL
DE440s ephemeris; `data/spectral.json` holds the spectral tables.

## Checking it

    node tests/besselian.test.js
    node tests/radiometry.test.js
    node tests/stabilise.test.js
    node tests/terrain.test.js

Node 22, nothing to install. The reference values in `tests/reference/` come
from the project's Python chain, which computes the same quantities
independently and is not part of this repository; comments that name `src/` or
`tools/` files refer to it. The tests' reference site is a public viewpoint.

Some comments and data files also name paths in the project's own repository,
such as `web/vendor/`, `data/atmosphere.json` or `literature.json`. Here the
pvlib notice is `data/LICENSE-pvlib.txt`; the other files are not part of this
repository.

## Licence

© 2026 eclipseradar.com. Code under AGPL-3.0-only ([`LICENSE`](LICENSE)); data
under CC BY-SA 4.0 ([`LICENSE-DATA`](LICENSE-DATA)), except the SPECTRL2
coefficient table in `data/spectral.json`, which is BSD-3-Clause
([`data/LICENSE-pvlib.txt`](data/LICENSE-pvlib.txt)), and the ICNIRP and CIE
weighting functions it carries, reproduced as numerical facts.

The measured atmosphere in `data/spectral.json` takes aerosol optical depth from
CAMS and water vapour, pressure and cloud from the ECMWF IFS forecast, both
served by Open-Meteo, and column ozone from WOUDC station 411 (Zaragoza),
measured by AEMET. As the CAMS licence requires:

> Generated using Copernicus Atmosphere Monitoring Service information 2026.
> Neither the European Commission nor ECMWF is responsible for any use of this
> data.

The ozone is acknowledged to the World Ozone and Ultraviolet Radiation Data
Centre (WOUDC) and to AEMET, which made the measurement.

A licence for use in a closed product can be arranged: write to
support@eclipseradar.com.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) and the agreement in [`FLA.md`](FLA.md).

## Safety

Nothing computed here is permission to look at the Sun. The exposure figures are
the ICNIRP equations evaluated under declared assumptions, and
<https://eclipseradar.com/en/safety> sets out what they mean for an eye or a
camera.
