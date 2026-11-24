# Must-See Menu

A static Toronto restaurant guide with a 1990s sitcom living-room look. Foodies can browse real restaurants by neighbourhood, cuisine, and price, ask the audience for a random table, or see places newly added to the map.

## Data

Listings come from [OpenStreetMap](https://www.openstreetmap.org/copyright), fetched at build time through the public Overpass API (no key). The committed snapshot is [`public/data/restaurants.json`](public/data/restaurants.json): **3,624 restaurants**.

© OpenStreetMap contributors. The snapshot is a derived database under the [Open Database License](https://opendatacommons.org/licenses/odbl/1-0/).

What each field uses:

- **Name, coordinates, cuisine, address, phone, hours, website, opening date, and price** are copied from OpenStreetMap tags. A missing price stays missing. The guide does not estimate `$` / `$$` / `$$$`.
- **City neighbourhoods** come from Toronto `admin_level=10` boundary relations.
- **Kensington** and **Chinatown** follow the Kensington Market and Kensington-Chinatown boundaries.
- **Ossington, Queen West, Little Italy, the Danforth, and Leslieville** are restaurants within about a block of those streets, using the road geometry from OpenStreetMap. The exact clips live in `scripts/fetch-restaurants.mjs`.

`npm run build` tries a fresh fetch. If Overpass is slow or unavailable and a snapshot is already committed, the build keeps that file.

## Develop

```bash
npm install
npm run dev
```

Refresh the snapshot on purpose with `npm run fetch-data`. `npm run build` validates the snapshot and writes the static site to `dist/`.

## Deploy

The project is a plain [Vite](https://vitejs.dev/) site. On Vercel, the framework preset can stay empty: `npm run build` outputs `dist/`, and the site needs no server and no secrets.
