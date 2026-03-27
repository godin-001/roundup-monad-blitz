// ============================================================
// RoundUp — popup.js
// Conecta Chrome Extension con contrato en Monad Testnet
// ============================================================

const CONTRACT_ADDRESS = "0x071eC761f7cDFb790F4a7Ab20b754FC1f922F28e"; // ← se llena después del deploy
const CONTRACT_ABI = [
  "function invest() external payable",
  "function getMyBalance() external view returns (uint256)",
  "function getMyInvestmentCount() external view returns (uint256)",
  "function getTotalInvestments() external view returns (uint256)",
  "event Invested(address indexed user, uint256 amount, uint256 timestamp)"
];

const MONAD_CHAIN_ID = "0x279F"; // 10143
const MONAD_RPC = "https://testnet-rpc.monad.xyz";
const MONAD_EXPLORER = "https://testnet.monadexplorer.com";

// Estado de sesión
let sessionInvestedMON = 0;
let sessionCount = 0;
let currentAmount = 13.44;

// ──── UI helpers ────────────────────────────────────────────
function setStatus(msg, isError = false) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className = isError ? 'error' : '';
}

function updateCalc(raw) {
  const amount = parseFloat(raw) || 0;
  currentAmount = amount;

  const rounded = Number.isInteger(amount) ? amount + 1 : Math.ceil(amount);
  const invest = parseFloat((rounded - amount).toFixed(6));

  document.getElementById('originalVal').textContent = `$${amount.toFixed(2)}`;
  document.getElementById('roundedVal').textContent = `$${rounded.toFixed(2)}`;
  document.getElementById('investVal').textContent = `$${invest.toFixed(2)}`;
  document.getElementById('monVal').textContent = invest.toFixed(4);
  document.getElementById('investBtnAmt').textContent = invest.toFixed(2);

  return invest;
}

// ──── Inicialización ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  updateCalc(document.getElementById('amountInput').value);

  // Recalcular al cambiar input
  document.getElementById('amountInput').addEventListener('input', (e) => {
    updateCalc(e.target.value);
  });

  // Intentar recuperar monto detectado por content script
  chrome.storage.local.get(['detectedAmount'], (result) => {
    if (result.detectedAmount) {
      document.getElementById('amountInput').value = result.detectedAmount;
      updateCalc(result.detectedAmount);
    }
  });

  // Verificar si ya hay wallet conectada
  if (window.ethereum) {
    window.ethereum.request({ method: 'eth_accounts' }).then(accounts => {
      if (accounts.length > 0) {
        showConnected(accounts[0]);
      }
    });
  }
});

// ──── Conectar wallet ───────────────────────────────────────
document.getElementById('connectBtn').addEventListener('click', async () => {
  if (!window.ethereum) {
    setStatus("⚠️ MetaMask no detectado. Instálalo primero.", true);
    return;
  }

  try {
    setStatus("Conectando...");

    // Agregar / cambiar a Monad Testnet
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: MONAD_CHAIN_ID }]
      });
    } catch (switchError) {
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: MONAD_CHAIN_ID,
            chainName: 'Monad Testnet',
            rpcUrls: [MONAD_RPC],
            nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
            blockExplorerUrls: [MONAD_EXPLORER]
          }]
        });
      } else {
        throw switchError;
      }
    }

    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    showConnected(accounts[0]);
    setStatus("✅ Conectado a Monad Testnet");

  } catch (e) {
    setStatus("Error: " + (e.message || e), true);
  }
});

function showConnected(address) {
  document.getElementById('connectBtn').style.display = 'none';
  document.getElementById('investBtn').style.display = 'block';
  const badge = document.getElementById('walletBadge');
  if (badge) badge.style.display = 'flex';
  document.getElementById('walletAddr').textContent =
    address.slice(0, 6) + '...' + address.slice(-4);
}

// ──── Invertir ──────────────────────────────────────────────
document.getElementById('investBtn').addEventListener('click', async () => {
  const investBtn = document.getElementById('investBtn');

  if (CONTRACT_ADDRESS === "0x071eC761f7cDFb790F4a7Ab20b754FC1f922F28e") {
    setStatus("⚠️ Contrato no deployado aún. Espera el deploy.", true);
    return;
  }

  try {
    investBtn.disabled = true;
    setStatus("⏳ Enviando tx a Monad...");

    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    // Calcular el monto de inversión
    const amount = parseFloat(document.getElementById('amountInput').value) || 0;
    const rounded = Number.isInteger(amount) ? amount + 1 : Math.ceil(amount);
    const invest = parseFloat((rounded - amount).toFixed(6));

    if (invest <= 0) {
      setStatus("⚠️ El monto es un número exacto, no hay cambio que invertir.", true);
      investBtn.disabled = false;
      return;
    }

    const amountInWei = ethers.utils.parseEther(invest.toFixed(8));

    const tx = await contract.invest({ value: amountInWei });
    setStatus(`⏳ Tx enviada: ${tx.hash.slice(0, 12)}... esperando confirmación`);

    await tx.wait();

    sessionInvestedMON += invest;
    sessionCount++;
    document.getElementById('sessionTotal').textContent = sessionInvestedMON.toFixed(4) + ' MON';
    document.getElementById('sessionCount').textContent = sessionCount;

    setStatus(`✅ ¡Invertido! Ver en explorer: ${tx.hash.slice(0, 14)}...`);

    // Guardar en storage para historial
    const history = await chrome.storage.local.get(['history']) || { history: [] };
    const entries = history.history || [];
    entries.unshift({ amount: invest, tx: tx.hash, ts: Date.now() });
    await chrome.storage.local.set({ history: entries.slice(0, 20) });

  } catch (e) {
    setStatus("Error: " + (e.message || e), true);
  } finally {
    investBtn.disabled = false;
  }
});
