# Synthetic second-country geography fixture

This fixture exercises the generic manifest importer with ISO identifiers for a
country other than Nigeria. Its rectangular coordinates and names are invented
for automated tests. They are **not authentic Canadian or Ontario boundaries**
and must never be imported into a production geography catalog.

The fixture uses `PENDING_REVIEW` and `APPROXIMATE_BOUNDARY` deliberately. Its
provider URL uses the reserved `.invalid` domain and its declared license is
CC0 because the geometry was authored solely for this test.
