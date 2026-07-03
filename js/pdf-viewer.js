import * as pdfjsLib from "../vendor/pdfjs/build/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("../vendor/pdfjs/build/pdf.worker.min.mjs", import.meta.url).toString();

export async function initPdfViewer({
  pdfUrl,
  canvas,
  highlightLayer,
  canvasWrap,
  prevButton,
  nextButton,
  zoomInButton,
  zoomOutButton,
  fitButton,
  fullscreenButton,
  pageIndicator,
  pageJumpForm,
  pageJumpInput,
  searchForm,
  searchInput,
  searchPrevButton,
  searchStatusEl,
  viewerShell,
}) {
  if (!pdfUrl) {
    throw new Error("PDF introuvable.");
  }

  const resolvedPdfUrl = new URL(pdfUrl, window.location.href).toString();
  const context = canvas.getContext("2d", { alpha: false });
  let pdfDoc = null;
  let currentPage = 1;
  let scale = 1;
  let fitMode = true;
  let rendering = false;
  let pendingPage = null;
  let pageTexts = [];
  let searchMatches = [];
  let activeMatchIndex = -1;
  let lastSearchQuery = "";

  function normalizeSearchText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function updateControls() {
    if (!pdfDoc) {
      pageIndicator.textContent = "Page - / -";
      prevButton.disabled = true;
      nextButton.disabled = true;
      pageJumpInput.disabled = true;
      pageJumpInput.removeAttribute("max");
      searchInput.disabled = true;
      searchPrevButton.disabled = true;
      return;
    }
    pageIndicator.textContent = `Page ${currentPage} / ${pdfDoc.numPages}`;
    prevButton.disabled = currentPage <= 1;
    nextButton.disabled = currentPage >= pdfDoc.numPages;
    pageJumpInput.disabled = false;
    pageJumpInput.max = String(pdfDoc.numPages);
    pageJumpInput.placeholder = String(currentPage);
    searchInput.disabled = false;
    searchPrevButton.disabled = searchMatches.length === 0;
  }

  function clearHighlights() {
    highlightLayer.innerHTML = "";
    highlightLayer.style.width = canvas.style.width;
    highlightLayer.style.height = canvas.style.height;
  }

  async function renderSearchHighlights(page, viewport) {
    clearHighlights();

    const query = normalizeSearchText(lastSearchQuery);
    if (!query) {
      return;
    }

    const textContent = await page.getTextContent();
    for (const item of textContent.items) {
      const itemText = normalizeSearchText(item.str || "");
      if (!itemText.includes(query)) {
        continue;
      }

      const transform = pdfjsLib.Util.transform(viewport.transform, item.transform);
      const fontHeight = Math.hypot(transform[2], transform[3]);
      const highlight = document.createElement("span");
      highlight.className = "pdf-search-highlight";
      highlight.style.left = `${transform[4]}px`;
      highlight.style.top = `${transform[5] - fontHeight}px`;
      highlight.style.width = `${Math.max(8, item.width * scale)}px`;
      highlight.style.height = `${Math.max(8, fontHeight)}px`;
      highlightLayer.append(highlight);
    }
  }

  async function renderPage(pageNumber) {
    if (!pdfDoc) {
      return;
    }
    rendering = true;

    try {
      const page = await pdfDoc.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });

      if (fitMode) {
        const maxWidth = Math.max(300, canvasWrap.clientWidth - 40);
        scale = Math.max(0.5, Math.min(2.4, maxWidth / baseViewport.width));
      }

      const viewport = page.getViewport({ scale });
      const outputScale = window.devicePixelRatio || 1;

      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const renderContext = {
        canvasContext: context,
        viewport,
        transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null,
      };

      await page.render(renderContext).promise;
      await renderSearchHighlights(page, viewport);
      updateControls();
    } finally {
      rendering = false;
    }

    if (pendingPage !== null) {
      const nextPendingPage = pendingPage;
      pendingPage = null;
      await renderPage(nextPendingPage);
    }
  }

  async function queueRender(pageNumber) {
    if (!pdfDoc) {
      return;
    }
    if (rendering) {
      pendingPage = pageNumber;
      return;
    }
    await renderPage(pageNumber);
  }

  function changePage(delta) {
    if (!pdfDoc) {
      return;
    }
    const nextPage = Math.min(pdfDoc.numPages, Math.max(1, currentPage + delta));
    if (nextPage !== currentPage) {
      currentPage = nextPage;
      void queueRender(currentPage);
    }
  }

  function goToPage(pageNumber) {
    if (!pdfDoc) {
      return;
    }
    const nextPage = Math.min(pdfDoc.numPages, Math.max(1, Number(pageNumber) || 1));
    if (nextPage !== currentPage) {
      currentPage = nextPage;
      void queueRender(currentPage);
    } else {
      updateControls();
    }
  }

  function zoom(delta) {
    if (!pdfDoc) {
      return;
    }
    fitMode = false;
    scale = Math.max(0.5, Math.min(3, scale + delta));
    void queueRender(currentPage);
  }

  function updateSearchStatus(message) {
    searchStatusEl.textContent = message;
  }

  async function extractPageText(pageNumber) {
    const page = await pdfDoc.getPage(pageNumber);
    const content = await page.getTextContent();
    return content.items.map((item) => item.str || "").join(" ");
  }

  async function buildTextIndex() {
    pageTexts = new Array(pdfDoc.numPages);
    for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber += 1) {
      pageTexts[pageNumber - 1] = normalizeSearchText(await extractPageText(pageNumber));
    }
  }

  function countOccurrences(text, query) {
    if (!query) {
      return 0;
    }

    let count = 0;
    let offset = 0;
    while (offset <= text.length) {
      const foundIndex = text.indexOf(query, offset);
      if (foundIndex === -1) {
        break;
      }
      count += 1;
      offset = foundIndex + Math.max(1, query.length);
    }
    return count;
  }

  function findClosestMatchIndex() {
    const currentIndex = searchMatches.findIndex((match) => match.page >= currentPage);
    return currentIndex === -1 ? 0 : currentIndex;
  }

  function runSearch(direction = 1) {
    if (!pdfDoc) {
      return;
    }

    const query = normalizeSearchText(searchInput.value);
    if (!query) {
      searchMatches = [];
      activeMatchIndex = -1;
      lastSearchQuery = "";
      updateSearchStatus("");
      clearHighlights();
      updateControls();
      return;
    }

    if (query !== lastSearchQuery) {
      searchMatches = [];
      for (let index = 0; index < pageTexts.length; index += 1) {
        const count = countOccurrences(pageTexts[index], query);
        for (let matchNumber = 0; matchNumber < count; matchNumber += 1) {
          searchMatches.push({ page: index + 1 });
        }
      }
      activeMatchIndex = searchMatches.length > 0 ? findClosestMatchIndex() : -1;
      lastSearchQuery = query;
    } else if (searchMatches.length > 0) {
      activeMatchIndex = (activeMatchIndex + direction + searchMatches.length) % searchMatches.length;
    }

    if (searchMatches.length === 0) {
      updateSearchStatus("Aucun résultat");
      updateControls();
      return;
    }

    const activeMatch = searchMatches[activeMatchIndex];
    const resultLabel = `${activeMatchIndex + 1} / ${searchMatches.length}`;
    updateSearchStatus(`${resultLabel} · page ${activeMatch.page}`);
    const shouldRefreshCurrentPage = activeMatch.page === currentPage;
    goToPage(activeMatch.page);
    if (shouldRefreshCurrentPage) {
      void queueRender(currentPage);
    }
    updateControls();
  }

  async function toggleFullscreen() {
    if (!document.fullscreenElement) {
      await viewerShell.requestFullscreen();
      fullscreenButton.textContent = "Quitter";
      return;
    }
    await document.exitFullscreen();
    fullscreenButton.textContent = "Plein écran";
  }

  canvas.addEventListener("contextmenu", (event) => event.preventDefault());

  prevButton.addEventListener("click", () => changePage(-1));
  nextButton.addEventListener("click", () => changePage(1));
  zoomInButton.addEventListener("click", () => zoom(0.15));
  zoomOutButton.addEventListener("click", () => zoom(-0.15));
  fitButton.addEventListener("click", () => {
    fitMode = true;
    void queueRender(currentPage);
  });
  fullscreenButton.addEventListener("click", () => {
    void toggleFullscreen();
  });
  document.addEventListener("fullscreenchange", () => {
    fullscreenButton.textContent = document.fullscreenElement ? "Quitter" : "Plein écran";
    if (fitMode && pdfDoc) {
      void queueRender(currentPage);
    }
  });

  pageJumpForm.addEventListener("submit", (event) => {
    event.preventDefault();
    goToPage(pageJumpInput.value);
  });

  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    runSearch(1);
  });

  searchPrevButton.addEventListener("click", () => runSearch(-1));
  searchInput.addEventListener("input", () => {
    lastSearchQuery = "";
    searchMatches = [];
    activeMatchIndex = -1;
    clearHighlights();
    if (!searchInput.value.trim()) {
      updateSearchStatus("");
    }
    updateControls();
  });

  window.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && ["p", "s"].includes(event.key.toLowerCase())) {
      event.preventDefault();
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
      event.preventDefault();
      searchInput.focus();
      searchInput.select();
    }
    if (event.key === "ArrowLeft") {
      changePage(-1);
    }
    if (event.key === "ArrowRight") {
      changePage(1);
    }
  });

  const resizeObserver = new ResizeObserver(() => {
    if (fitMode && pdfDoc) {
      void queueRender(currentPage);
    }
  });
  resizeObserver.observe(canvasWrap);

  updateControls();

  const loadingTask = pdfjsLib.getDocument({
    url: resolvedPdfUrl,
  });

  pdfDoc = await loadingTask.promise;
  await buildTextIndex();

  await queueRender(currentPage);
}
