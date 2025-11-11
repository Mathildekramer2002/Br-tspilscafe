const DATA_URL =
  "https://raw.githubusercontent.com/cederdorff/race/refs/heads/master/data/games.json";

const els = {
  // top pills
  agePill: document.getElementById("age-pill"),
  playersPill: document.getElementById("players-pill"),
  durationPill: document.getElementById("duration-pill"),

  // search + basics
  search: document.getElementById("search-input"),
  list: document.getElementById("game-list"),

  // “flere filtre”
  genre: document.getElementById("genre-select"),
  language: document.getElementById("language-select"),
  difficulty: document.getElementById("difficulty-select"),
  ratingFrom: document.getElementById("rating-from"),
  ratingTo: document.getElementById("rating-to"),
  playFrom: document.getElementById("playtime-from"),
  playTo: document.getElementById("playtime-to"),
  availableOnly: document.getElementById("available-only"),
  sort: document.getElementById("sort-select"),
  clear: document.getElementById("clear-filters"),

  favFilter: document.getElementById("filter-favourites"),
};

let GAMES = [];
let FAVS = new Set(JSON.parse(localStorage.getItem("favs") || "[]"));

init();

async function init() {
  try {
    const res = await fetch(DATA_URL);
    GAMES = await res.json();
    hydrateSelects(GAMES);
    bindEvents();
    render();
  } catch (err) {
    console.error(err);
    els.list.innerHTML = `<p>Kunne ikke indlæse spil.</p>`;
  }
}

function hydrateSelects(games) {
  fillUniqueOptions(els.genre, unique(games.map((g) => g.genre)));
  fillUniqueOptions(els.language, unique(games.map((g) => g.language)));
  fillUniqueOptions(els.difficulty, unique(games.map((g) => g.difficulty)));

  // placeholders
  const ratings = games.map((g) => g.rating).filter(Number.isFinite);
  els.ratingFrom.placeholder = Math.min(...ratings).toFixed(1);
  els.ratingTo.placeholder = Math.max(...ratings).toFixed(1);
}

function bindEvents() {
  // alle input re-render
  [
    els.search,
    els.genre,
    els.language,
    els.difficulty,
    els.ratingFrom,
    els.ratingTo,
    els.playFrom,
    els.playTo,
    els.availableOnly,
    els.sort,
    els.agePill,
    els.playersPill,
    els.durationPill,
  ].forEach((el) => el.addEventListener("input", render));

  els.clear.addEventListener("click", () => {
    els.search.value = "";
    ["genre", "language", "difficulty"].forEach((k) => (els[k].value = "all"));
    ["ratingFrom", "ratingTo", "playFrom", "playTo"].forEach(
      (k) => (els[k].value = "")
    );
    els.availableOnly.checked = false;
    els.sort.value = "none";
    els.agePill.value = "all";
    els.playersPill.value = "all";
    els.durationPill.value = "all";
    render();
  });

  if (els.favFilter) {
    els.favFilter.addEventListener("click", () => {
      // toggler “kun favoritter” som en quick-filter via dataset-flag
      const active = els.favFilter.classList.toggle("active");
      els.favFilter.dataset.onlyFavs = active ? "1" : "";
      render();
    });
  }

  // deleger klik på hjerter
  els.list.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-fav-id]");
    if (!btn) return;
    const id = btn.dataset.favId;
    if (FAVS.has(id)) {
      FAVS.delete(id);
      btn.classList.remove("active");
    } else {
      FAVS.add(id);
      btn.classList.add("active");
    }
    localStorage.setItem("favs", JSON.stringify([...FAVS]));
    // hvis kun-favoritter filteret er aktivt, re-render
    if (els.favFilter?.dataset.onlyFavs) render();
  });
}

function getFilters() {
  const num = (v) => (v === "" || v == null ? null : Number(v));
  return {
    query: els.search.value.trim().toLowerCase(),
    genre: valueOrAll(els.genre),
    language: valueOrAll(els.language),
    difficulty: valueOrAll(els.difficulty),
    ratingFrom: num(els.ratingFrom.value),
    ratingTo: num(els.ratingTo.value),
    playFrom: num(els.playFrom.value),
    playTo: num(els.playTo.value),
    availableOnly: els.availableOnly.checked,
    sort: valueOrAll(els.sort),

    // top pills
    agePill: valueOrAll(els.agePill),
    playersPill: valueOrAll(els.playersPill),
    durationPill: valueOrAll(els.durationPill),

    onlyFavs: !!els.favFilter?.dataset.onlyFavs,
  };
}
const valueOrAll = (el) => (el && el.value ? el.value : "all");

function applyFilters(arr, f) {
  return arr.filter((g) => {
    // tekst
    const text = (
      g.title +
      " " +
      (g.description || "") +
      " " +
      (g.rules || "")
    ).toLowerCase();
    if (f.query && !text.includes(f.query)) return false;

    // “flere filtre”
    if (f.genre !== "all" && g.genre !== f.genre) return false;
    if (f.language !== "all" && g.language !== f.language) return false;
    if (f.difficulty !== "all" && g.difficulty !== f.difficulty) return false;
    if (f.ratingFrom != null && g.rating < f.ratingFrom) return false;
    if (f.ratingTo != null && g.rating > f.ratingTo) return false;
    if (f.playFrom != null && g.playtime < f.playFrom) return false;
    if (f.playTo != null && g.playtime > f.playTo) return false;
    if (f.availableOnly && !g.available) return false;

    // top-pills
    if (f.agePill !== "all" && g.age < Number(f.agePill)) return false;

    if (f.playersPill !== "all") {
      const [minStr, maxStr] = f.playersPill.split("-");
      const wantMin = Number(minStr);
      const wantMax = maxStr?.includes("+") ? 99 : Number(maxStr);
      const gMin = g.players?.min ?? 1;
      const gMax = g.players?.max ?? 99;
      // overlap check
      if (gMax < wantMin || gMin > wantMax) return false;
    }

    if (f.durationPill !== "all") {
      let [a, b] = f.durationPill.split("-");
      const from = Number(a);
      const to = b?.includes("+") ? 10000 : Number(b);
      if (g.playtime < from || g.playtime > to) return false;
    }

    if (f.onlyFavs && !FAVS.has(g.id)) return false;

    return true;
  });
}

function applySort(arr, key) {
  const out = [...arr];
  switch (key) {
    case "title":
      out.sort((a, b) => a.title.localeCompare(b.title, "da"));
      break;
    case "playtime":
      out.sort((a, b) => (a.playtime ?? 0) - (b.playtime ?? 0));
      break;
    case "rating":
      out.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      break;
  }
  return out;
}

function render() {
  const f = getFilters();
  const filtered = applyFilters(GAMES, f);
  const sorted = applySort(filtered, f.sort);

  if (!sorted.length) {
    els.list.innerHTML = `<p style="color:#7b5647">Ingen spil matcher dine filtre.</p>`;
    return;
  }
  els.list.innerHTML = sorted.map(gameCard).join("");
}

function gameCard(g) {
  const favActive = FAVS.has(g.id) ? "active" : "";
  const players = g.players ? `${g.players.min}–${g.players.max}` : "—";
  const rating = Number.isFinite(g.rating) ? g.rating.toFixed(1) : "—";
  const badgeAvail = g.available ? `<span class="badge">Ledig</span>` : ``;

  return `
    <article class="card">
      <div class="thumb">
        <img src="${g.image}" alt="${escapeHtml(g.title)}">
        <div class="badges">${badgeAvail}</div>
        <button class="fav ${favActive}" data-fav-id="${
    g.id
  }" aria-label="Føj til favoritter">❤</button>
      </div>
      <h3>${escapeHtml(g.title)}</h3>
      <div class="meta">
        <span>👥 ${players}</span>
        <span>⭐ ${rating}</span>
      </div>
      <div class="extra">
        ${g.shelf ? `<span>Placering: ${escapeHtml(g.shelf)}</span>` : ""}
      </div>
    </article>
  `;
}

/* ------- utils ------- */
function fillUniqueOptions(select, arr) {
  unique(arr).forEach((v) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = v;
    select.appendChild(o);
  });
}
function unique(arr) {
  return [...new Set(arr.filter(Boolean))].sort((a, b) =>
    String(a).localeCompare(String(b), "da")
  );
}
function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
