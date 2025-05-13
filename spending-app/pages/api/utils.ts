import { BlockfrostProvider, MeshTxBuilder } from "@meshsdk/core";

export function initializeBlockchainProvider(): BlockfrostProvider {
  const apiKey = process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY;
  if (!apiKey) {
    throw new Error("Blockfrost API key is missing");
  }
  return new BlockfrostProvider(apiKey);
}

export const blockchainProvider = initializeBlockchainProvider()

export const txBuilder = new MeshTxBuilder({
  fetcher: blockchainProvider,
  submitter: blockchainProvider,
});
