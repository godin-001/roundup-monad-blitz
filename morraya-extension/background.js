/**
 * MORRAYA – background.js (Service Worker MV3)
 *
 * Este service worker actúa como proxy para llamadas a Etherfuse API.
 * Los service workers en MV3 sí pueden hacer fetch cross-origin si
 * host_permissions está declarado en manifest.json.
 *
 * ¿Por qué aquí y no en popup.js?
 * - popup.js corre en una página de extensión → sujeta a CORS del servidor
 * - background.js es un service worker → bypass de CORS, puede incluir headers custom
 * - La API key NUNCA toca el DOM ni el popup → más seguro
 */

const ETHERFUSE_SANDBOX = "https://api.sand.etherfuse.com";
const ETHERFUSE_PROD    = "https://api.etherfuse.com";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getApiKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get("etherfuse_api_key", (result) => {
      resolve(result.etherfuse_api_key || null);
    });
  });
}

async function etherfuseFetch(path, options = {}) {
  const apiKey  = await getApiKey();
  const baseUrl = ETHERFUSE_SANDBOX; // cambiar a PROD para producción

  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: apiKey } : {}), // NO Bearer prefix
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Etherfuse API error ${res.status}: ${err}`);
  }

  return res.json();
}

// ─── Handlers de mensajes desde popup.js ────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse).catch((err) => {
    sendResponse({ error: err.message });
  });
  return true; // indica que la respuesta es asíncrona
});

async function handleMessage(message) {
  switch (message.type) {

    // ── Guardar API key (llamado desde la pantalla de configuración) ──────────
    case "SET_API_KEY": {
      await chrome.storage.local.set({ etherfuse_api_key: message.apiKey });
      return { ok: true };
    }

    // ── Precio público de CETES (no requiere API key) ────────────────────────
    // Endpoint público: /lookup/stablebonds
    case "GET_CETES_PRICE": {
      const data = await fetch(
        `${ETHERFUSE_SANDBOX}/lookup/stablebonds`
      ).then((r) => r.json());

      // Busca CETES en la lista
      const cetes = data.stablebonds?.find((b) =>
        b.symbol?.toUpperCase() === "CETES"
      );

      return {
        symbol: cetes?.symbol ?? "CETES",
        price: cetes?.price ?? null,         // precio en USD
        apy: cetes?.apy ?? cetes?.yield ?? null,
        currency: "MXN",
      };
    }

    // ── Assets disponibles en Monad (requiere API key) ───────────────────────
    case "GET_ASSETS": {
      const { walletAddress } = message;
      return etherfuseFetch(
        `/ramp/assets?blockchain=monad&currency=mxn&wallet=${walletAddress}`
      );
    }

    // ── Crear cotización (requiere API key) ───────────────────────────────────
    // Esto es parte del flujo completo de onramp con Etherfuse
    // Para el demo del hackathon usamos la ruta MockCETES on-chain
    case "CREATE_QUOTE": {
      const { fromAmount, assetIdentifier, walletAddress } = message;
      return etherfuseFetch("/ramp/quote", {
        method: "POST",
        body: JSON.stringify({
          blockchain: "monad",
          direction: "onramp",
          asset: assetIdentifier,
          fiatAmount: fromAmount,
          currency: "mxn",
          publicKey: walletAddress,
        }),
      });
    }

    default:
      throw new Error(`Mensaje desconocido: ${message.type}`);
  }
}
