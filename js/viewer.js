import { loadMemoires } from "./data-store.js";
import { initPdfViewer } from "./pdf-viewer.js";

const titleEl = document.querySelector("#memoire-title");
const authorEl = document.querySelector("#memoire-author");
const yearEl = document.querySelector("#memoire-year");
const themesEl = document.querySelector("#memoire-themes");
const summaryEl = document.querySelector("#memoire-summary");

const errorEl = document.querySelector("#viewer-error");

function showError(message) {
  errorEl.textContent = message;
  errorEl.classList.remove("hidden");
}

function createThemeBadge(label) {
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = label;
  return badge;
}

function fillMetadata(memoire) {
  titleEl.textContent = memoire.title;
  authorEl.textContent = `Auteur/autrice : ${memoire.author}`;
  yearEl.textContent = `Année : ${memoire.year ?? "Non renseignée"}`;
  summaryEl.textContent = memoire.summary;

  themesEl.innerHTML = "";
  for (const theme of memoire.themes) {
    themesEl.append(createThemeBadge(theme));
  }
}

async function initViewer() {
  try {
    const slug = new URLSearchParams(window.location.search).get("slug");
    if (!slug) {
      showError("Aucun mémoire sélectionné.");
      return;
    }

    const memoires = await loadMemoires();
    const memoire = memoires.find((entry) => entry.slug === slug);

    if (!memoire) {
      showError("Mémoire introuvable. Vérifiez les métadonnées.");
      return;
    }

    if (!memoire.pdf) {
      showError("Le chemin PDF est manquant pour ce mémoire.");
      return;
    }

    fillMetadata(memoire);

    await initPdfViewer({
      pdfUrl: memoire.pdf,
      canvas: document.querySelector("#pdf-canvas"),
      canvasWrap: document.querySelector("#viewer-canvas-wrap"),
      prevButton: document.querySelector("#prev-page"),
      nextButton: document.querySelector("#next-page"),
      zoomInButton: document.querySelector("#zoom-in"),
      zoomOutButton: document.querySelector("#zoom-out"),
      fitButton: document.querySelector("#fit-width"),
      pageIndicator: document.querySelector("#page-indicator"),
      statusEl: document.querySelector("#viewer-status"),
    });
  } catch (error) {
    console.error("Erreur de chargement du viewer PDF:", error);
    showError("Impossible de charger ce PDF. Vérifiez que le fichier existe dans le dossier pdfs/.");
  }
}

initViewer();
