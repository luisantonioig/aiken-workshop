import { applyParamsToScript, BlockfrostProvider, Data, MeshTxBuilder, PlutusScript } from "@meshsdk/core";
import plutusScript from "../../onchain/plutus.json";
import cbor from "cbor";

export function getPlutusScript(title: String): PlutusScript {
  return {
    code: cbor
      .encode(Buffer.from(plutusScript.validators.filter((val: any) => val.title === title)[0].compiledCode, "hex"))
      .toString("hex"),
    version: "V3",
  };
}

export function getPlutusScriptParams(title:string, params: object[] | Data[]): PlutusScript {
  const scriptCbor = applyParamsToScript(
    cbor.encode(Buffer.from(plutusScript.validators.filter((val: any) => val.title === title)[0].compiledCode, "hex"))
      .toString("hex"),
    params,
    "Mesh",
  );

  return  {
    code: scriptCbor,
    version: "V3"
  }
}

export function initializeBlockchainProvider(): BlockfrostProvider {
  const apiKey = process.env.BLOCKFROST_API_KEY;
  if (!apiKey) {
    throw new Error("Blockfrost API key is missing");
  }
  return new BlockfrostProvider(apiKey);
}

export const blockchainProvider = initializeBlockchainProvider()

export const txBuilder = new MeshTxBuilder({
  fetcher: blockchainProvider,
  submitter: blockchainProvider,
  //evaluator: blockchainProvider,
});
