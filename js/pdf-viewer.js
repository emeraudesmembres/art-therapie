import * as pdfjsLib from "../vendor/pdfjs/build/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL("../vendor/pdfjs/build/pdf.worker.min.mjs", import.meta.url).toString();

export async function initPdfViewer({
  pdfUrl,
  canvas,
  canvasWrap,
  prevButton,
  nextButton,
  zoomInButton,
  zoomOutButton,
  fitButton,
  pageIndicator,
  statusEl,
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

  function setStatus(message) {
    statusEl.textContent = message;
  }

  function updateControls() {
    if (!pdfDoc) {
      pageIndicator.textContent = "Page - / -";
      prevButton.disabled = true;
      nextButton.disabled = true;
      return;
    }
    pageIndicator.textContent = `Page ${currentPage} / ${pdfDoc.numPages}`;
    prevButton.disabled = currentPage <= 1;
    nextButton.disabled = currentPage >= pdfDoc.numPages;
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

  function zoom(delta) {
    if (!pdfDoc) {
      return;
    }
    fitMode = false;
    scale = Math.max(0.5, Math.min(3, scale + delta));
    void queueRender(currentPage);
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

  window.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && ["p", "s"].includes(event.key.toLowerCase())) {
      event.preventDefault();
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

  setStatus("Chargement du mémoire...");
  updateControls();

  const loadingTask = pdfjsLib.getDocument({
    url: resolvedPdfUrl,
  });

  pdfDoc = await loadingTask.promise;
  setStatus("Lecture active");

  await queueRender(currentPage);
}
