import { getUniqueValues, loadMemoires, normalizeText } from "./data-store.js";

const listEl = document.querySelector("#memoire-list");
const countEl = document.querySelector("#results-count");
const errorEl = document.querySelector("#library-error");
const emptyEl = document.querySelector("#empty-state");

const searchInput = document.querySelector("#search-input");
const authorSelect = document.querySelector("#author-filter");
const themeSelect = document.querySelector("#theme-filter");
const resetButton = document.querySelector("#reset-filters");

let memoires = [];

function showError(message) {
  errorEl.textContent = message;
  errorEl.classList.remove("hidden");
}

function clearError() {
  errorEl.textContent = "";
  errorEl.classList.add("hidden");
}

function fillSelect(select, values, defaultLabel) {
  select.innerHTML = "";
  select.append(new Option(defaultLabel, ""));
  for (const value of values) {
    select.append(new Option(value, value));
  }
}

function createTag(text) {
  const tag = document.createElement("span");
  tag.className = "badge";
  tag.textContent = text;
  return tag;
}

function createMeta(label, value) {
  const item = document.createElement("span");
  item.className = "memoire-meta-item";

  const labelEl = document.createElement("span");
  labelEl.textContent = label;

  item.append(labelEl, document.createTextNode(value));
  return item;
}

function createThemeRow(themes) {
  const row = document.createElement("div");
  row.className = "badge-row";

  for (const theme of themes) {
    row.append(createTag(theme));
  }

  return row;
}

function createThemeBlock(themes = []) {
  const block = document.createElement("div");
  block.className = "theme-block";

  const visibleThemes = themes.slice(0, 8);
  const hiddenThemes = themes.slice(8);

  block.append(createThemeRow(visibleThemes));

  if (hiddenThemes.length > 0) {
    const details = document.createElement("details");
    details.className = "theme-details";

    const summary = document.createElement("summary");
    summary.textContent = `Voir ${hiddenThemes.length} mot${hiddenThemes.length > 1 ? "s" : ""}-clé${hiddenThemes.length > 1 ? "s" : ""} de plus`;

    details.append(summary, createThemeRow(hiddenThemes));
    block.append(details);
  }

  return block;
}

function createMemoireCard(memoire) {
  const article = document.createElement("article");
  article.className = "memoire-card";

  const viewerHref = `./viewer.html?slug=${encodeURIComponent(memoire.slug)}`;

  const coverLink = document.createElement("a");
  coverLink.className = "memoire-cover-link";
  coverLink.href = viewerHref;
  coverLink.setAttribute("aria-label", `Consulter le mémoire ${memoire.title}`);

  const cover = document.createElement("img");
  cover.className = "memoire-cover";
  cover.src = memoire.cover || "./assets/covers/traces-vivantes.svg";
  cover.alt = `Couverture du mémoire ${memoire.title}`;
  cover.loading = "lazy";
  coverLink.append(cover);

  const content = document.createElement("div");
  content.className = "memoire-content";

  const header = document.createElement("div");
  header.className = "memoire-header";

  const title = document.createElement("h2");
  title.className = "memoire-title";
  title.textContent = memoire.title;
  header.append(title);

  const meta = document.createElement("div");
  meta.className = "memoire-meta";
  meta.append(
    createMeta("Auteur/autrice", memoire.author || "Non renseigné"),
    createMeta("Année", memoire.year ? String(memoire.year) : "Non renseignée"),
  );

  const summary = document.createElement("p");
  summary.className = "memoire-summary";
  summary.textContent = memoire.summary || "Résumé non renseigné.";

  const actions = document.createElement("div");
  actions.className = "memoire-actions";

  const openButton = document.createElement("a");
  openButton.className = "button";
  openButton.href = viewerHref;
  openButton.textContent = "Consulter";
  actions.append(openButton);

  content.append(header, meta, summary, createThemeBlock(memoire.themes), actions);
  article.append(coverLink, content);

  return article;
}

function currentFilters() {
  return {
    search: normalizeText(searchInput.value),
    author: normalizeText(authorSelect.value),
    theme: normalizeText(themeSelect.value),
  };
}

function matchesFilters(memoire, filters) {
  if (filters.author && normalizeText(memoire.author) !== filters.author) {
    return false;
  }

  if (filters.theme) {
    const hasTheme = memoire.themes.some((theme) => normalizeText(theme) === filters.theme);
    if (!hasTheme) {
      return false;
    }
  }

  if (filters.search) {
    const haystack = normalizeText(
      [memoire.title, memoire.author, memoire.summary, memoire.year, memoire.themes.join(" ")].join(" "),
    );
    if (!haystack.includes(filters.search)) {
      return false;
    }
  }

  return true;
}

function renderList(items) {
  listEl.innerHTML = "";

  if (items.length === 0) {
    emptyEl.classList.remove("hidden");
  } else {
    emptyEl.classList.add("hidden");
    for (const memoire of items) {
      listEl.append(createMemoireCard(memoire));
    }
  }

  const label = items.length > 1 ? "mémoires" : "mémoire";
  countEl.textContent = `${items.length} ${label} affiché${items.length > 1 ? "s" : ""}`;
}

function applyFilters() {
  const filters = currentFilters();
  const filtered = memoires.filter((memoire) => matchesFilters(memoire, filters));
  renderList(filtered);
}

function resetFilters() {
  searchInput.value = "";
  authorSelect.value = "";
  themeSelect.value = "";
  applyFilters();
}

async function initLibrary() {
  try {
    clearError();
    memoires = await loadMemoires();

    fillSelect(authorSelect, getUniqueValues(memoires, "author"), "Tous");
    fillSelect(themeSelect, getUniqueValues(memoires, "themes"), "Tous");

    renderList(memoires);

    [searchInput, authorSelect, themeSelect].forEach((input) => {
      input.addEventListener("input", applyFilters);
      input.addEventListener("change", applyFilters);
    });

    resetButton.addEventListener("click", resetFilters);
  } catch {
    showError("Impossible de charger la bibliothèque. Vérifiez le fichier data/memoires.json.");
    countEl.textContent = "Aucun résultat";
    emptyEl.classList.add("hidden");
  }
}

initLibrary();
