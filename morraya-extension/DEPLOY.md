# MORRAYA – Guía de integración Web3 (Hackathon)

## Estado actual
- ✅ UI popup.html completa y funcional (mock)
- ✅ manifest.json con host_permissions para Etherfuse (CORS resuelto)
- ✅ background.js como proxy para Etherfuse API (sin exponer API key)
- ✅ web3.js con conexión MetaMask + Monad Testnet
- ✅ popup.js con flujo completo invest
- ✅ MockCETES.sol para el contrato de demo
- ⏳ PENDIENTE: deployar contrato + actualizar MOCK_CETES_ADDRESS

---

## PASO 1 – Conseguir MON testnet (5 min)

1. Abre MetaMask, agrega Monad Testnet manualmente:
   - Network name: Monad Testnet
   - RPC URL: https://testnet-rpc.monad.xyz
   - Chain ID: 10143
   - Currency: MON
   - Explorer: https://testnet.monadexplorer.com

2. Ve al faucet: https://faucet.monad.xyz
3. Pega tu dirección de MetaMask
4. Recibirás MON testnet en ~30 seg

---

## PASO 2 – Deployar MockCETES en Remix (10 min)

1. Ve a https://remix.ethereum.org
2. Crea nuevo archivo: `MockCETES.sol`
3. Pega el contenido de `contracts/MockCETES.sol`
4. Compila:
   - Compiler: 0.8.20
   - Click "Compile MockCETES.sol"
5. Deploy:
   - Environment: **Injected Provider - MetaMask**
   - Confirma que MetaMask está en **Monad Testnet** (Chain 10143)
   - Click "Deploy"
   - MetaMask pedirá confirmación → acepta
6. Copia la dirección del contrato deployado (aparece en "Deployed Contracts")

---

## PASO 3 – Actualizar la dirección del contrato (1 min)

En `web3.js`, línea ~20:
```js
// ANTES:
export const MOCK_CETES_ADDRESS = "0x0000000000000000000000000000000000000000";

// DESPUÉS (tu dirección real):
export const MOCK_CETES_ADDRESS = "0xTU_DIRECCION_AQUI";
```

---

## PASO 4 – Integrar popup.js en popup.html (5 min)

Busca en tu `popup.html` el cierre `</body>` y agrega:
```html
<!-- Reemplaza cualquier <script> existente de lógica -->
<script type="module" src="popup.js"></script>
```

Asegúrate de que tu HTML tenga estos IDs:
- `#btn-connect`    → botón conectar wallet
- `#btn-invest`     → botón invertir
- `#wallet-address` → donde mostrar la dirección
- `#wallet-balance` → donde mostrar el balance MON
- `#purchase-amount` → input del monto de compra
- `#roundup-amount` → donde mostrar el round-up calculado
- `#cetes-apy`      → donde mostrar el APY de CETES (datos reales de Etherfuse)
- `#history-list`   → lista del historial

---

## PASO 5 – Cargar la extensión en Chrome (2 min)

1. Ve a `chrome://extensions`
2. Activa "Modo desarrollador" (toggle arriba derecha)
3. Click "Cargar descomprimida"
4. Selecciona la carpeta `morraya-extension/`
5. La extensión aparece en la barra de Chrome

---

## PASO 6 – (Opcional) Conectar Etherfuse Sandbox

Para usar datos reales de CETES (APY, precio) autenticados:

1. Ve a https://devnet.etherfuse.com
2. Crea cuenta con email/password
3. Completa KYC con **datos falsos** (es sandbox)
4. Ve a Ramp → API Keys → crea una nueva
5. En la extensión (o en una pantalla de config que agregues al popup):
   ```js
   chrome.runtime.sendMessage({
     type: "SET_API_KEY",
     apiKey: "tu-api-key-aqui"
   });
   ```
   
   O más fácil para el hackathon, guárdala directamente en storage desde la consola de DevTools:
   ```js
   chrome.storage.local.set({ etherfuse_api_key: "tu-api-key" });
   ```

> ⚠️ **Nota**: El precio/APY de CETES ya funciona SIN API key (endpoint público).
> La API key solo es necesaria para el flujo completo de onramp con banco.

---

## Flujo completo del demo (lo que ven los jueces)

```
1. Usuario abre extensión
2. Pantalla muestra: "CETES tokenizados · ~10.5% APY" (dato real de Etherfuse)
3. Usuario ingresa compra: $91.50 MXN
4. Round-up calculado: $8.50 MXN
5. Click "Conectar Wallet" → MetaMask abre → usuario confirma
6. MetaMask se agrega automáticamente a Monad Testnet
7. Click "Invertir $8.50 en CETES"
8. MetaMask abre con la tx lista para firmar
9. Usuario confirma → TX BROADCAST A MONAD TESTNET
10. Extensión muestra: hash real + link a testnet.monadexplorer.com
11. El historial se guarda en chrome.storage.local
```

---

## Argumentación para los jueces

**"¿Por qué no usaron el contrato oficial de Etherfuse?"**
> "Etherfuse en Monad opera vía su FX API (onramp): el usuario depositaría MXN por SPEI y recibiría CETES on-chain. Para el demo, MockCETES simula ese token y la lógica de round-up. La integración con Etherfuse está en background.js: ya trae el precio y APY real, y el flujo de /ramp/quote y /ramp/order está implementado en el service worker, listo para conectar con la cuenta KYC del usuario en producción."

---

## Troubleshooting

| Problema | Solución |
|----------|----------|
| MetaMask no detectado | Asegúrate de tener MetaMask instalado y el popup corriendo sobre `chrome-extension://` |
| CORS error en background.js | Verifica que `host_permissions` esté en manifest.json |
| tx rechazada por "insufficient funds" | Ve al faucet de Monad y consigue más MON |
| Chain ID incorrecto | MetaMask debe estar en Monad Testnet (10143) |
| `invest()` selector incorrecto | El selector `0xe8b5e51f` es keccak256("invest()")[0:4] — verificar con cast sig "invest()" |

---

## Próximos pasos (post-hackathon)

1. Integrar Etherfuse onramp completo (requiere KYC + CLABE del usuario)
2. Content script que detecte montos de compra en sitios como Rappi, Cornershop, etc.
3. Automatización: round-up automático al detectar una compra completada
4. Swap USDC → CETES on-chain vía Etherfuse contract en Monad Mainnet
