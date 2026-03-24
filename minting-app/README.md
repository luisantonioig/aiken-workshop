# Minting App

Aplicacion de ejemplo para mintear tokens en Cardano usando Next.js, Mesh y contratos Aiken.

## Requisitos

- Node.js 20+
- Una wallet compatible con CIP-30
- Una API key de Blockfrost para la red que vayas a usar

## Variables de entorno

Crea un archivo `.env.local` en la raiz con:

```env
BLOCKFROST_API_KEY=tu_project_id_de_blockfrost
CARDANO_NETWORK=preprod
```

`CARDANO_NETWORK` puede ser `testnet`, `preview`, `preprod` o `mainnet`. Si no se define, la app usa `preprod`.

## Instalacion

```bash
npm install
```

## Desarrollo

```bash
npm run dev
```

Luego abre `http://localhost:3000`.

## Flujo de mint

1. Conecta tu wallet.
2. Pega el CBOR del script de minting.
3. Captura cantidad, nombre del token y redeemer.
4. La app pide al servidor construir la transaccion con Blockfrost.
5. La wallet firma la transaccion.
6. El servidor la envia a la red.

## Notas de seguridad

- La API key de Blockfrost ya no se expone en el cliente.
- El endpoint [`pages/api/mint.ts`](/home/antonio/personal/aiken-workshop/minting-app/pages/api/mint.ts) construye y envia la transaccion desde el servidor.
- La UI valida wallet conectada, red esperada, UTxOs y collateral antes de intentar el mint.
