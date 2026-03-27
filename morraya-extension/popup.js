/**
 * MORRAYA – popup.js
 *
 * Lógica principal del popup. Conecta:
 *  - MetaMask/web3 (via web3.js)
 *  - Etherfuse price data (via background.js)
 *  - UI del popup.html (ya tienes el diseño)
 *
 * INSTRUCCIONES DE INTEGRACIÓN:
 * En tu popup.html agrega al final del <body>:
 *   <script type="module" src="popup.js"></script>
 *
 * IDs de elementos que este script espera en el DOM:
 *   #btn-connect       → botón "Conectar Wallet"
 *   #btn-invest        → botón "Invertir"
 *   #wallet-address    → span/div que muestra la dirección
 *   #wallet-balance    → span/div que muestra balance MON
 *   #purchase-amount   → input con el monto de la compra (ej: 91.50)
 *   #roundup-amount    → span que muestra el round-up calculado
 *   #cetes-apy         → span que muestra el APY de CETES
 *   #tx-result         → div oculto que aparece con el resultado de la tx
 *   #tx-hash           → anchor dentro de #tx-result
 *   #history-list      → ul/div para el historial de inversiones
 */

import {
  connectWallet,
  getMonBalance,
  investRoundup,
  onAccountChange,
  onChainChange,
  MONAD_TESTNET,
} from "./web3.js";

// ─── Estado ────────────────────────────────────────────────────────────────
let state = {
  walletAddress: null,
  monBalance:    0,
  cetesApy:      null,
  purchaseAmount: 0,
  roundupAmount:  0,
  history:        [],
};

// ─── Init ──────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  loadHistory();
  await loadCetesPrice();
  setupEventListeners();

  // Si ya hay una cuenta conectada (sesión previa), reconectar silenciosamente
  if (window.ethereum) {
    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    if (accounts.length > 0) {
      await onWalletConnected(accounts[0]);
    }
  }
});

// ─── Cargar precio de CETES desde Etherfuse (datos reales) ─────────────────
async function loadCetesPrice() {
  try {
    const data = await chrome.runtime.sendMessage({ type: "GET_CETES_PRICE" });

    if (data && !data.error) {
      state.cetesApy = data.apy;
      const apyEl = document.getElementById("cetes-apy");
      if (apyEl) {
        apyEl.textContent = data.apy
          ? `${(data.apy * 100).toFixed(2)}% APY`
          : "~10.5% APY";          // fallback para demo
      }
    }
  } catch (e) {
    console.warn("No se pudo cargar precio de CETES:", e);
    const apyEl = document.getElementById("cetes-apy");
    if (apyEl) apyEl.textContent = "~10.5% APY";
  }
}

// ─── Event listeners ──────────────────────────────────────────────────────
function setupEventListeners() {
  // Botón conectar wallet
  const btnConnect = document.getElementById("btn-connect");
  if (btnConnect) {
    btnConnect.addEventListener("click", handleConnect);
  }

  // Botón invertir
  const btnInvest = document.getElementById("btn-invest");
  if (btnInvest) {
    btnInvest.addEventListener("click", handleInvest);
  }

  // Input de monto de compra → calcular round-up en tiempo real
  const inputPurchase = document.getElementById("purchase-amount");
  if (inputPurchase) {
    inputPurchase.addEventListener("input", handlePurchaseChange);
  }

  // Escuchar cambios de cuenta en MetaMask
  onAccountChange((newAccount) => {
    if (newAccount) {
      onWalletConnected(newAccount);
    } else {
      onWalletDisconnected();
    }
  });

  // Si cambian de red, verificar que sigan en Monad
  onChainChange((chainId) => {
    if (chainId !== MONAD_TESTNET.chainId) {
      showStatus("⚠️ Cambia a Monad Testnet para invertir", "warning");
    } else {
      showStatus("✅ Conectado a Monad Testnet", "success");
    }
  });
}

// ─── Conectar wallet ───────────────────────────────────────────────────────
async function handleConnect() {
  const btn = document.getElementById("btn-connect");
  if (btn) {
    btn.textContent = "Conectando…";
    btn.disabled = true;
  }

  try {
    const address = await connectWallet();
    await onWalletConnected(address);
  } catch (err) {
    showStatus(`❌ ${err.message}`, "error");
    if (btn) {
      btn.textContent = "Conectar";
      btn.disabled = false;
    }
  }
}

async function onWalletConnected(address) {
  state.walletAddress = address;

  // Mostrar dirección truncada
  const addrEl = document.getElementById("wallet-address");
  if (addrEl) {
    addrEl.textContent = `${address.slice(0, 6)}…${address.slice(-4)}`;
    addrEl.style.color = "#94a3b8";
  }

  // Cargar balance
  try {
    const balance = await getMonBalance(address);
    state.monBalance = balance;
    const balEl = document.getElementById("wallet-balance");
    if (balEl) {
      balEl.textContent = `${balance.toFixed(4)} MON`;
      balEl.style.color = "#e2e8f0";
    }
  } catch (e) {
    console.warn("Error obteniendo balance:", e);
  }

  // Actualizar UI
  const btnConnect    = document.getElementById("btn-connect");
  const btnInvest     = document.getElementById("btn-invest");
  const btnInvestText = document.getElementById("btn-invest-text");
  if (btnConnect) {
    btnConnect.textContent = "✅ Conectado";
    btnConnect.disabled = true;
  }
  if (btnInvest) btnInvest.disabled = false;
  if (btnInvestText) btnInvestText.textContent = "Invertir Round-Up";

  showStatus("✅ Wallet conectada a Monad Testnet", "success");
}

function onWalletDisconnected() {
  state.walletAddress = null;
  const addrEl = document.getElementById("wallet-address");
  const balEl  = document.getElementById("wallet-balance");
  if (addrEl) { addrEl.textContent = "Sin conectar"; addrEl.style.color = "#475569"; }
  if (balEl)  { balEl.textContent  = "— MON";        balEl.style.color  = "#475569"; }

  const btnConnect = document.getElementById("btn-connect");
  const btnInvest  = document.getElementById("btn-invest");
  if (btnConnect) {
    btnConnect.textContent = "Conectar";
    btnConnect.disabled = false;
  }
  if (btnInvest) btnInvest.disabled = true;
}

// ─── Calcular round-up ─────────────────────────────────────────────────────
function calculateRoundup(amount) {
  if (!amount || amount <= 0) return 0;

  const roundUpTo = amount <= 50  ? 50  :
                    amount <= 100 ? 100 :
                    Math.ceil(amount / 100) * 100;

  return parseFloat((roundUpTo - amount).toFixed(2));
}

function handlePurchaseChange(e) {
  const amount = parseFloat(e.target.value) || 0;
  state.purchaseAmount = amount;
  state.roundupAmount  = calculateRoundup(amount);

  const roundupEl     = document.getElementById("roundup-amount");
  const btnInvestText = document.getElementById("btn-invest-text");

  if (roundupEl) {
    roundupEl.textContent = state.roundupAmount > 0
      ? `$${state.roundupAmount.toFixed(2)} MXN`
      : "—";
  }

  // Actualizar texto del botón si ya está conectado
  if (btnInvestText && state.walletAddress) {
    btnInvestText.textContent = state.roundupAmount > 0
      ? `Invertir $${state.roundupAmount.toFixed(2)} en CETES`
      : "Invertir Round-Up";
  }
}

// ─── Invertir ──────────────────────────────────────────────────────────────
async function handleInvest() {
  if (!state.walletAddress) {
    showStatus("Primero conecta tu wallet", "warning");
    return;
  }

  if (state.roundupAmount <= 0) {
    showStatus("Ingresa un monto de compra primero", "warning");
    return;
  }

  const btnInvest = document.getElementById("btn-invest");
  const btnInvestText = document.getElementById("btn-invest-text");
  if (btnInvest) btnInvest.disabled = true;
  if (btnInvestText) btnInvestText.textContent = "Firmando en MetaMask…";

  try {
    showStatus("Abre MetaMask para confirmar la tx…", "info");

    const result = await investRoundup(
      state.walletAddress,
      state.roundupAmount
    );

    // ── Éxito: mostrar hash real ─────────────────────────────────────────
    showTxResult(result.txHash, result.explorerUrl, result.amountMXN);

    // Guardar en historial
    saveToHistory({
      date:       new Date().toLocaleDateString("es-MX"),
      amount:     result.amountMXN,
      txHash:     result.txHash,
      explorerUrl: result.explorerUrl,
    });

    // Recargar balance
    const newBalance = await getMonBalance(state.walletAddress);
    state.monBalance = newBalance;
    const balEl = document.getElementById("wallet-balance");
    if (balEl) balEl.textContent = `${newBalance.toFixed(4)} MON`;

    showStatus("✅ Inversión completada. CETES recibidos.", "success");

  } catch (err) {
    if (err.code === 4001) {
      showStatus("Transacción rechazada por el usuario", "warning");
    } else {
      showStatus(`❌ Error: ${err.message}`, "error");
    }
  } finally {
    if (btnInvest) btnInvest.disabled = false;
    if (btnInvestText) btnInvestText.textContent = "Invertir Round-Up";
  }
}

// ─── Mostrar resultado de tx ───────────────────────────────────────────────
function showTxResult(txHash, explorerUrl, amountMXN) {
  const txResult      = document.getElementById("tx-result");
  const txHashEl      = document.getElementById("tx-hash");
  const txExplorerEl  = document.getElementById("tx-explorer");
  const txSuccessLabel = document.getElementById("tx-success-label");

  if (!txResult) return;

  txResult.style.display = "block";

  if (txSuccessLabel) {
    txSuccessLabel.textContent = `Inversión exitosa · $${amountMXN} MXN → CETES`;
  }

  if (txHashEl) {
    txHashEl.textContent = `${txHash.slice(0, 22)}…${txHash.slice(-6)}`;
    txHashEl.href = explorerUrl;
  }

  if (txExplorerEl) {
    txExplorerEl.href = explorerUrl;
    txExplorerEl.textContent = "Ver en Monad Explorer →";
  }
}

// ─── Historial ─────────────────────────────────────────────────────────────
function saveToHistory(entry) {
  state.history.unshift(entry);
  if (state.history.length > 20) state.history.pop(); // máximo 20 entradas

  chrome.storage.local.set({ morraya_history: state.history });
  renderHistory();
}

function loadHistory() {
  chrome.storage.local.get("morraya_history", (result) => {
    state.history = result.morraya_history || [];
    renderHistory();
  });
}

function renderHistory() {
  const listEl = document.getElementById("history-list");
  if (!listEl) return;

  if (state.history.length === 0) {
    listEl.innerHTML = `
      <li class="history-empty" style="background: transparent; justify-content: center;">
        Sin inversiones aún
      </li>`;
    return;
  }

  listEl.innerHTML = state.history.map((entry) => `
    <li>
      <span class="history-date">${entry.date}</span>
      <span class="history-amount">$${Number(entry.amount).toFixed(2)} MXN</span>
      <a
        class="history-hash"
        href="${entry.explorerUrl}"
        target="_blank"
        rel="noopener"
      >${entry.txHash.slice(0, 8)}…${entry.txHash.slice(-4)}</a>
    </li>
  `).join("");
}

// ─── Status messages ──────────────────────────────────────────────────────
function showStatus(msg, type = "info") {
  let statusEl = document.getElementById("status-message");

  // Si no existe en el DOM, lo creamos e insertamos al inicio del .content
  if (!statusEl) {
    statusEl = document.createElement("div");
    statusEl.id = "status-message";
    statusEl.style.cssText = `
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      margin: 0 0 4px;
      transition: opacity 0.4s ease;
    `;
    const content = document.querySelector(".content");
    if (content) content.prepend(statusEl);
    else document.body.prepend(statusEl);
  }

  const colors = {
    success: { bg: "#0d2d1a", color: "#4ade80", border: "#166534" },
    error:   { bg: "#2d0d0d", color: "#f87171", border: "#991b1b" },
    warning: { bg: "#2d1f0d", color: "#fbbf24", border: "#92400e" },
    info:    { bg: "#0d1a2d", color: "#60a5fa", border: "#1e3a5f" },
  };

  const c = colors[type] || colors.info;
  statusEl.style.cssText += `
    background: ${c.bg};
    color: ${c.color};
    border: 1px solid ${c.border};
    opacity: 1;
  `;
  statusEl.textContent = msg;

  // Auto-ocultar mensajes no críticos después de 4s
  if (type === "success" || type === "info") {
    clearTimeout(statusEl._timeout);
    statusEl._timeout = setTimeout(() => {
      statusEl.style.opacity = "0";
    }, 4000);
  }
}
