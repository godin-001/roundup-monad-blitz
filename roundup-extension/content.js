// ============================================================
// RoundUp — content.js
// Detecta montos de pago en páginas web automáticamente
// ============================================================

(function () {
  // Patrones para detectar precios en texto
  const PRICE_PATTERNS = [
    /\$\s*(\d{1,6}(?:,\d{3})*(?:\.\d{2}))/g,    // $13.44, $1,234.56
    /MXN\s*(\d{1,6}(?:,\d{3})*(?:\.\d{2}))/g,   // MXN 13.44
    /USD\s*(\d{1,6}(?:,\d{3})*(?:\.\d{2}))/g,   // USD 13.44
  ];

  // Selectores de elementos de "total" comunes en ecommerce
  const TOTAL_SELECTORS = [
    '[class*="total"]',
    '[class*="price"]',
    '[class*="amount"]',
    '[id*="total"]',
    '[id*="price"]',
    '[data-testid*="total"]',
    '[data-testid*="price"]',
  ];

  let detectedAmount = null;
  let highestAmount = 0;

  function extractPrice(text) {
    for (const pattern of PRICE_PATTERNS) {
      pattern.lastIndex = 0;
      const match = pattern.exec(text);
      if (match) {
        const num = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(num) && num > 0) return num;
      }
    }
    return null;
  }

  function scanPage() {
    // Buscar en selectores específicos primero
    for (const selector of TOTAL_SELECTORS) {
      try {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => {
          const text = el.innerText || el.textContent;
          const price = extractPrice(text);
          if (price && price > highestAmount && price < 100000) {
            highestAmount = price;
            detectedAmount = price;
          }
        });
      } catch (e) {}
    }

    // Si encontramos algo, guardarlo en storage
    if (detectedAmount !== null) {
      chrome.storage.local.set({ detectedAmount: detectedAmount.toFixed(2) });
    }
  }

  // Escanear al cargar
  if (document.readyState === 'complete') {
    scanPage();
  } else {
    window.addEventListener('load', scanPage);
  }

  // Observar cambios DOM (para páginas SPA / dinámicas)
  const observer = new MutationObserver(() => {
    scanPage();
  });
  observer.observe(document.body, { childList: true, subtree: true });

})();
