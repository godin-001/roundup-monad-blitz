# 💜 RoundUp — Invierte tu cambio en Monad

> Redondea tus pagos e invierte la diferencia en crypto, automáticamente.

**Hackathon:** Monad Blitz CDMX — Marzo 2026  
**Red:** Monad Testnet (Chain ID: 10143)

---

## 🎯 El Problema

Cuando pagas $13.44, esos $0.56 de cambio se pierden. RoundUp los captura y los invierte automáticamente en crypto a través de Monad.

## 💡 La Solución

Una extensión de Chrome que:
1. **Detecta** montos de pago en cualquier página web
2. **Calcula** el redondeo al siguiente número entero
3. **Invierte** la diferencia en el contrato de Monad con un clic

**Ejemplo:** Pago de $13.44 → redondea a $14.00 → invierte $0.56 MON

---

## 🏗️ Arquitectura

```
Chrome Extension (Frontend)
├── popup.html / popup.js    ← UI principal + conexión MetaMask
├── content.js               ← Detección de precios en páginas
└── ethers.js v5             ← Interacción con blockchain

Monad Testnet (Blockchain)
└── RoundUp.sol              ← Contrato de inversión
    ├── invest()             ← Recibe MON y registra inversión
    ├── getMyBalance()       ← Consulta balance del usuario
    └── withdraw()           ← Retira fondos
```

---

## 🚀 Setup

### 1. Deploy del contrato

```bash
# Instalar Foundry (si no lo tienes)
curl -L https://foundry.paradigm.xyz | bash && foundryup

# Deploy
cd roundup-contract
PRIVATE_KEY=0xTU_CLAVE bash deploy.sh
```

### 2. Instalar la extensión

1. Abre Chrome → `chrome://extensions`
2. Activa **Modo desarrollador** (toggle arriba a la derecha)
3. Click **"Cargar descomprimida"**
4. Selecciona la carpeta `roundup-extension/`

### 3. Usar

1. Ve a cualquier página con precios
2. Click en el ícono de la extensión
3. Conecta MetaMask (ya configurado con Monad Testnet)
4. Click **"Invertir cambio"** → tx confirmada en segundos

---

## 📋 Contrato en Monad Testnet

- **Dirección:** `0x071eC761f7cDFb790F4a7Ab20b754FC1f922F28e`
- **Socialscan:** https://monad-testnet.socialscan.io/address/0x071eC761f7cDFb790F4a7Ab20b754FC1f922F28e
- **Monadscan:** https://testnet.monadscan.com/address/0x071eC761f7cDFb790F4a7Ab20b754FC1f922F28e
- **Chain ID:** 10143
- **RPC:** https://testnet-rpc.monad.xyz
- **Verificado:** ✅ Socialscan + Monadscan

---

## 🏆 Por qué Monad

- **Velocidad:** Confirmaciones en ~1 segundo vs minutos en otras chains
- **EVM compatible:** Sin fricción para desarrolladores
- **Bajo costo:** Fees mínimos para microtransacciones como el cambio de $0.56
- **Finality rápida:** El usuario ve su inversión confirmada antes de salir de la página de pago

---

## 👥 Equipo

- [Tu nombre aquí]

---

*Construido en el Monad Blitz CDMX — Marzo 2026*
