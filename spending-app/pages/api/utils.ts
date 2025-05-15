import { BlockfrostProvider, Data, MeshTxBuilder } from "@meshsdk/core";

export function initializeBlockchainProvider(): BlockfrostProvider {
  const apiKey = process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY;
  if (!apiKey) {
    throw new Error("Blockfrost API key is missing");
  }
  return new BlockfrostProvider(apiKey);
}

export const blockchainProvider = initializeBlockchainProvider()

export function parseData(input: any): Data {
  if (
    input !== null
    && typeof input === 'object'
    && 'bytes' in input
    && Object.keys(input).length === 1
  ) {
    return (input as {bytes: string}).bytes;
  }

  if (
    input !== null
    && typeof input === 'object'
    && 'number' in input
    && Object.keys(input).length === 1
  ) {
    return BigInt((input as {number: number}).number);
  }


  if (typeof input === 'string' || typeof input === 'number' || typeof input === 'bigint') {
    return input;
  }


  if (Array.isArray(input)) {
    return input.map(parseData);
  }


  if (
    input !== null
    && typeof input === 'object'
    && 'alternative' in input
    && Array.isArray(input.fields)
  ) {
    return {
      alternative: input.alternative,
      fields: input.fields.map(parseData)
    };
  }

  throw new Error(`Tipo no soportado en parseData: ${JSON.stringify(input)}`);
}

export const txBuilder = new MeshTxBuilder({
  fetcher: blockchainProvider,
  submitter: blockchainProvider,
});
