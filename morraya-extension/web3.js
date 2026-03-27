/**
 * MORRAYA – web3.js
 * Módulo de conexión a MetaMask + Monad Testnet.
 * Importado directamente en popup.html con <script type="module">
 */

// ─── Configuración de Monad Testnet ────────────────────────────────────────
export const MONAD_TESTNET = {
  chainId:     "0x279F",           // 10143 en decimal
  chainName:   "Monad Testnet",
  nativeCurrency: {
    name:     "MON",
    symbol:   "MON",
    decimals: 18,
  },
  rpcUrls:         ["https://testnet-rpc.monad.xyz"],
  blockExplorerUrls: ["https://testnet.monadexplorer.com"],
};

// ─── Dirección del contrato MockCETES en Monad Testnet ────────────────────
// IMPORTANTE: reemplaza esta dirección con la que obtengas al deployar MockCETES.sol
// Si aún no la has deployado, ve a la sección de deployment más abajo
export const MOCK_CETES_ADDRESS = "0x0000000000000000000000000000000000000000"; // ← CAMBIAR

// ABI mínimo del contrato MockCETES (solo las funciones que usamos)
export const MOCK_CETES_ABI = [
  // invest(): envía MON y recibe CETES
  {
    name: "invest",
    type: "function",
    stateMutability: "payable",
    inputs: [],
    outputs: [],
  },
  // balanceOf(address): balance de CETES del usuario
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  // totalInvested(): total acumulado en el contrato
  {
    name: "totalInvested",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
];

// ─── Conectar MetaMask ──────────────────────────────────────────────────────
export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error("MetaMask no instalado. Instálalo en metamask.io");
  }

  // 1. Solicitar acceso a cuentas
  const accounts = await window.ethereum.request({
    method: "eth_requestAccounts",
  });

  if (!accounts || accounts.length === 0) {
    throw new Error("No se otorgó acceso a ninguna cuenta");
  }

  // 2. Cambiar o agregar Monad Testnet
  await switchToMonad();

  return accounts[0];
}

// ─── Cambiar a Monad Testnet ────────────────────────────────────────────────
export async function switchToMonad() {
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: MONAD_TESTNET.chainId }],
    });
  } catch (err) {
    // Error 4902 = la red no está en MetaMask → la agregamos
    if (err.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [MONAD_TESTNET],
      });
    } else {
      throw err;
    }
  }
}

// ─── Obtener balance de MON ─────────────────────────────────────────────────
export async function getMonBalance(address) {
  const hex = await window.ethereum.request({
    method: "eth_getBalance",
    params: [address, "latest"],
  });
  // Convertir wei → MON
  return parseInt(hex, 16) / 1e18;
}

// ─── Invertir round-up en MockCETES ────────────────────────────────────────
/**
 * @param {string}  fromAddress  - dirección del usuario
 * @param {number}  amountMXN   - monto en MXN del round-up (ej: 8.50)
 * @param {number}  monPerMxn   - tipo de cambio MON/MXN para demo (default 1:1 en testnet)
 * @returns {{ txHash, explorerUrl }}
 */
export async function investRoundup(fromAddress, amountMXN, monPerMxn = 0.0001) {
  if (!window.ethereum) throw new Error("MetaMask no disponible");

  // Asegurarnos que estamos en Monad Testnet
  await switchToMonad();

  // Calcular valor en wei (MON testnet)
  // Para el demo usamos una cantidad pequeña de MON real para no gastar mucho
  const amountInMon = amountMXN * monPerMxn;           // ej: 8.50 MXN * 0.0001 = 0.00085 MON
  const amountInWei = BigInt(Math.floor(amountInMon * 1e18)).toString(16);

  let txHash;

  if (MOCK_CETES_ADDRESS === "0x0000000000000000000000000000000000000000") {
    // ─── MODO FALLBACK: si no hay contrato deployado, manda una tx simple ────
    // Útil para demo si no tuviste tiempo de deployar el contrato
    // La tx va a la propia dirección del usuario (self-transfer simbólica)
    txHash = await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [{
        from: fromAddress,
        to:   fromAddress,   // ← self-transfer: solo para generar un hash real
        value: "0x" + (amountInWei || "1"),
        data: "0x4d4f525241594120726f756e642d7570", // "MORRAYA round-up" en hex (metadata)
        gas: "0x5208",       // 21000 gas
      }],
    });
  } else {
    // ─── MODO CONTRATO: llama a invest() en MockCETES ─────────────────────
    // Codificar la llamada a invest() → selector = primeros 4 bytes del keccak256("invest()")
    const investSelector = "0xe8b5e51f"; // keccak256("invest()")[0:4]

    txHash = await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [{
        from:  fromAddress,
        to:    MOCK_CETES_ADDRESS,
        value: "0x" + amountInWei,
        data:  investSelector,
        gas:   "0x186A0",     // 100,000 gas (suficiente para mint ERC20)
      }],
    });
  }

  return {
    txHash,
    explorerUrl: `https://testnet.monadexplorer.com/tx/${txHash}`,
    amountMXN,
  };
}

// ─── Escuchar cambios de cuenta o red ──────────────────────────────────────
export function onAccountChange(callback) {
  if (window.ethereum) {
    window.ethereum.on("accountsChanged", (accounts) => callback(accounts[0] || null));
  }
}

export function onChainChange(callback) {
  if (window.ethereum) {
    window.ethereum.on("chainChanged", callback);
  }
}
