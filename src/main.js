const STRIPS = [
  { id: "kensington", label: "Kensington" },
  { id: "chinatown", label: "Chinatown" },
  { id: "ossington", label: "Ossington" },
  { id: "queen-west", label: "Queen West" },
  { id: "little-italy", label: "Little Italy" },
  { id: "danforth", label: "The Danforth" },
  { id: "leslieville", label: "Leslieville" },
];

const PAGE_SIZE = 12;

const state = {
  payload: null,
  hood: "",
  cuisine: "",
  price: "",
  query: "",
  whatsNew: false,
  page: 1,
  surprise: null,
  laughs: 0,
  hasPriceData: false,
};

const directory = document.getElementById("directory");
const dialog = document.getElementById("guest-dialog");
const applauseButton = document.getElementById("applause");
const laughsLabel = document.getElementById("laughs");

let audioContext = null;
let hoodSelect;
let cuisineSelect;
let priceSelect;
let searchInput;

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else node.setAttribute(key, String(value));
  }
  for (const child of [].concat(children)) {
    if (child == null || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

function stripLabel(id) {
  return STRIPS.find((strip) => strip.id === id)?.label || id;
}

function readUrl() {
  const params = new URLSearchParams(location.search);
  state.hood = params.get("hood") || "";
  state.cuisine = params.get("cuisine") || "";
  state.price = params.get("price") || "";
  state.query = params.get("q") || "";
  state.whatsNew = params.get("new") === "1";
  state.page = Math.max(1, Number.parseInt(params.get("page") || "1", 10) || 1);
}

function writeUrl() {
  const params = new URLSearchParams();
  if (state.hood) params.set("hood", state.hood);
  if (state.cuisine) params.set("cuisine", state.cuisine);
  if (state.price) params.set("price", state.price);
  if (state.query) params.set("q", state.query);
  if (state.whatsNew) params.set("new", "1");
  if (state.page > 1) params.set("page", String(state.page));
  const query = params.toString();
  const next = `${location.pathname}${query ? `?${query}` : ""}${location.hash}`;
  history.replaceState(null, "", next);
}

function isFresh(restaurant, now = new Date()) {
  const year = Number.parseInt(String(restaurant.startDate || "").slice(0, 4), 10);
  if (Number.isFinite(year) && year >= now.getFullYear() - 2) return true;
  if (restaurant.osmVersion === 1 && restaurant.osmUpdated) {
    const updated = new Date(restaurant.osmUpdated).getTime();
    if (Number.isFinite(updated) && now.getTime() - updated < 1000 * 60 * 60 * 24 * 730) return true;
  }
  return false;
}

function matches(restaurant) {
  if (state.hood.startsWith("strip:")) {
    if (!restaurant.strips?.includes(state.hood.slice(6))) return false;
  } else if (state.hood.startsWith("nbhd:")) {
    if (restaurant.neighbourhood !== state.hood.slice(5)) return false;
  }
  if (state.cuisine === "__none__") {
    if (restaurant.cuisines?.length) return false;
  } else if (state.cuisine && !restaurant.cuisines?.includes(state.cuisine)) {
    return false;
  }
  if (state.hasPriceData && state.price === "none") {
    if (restaurant.price) return false;
  } else if (state.hasPriceData && state.price && restaurant.price !== state.price) {
    return false;
  }
  if (state.whatsNew && !isFresh(restaurant)) return false;
  const query = state.query.trim().toLowerCase();
  if (query) {
    const haystack = [restaurant.name, restaurant.neighbourhood, restaurant.address, restaurant.city, ...(restaurant.cuisines || [])]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(query)) return false;
  }
  return true;
}

function hoodPhrase() {
  if (state.hood.startsWith("strip:")) return stripLabel(state.hood.slice(6));
  if (state.hood.startsWith("nbhd:")) return state.hood.slice(5);
  return "";
}

function episodeTitle() {
  if (state.surprise && !state.surprise.empty) return "The One With the Surprise Guest";
  const place = hoodPhrase();
  const food = state.cuisine && state.cuisine !== "__none__" ? state.cuisine : "";
  if (food && place) return `The One Where You Find ${food} in ${place}`;
  if (food) return `The One Where You Find ${food}`;
  if (place) return `The One in ${place}`;
  if (state.whatsNew) return "The One With the New Kid";
  if (state.query.trim()) return "The One Where You Know the Name";
  if (state.hasPriceData && state.price && state.price !== "none") return "The One With the Price Tag";
  return "The One Where You Scroll the Menu";
}

function mapsUrl(restaurant) {
  const query = [restaurant.name, restaurant.address, restaurant.city || "Toronto"].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function osmUrl(restaurant) {
  const [type, id] = restaurant.id.split("/");
  return `https://www.openstreetmap.org/${type}/${id}`;
}

function addressLine(restaurant) {
  const line = [restaurant.address, restaurant.city, restaurant.postcode].filter(Boolean).join(", ");
  return line || "Street address not on the map";
}

function priceText(price) {
  if (!price) return "No price recorded";
  if (price === "$") return "$";
  if (price === "$$") return "$$";
  if (price === "$$$") return "$$$";
  if (price === "$$$$") return "$$$$";
  return price;
}

function extraStrips(restaurant) {
  return (restaurant.strips || []).filter((id) => {
    if (id === "kensington" && restaurant.neighbourhood === "Kensington Market") return false;
    if (id === "chinatown" && restaurant.neighbourhood === "Kensington-Chinatown") return false;
    return true;
  });
}

function externalLink(href, className, label) {
  return el("a", {
    href,
    class: className,
    target: "_blank",
    rel: "noopener noreferrer",
  }, [
    label,
    el("span", { class: "visually-hidden" }, " (opens in a new tab)"),
  ]);
}

function playApplause() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  if (!audioContext) audioContext = new AudioCtx();
  if (audioContext.state === "suspended") audioContext.resume();
  const duration = 0.95;
  const length = Math.floor(audioContext.sampleRate * duration);
  const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
  const channel = buffer.getChannelData(0);
  const hits = [0, 0.11, 0.2, 0.34, 0.46, 0.6, 0.74];
  for (let index = 0; index < length; index += 1) {
    const time = index / audioContext.sampleRate;
    let envelope = 0;
    for (const hit of hits) {
      const delta = time - hit;
      if (delta >= 0 && delta < 0.16) envelope += Math.exp(-delta * 26);
    }
    channel[index] = (Math.random() * 2 - 1) * envelope * 0.35;
  }
  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  const filter = audioContext.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 700;
  source.connect(filter).connect(audioContext.destination);
  source.start();
}

function bumpLaughs() {
  state.laughs += 1;
  laughsLabel.textContent = `${state.laughs} laugh${state.laughs === 1 ? "" : "s"}`;
  applauseButton.classList.add("lit");
  window.setTimeout(() => applauseButton.classList.remove("lit"), 900);
}

function filteredRestaurants() {
  return state.payload.restaurants.filter(matches);
}

function renderCard(restaurant, index) {
  const website = restaurant.website;
  const map = mapsUrl(restaurant);
  const primaryHref = website || map;
  const stamps = [
    state.hasPriceData ? el("span", { class: "stamp", text: priceText(restaurant.price) }) : null,
    restaurant.outdoor ? el("span", { class: "stamp", text: "Patio" }) : null,
    restaurant.vegan ? el("span", { class: "stamp", text: "Vegan tagged" }) : null,
    !restaurant.vegan && restaurant.vegetarian ? el("span", { class: "stamp", text: "Vegetarian tagged" }) : null,
    isFresh(restaurant) ? el("span", { class: "stamp fresh", text: restaurant.startDate ? `Opened ${restaurant.startDate}` : "New on the map" }) : null,
  ].filter(Boolean);

  return el("article", { class: "card" }, [
    el("p", { class: "guest-no", text: `Guest star ${index + 1}` }),
    el("div", { class: "neighbourhood-bar", text: restaurant.neighbourhood }),
    extraStrips(restaurant).length
      ? el("div", { class: "strip-row" }, extraStrips(restaurant).map((id) => el("span", { class: "strip", text: `${stripLabel(id)} strip` })))
      : null,
    el("h3", {}, [
      el("a", { href: primaryHref, target: "_blank", rel: "noopener noreferrer", text: restaurant.name }),
    ]),
    el("div", { class: "cuisine-row" }, (restaurant.cuisines.length ? restaurant.cuisines : ["Cuisine not recorded"]).map((cuisine) =>
      el("span", { class: "cuisine", text: cuisine }),
    )),
    el("p", { class: "address", text: addressLine(restaurant) }),
    stamps.length ? el("div", { class: "stamps" }, stamps) : null,
    restaurant.openingHours
      ? restaurant.openingHours.length > 140
        ? el("details", { class: "hours" }, [
            el("summary", { text: "Hours on the call sheet" }),
            el("p", { text: restaurant.openingHours.replaceAll(";", " · ") }),
          ])
        : el("p", { class: "hours", text: restaurant.openingHours.replaceAll(";", " · ") })
      : null,
    restaurant.phone ? el("p", { class: "phone" }, [el("a", { href: `tel:${restaurant.phone.replace(/[^\d+]/g, "")}`, text: restaurant.phone })]) : null,
    el("div", { class: "card-actions" }, [
      website ? externalLink(website, "action primary", "Visit their site") : null,
      externalLink(map, website ? "action" : "action primary", "Search on Google Maps"),
      externalLink(osmUrl(restaurant), "action", "OpenStreetMap"),
    ]),
  ]);
}

function renderDialog() {
  dialog.replaceChildren();
  const surprise = state.surprise;
  if (!surprise) {
    if (dialog.open) dialog.close();
    return;
  }
  if (surprise.empty) {
    dialog.append(
      el("div", { class: "guest-card" }, [
        el("p", { class: "guest-kicker", text: "Cold open" }),
        el("h2", { id: "guest-title", text: "The couch is empty" }),
        el("p", { text: "This filter combination has no restaurants on the call sheet. Clear a filter and try the surprise again." }),
        el("div", { class: "guest-actions" }, [
          el("button", { type: "button", class: "close-guest", text: "Back to the episode", onClick: closeSurprise }),
        ]),
      ]),
    );
  } else {
    dialog.append(
      el("div", { class: "guest-card" }, [
        el("p", { class: "guest-kicker", text: "Tonight's very special guest" }),
        el("h2", { id: "guest-title", text: surprise.name }),
        el("p", { text: `${surprise.neighbourhood}${surprise.cuisines?.length ? ` · ${surprise.cuisines.join(", ")}` : ""}` }),
        el("p", { text: addressLine(surprise) }),
        state.hasPriceData ? el("p", { text: `Price on the script: ${priceText(surprise.price)}` }) : null,
        el("div", { class: "guest-actions" }, [
          surprise.website ? externalLink(surprise.website, "primary", "Visit their site") : null,
          externalLink(mapsUrl(surprise), surprise.website ? "" : "primary", "Search on Google Maps"),
          el("button", { type: "button", text: "Different guest", onClick: pickSurprise }),
          el("button", { type: "button", class: "close-guest", text: "Back to the episode", onClick: closeSurprise }),
        ]),
      ]),
    );
  }
  if (!dialog.open) dialog.showModal();
}

function closeSurprise() {
  state.surprise = null;
  if (dialog.open) dialog.close();
  renderResults();
}

function pickSurprise() {
  const pool = filteredRestaurants();
  if (!pool.length) {
    state.surprise = { empty: true };
  } else {
    state.surprise = pool[Math.floor(Math.random() * pool.length)];
    playApplause();
    bumpLaughs();
  }
  renderDialog();
  renderResults();
}

function syncControls() {
  if (hoodSelect.value !== state.hood) hoodSelect.value = state.hood;
  if (cuisineSelect.value !== state.cuisine) cuisineSelect.value = state.cuisine;
  if (priceSelect.value !== state.price) priceSelect.value = state.price;
  if (document.activeElement !== searchInput && searchInput.value !== state.query) searchInput.value = state.query;
  document.querySelectorAll("[data-strip]").forEach((button) => {
    button.setAttribute("aria-pressed", button.dataset.strip === state.hood ? "true" : "false");
  });
  document.getElementById("whats-new")?.setAttribute("aria-pressed", state.whatsNew ? "true" : "false");
}

function renderResults() {
  const matchesNow = filteredRestaurants();
  const pages = Math.max(1, Math.ceil(matchesNow.length / PAGE_SIZE));
  if (state.page > pages) state.page = pages;
  if (state.page < 1) state.page = 1;
  writeUrl();
  syncControls();

  const title = episodeTitle();
  document.title = `${title} — Must-See Menu`;
  document.getElementById("episode").textContent = title;

  const bits = [];
  if (hoodPhrase()) bits.push(hoodPhrase());
  if (state.cuisine === "__none__") bits.push("cuisine not recorded");
  else if (state.cuisine) bits.push(state.cuisine);
  if (state.hasPriceData && state.price === "none") bits.push("price not recorded");
  else if (state.hasPriceData && state.price) bits.push(state.price);
  if (state.whatsNew) bits.push("new on the map");
  if (state.query.trim()) bits.push(`matching “${state.query.trim()}”`);
  const where = bits.length ? bits.join(" · ") : "all of Toronto";
  const noun = matchesNow.length === 1 ? "restaurant" : "restaurants";
  document.getElementById("logline").textContent = `${matchesNow.length} ${noun} · ${where}`;

  const results = document.getElementById("results");
  const start = (state.page - 1) * PAGE_SIZE;
  const pageItems = matchesNow.slice(start, start + PAGE_SIZE);
  results.replaceChildren();

  if (!pageItems.length) {
    const priceMiss = state.hasPriceData && state.price && state.price !== "none";
    results.append(
      el("div", { class: "empty" }, [
        el("h3", { text: priceMiss ? "No dollar sign on this call sheet" : "The audience is quiet" }),
        el("p", {
          text: priceMiss
            ? `OpenStreetMap has no ${state.price} price tag in this cut. Recorded prices are uncommon in Toronto, so try “Any price” or “Price not recorded”.`
            : "Nothing in the snapshot matches this combination. Clear a filter, pick another block, or ask the audience for a surprise.",
        }),
      ]),
    );
  } else {
    const grid = el("div", { class: "grid" });
    pageItems.forEach((restaurant, index) => grid.append(renderCard(restaurant, start + index)));
    results.append(grid);
  }

  const pager = document.getElementById("pager");
  pager.replaceChildren();
  if (pages > 1) {
    pager.append(
      el("button", {
        type: "button",
        class: "page-btn",
        text: "Previous episode",
        disabled: state.page === 1 ? "" : null,
        onClick: () => {
          state.page -= 1;
          renderResults();
          directory.scrollIntoView({ behavior: "smooth", block: "start" });
        },
      }),
      el("p", { text: `Scene ${state.page} of ${pages}` }),
      el("button", {
        type: "button",
        class: "page-btn",
        text: "Next episode",
        disabled: state.page === pages ? "" : null,
        onClick: () => {
          state.page += 1;
          renderResults();
          directory.scrollIntoView({ behavior: "smooth", block: "start" });
        },
      }),
    );
  }
}

function option(value, label) {
  return el("option", { value, text: label });
}

function buildShell() {
  const restaurants = state.payload.restaurants;
  const stripCounts = Object.fromEntries(STRIPS.map((strip) => [strip.id, 0]));
  const neighbourhoodCounts = new Map();
  const cuisineCounts = new Map();
  let unlistedCuisine = 0;
  const priceCounts = new Map();
  for (const restaurant of restaurants) {
    for (const strip of restaurant.strips || []) {
      if (stripCounts[strip] != null) stripCounts[strip] += 1;
    }
    neighbourhoodCounts.set(restaurant.neighbourhood, (neighbourhoodCounts.get(restaurant.neighbourhood) || 0) + 1);
    if (!restaurant.cuisines?.length) unlistedCuisine += 1;
    for (const cuisine of restaurant.cuisines || []) {
      cuisineCounts.set(cuisine, (cuisineCounts.get(cuisine) || 0) + 1);
    }
    if (restaurant.price) priceCounts.set(restaurant.price, (priceCounts.get(restaurant.price) || 0) + 1);
  }
  const recordedPrices = [...priceCounts.values()].reduce((sum, count) => sum + count, 0);
  state.hasPriceData = recordedPrices > 0;
  if (!state.hasPriceData) state.price = "";

  hoodSelect = el("select", { id: "hood", name: "hood" }, [
    option("", "Every neighbourhood"),
  ]);
  const featured = el("optgroup", { label: "The blocks" });
  for (const strip of STRIPS) {
    featured.append(option(`strip:${strip.id}`, `${strip.label} (${stripCounts[strip.id]})`));
  }
  const official = el("optgroup", { label: "City neighbourhoods" });
  for (const name of [...neighbourhoodCounts.keys()].sort((a, b) => a.localeCompare(b))) {
    official.append(option(`nbhd:${name}`, `${name} (${neighbourhoodCounts.get(name)})`));
  }
  hoodSelect.append(featured, official);

  cuisineSelect = el("select", { id: "cuisine", name: "cuisine" }, [
    option("", "Every cuisine"),
    option("__none__", `Cuisine not recorded (${unlistedCuisine})`),
  ]);
  for (const name of [...cuisineCounts.keys()].sort((a, b) => a.localeCompare(b))) {
    cuisineSelect.append(option(name, `${name} (${cuisineCounts.get(name)})`));
  }

  priceSelect = el("select", { id: "price", name: "price" }, [
    option("", "Any price"),
    option("$", `$ (${priceCounts.get("$") || 0})`),
    option("$$", `$$ (${priceCounts.get("$$") || 0})`),
    option("$$$", `$$$ (${priceCounts.get("$$$") || 0})`),
    option("$$$$", `$$$$ (${priceCounts.get("$$$$") || 0})`),
    option("none", "Price not recorded"),
  ]);

  searchInput = el("input", {
    id: "search",
    type: "search",
    name: "q",
    placeholder: "Search a name, street, or cuisine",
    value: state.query,
  });

  const form = el("form", { class: "remote", id: "remote" }, [
    el("div", { class: "chips" }, [
      el("button", {
        type: "button",
        class: "chip",
        "data-strip": "",
        text: "Every block",
        onClick: () => {
          state.hood = "";
          state.page = 1;
          renderResults();
        },
      }),
      ...STRIPS.map((strip) =>
        el("button", {
          type: "button",
          class: "chip",
          "data-strip": `strip:${strip.id}`,
          text: strip.label,
          onClick: () => {
            state.hood = `strip:${strip.id}`;
            state.page = 1;
            renderResults();
          },
        }),
      ),
    ]),
    el("div", { class: state.hasPriceData ? "fields has-price" : "fields" }, [
      el("label", {}, ["Neighbourhood", hoodSelect]),
      el("label", {}, ["Cuisine", cuisineSelect]),
      state.hasPriceData ? el("label", {}, ["Price", priceSelect]) : null,
    ]),
    el("label", { class: "search-field" }, ["Search the call sheet", searchInput]),
    el("div", { class: "actions-row" }, [
      el("button", { type: "button", class: "action primary", id: "surprise", text: "Surprise me", onClick: pickSurprise }),
      el("button", {
        type: "button",
        class: "action",
        id: "whats-new",
        text: "What's new",
        onClick: () => {
          state.whatsNew = !state.whatsNew;
          state.page = 1;
          renderResults();
        },
      }),
      el("button", {
        type: "button",
        class: "action",
        text: "Clear the set",
        onClick: () => {
          state.hood = "";
          state.cuisine = "";
          state.price = "";
          state.query = "";
          state.whatsNew = false;
          state.page = 1;
          searchInput.value = "";
          renderResults();
        },
      }),
    ]),
    el("p", {
      class: "hint",
      text: state.hasPriceData
        ? "What's new keeps places added to OpenStreetMap in the last two years, and any opening date a mapper wrote down. Prices are the dollar signs stored on the map."
        : "What's new keeps places added to OpenStreetMap in the last two years, and any opening date a mapper wrote down.",
    }),
  ]);

  form.addEventListener("submit", (event) => event.preventDefault());
  hoodSelect.addEventListener("change", () => {
    state.hood = hoodSelect.value;
    state.page = 1;
    renderResults();
  });
  cuisineSelect.addEventListener("change", () => {
    state.cuisine = cuisineSelect.value;
    state.page = 1;
    renderResults();
  });
  priceSelect.addEventListener("change", () => {
    state.price = priceSelect.value;
    state.page = 1;
    renderResults();
  });
  searchInput.addEventListener("input", () => {
    state.query = searchInput.value;
    state.page = 1;
    renderResults();
  });

  directory.replaceChildren(
    el("h2", { class: "episode", id: "episode" }),
    el("p", { class: "logline", id: "logline" }),
    form,
    el("div", { id: "results" }),
    el("div", { class: "pager", id: "pager" }),
  );

  const when = state.payload.fetchedAt ? new Date(state.payload.fetchedAt).toLocaleDateString("en-CA", { dateStyle: "long" }) : "the latest snapshot";
  const priceCredit = state.hasPriceData ? ` ${recordedPrices} have a price tag in OpenStreetMap.` : "";
  document.getElementById("credit-meta").textContent = `${state.payload.count} restaurants in this snapshot, fetched ${when}.${priceCredit} ${state.payload.attribution}.`;
}

function showError(message) {
  directory.replaceChildren(
    el("div", { class: "empty" }, [
      el("h3", { text: "Technical difficulties" }),
      el("p", { text: message }),
    ]),
  );
}

applauseButton.addEventListener("click", () => {
  playApplause();
  bumpLaughs();
});

dialog.addEventListener("close", () => {
  state.surprise = null;
  renderResults();
});

readUrl();

fetch("/data/restaurants.json")
  .then((response) => {
    if (!response.ok) throw new Error("The restaurant snapshot did not load.");
    return response.json();
  })
  .then((payload) => {
    state.payload = payload;
    buildShell();
    renderResults();
  })
  .catch((error) => {
    showError(error.message || "The restaurant snapshot did not load.");
  });
