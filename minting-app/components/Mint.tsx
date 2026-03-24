import React, { useState } from "react";
import { useAssets, useWallet } from "@meshsdk/react";
import {
  applyCborEncoding,
  AssetExtended,
  PlutusScript,
  resolvePlutusScriptAddress,
  resolvePlutusScriptHash,
} from "@meshsdk/core";
import type {
  MintBuildRequest,
  MintBuildResponse,
  MintSubmitResponse,
} from "../lib/mint";

import "@meshsdk/react/styles.css";

const EXPECTED_NETWORK_ID = 0;

function isErrorResponse(value: unknown): value is { error: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as { error: unknown }).error === "string"
  );
}

const Mint = () => {
  const { wallet, connected } = useWallet();
  const walletAssets = useAssets();

  const [policyId, setPolicyId] = useState("");
  const [assets, setAssets] = useState<AssetExtended[]>([]);
  const [cbor, setCbor] = useState("");
  const [cborEncoded, setCborEncoded] = useState("");
  const [name, setName] = useState("");
  const [redeemer, setRedeemer] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isMinting, setIsMinting] = useState(false);

  const setCantidadFromInput = async (dat: string) => {
    if (/^\d*$/.test(dat)) {
      setCantidad(dat);

      if (dat && parseInt(dat, 10) <= 0) {
        setError("El numero debe ser mayor a 0.");
      } else {
        setError(null);
      }
    } else {
      setError("Tiene que ser una cantidad en Lovelace.");
    }
  };

  function hexToString(hex: string): string {
    let result = "";
    for (let i = 0; i < hex.length; i += 2) {
      const hexPair = hex.slice(i, i + 2);
      result += String.fromCharCode(parseInt(hexPair, 16));
    }
    return result;
  }

  const setRedeemerFromInput = async (dat: string) => {
    setRedeemer(dat);
  };

  const setNameFromInput = async (dat: string) => {
    setName(dat);
  };

  const minar = async () => {
    if (!connected) {
      setError("Conecta una wallet antes de minar.");
      return;
    }

    if (!cborEncoded || !policyId) {
      setError("Pega el CBOR del script para obtener la policy ID.");
      return;
    }

    if (!cantidad || !name || !redeemer) {
      setError("Completa cantidad, token name y redeemer.");
      return;
    }

    if (error) {
      return;
    }

    setIsMinting(true);
    setError(null);
    setStatus("Validando wallet...");

    try {
      const networkId = await wallet.getNetworkId();
      if (networkId !== EXPECTED_NETWORK_ID) {
        throw new Error("La wallet debe estar conectada a preprod/testnet.");
      }

      const [utxos, collaterals, changeAddress] = await Promise.all([
        wallet.getUtxosMesh(),
        wallet.getCollateralMesh(),
        wallet.getChangeAddressBech32(),
      ]);

      if (utxos.length === 0) {
        throw new Error("La wallet no tiene UTxOs disponibles.");
      }

      if (collaterals.length === 0) {
        throw new Error(
          "La wallet no tiene collateral. Configura collateral en tu wallet e intenta de nuevo.",
        );
      }

      setStatus("Construyendo transaccion...");
      const buildPayload: MintBuildRequest = {
        action: "build",
        cantidad,
        name,
        redeemer,
        code: cborEncoded,
        policyId,
        utxos,
        collaterals,
        changeAddress,
      };

      const buildResponse = await fetch("/api/mint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildPayload),
      });

      const buildResult = (await buildResponse.json()) as
        | MintBuildResponse
        | { error: string };

      if (!buildResponse.ok || isErrorResponse(buildResult)) {
        throw new Error(
          isErrorResponse(buildResult)
            ? buildResult.error
            : "No fue posible construir la transaccion.",
        );
      }

      setStatus("Solicitando firma en la wallet...");
      const signedTx = await wallet.signTxReturnFullTx(buildResult.tx, true);

      setStatus("Enviando transaccion...");
      const submitResponse = await fetch("/api/mint", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "submit",
          signedTx,
        }),
      });

      const submitResult = (await submitResponse.json()) as
        | MintSubmitResponse
        | { error: string };

      if (!submitResponse.ok || isErrorResponse(submitResult)) {
        throw new Error(
          isErrorResponse(submitResult)
            ? submitResult.error
            : "No fue posible enviar la transaccion.",
        );
      }

      setStatus(`Transaccion enviada: ${submitResult.txHash}`);
    } catch (mintError) {
      setStatus(null);
      setError(
        mintError instanceof Error
          ? mintError.message
          : "No fue posible completar el mint.",
      );
    } finally {
      setIsMinting(false);
    }
  };

  const setCborFromTextarea = async (
    event: React.ClipboardEvent<HTMLTextAreaElement>,
  ) => {
    event.preventDefault();
    const pastedData = event.clipboardData.getData("text");
    event.currentTarget.value += pastedData;
    await obtenerPolicy(pastedData);
  };

  const reload = async () => {
    if (cbor !== "") {
      await obtenerPolicy(cbor);
    } else {
      setError("Pega el codigo de CBOR.");
    }
  };

  const obtenerPolicy = async (cborParameter: string) => {
    const encoded = applyCborEncoding(cborParameter);

    const script: PlutusScript = {
      version: "V3",
      code: encoded,
    };

    const hash = resolvePlutusScriptHash(resolvePlutusScriptAddress(script, 0));
    const listAssets = (walletAssets ?? []).filter(
      (ea: AssetExtended) => ea.policyId === hash,
    );
    setPolicyId(hash);
    setAssets(listAssets);
    setCborEncoded(encoded);
    setCbor(cborParameter);
    setError(null);
  };

  return (
    <div className="flex flex-col items-center w-full bg-gray-900 min-h-screen">
      <div className="w-full bg-gray-800 flex flex-col items-center py-4 px-4">
        <div className="bg-[#1f1f1f] shadow-md border border-white rounded-lg p-4 w-full">
          <p className="text-sm font-bold text-center text-white mb-2">
            {policyId !== "" ? policyId : "Escribe el codigo abajo para poder obtener la policy Id"}
          </p>
          <div className="flex flex-col space-y-2">
            <textarea
              className="w-full bg-[#2c2c2c] text-white p-2 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-[#c80e22] focus:border-transparent"
              placeholder="Escribe aqui..."
              value={cbor}
              onChange={(e) => setCbor(e.target.value)}
              onPaste={setCborFromTextarea}
              style={{ minHeight: "10px" }}
            />
          </div>
        </div>

        <div className="flex justify-between w-full p-4 space-x-4">
          <div className="bg-[#1f1f1f] shadow-md border border-white rounded-lg p-4 w-1/2">
            <p className="text-sm font-bold text-center text-white mb-2">Minar tokens</p>
            <div className="flex flex-col space-y-6">
              <div className="relative">
                <span className="absolute top-1/2 left-4 transform -translate-y-1/2 text-gray-300 pointer-events-none">
                  Cantidad
                </span>
                <input
                  type="text"
                  placeholder="Cantidad"
                  className="border border-gray-300 rounded px-3 py-1 pl-32 bg-transparent relative w-full text-white caret-white"
                  onChange={(e) => setCantidadFromInput(e.target.value)}
                />

                {error && (
                  <span className="absolute left-3 top-full mt-1 text-red-500 text-sm">
                    {error}
                  </span>
                )}
              </div>
              {status && <p className="text-sm text-green-400">{status}</p>}
              <div className="relative">
                <span className="absolute top-1/2 left-4 transform -translate-y-1/2 text-gray-300 pointer-events-none">
                  Token Name
                </span>
                <input
                  type="text"
                  placeholder="Token Name"
                  className="border border-gray-300 rounded px-3 py-1 pl-32 bg-transparent relative w-full text-white caret-white"
                  onChange={(e) => setNameFromInput(e.target.value)}
                />
              </div>
              <div className="relative">
                <span className="absolute top-1/2 left-4 transform -translate-y-1/2 text-gray-300 pointer-events-none">
                  Redeemer
                </span>
                <input
                  type="text"
                  placeholder="Redeemer"
                  className="border border-gray-300 rounded px-3 py-1 pl-32 bg-transparent relative w-full text-white caret-white"
                  onChange={(e) => setRedeemerFromInput(e.target.value)}
                />
              </div>
              <div className="flex justify-between space-x-2">
                <button
                  disabled={!connected || isMinting}
                  className="bg-[#c80e22] text-white font-semibold py-1 px-3 rounded hover:bg-black disabled:bg-gray-400 disabled:cursor-not-allowed"
                  onClick={minar}
                >
                  {isMinting ? "Procesando..." : "Minar tokens"}
                </button>
              </div>
            </div>
          </div>
          <div className="bg-[#1f1f1f] shadow-md border border-white rounded-lg p-4 w-1/2 mx-auto">
            <p className="text-sm font-bold text-center text-white mb-4">
              {policyId !== "" ? "Tokens con " + policyId : "Actualiza o pega el cbor para ver los tokens"}
            </p>

            <button
              className="bg-[#c80e22] text-white font-semibold py-1 px-3 rounded hover:bg-black disabled:bg-gray-400 disabled:cursor-not-allowed"
              onClick={reload}
            >
              Recargar
            </button>
            <div className="list space-y-2">
              {assets.map((item) => (
                <button
                  key={`${item.policyId}.${item.assetName}`}
                  className="list-item bg-white text-black rounded-lg p-2 text-center"
                  disabled={!connected}
                >
                  {hexToString(item.assetName) + " " + item.quantity}
                </button>
              ))}
            </div>

            <div className="relative">
              <span className="absolute top-1/2 left-4 transform -translate-y-1/2 text-gray-300 pointer-events-none">
                Redeemer
              </span>
              <input
                type="text"
                placeholder="Redeemer"
                className="border border-gray-300 rounded px-3 py-1 pl-32 bg-transparent relative w-full text-white caret-white"
                onChange={(e) => setRedeemerFromInput(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Mint;
