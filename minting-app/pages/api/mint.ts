import type { NextApiRequest, NextApiResponse } from "next";
import {
  applyCborEncoding,
  BlockfrostProvider,
  isNetwork,
  type Network,
  Transaction,
} from "@meshsdk/core";
import type {
  MintBuildRequest,
  MintBuildResponse,
  MintSubmitRequest,
  MintSubmitResponse,
} from "../../lib/mint";

type MintApiResponse =
  | MintBuildResponse
  | MintSubmitResponse
  | { error: string };

function textToHex(text: string): string {
  return Array.from(text)
    .map((char) => char.charCodeAt(0).toString(16).padStart(2, "0"))
    .join("");
}

function getBlockfrostProjectId(): string {
  const projectId =
    process.env.BLOCKFROST_API_KEY ?? process.env.BLOCKFROST_PROJECT_ID;

  if (!projectId) {
    throw new Error(
      "Falta configurar BLOCKFROST_API_KEY o BLOCKFROST_PROJECT_ID en el entorno.",
    );
  }

  return projectId;
}

function getNetwork(): Network {
  const envNetwork = process.env.CARDANO_NETWORK ?? "preprod";

  if (!isNetwork(envNetwork)) {
    throw new Error(
      "CARDANO_NETWORK debe ser uno de: testnet, preview, preprod, mainnet.",
    );
  }

  return envNetwork;
}

function assertBuildBody(body: Partial<MintBuildRequest>): asserts body is MintBuildRequest {
  if (
    !body.cantidad ||
    !body.name ||
    !body.redeemer ||
    !body.code ||
    !body.policyId ||
    !body.changeAddress ||
    !Array.isArray(body.utxos) ||
    !Array.isArray(body.collaterals)
  ) {
    throw new Error("Faltan datos para construir la transaccion.");
  }
}

async function buildMintTx(body: MintBuildRequest): Promise<MintBuildResponse> {
  const blockfrost = new BlockfrostProvider(getBlockfrostProjectId());
  const network = getNetwork();

  if (body.collaterals.length === 0) {
    throw new Error("La wallet no tiene collateral disponible.");
  }

  const initiator = {
    getChangeAddress: async () => body.changeAddress,
    getCollateral: async () => body.collaterals,
    getUtxos: async () => body.utxos,
  };

  const tx = await new Transaction({
    initiator,
    fetcher: blockfrost,
    verbose: true,
  })
    .txBuilder
    .mintPlutusScriptV3()
    .mint(body.cantidad, body.policyId, textToHex(body.name))
    .mintingScript(applyCborEncoding(body.code))
    .mintRedeemerValue(body.redeemer)
    .selectUtxosFrom(body.utxos)
    .changeAddress(body.changeAddress)
    .txInCollateral(
      body.collaterals[0].input.txHash,
      body.collaterals[0].input.outputIndex,
    )
    .setNetwork(network)
    .complete();

  return { tx, network };
}

async function submitMintTx(body: MintSubmitRequest): Promise<MintSubmitResponse> {
  const blockfrost = new BlockfrostProvider(getBlockfrostProjectId()) as {
    submitTx: (tx: string) => Promise<string>;
  };

  if (!body.signedTx) {
    throw new Error("Falta la transaccion firmada.");
  }

  const txHash = await blockfrost.submitTx(body.signedTx);
  return { txHash };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MintApiResponse>,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Metodo no permitido." });
  }

  try {
    const body = req.body as Partial<MintBuildRequest> &
      Partial<MintSubmitRequest> & {
        action?: "build" | "submit";
      };

    if (body.action === "build") {
      assertBuildBody(body);
      const response = await buildMintTx(body);
      return res.status(200).json(response);
    }

    if (body.action === "submit") {
      const response = await submitMintTx(body as MintSubmitRequest);
      return res.status(200).json(response);
    }

    return res.status(400).json({ error: "Accion invalida." });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No fue posible procesar el mint.";

    return res.status(400).json({ error: message });
  }
}
