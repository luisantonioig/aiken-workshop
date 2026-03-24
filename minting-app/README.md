# Minting App

Example application for minting tokens on Cardano using Next.js, Mesh, and Aiken smart contracts.

## Requirements

- Node.js 20+
- A CIP-30 compatible wallet
- A Blockfrost API key for the network you want to use

## Environment Variables

Create a `.env.local` file in the project root:

```env
BLOCKFROST_API_KEY=your_blockfrost_project_id
CARDANO_NETWORK=preprod
```

`CARDANO_NETWORK` can be `testnet`, `preview`, `preprod`, or `mainnet`. If it is not set, the app defaults to `preprod`.

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

Then open `http://localhost:3000`.

## Mint Flow

1. Connect your wallet.
2. Paste the minting script CBOR.
3. Enter the amount, token name, and redeemer.
4. The app asks the server to build the transaction with Blockfrost.
5. The wallet signs the transaction.
6. The server submits the transaction to the network.

## Security Notes

- The Blockfrost API key is no longer exposed in the client.
- The endpoint `pages/api/mint.ts` builds and submits the transaction from the server.
- The UI validates wallet connection, expected network, UTxOs, and collateral before attempting the mint.

## Testing

The repository includes automated tests for the mint API route.

### Run the tests

```bash
npm test
```

### Run the Aiken contract tests

```bash
cd onchain
aiken check
```

### What is covered

The test suite in `tests/mint-api.test.ts` validates the server-side mint flow with mocked Mesh SDK dependencies.

The on-chain test suites currently live in:

- `onchain/validators/minting.ak`
- `onchain/validators/collateral.ak`
- `onchain/validators/oracle.ak`

They validate the core validator rules directly in Aiken.

It currently verifies that:

- the `build` action creates an unsigned mint transaction
- the token name is converted to hex before being added to the transaction
- the encoded script, collateral input, and network are passed to the transaction builder
- the API rejects build requests without collateral
- the `submit` action sends the signed transaction through the Blockfrost provider
- the API returns `405` for unsupported HTTP methods
- the minting helper computes the expected maximum mint amount
- the minting policy reads the minted stablecoin quantity correctly
- collateral datum checks accept valid transactions and reject missing signatures
- mint-limit checks accept transactions with enough collateral and reject those above the limit
- burn matching checks accept exact negative minting for collateral redemption
- the collateral validator accepts valid redeem and liquidation paths and rejects incorrect burn amounts
- the oracle validator accepts operator-signed mint and update flows and rejects unsigned attempts

### What is mocked

These tests do not call the real Cardano network.

They mock:

- `Transaction` from `@meshsdk/core`
- `BlockfrostProvider`
- `applyCborEncoding`
- network validation through `isNetwork`

This makes the tests fast and deterministic while still checking that the route uses the transaction builder correctly.

### What is not covered yet

These tests do not prove that:

- the Aiken validators accept or reject transactions correctly
- a real wallet signs the transaction as expected
- Blockfrost accepts and propagates the transaction on `preprod`

For that, you should complement them with:

1. Aiken tests in `onchain/`
2. manual end-to-end testing with a real wallet on `preprod`
