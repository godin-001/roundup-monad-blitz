/**
 * MORRAYA – app.js
 *
 * Lógica completa usando window.ethereum (MetaMask API) directamente.
 * Sin dependencias externas — MetaMask ya expone todo lo que ethers.js usa bajo el capó.
 *
 * ─── CONFIGURACIÓN ──────────────────────────────────────────────────────────
 * Después de deployar MockCETES.sol en Remix, reemplaza esta línea:
 */
const CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000"; // ← tu contrato aquí

// Monad Testnet
const MONAD = {
  chainId:          "0x279F",          // 10143
  chainName:        "Monad Testnet",
  nativeCurrency:   { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls:          ["https://testnet-rpc.monad.xyz"],
  blockExplorerUrls:["https://testnet.monadexplorer.com"],
};

const EXPLORER = "https://testnet.monadexplorer.com/tx/";
const CETES_APY = 0.108; // 10.8% anual

// ─── ESTADO ────────────────────────────────────────────────────────────────
const S = {
  wallet:        null,
  monBalance:    0,
  cetesBalance:  0,
  totalInvested: 0,   // MXN acumulado (histórico)
  accumulated:   0,   // round-ups guardados sin invertir (MXN)
  history:       [],  // max 20 entradas
  multiple:      50,  // pill seleccionado
  purchase:      0,   // input del usuario
  residuo:       0,   // round-up calculado
  roundedTo:     0,
  investing:     false,
};

// ─── HELPERS ───────────────────────────────────────────────────────────────

function hexToFloat(hex) {
  if (!hex || hex === "0x") return 0;
  return Number(BigInt(hex)) / 1e18;
}

/** Convierte MXN a wei para el demo: $1 MXN = 1_000_000_000_000 wei (1e12) */
function mxnToWei(mxn) {
  const wei = BigInt(Math.floor(mxn * 1e12));
  return "0x" + wei.toString(16);
}

function calcRoundup(amount, multiple) {
  if (!amount || amount <= 0) return { roundedTo: 0, residuo: 0 };
  const next = Math.ceil(amount / multiple) * multiple;
  const residuo = parseFloat((next - amount).toFixed(2));
  return { roundedTo: next, residuo: residuo === 0 ? 0 : residuo };
}

/** Proyección anual: asume este residuo 3 veces al día, 365 días, al 10.8% */
function calcProjection(residuo, totalInvested) {
  const futureAccum = residuo * 3 * 365;
  const interest    = (totalInvested + futureAccum) * CETES_APY;
  return interest.toFixed(2);
}

function fmtMXN(val) {
  return `$${Number(val).toFixed(2)}`;
}

function fmtDate(ts) {
  const diff = Date.now() - ts;
  if (diff < 86_400_000)  return "Hoy";
  if (diff < 172_800_000) return "Ayer";
  return new Date(ts).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

function shortAddr(addr) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function shortHash(hash) {
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

// ─── STORAGE ────────────────────────────────────────────────────────────────

function persist() {
  const data = {
    totalInvested: S.totalInvested,
    cetesBalance:  S.cetesBalance,
    accumulated:   S.accumulated,
    history:       S.history,
  };
  if (typeof chrome !== "undefined" && chrome?.storage?.local) {
    chrome.storage.local.set({ morraya: data });
  } else {
    localStorage.setItem("morraya", JSON.stringify(data));
  }
}

function hydrate(cb) {
  if (typeof chrome !== "undefined" && chrome?.storage?.local) {
    chrome.storage.local.get("morraya", (r) => {
      if (r.morraya) Object.assign(S, r.morraya);
      cb();
    });
  } else {
    const raw = localStorage.getItem("morraya");
    if (raw) Object.assign(S, JSON.parse(raw));
    cb();
  }
}

// ─── WALLET ─────────────────────────────────────────────────────────────────

async function ensureWallet() {
  if (!window.ethereum) throw new Error("Instala MetaMask primero");
  if (!S.wallet) {
    const accs = await window.ethereum.request({ method: "eth_requestAccounts" });
    if (!accs?.length) throw new Error("Sin acceso a cuentas");
    S.wallet = accs[0];
  }
  await ensureMonad();
  return S.wallet;
}

async function ensureMonad() {
  const chainId = await window.ethereum.request({ method: "eth_chainId" });
  if (chainId === MONAD.chainId) return;

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: MONAD.chainId }],
    });
  } catch (err) {
    if (err.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [MONAD],
      });
    } else {
      throw err;
    }
  }
}

async function refreshBalance() {
  if (!S.wallet) return;
  try {
    const hex = await window.ethereum.request({
      method: "eth_getBalance",
      params: [S.wallet, "latest"],
    });
    S.monBalance = hexToFloat(hex);
  } catch {}

  // mCETES balance via eth_call si el contrato está deployado
  const isContract = CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000";
  if (isContract) {
    try {
      // balanceOf(address) selector: 0x70a08231
      const paddedAddr = S.wallet.toLowerCase().replace("0x", "").padStart(64, "0");
      const result = await window.ethereum.request({
        method: "eth_call",
        params: [
          { to: CONTRACT_ADDRESS, data: "0x70a08231" + paddedAddr },
          "latest",
        ],
      });
      S.cetesBalance = result && result !== "0x" ? parseInt(result, 16) : 0;
    } catch {}
  }
}

// ─── INVEST ─────────────────────────────────────────────────────────────────

async function sendInvestTx(amountMXN) {
  await ensureWallet();
  const valueHex = mxnToWei(amountMXN);
  const isContract = CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000";

  const txParams = {
    from:  S.wallet,
    to:    isContract ? CONTRACT_ADDRESS : S.wallet,
    value: valueHex,
    gas:   isContract ? "0x186A0" : "0x5208", // 100k vs 21k gas
  };

  // Contrato deployado: llama receive() (no data → recibe MON → mintea mCETES)
  // Fallback: self-transfer con metadata en hex para generar un hash real
  if (!isContract) {
    txParams.data = "0x4d4f525241594120524f554e442d5550"; // "MORRAYA ROUND-UP" UTF-8 → hex
  }

  const txHash = await window.ethereum.request({
    method: "eth_sendTransaction",
    params: [txParams],
  });

  return txHash;
}

// ─── UI RENDERING ───────────────────────────────────────────────────────────

function renderWallet() {
  const noW = document.getElementById("stateNoWallet");
  const yeW = document.getElementById("stateConnected");

  if (!S.wallet) {
    noW.classList.remove("hidden");
    yeW.classList.add("hidden");
  } else {
    noW.classList.add("hidden");
    yeW.classList.remove("hidden");
    document.getElementById("walletAddr").textContent = shortAddr(S.wallet);
    document.getElementById("walletBal").textContent  = S.monBalance.toFixed(4);
  }
}

function renderStats() {
  document.getElementById("statInvested").textContent = fmtMXN(S.totalInvested);
  document.getElementById("statCetes").textContent    =
    S.cetesBalance > 0 ? S.cetesBalance.toLocaleString("es-MX") : "0";
  const yield_ = (S.totalInvested * CETES_APY).toFixed(2);
  document.getElementById("statYield").textContent = fmtMXN(yield_);
}

function renderBreakdown() {
  const { purchase, residuo, roundedTo } = S;

  if (purchase <= 0) {
    ["brPurchase", "brRounded", "brResidue", "brProjection"].forEach((id) => {
      document.getElementById(id).textContent = "—";
    });
    document.getElementById("btnInvest").disabled    = true;
    document.getElementById("btnAccumulate").disabled = true;
    document.getElementById("btnInvestIcon").textContent = "🔒";
    return;
  }

  document.getElementById("brPurchase").textContent  = fmtMXN(purchase);
  document.getElementById("brRounded").textContent   = fmtMXN(roundedTo);
  document.getElementById("brResidue").textContent   =
    residuo > 0 ? fmtMXN(residuo) : "$0.00 (exacto)";
  document.getElementById("brProjection").textContent =
    residuo > 0 ? `+${fmtMXN(calcProjection(residuo, S.totalInvested))} / año` : "—";

  const canAct = residuo > 0;
  document.getElementById("btnInvest").disabled    = !canAct;
  document.getElementById("btnAccumulate").disabled = !canAct;
  document.getElementById("btnInvestIcon").textContent = canAct ? "🚀" : "🔒";
}

function renderAccBadge() {
  const badge = document.getElementById("accBadge");
  if (S.accumulated > 0) {
    badge.classList.remove("hidden");
    document.getElementById("accAmount").textContent = fmtMXN(S.accumulated);
  } else {
    badge.classList.add("hidden");
  }
}

function renderHistory() {
  const list = document.getElementById("historyList");
  if (!S.history.length) {
    list.innerHTML = `<div class="h-empty">Sin operaciones aún</div>`;
    return;
  }

  list.innerHTML = S.history
    .slice(0, 6)
    .map((h) => {
      const typeClass = h.type === "invested" ? "invested" : "accumulated";
      const typeLabel = h.type === "invested" ? "TX" : "ACUM";
      const hashLine  = h.txHash
        ? `<a class="h-hash" href="${EXPLORER}${h.txHash}" target="_blank" rel="noopener">
             ${shortHash(h.txHash)}
           </a>`
        : `<span class="h-hash" style="color:var(--gold)">Sin tx (acumulado)</span>`;

      return `
        <div class="h-item">
          <div class="h-type ${typeClass}"></div>
          <div class="h-info">
            <div class="h-top">
              <span class="h-amount ${typeClass === "invested" ? "green" : "gold"}">
                ${fmtMXN(h.amount)}
              </span>
              <span class="h-date">${fmtDate(h.ts)}</span>
            </div>
            ${hashLine}
          </div>
          <span class="h-tag ${typeClass}">${typeLabel}</span>
        </div>`;
    })
    .join("");
}

function renderAll() {
  renderWallet();
  renderStats();
  renderBreakdown();
  renderAccBadge();
  renderHistory();
}

// ─── TOAST ──────────────────────────────────────────────────────────────────

let _toastTimer = null;
function toast(msg, type = "info", duration = 4000) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className   = type;
  el.style.display = "block";
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { el.style.display = "none"; }, duration);
}

// ─── EVENT HANDLERS ─────────────────────────────────────────────────────────

function onAmountChange() {
  const val = parseFloat(document.getElementById("amountInput").value) || 0;
  S.purchase = val;
  const { roundedTo, residuo } = calcRoundup(val, S.multiple);
  S.roundedTo = roundedTo;
  S.residuo   = residuo;
  renderBreakdown();
  renderAccBadge();
  // Actualizar texto del botón invertir con monto
  if (residuo > 0) {
    document.getElementById("btnInvestText").textContent = `Invertir ${fmtMXN(residuo)}`;
  } else {
    document.getElementById("btnInvestText").textContent = "Invertir";
  }
}

function onPillClick(e) {
  const pill = e.target.closest(".pill");
  if (!pill) return;
  document.querySelectorAll(".pill").forEach((p) => p.classList.remove("active"));
  pill.classList.add("active");
  S.multiple = parseInt(pill.dataset.val);
  onAmountChange(); // recalcular con nuevo múltiplo
}

async function onConnect() {
  const btn = document.getElementById("btnConnect");
  btn.disabled    = true;
  btn.textContent = "Conectando…";
  try {
    await ensureWallet();
    await refreshBalance();
    toast("✅ Wallet conectada a Monad Testnet", "success");
    renderAll();
  } catch (err) {
    toast(`❌ ${err.message}`, "error");
  } finally {
    btn.disabled    = false;
    btn.textContent = "Conectar";
  }
}

function onDisconnect() {
  S.wallet     = null;
  S.monBalance = 0;
  renderWallet();
  toast("Wallet desconectada", "info", 2000);
}

async function onInvest(amount) {
  if (S.investing) return;
  const investAmount = amount ?? S.residuo;
  if (!investAmount || investAmount <= 0) return;

  S.investing = true;
  const btnInvest = document.getElementById("btnInvest");
  btnInvest.disabled = true;
  document.getElementById("btnInvestIcon").textContent = "⏳";
  document.getElementById("btnInvestText").textContent = "Esperando MetaMask…";

  // Ocultar tx anterior
  document.getElementById("txSuccess").classList.add("hidden");

  try {
    // Conectar si no está conectado
    if (!S.wallet) {
      toast("Conectando wallet…", "info");
      await ensureWallet();
      await refreshBalance();
      renderWallet();
    }

    toast("Confirma la tx en MetaMask…", "info", 60000);
    const txHash = await sendInvestTx(investAmount);

    // ── Éxito ───────────────────────────────────────────────────────────────
    const explorerUrl = EXPLORER + txHash;

    // Mostrar tx success card
    const txSuccessEl = document.getElementById("txSuccess");
    txSuccessEl.classList.remove("hidden");
    document.getElementById("txSuccessLabel").textContent =
      `$${investAmount.toFixed(2)} MXN → CETES ✨`;
    document.getElementById("txHashLink").textContent = shortHash(txHash);
    document.getElementById("txHashLink").href        = explorerUrl;
    document.getElementById("txExplorerLink").href    = explorerUrl;

    // Actualizar estado
    S.totalInvested += investAmount;
    S.cetesBalance  += Math.floor(investAmount); // local approx
    S.accumulated   = amount ? 0 : S.accumulated; // si se invirtió acumulado, limpiar

    // Guardar en historial
    S.history.unshift({
      type:   "invested",
      amount: investAmount,
      txHash,
      ts:     Date.now(),
    });
    if (S.history.length > 20) S.history.pop();

    persist();
    await refreshBalance();
    toast(`✅ Tx confirmada: ${shortHash(txHash)}`, "success");
    renderAll();

    // Reset input
    document.getElementById("amountInput").value = "";
    S.purchase = 0; S.residuo = 0; S.roundedTo = 0;
    renderBreakdown();

  } catch (err) {
    if (err.code === 4001) {
      toast("Tx rechazada por el usuario", "warn");
    } else if (err.code === 4902) {
      toast("Agrega Monad Testnet a MetaMask", "warn");
    } else {
      toast(`❌ ${err.message}`, "error");
    }
  } finally {
    S.investing = false;
    btnInvest.disabled = false;
    document.getElementById("btnInvestIcon").textContent = S.residuo > 0 ? "🚀" : "🔒";
    document.getElementById("btnInvestText").textContent =
      S.residuo > 0 ? `Invertir ${fmtMXN(S.residuo)}` : "Invertir";
    renderAccBadge();
  }
}

function onAccumulate() {
  if (!S.residuo || S.residuo <= 0) return;

  S.accumulated += S.residuo;
  S.history.unshift({
    type:   "accumulated",
    amount: S.residuo,
    txHash: null,
    ts:     Date.now(),
  });
  if (S.history.length > 20) S.history.pop();

  persist();
  toast(`💰 ${fmtMXN(S.residuo)} guardado para invertir después`, "info");

  // Reset input
  document.getElementById("amountInput").value = "";
  S.purchase = 0; S.residuo = 0; S.roundedTo = 0;
  renderAll();
}

function onClearHistory() {
  S.history = [];
  persist();
  renderHistory();
}

// ─── METAMASK EVENTS ────────────────────────────────────────────────────────

function wireMetaMaskEvents() {
  if (!window.ethereum) return;

  window.ethereum.on("accountsChanged", (accs) => {
    S.wallet = accs[0] || null;
    if (S.wallet) refreshBalance().then(renderAll);
    else renderWallet();
  });

  window.ethereum.on("chainChanged", (chainId) => {
    if (chainId !== MONAD.chainId) {
      toast("⚠️ Cambia a Monad Testnet (10143)", "warn");
    } else {
      toast("✅ Monad Testnet activo", "success", 2000);
    }
  });
}

// ─── INIT ────────────────────────────────────────────────────────────────────

function bindEvents() {
  document.getElementById("btnConnect").addEventListener("click", onConnect);
  document.getElementById("btnDisconnect").addEventListener("click", onDisconnect);
  document.getElementById("amountInput").addEventListener("input", onAmountChange);
  document.querySelector(".pills").addEventListener("click", onPillClick);
  document.getElementById("btnInvest").addEventListener("click", () => onInvest());
  document.getElementById("btnAccumulate").addEventListener("click", onAccumulate);
  document.getElementById("btnInvestAll").addEventListener("click", () => onInvest(S.accumulated));
  document.getElementById("btnClearHistory").addEventListener("click", onClearHistory);
}

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  wireMetaMaskEvents();

  hydrate(async () => {
    renderAll();

    // Si MetaMask ya tiene una cuenta activa, reconectar silenciosamente
    if (window.ethereum) {
      try {
        const accs = await window.ethereum.request({ method: "eth_accounts" });
        if (accs?.length) {
          S.wallet = accs[0];
          await refreshBalance();
          renderAll();
        }
      } catch {}
    }
  });
});
