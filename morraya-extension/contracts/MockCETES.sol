// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * MockCETES – Contrato de demostración para MORRAYA
 *
 * Simula la compra de CETES tokenizados en Monad Testnet.
 * En producción, este contrato sería reemplazado por el contrato
 * oficial de Etherfuse en Monad Mainnet.
 *
 * DEPLOYMENT:
 *   1. Ve a https://remix.ethereum.org
 *   2. Crea este archivo en Remix
 *   3. Compila con Solidity 0.8.20
 *   4. En "Deploy & Run":
 *      - Environment: Injected Provider (MetaMask)
 *      - Asegúrate de estar en Monad Testnet (Chain ID: 10143)
 *   5. Deploy → copia la dirección del contrato
 *   6. Pega la dirección en web3.js → MOCK_CETES_ADDRESS
 *
 * Faucet MON testnet: https://faucet.monad.xyz
 */

contract MockCETES {
    // ─── Estado ────────────────────────────────────────────────────────────

    string  public constant name     = "CETES Tokenizado (Demo)";
    string  public constant symbol   = "mCETES";
    uint8   public constant decimals = 18;

    // Precio: 1 CETES = 0.000001 ETH (muy bajo para demo con testnet MON)
    // Ajusta según cuánto MON quieres gastar por inversión
    uint256 public constant CETES_PRICE_WEI = 1e12; // 0.000001 MON

    uint256 public totalSupply;
    uint256 public totalInvested; // total de MON recibido

    mapping(address => uint256) public balanceOf;
    mapping(address => Investment[]) public investmentHistory;

    // ─── Eventos ───────────────────────────────────────────────────────────
    event Invested(
        address indexed investor,
        uint256 monAmount,
        uint256 cetesReceived,
        uint256 timestamp
    );

    event Transfer(address indexed from, address indexed to, uint256 value);

    // ─── Struct ────────────────────────────────────────────────────────────
    struct Investment {
        uint256 monAmount;
        uint256 cetesReceived;
        uint256 timestamp;
    }

    // ─── Función principal: invertir MON y recibir mCETES ─────────────────
    function invest() external payable {
        require(msg.value > 0, "MORRAYA: Debes enviar MON para invertir");

        // Calcular cuántos mCETES recibe el usuario
        uint256 cetesAmount = (msg.value * 1e18) / CETES_PRICE_WEI;

        // Mint de mCETES al usuario
        totalSupply             += cetesAmount;
        totalInvested           += msg.value;
        balanceOf[msg.sender]   += cetesAmount;

        // Guardar en historial
        investmentHistory[msg.sender].push(Investment({
            monAmount:     msg.value,
            cetesReceived: cetesAmount,
            timestamp:     block.timestamp
        }));

        emit Transfer(address(0), msg.sender, cetesAmount);
        emit Invested(msg.sender, msg.value, cetesAmount, block.timestamp);
    }

    // ─── Consultar historial del usuario ───────────────────────────────────
    function getHistory(address user)
        external
        view
        returns (Investment[] memory)
    {
        return investmentHistory[user];
    }

    // ─── Consultar precio actual ────────────────────────────────────────────
    function getCetesPrice() external pure returns (uint256) {
        return CETES_PRICE_WEI;
    }

    // ─── Retirar fondos (solo para demo, el deployer puede retirar) ─────────
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    function withdraw() external {
        require(msg.sender == owner, "Solo el owner");
        payable(owner).transfer(address(this).balance);
    }

    // ─── Fallback: si alguien manda MON directamente ──────────────────────
    receive() external payable {
        // Redirige al invest() automáticamente
        if (msg.value > 0) {
            uint256 cetesAmount = (msg.value * 1e18) / CETES_PRICE_WEI;
            totalSupply           += cetesAmount;
            totalInvested         += msg.value;
            balanceOf[msg.sender] += cetesAmount;
            emit Transfer(address(0), msg.sender, cetesAmount);
            emit Invested(msg.sender, msg.value, cetesAmount, block.timestamp);
        }
    }
}
