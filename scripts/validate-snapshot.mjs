import fs from "node:fs";

const file = new URL("../public/data/restaurants.json", import.meta.url);
const data = JSON.parse(fs.readFileSync(file, "utf8"));

if (!data.attribution || !data.attribution.includes("OpenStreetMap")) {
  console.error("Snapshot is missing OpenStreetMap attribution.");
  process.exit(1);
}

if (!Array.isArray(data.restaurants) || data.restaurants.length < 100) {
  console.error("Snapshot does not include enough restaurants.");
  process.exit(1);
}

if (data.count !== data.restaurants.length) {
  console.error("Snapshot count does not match the restaurant list.");
  process.exit(1);
}

const broken = data.restaurants.find(
  (restaurant) =>
    !restaurant.name ||
    !restaurant.id ||
    typeof restaurant.lat !== "number" ||
    typeof restaurant.lon !== "number" ||
    restaurant.lat < 43.5 ||
    restaurant.lat > 43.9 ||
    restaurant.lon < -79.7 ||
    restaurant.lon > -79.05,
);

if (broken) {
  console.error(`Snapshot has a restaurant outside Toronto or missing a name: ${broken.name || broken.id}`);
  process.exit(1);
}

console.log(`Snapshot ok: ${data.count} OpenStreetMap restaurants.`);
