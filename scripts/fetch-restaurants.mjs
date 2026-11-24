/**
 * Build a Toronto restaurant snapshot from OpenStreetMap via the public
 * Overpass API. No API key. If the fetch fails and a snapshot already
 * exists, the build keeps that committed file.
 *
 * Data © OpenStreetMap contributors, ODbL 1.0.
 * https://www.openstreetmap.org/copyright
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outFile = path.join(root, "public/data/restaurants.json");
const cacheDir = "/tmp/toronto-eats-osm-cache";
const useCache = !process.argv.includes("--refresh");

const MIRRORS = [
  "https://overpass.openstreetmap.fr/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const TORONTO_NEIGHBOURHOODS = [
  "Agincourt North",
  "Agincourt South-Malvern West",
  "Alderwood",
  "Algonquin Island",
  "Annex",
  "Avondale",
  "Banbury-Don Mills",
  "Bathurst Manor",
  "Bay-Cloverhill",
  "Bayview Village",
  "Bayview Woods-Steeles",
  "Bedford Park-Nortown",
  "Beechborough-Greenbrook",
  "Bendale South",
  "Bendale-Glen Andrew",
  "Birchcliffe-Cliffside",
  "Black Creek",
  "Blake-Jones",
  "Briar Hill-Belgravia",
  "Bridle Path-Sunnybrook-York Mills",
  "Broadview North",
  "Brockton Village",
  "Brookhaven-Amesbury",
  "Cabbagetown-South St.James Town",
  "Caledonia-Fairbank",
  "Casa Loma",
  "Centennial Scarborough",
  "Church-Wellesley",
  "Clairlea-Birchmount",
  "Clanton Park",
  "Cliffcrest",
  "Corso Italia-Davenport",
  "Danforth",
  "Danforth East York",
  "Don Valley Village",
  "Dorset Park",
  "Dovercourt Village",
  "Downsview",
  "Downtown Yonge East",
  "Dufferin Grove",
  "East End-Danforth",
  "East L'Amoreaux",
  "East Willowdale",
  "Edenbridge-Humber Valley",
  "Eglinton East",
  "Elms-Old Rexdale",
  "Englemount-Lawrence",
  "Eringate-Centennial-West Deane",
  "Etobicoke City Centre",
  "Etobicoke West Mall",
  "Fenside-Parkwoods",
  "Financial District",
  "Flemingdon Park",
  "Forest Hill North",
  "Forest Hill South",
  "Fort York-Liberty Village",
  "Glenfield-Jane Heights",
  "Golfdale-Cedarbrae-Woburn",
  "Greenwood-Coxwell",
  "Guildwood",
  "Harbourfront-CityPlace",
  "Henry Farm",
  "High Park North",
  "High Park-Swansea",
  "Highland Creek",
  "Hillcrest Village",
  "Humber Bay Shores",
  "Humber Heights-Westmount",
  "Humber Summit",
  "Humbermede",
  "Humewood-Cedarvale",
  "Ionview",
  "Islington",
  "Junction Area",
  "Junction Triangle",
  "Keelesdale-Eglinton West",
  "Kennedy Park",
  "Kensington Market",
  "Kensington-Chinatown",
  "Kingsview Village-The Westway",
  "Kingsway South",
  "L'Amoreaux West",
  "Lambton Baby Point",
  "Lansing-Westgate",
  "Lawrence Park North",
  "Lawrence Park South",
  "Leaside-Bennington",
  "Little Portugal",
  "Long Branch",
  "Malvern East",
  "Malvern West",
  "Maple Leaf",
  "Markland Wood",
  "Milliken",
  "Mimico-Queensway",
  "Morningside",
  "Morningside Heights",
  "Moss Park",
  "Mount Dennis",
  "Mount Olive-Silverstone-Jamestown",
  "Mount Pleasant East",
  "New Toronto",
  "Newtonbrook East",
  "Newtonbrook West",
  "North Riverdale",
  "North St.James Town",
  "North Toronto",
  "O'Connor-Parkview",
  "Oakdale-Beverley Heights",
  "Oakridge",
  "Oakwood Village",
  "Old East York",
  "Palmerston-Little Italy",
  "Parkwoods-O'Connor Hills",
  "Pelmo Park-Humberlea",
  "Playter Estates-Danforth",
  "Pleasant View",
  "Princess-Rosethorn",
  "Regent Park",
  "Rexdale-Kipling",
  "Rockcliffe-Smythe",
  "Roncesvalles",
  "Rosedale-Moore Park",
  "Runnymede-Bloor West Village",
  "Rustic",
  "Scarborough Village",
  "South Eglinton-Davisville",
  "South Parkdale",
  "South Riverdale",
  "St Lawrence-East Bayfront-The Islands",
  "St.Andrew-Windfields",
  "Steeles",
  "Stonegate-Queensway",
  "Tam O'Shanter-Sullivan",
  "Taylor-Massey",
  "The Beaches",
  "The Pocket",
  "Thistletown-Beaumond Heights",
  "Thorncliffe Park",
  "Trinity-Bellwoods",
  "University",
  "Upper Beaches",
  "Victoria Village",
  "Wallace Emerson",
  "Ward's Island",
  "Wellington Place",
  "West Hill",
  "West Humber-Clairville",
  "West Queen West",
  "West Rouge",
  "Westminster-Branson",
  "Weston",
  "Weston-Pelham Park",
  "Wexford",
  "Willowdale West",
  "Willowridge-Martingrove-Richview",
  "Woburn North",
  "Woodbine Corridor",
  "Woodbine-Lumsden",
  "Wychwood",
  "Yonge-Bay Corridor",
  "Yonge-Doris",
  "Yonge-Eglinton",
  "Yonge-St.Clair",
  "York University Heights",
  "Yorkdale-Glen Park",
];

// Colloquial food strips. Kensington and Chinatown use official polygons.
// The rest are distance-to-street tests against OpenStreetMap road geometry,
// clipped to the stretch food people mean by that name.
const STREET_STRIPS = [
  {
    id: "ossington",
    street: "Ossington Avenue",
    minLat: 43.643,
    maxLat: 43.672,
    minLon: -79.428,
    maxLon: -79.412,
    meters: 145,
  },
  {
    id: "queen-west",
    street: "Queen Street West",
    minLat: 43.64,
    maxLat: 43.653,
    minLon: -79.432,
    maxLon: -79.388,
    meters: 130,
  },
  {
    id: "little-italy",
    street: "College Street",
    minLat: 43.652,
    maxLat: 43.66,
    minLon: -79.423,
    maxLon: -79.404,
    meters: 125,
  },
  {
    id: "danforth",
    street: "Danforth Avenue",
    minLat: 43.672,
    maxLat: 43.69,
    minLon: -79.362,
    maxLon: -79.318,
    meters: 150,
  },
  {
    id: "leslieville",
    street: "Queen Street East",
    minLat: 43.656,
    maxLat: 43.672,
    minLon: -79.353,
    maxLon: -79.318,
    meters: 160,
  },
];

const CUISINE_LABELS = {
  bbq: "Barbecue",
  barbecue: "Barbecue",
  kebab: "Kebab",
  kebap: "Kebab",
  dim_sum: "Dim Sum",
  coffee_shop: "Coffee",
  ice_cream: "Ice Cream",
  fish_and_chips: "Fish and Chips",
  middle_eastern: "Middle Eastern",
  latin_american: "Latin American",
  fast_food: "Fast Food",
  fish: "Seafood",
  seafood: "Seafood",
  burger: "Burgers",
  noodles: "Noodles",
  noodle: "Noodles",
  steak_house: "Steak",
  chicken: "Chicken",
  pizza: "Pizza",
  sushi: "Sushi",
  ramen: "Ramen",
  dumplings: "Dumplings",
  caribbean: "Caribbean",
  ethiopian: "Ethiopian",
  korean: "Korean",
  vietnamese: "Vietnamese",
  thai: "Thai",
  indian: "Indian",
  chinese: "Chinese",
  japanese: "Japanese",
  italian: "Italian",
  french: "French",
  greek: "Greek",
  mexican: "Mexican",
  portuguese: "Portuguese",
  spanish: "Spanish",
  turkish: "Turkish",
  lebanese: "Lebanese",
  persian: "Persian",
  african: "African",
  american: "American",
  canadian: "Canadian",
  mediterranean: "Mediterranean",
  vegan: "Vegan",
  vegetarian: "Vegetarian",
  breakfast: "Breakfast",
  brunch: "Brunch",
  dessert: "Dessert",
  tapas: "Tapas",
  georgian: "Georgian",
  filipino: "Filipino",
  malaysian: "Malaysian",
  indonesian: "Indonesian",
  taiwanese: "Taiwanese",
  cantonese: "Cantonese",
  szechuan: "Szechuan",
  sichuan: "Sichuan",
  hot_pot: "Hot Pot",
  shawarma: "Shawarma",
  wings: "Wings",
  sandwich: "Sandwiches",
  bagel: "Bagels",
  donut: "Donuts",
  crepe: "Crepes",
  pasta: "Pasta",
  poke: "Poke",
  hawaiian: "Hawaiian",
  brazilian: "Brazilian",
  peruvian: "Peruvian",
  argentinian: "Argentinian",
  argentine: "Argentine",
  cuban: "Cuban",
  jamaican: "Jamaican",
  tibetan: "Tibetan",
  nepalese: "Nepalese",
  pakistani: "Pakistani",
  bangladeshi: "Bangladeshi",
  sri_lankan: "Sri Lankan",
  afghan: "Afghan",
  moroccan: "Moroccan",
  egyptian: "Egyptian",
  israeli: "Israeli",
  syrian: "Syrian",
  iraqi: "Iraqi",
  armenian: "Armenian",
  georgian: "Georgian",
  ukrainian: "Ukrainian",
  polish: "Polish",
  german: "German",
  british: "British",
  irish: "Irish",
  soul_food: "Soul Food",
  cajun: "Cajun",
  "tex-mex": "Tex-Mex",
  tex_mex: "Tex-Mex",
  south_american: "South American",
  west_african: "West African",
  east_african: "East African",
  north_african: "North African",
  international: "International",
  regional: "Regional",
  asian: "Asian",
  fusion: "Fusion",
  diner: "Diner",
  deli: "Deli",
  pub: "Pub",
  wine_bar: "Wine Bar",
  bar_and_grill: "Bar and Grill",
};

const TILES = [
  [43.58, -79.64, 43.66, -79.5],
  [43.58, -79.5, 43.66, -79.4],
  [43.58, -79.4, 43.66, -79.3],
  [43.58, -79.3, 43.66, -79.12],
  [43.66, -79.64, 43.73, -79.48],
  [43.66, -79.48, 43.73, -79.38],
  [43.66, -79.38, 43.73, -79.28],
  [43.66, -79.28, 43.73, -79.12],
  [43.73, -79.64, 43.8, -79.4],
  [43.73, -79.4, 43.8, -79.12],
  [43.8, -79.64, 43.86, -79.4],
  [43.8, -79.4, 43.86, -79.12],
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function keepSnapshot(reason) {
  if (fs.existsSync(outFile)) {
    const existing = JSON.parse(fs.readFileSync(outFile, "utf8"));
    console.warn(
      `Fetch did not finish (${reason}). Keeping committed snapshot with ${existing.count ?? existing.restaurants?.length ?? "unknown"} restaurants.`,
    );
    process.exit(0);
  }
  console.error(`Fetch failed and no snapshot exists: ${reason}`);
  process.exit(1);
}

let mirrorCursor = 0;

async function overpass(query) {
  if (useCache) {
    fs.mkdirSync(cacheDir, { recursive: true });
    const cached = path.join(cacheDir, `${crypto.createHash("sha1").update(query).digest("hex")}.json`);
    if (fs.existsSync(cached)) {
      const json = JSON.parse(fs.readFileSync(cached, "utf8"));
      if (Array.isArray(json.elements)) {
        console.log(`  cache hit (${json.elements.length} elements)`);
        return json;
      }
    }
  }

  let lastError = null;
  const attempts = process.env.VERCEL ? 2 : MIRRORS.length * 2;
  const requestMs = process.env.VERCEL ? 20_000 : 100_000;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const endpoint = MIRRORS[(mirrorCursor + attempt) % MIRRORS.length];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), requestMs);
    try {
      console.log(`  POST ${endpoint}`);
      const response = await fetch(endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          Accept: "application/json",
          "User-Agent": "toronto-eats-90s/1.0 (static snapshot; OSM attribution on site)",
        },
        body: new URLSearchParams({ data: query }).toString(),
      });
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${text.slice(0, 160).replace(/\s+/g, " ")}`);
      }
      const json = JSON.parse(text);
      if (!Array.isArray(json.elements)) {
        throw new Error(json.remark || "Overpass response had no elements");
      }
      mirrorCursor = MIRRORS.indexOf(endpoint);
      if (useCache) {
        const cached = path.join(cacheDir, `${crypto.createHash("sha1").update(query).digest("hex")}.json`);
        fs.writeFileSync(cached, text);
      }
      await sleep(1200);
      return json;
    } catch (error) {
      lastError = error;
      console.warn(`  attempt failed: ${error.message}`);
      await sleep(2500 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

function chunk(list, size) {
  const out = [];
  for (let index = 0; index < list.length; index += size) out.push(list.slice(index, index + size));
  return out;
}

function samePoint(a, b) {
  return Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lon - b.lon) < 1e-6;
}

function stitch(lines) {
  const unused = lines.map((line) => line.slice());
  const rings = [];
  while (unused.length) {
    let ring = unused.pop();
    let guard = 0;
    let closed = false;
    while (guard < 5000) {
      guard += 1;
      if (ring.length >= 4 && samePoint(ring[0], ring[ring.length - 1])) {
        rings.push(ring);
        closed = true;
        break;
      }
      const end = ring[ring.length - 1];
      const start = ring[0];
      let found = -1;
      let reverse = false;
      let prepend = false;
      for (let index = 0; index < unused.length; index += 1) {
        const line = unused[index];
        const head = line[0];
        const tail = line[line.length - 1];
        if (samePoint(end, head)) {
          found = index;
          break;
        }
        if (samePoint(end, tail)) {
          found = index;
          reverse = true;
          break;
        }
        if (samePoint(start, tail)) {
          found = index;
          prepend = true;
          break;
        }
        if (samePoint(start, head)) {
          found = index;
          reverse = true;
          prepend = true;
          break;
        }
      }
      if (found === -1) break;
      let line = unused.splice(found, 1)[0];
      if (reverse) line.reverse();
      ring = prepend ? line.slice(0, -1).concat(ring) : ring.concat(line.slice(1));
    }
    if (!closed && ring.length >= 4) {
      // Keep nearly-closed shells. A one-node gap still works for point-in-polygon.
      rings.push(ring);
    }
  }
  return rings;
}

function ringArea(ring) {
  let area = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    area += ring[index].lon * ring[index + 1].lat - ring[index + 1].lon * ring[index].lat;
  }
  return Math.abs(area / 2);
}

function pointInRing(lat, lon, ring) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const yi = ring[index].lat;
    const xi = ring[index].lon;
    const yj = ring[previous].lat;
    const xj = ring[previous].lon;
    const intersects = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function parseNeighbourhoods(elements) {
  const areas = [];
  for (const element of elements) {
    const name = element.tags?.name;
    if (!name || !TORONTO_NEIGHBOURHOODS.includes(name)) continue;
    const outers = [];
    const inners = [];
    for (const member of element.members || []) {
      if (member.type !== "way" || !Array.isArray(member.geometry) || member.geometry.length < 2) continue;
      const line = member.geometry.map((point) => ({ lat: point.lat, lon: point.lon }));
      if ((member.role || "outer") === "inner") inners.push(line);
      else if ((member.role || "outer") === "outer") outers.push(line);
    }
    const outerRings = stitch(outers);
    const innerRings = stitch(inners);
    if (!outerRings.length) {
      console.warn(`  no ring for ${name}`);
      continue;
    }
    let minLat = 90;
    let maxLat = -90;
    let minLon = 180;
    let maxLon = -180;
    let area = 0;
    for (const ring of outerRings) {
      area += ringArea(ring);
      for (const point of ring) {
        minLat = Math.min(minLat, point.lat);
        maxLat = Math.max(maxLat, point.lat);
        minLon = Math.min(minLon, point.lon);
        maxLon = Math.max(maxLon, point.lon);
      }
    }
    for (const ring of innerRings) area -= ringArea(ring);
    areas.push({ name, outerRings, innerRings, minLat, maxLat, minLon, maxLon, area });
  }
  return areas;
}

function neighbourhoodAt(lat, lon, areas) {
  let best = null;
  for (const area of areas) {
    if (lat < area.minLat || lat > area.maxLat || lon < area.minLon || lon > area.maxLon) continue;
    const inOuter = area.outerRings.some((ring) => pointInRing(lat, lon, ring));
    if (!inOuter) continue;
    const inHole = area.innerRings.some((ring) => pointInRing(lat, lon, ring));
    if (inHole) continue;
    if (!best || area.area < best.area) best = area;
  }
  return best?.name || null;
}

function closestOnSegment(lat, lon, start, end) {
  const metresPerLat = 111320;
  const metresPerLon = 111320 * Math.cos((lat * Math.PI) / 180);
  const ax = (start.lon - lon) * metresPerLon;
  const ay = (start.lat - lat) * metresPerLat;
  const bx = (end.lon - lon) * metresPerLon;
  const by = (end.lat - lat) * metresPerLat;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  let t = lengthSquared === 0 ? 0 : (-ax * dx + -ay * dy) / lengthSquared;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return {
    dist: Math.hypot(cx, cy),
    lat: lat + cy / metresPerLat,
    lon: lon + cx / metresPerLon,
  };
}

function buildStreetIndex(elements) {
  const index = new Map(STREET_STRIPS.map((strip) => [strip.street, []]));
  for (const element of elements) {
    const name = element.tags?.name;
    if (!index.has(name) || !Array.isArray(element.geometry)) continue;
    const geometry = element.geometry;
    for (let pointIndex = 0; pointIndex < geometry.length - 1; pointIndex += 1) {
      index.get(name).push([
        { lat: geometry[pointIndex].lat, lon: geometry[pointIndex].lon },
        { lat: geometry[pointIndex + 1].lat, lon: geometry[pointIndex + 1].lon },
      ]);
    }
  }
  for (const strip of STREET_STRIPS) {
    console.log(`  ${strip.street}: ${index.get(strip.street).length} segments`);
  }
  return index;
}

function stripsAt(lat, lon, neighbourhood, streets) {
  const strips = [];
  if (neighbourhood === "Kensington Market") strips.push("kensington");
  if (neighbourhood === "Kensington-Chinatown") strips.push("chinatown");
  for (const strip of STREET_STRIPS) {
    const segments = streets.get(strip.street) || [];
    let near = false;
    for (const [start, end] of segments) {
      const hit = closestOnSegment(lat, lon, start, end);
      if (hit.dist > strip.meters) continue;
      if (
        hit.lat < strip.minLat ||
        hit.lat > strip.maxLat ||
        hit.lon < strip.minLon ||
        hit.lon > strip.maxLon
      ) {
        continue;
      }
      near = true;
      break;
    }
    if (near) strips.push(strip.id);
  }
  return strips;
}

function titleCase(value) {
  return value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function cuisinesFrom(tags) {
  if (!tags.cuisine) return [];
  const skip = new Set(["yes", "no", "restaurant", "food"]);
  const labels = [];
  for (const part of tags.cuisine.split(";")) {
    const key = part.trim().toLowerCase();
    if (!key || skip.has(key)) continue;
    const label = CUISINE_LABELS[key] || titleCase(key.replace(/_/g, " "));
    if (!labels.includes(label)) labels.push(label);
  }
  return labels;
}

function cleanUrl(raw) {
  if (!raw || typeof raw !== "string") return null;
  let value = raw.trim();
  if (!value) return null;
  if (value.startsWith("www.")) value = `https://${value}`;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}

function parsePrice(tags) {
  const raw = tags.price_range || tags.price || tags.cost || null;
  if (!raw) return null;
  const value = String(raw).trim();
  const key = value.toLowerCase();
  const mapped = {
    "$": "$",
    "1": "$",
    cheap: "$",
    inexpensive: "$",
    low: "$",
    "$$": "$$",
    "2": "$$",
    moderate: "$$",
    medium: "$$",
    mid: "$$",
    "$$$": "$$$",
    "3": "$$$",
    expensive: "$$$",
    high: "$$$",
    "$$$$": "$$$$",
    "4": "$$$$",
    "very expensive": "$$$$",
    luxury: "$$$$",
  };
  if (mapped[key]) return mapped[key];
  if (/^\${1,4}$/.test(value)) return value;
  return value;
}

function flag(tags, key) {
  const value = tags[key];
  if (value === "yes" || value === "only") return true;
  return false;
}

function addressFrom(tags) {
  if (tags["addr:full"]) return tags["addr:full"].trim();
  const street = tags["addr:street"];
  if (!street) return null;
  const unit = tags["addr:unit"] ? `Unit ${tags["addr:unit"]}` : null;
  const number = tags["addr:housenumber"] || null;
  return [unit, number, street].filter(Boolean).join(" ");
}

function elementLatLon(element) {
  if (typeof element.lat === "number" && typeof element.lon === "number") {
    return { lat: element.lat, lon: element.lon };
  }
  if (element.center && typeof element.center.lat === "number") {
    return { lat: element.center.lat, lon: element.center.lon };
  }
  return null;
}

function shouldSkip(tags) {
  if (!tags.name || !tags.name.trim()) return true;
  if (tags.disused === "yes" || tags.abandoned === "yes") return true;
  if (tags.access === "private" || tags.access === "no") return true;
  const hours = (tags.opening_hours || "").trim().toLowerCase();
  if (hours === "closed" || hours === "off" || hours === "shutdown") return true;
  return false;
}

function scoreRecord(record) {
  return [
    record.website ? 4 : 0,
    record.cuisines.length ? 2 : 0,
    record.address ? 2 : 0,
    record.phone ? 1 : 0,
    record.openingHours ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0);
}

async function main() {
  const started = Date.now();
  const deadline = started + (process.env.VERCEL ? 90_000 : 12 * 60_000);
  const assertTime = () => {
    if (Date.now() > deadline) {
      throw new Error("time budget exceeded");
    }
  };

  console.log("Fetching neighbourhood boundaries…");
  const neighbourhoodElements = [];
  let osmTimestamp = null;
  for (const names of chunk(TORONTO_NEIGHBOURHOODS, 12)) {
    assertTime();
    const clauses = names
      .map((name) => {
        const escaped = name.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        return `  relation["boundary"="administrative"]["admin_level"="10"]["name"="${escaped}"](43.58,-79.64,43.86,-79.10);`;
      })
      .join("\n");
    const query = `[out:json][timeout:70];\n(\n${clauses}\n);\nout geom;`;
    console.log(` neighbourhoods ${names[0]} … ${names[names.length - 1]}`);
    const json = await overpass(query);
    osmTimestamp = json.osm3s?.timestamp_osm_base || osmTimestamp;
    neighbourhoodElements.push(...json.elements);
  }
  const areas = parseNeighbourhoods(neighbourhoodElements);
  console.log(`Neighbourhood polygons: ${areas.length}`);
  const kensington = areas.find((area) => area.name === "Kensington Market");
  if (!kensington) throw new Error("Kensington Market boundary missing");
  const probeInside = neighbourhoodAt(43.6553, -79.4024, areas);
  console.log(`Probe Augusta & Baldwin → ${probeInside}`);
  if (probeInside !== "Kensington Market") {
    throw new Error(`Neighbourhood probe failed: ${probeInside}`);
  }

  console.log("Fetching street corridors…");
  assertTime();
  const streetJson = await overpass(`[out:json][timeout:70];
(
  way["name"="Queen Street West"]["highway"](43.638,-79.440,43.656,-79.380);
  way["name"="Queen Street East"]["highway"](43.654,-79.360,43.675,-79.310);
  way["name"="Ossington Avenue"]["highway"](43.640,-79.430,43.675,-79.410);
  way["name"="Danforth Avenue"]["highway"](43.670,-79.370,43.695,-79.310);
  way["name"="College Street"]["highway"](43.650,-79.430,43.662,-79.400);
);
out geom;`);
  const streets = buildStreetIndex(streetJson.elements);
  for (const strip of STREET_STRIPS) {
    if ((streets.get(strip.street) || []).length < 5) {
      throw new Error(`Too few segments for ${strip.street}`);
    }
  }

  console.log("Fetching restaurants…");
  const byId = new Map();
  for (const [south, west, north, east] of TILES) {
    assertTime();
    console.log(` tile ${south},${west} ${north},${east}`);
    const json = await overpass(`[out:json][timeout:80];
(
  node["amenity"="restaurant"]["name"](${south},${west},${north},${east});
  way["amenity"="restaurant"]["name"](${south},${west},${north},${east});
  relation["amenity"="restaurant"]["name"](${south},${west},${north},${east});
);
out center meta;`);
    osmTimestamp = json.osm3s?.timestamp_osm_base || osmTimestamp;
    for (const element of json.elements) {
      byId.set(`${element.type}/${element.id}`, element);
    }
  }

  const prepared = [];
  for (const element of byId.values()) {
    const tags = element.tags || {};
    if (tags.amenity !== "restaurant") continue;
    if (shouldSkip(tags)) continue;
    const point = elementLatLon(element);
    if (!point) continue;
    const neighbourhood = neighbourhoodAt(point.lat, point.lon, areas);
    if (!neighbourhood) continue;
    const record = {
      id: `${element.type}/${element.id}`,
      name: tags.name.replace(/\s+/g, " ").trim(),
      cuisines: cuisinesFrom(tags),
      neighbourhood,
      strips: stripsAt(point.lat, point.lon, neighbourhood, streets),
      price: parsePrice(tags),
      website: cleanUrl(tags.website || tags["contact:website"] || tags.url),
      address: addressFrom(tags),
      city: tags["addr:city"]?.trim() || null,
      postcode: tags["addr:postcode"]?.trim() || null,
      lat: Math.round(point.lat * 1e6) / 1e6,
      lon: Math.round(point.lon * 1e6) / 1e6,
      phone: tags.phone || tags["contact:phone"] || null,
      openingHours: tags.opening_hours?.trim() || null,
      outdoor: flag(tags, "outdoor_seating"),
      vegetarian: flag(tags, "diet:vegetarian"),
      vegan: flag(tags, "diet:vegan"),
      startDate: tags.start_date?.trim() || null,
      osmUpdated: element.timestamp || null,
      osmVersion: element.version || null,
    };
    prepared.push(record);
  }

  const deduped = new Map();
  for (const record of prepared) {
    const key = `${record.name.toLowerCase()}|${record.lat.toFixed(4)}|${record.lon.toFixed(4)}`;
    const existing = deduped.get(key);
    if (!existing || scoreRecord(record) > scoreRecord(existing)) deduped.set(key, record);
  }

  const restaurants = [...deduped.values()].sort((a, b) => a.name.localeCompare(b.name, "en"));
  const withCuisine = restaurants.filter((restaurant) => restaurant.cuisines.length).length;
  const withPrice = restaurants.filter((restaurant) => restaurant.price).length;
  const stripCounts = {};
  for (const restaurant of restaurants) {
    for (const strip of restaurant.strips) stripCounts[strip] = (stripCounts[strip] || 0) + 1;
  }
  console.log(`Restaurants inside Toronto neighbourhoods: ${restaurants.length}`);
  console.log(`With cuisine: ${withCuisine}; with price: ${withPrice}`);
  console.log("Strips:", stripCounts);

  if (restaurants.length < 800) throw new Error(`Only ${restaurants.length} restaurants`);
  if ((stripCounts.kensington || 0) < 8) throw new Error("Kensington strip looks empty");
  if ((stripCounts.chinatown || 0) < 8) throw new Error("Chinatown strip looks empty");

  const payload = {
    source: "OpenStreetMap",
    sourceUrl: "https://www.openstreetmap.org",
    license: "Open Database License (ODbL) 1.0",
    licenseUrl: "https://opendatacommons.org/licenses/odbl/1-0/",
    attribution: "© OpenStreetMap contributors",
    fetchedAt: new Date().toISOString(),
    osmTimestamp,
    count: restaurants.length,
    priceRecorded: withPrice,
    notes: {
      neighbourhoods:
        "Official City of Toronto neighbourhood boundaries from OpenStreetMap administrative relations.",
      strips:
        "Kensington and Chinatown follow the Kensington Market and Kensington-Chinatown boundaries. Ossington, Queen West, Little Italy, the Danforth, and Leslieville are restaurants within about a block of those streets on the stretches named in scripts/fetch-restaurants.mjs.",
      price:
        "price is copied from OpenStreetMap price_range, price, or cost. It is null when mappers left it out. Nothing is estimated.",
    },
    restaurants,
  };

  if (fs.existsSync(outFile)) {
    try {
      const existing = JSON.parse(fs.readFileSync(outFile, "utf8"));
      if (JSON.stringify(existing.restaurants) === JSON.stringify(restaurants)) {
        console.log(
          `Snapshot already has these ${restaurants.length} restaurants. Leaving the committed file in place.`,
        );
        return;
      }
    } catch {
      // A broken snapshot gets replaced below.
    }
  }

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const temporary = `${outFile}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(payload));
  fs.renameSync(temporary, outFile);
  console.log(`Wrote ${outFile} (${restaurants.length} restaurants) in ${Math.round((Date.now() - started) / 1000)}s`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  keepSnapshot(error.message);
});
