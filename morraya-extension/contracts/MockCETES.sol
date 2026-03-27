// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * ██╗   ██╗ ██████╗  ██████╗██╗  ██╗
 * ███╗ ███║██╔═══██╗██╔════╝██║ ██╔╝
 * ████████║██║   ██║██║     █████╔╝
 * ██╔═██╔═╝██║   ██║██║     ██╔═██╗
 * ██║ ╚═╝  ╚██████╔╝╚██████╗██║  ██╗
 * ╚═╝       ╚═════╝  ╚═════╝╚═╝  ╚═╝
 *
 * MockCETES – MORRAYA Demo Contract para Monad Testnet
 *
 * Simula la compra de CETES tokenizados para el hackathon.
 * En producción, Etherfuse ya tiene contratos deployados en Monad Mainnet.
 *
 * ─── DEPLOYMENT (5 min) ─────────────────────────────────────────────────────
 * 1. Ve a https://remix.ethereum.org
 * 2. Crea MockCETES.sol y pega este código
 * 3. Compila: Solidity 0.8.20, optimization ON (200 runs)
 * 4. Deploy → Environment: Injected Provider (MetaMask en Monad Testnet 10143)
 * 5. Copia la dirección del contrato deployado
 * 6. Pega en app.js: const CONTRACT_ADDRESS = "0xTU_DIRECCION";
 *
 * Faucet MON testnet: https://faucet.monad.xyz
 * Explorer:           https://testnet.monadexplorer.com
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ─── CONVERSIÓN (demo) ──────────────────────────────────────────────────────
 * 1 MXN → 1e12 wei de MON (en la extensión)
 * 1e12 wei → 1 mCETES unit (6 decimales)
 * Ejemplo: $8.50 MXN → 8,500,000,000,000 wei → ~8 mCETES
 */
contract MockCETES {

    // ─── Metadata ERC-20 ──────────────────────────────────────────────────
    string  public constant name     = "CETES Tokenizado";
    string  public constant symbol   = "mCETES";
    uint8   public constant decimals = 6;

    // ─── Estado ────────────────────────────────────────────────────────────
    address public immutable owner;
    uint256 public totalSupply;
    uint256 public totalMONReceived;

    mapping(address => uint256) public balanceOf;
    mapping(address => Investment[]) private _history;

    // ─── Structs & eventos ────────────────────────────────────────────────
    struct Investment {
        uint256 monAmount;   // wei enviados
        uint256 cetesAmount; // mCETES acuñados
        uint256 timestamp;
    }

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Invested(
        address indexed investor,
        uint256 indexed monAmount,
        uint256 cetesAmount,
        uint256 timestamp
    );

    // ─── Constructor ──────────────────────────────────────────────────────
    constructor() {
        owner = msg.sender;
    }

    // ─── Función principal: comprar mCETES enviando MON ───────────────────
    /**
     * @dev Envía MON a esta función para recibir mCETES.
     *      La extensión MORRAYA llama receive() (sin data) que redirige aquí.
     *      También puedes llamar invest() explícitamente.
     */
    function invest() external payable {
        _buy(msg.sender, msg.value);
    }

    // ─── Fallback: acepta MON directo (sin data) ──────────────────────────
    receive() external payable {
        _buy(msg.sender, msg.value);
    }

    // ─── Lógica interna de compra ─────────────────────────────────────────
    function _buy(address buyer, uint256 monWei) internal {
        require(monWei > 0, "MockCETES: Debes enviar MON");

        // Conversión: 1e12 wei = 1 mCETES unit
        // Con 6 decimales, 1 mCETES unit = 0.000001 mCETES visibles
        // Para el demo: cada unidad de 1e12 wei = 1 "micro-CETES"
        uint256 cetesAmount = monWei / 1e12;
        if (cetesAmount == 0) cetesAmount = 1; // mínimo 1 unit

        totalSupply     += cetesAmount;
        totalMONReceived += monWei;
        balanceOf[buyer] += cetesAmount;

        _history[buyer].push(Investment({
            monAmount:   monWei,
            cetesAmount: cetesAmount,
            timestamp:   block.timestamp
        }));

        emit Transfer(address(0), buyer, cetesAmount);
        emit Invested(buyer, monWei, cetesAmount, block.timestamp);
    }

    // ─── Consultas ────────────────────────────────────────────────────────

    /** Retorna el historial de inversiones del usuario */
    function getHistory(address user) external view returns (Investment[] memory) {
        return _history[user];
    }

    /** Balance en "CETES visibles" con 6 decimales */
    function getDisplayBalance(address user) external view returns (uint256) {
        return balanceOf[user];
    }

    /** Total de MON invertido en el contrato (en ether/MON) */
    function getTotalMON() external view returns (uint256) {
        return totalMONReceived;
    }

    // ─── Admin ────────────────────────────────────────────────────────────

    /** Owner puede retirar MON del contrato para el demo */
    function withdraw() external {
        require(msg.sender == owner, "MockCETES: Solo el owner");
        (bool ok,) = payable(owner).call{value: address(this).balance}("");
        require(ok, "Withdraw failed");
    }
}
