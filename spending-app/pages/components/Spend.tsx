import React, { useState } from "react";
import { useWallet } from "@meshsdk/react";
import { applyCborEncoding,  deserializeDatum,  PlutusScript, resolvePlutusScriptAddress, UTxO } from "@meshsdk/core"

import "@meshsdk/react/styles.css";

import { sendToScript, unlockFromScript } from "../api/spendTx.ts";
import { initializeBlockchainProvider } from "../api/utils.ts";

const blockchainProvider = initializeBlockchainProvider();

const Customized = () => {
    const { wallet, connected } = useWallet();
    const [scriptAddress, setAddress] = useState("");
    const [scriptUTxOs, setScriptUTxOs] = useState<UTxO[]>([]);
    const [cbor, setCbor] = useState("")
    const [cborEncoded, setCborEncoded] = useState("");
    const [datum, setDatum] = useState("");
    const [redeemer, setRedeemer] = useState("");
    const [lovelace, setLovelace] = useState("");
    const [error, setError] = useState("");
    const [datumType, setDatumType] = useState("data");
    const [redeemerType, setRedeemerType] = useState("data");

	const setLovelaceFromInput = async (dat: string) => {

	if (/^\d*$/.test(dat)) {
	    setLovelace(dat);

	    if (dat && parseInt(dat, 10) < 1000000) {
		setError("El número debe ser mayor a 1,000,000");
	    } else {
		setError("");
		
	    }
	} else {
	    setError("Tiene que ser una cantidad en Lovelace");
	}
    }
    
    const setRedeemerFromInput = async (dat: string) => {
	setRedeemer(dat);
    }
    const setDatumFromInput = async (dat: string) => {
	setDatum(dat);
    }

    const desbloquearDesdeScript = async (txHash:string, index:number) => {
	if (redeemer!= ""){
	    if (redeemerType === "constructor") {
		unlockFromScript(wallet, cborEncoded,txHash,index, JSON.parse(redeemer));
	    } else {
		unlockFromScript(wallet, cborEncoded, txHash, index, redeemer);
	    }
	} else {
	    alert("Selecciona un redeemer");
	}
    }

    const bloquear = async () => {
			if (lovelace !== "" && error === "" && datum !== "") {
					try {
							if (datumType === "constructor") {
									await sendToScript(wallet, scriptAddress, lovelace, JSON.parse(datum));
							} else {
									await sendToScript(wallet, scriptAddress, lovelace, datum);
							}
					} catch (err) {
							alert("Error en los datos. Asegúrate de que el datum sea válido para el tipo seleccionado.");
					}
			} else {
					alert("Error en los datos lovelace y/o datum");
			}
	};

    const setCborFromTextarea = async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
	event.preventDefault();
	const pastedData = event.clipboardData.getData("text");
	event.currentTarget.value += pastedData;
	await obtenerAddress(pastedData);
    }
    const reload = async () => {
	if (cbor != "") {
	    obtenerAddress(cbor);
	} else {
	    alert("Pega el código de CBOR");
	}
	
    }
    const obtenerAddress = async (cborParameter:string) => {
	const encoded = applyCborEncoding(cborParameter);
	
	const script: PlutusScript = {
			
	    version: "V3",
	    code: encoded
	}
	
	const scriptAddr = resolvePlutusScriptAddress(script, 0)
	const UTxOs = await blockchainProvider.fetchAddressUTxOs(scriptAddr);

	setAddress(scriptAddr);
	setScriptUTxOs(UTxOs);
	setCborEncoded(encoded);
	setCbor(cborParameter);
	
    };

	return (<div className="flex flex-col items-center w-full bg-gray-900 min-h-screen">
		<div className="w-full bg-gray-800 flex flex-col items-center py-4 px-4">

			<div className="bg-[#1f1f1f] shadow-md border border-white rounded-lg p-4 w-full">
				<p className="text-sm font-bold text-center text-white mb-2">
					{scriptAddress !== "" ? scriptAddress : "Escribe el código abajo para poder obtener la address"}
				</p>
				<div className="flex flex-col space-y-2">
					<textarea
						className="w-full bg-[#2c2c2c] text-white p-2 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-[#c80e22] focus:border-transparent"
						placeholder="Escribe aquí..."
						onPaste={setCborFromTextarea}
						style={{ minHeight: "10px" }}
					/>
				</div>
			</div>

			<div className="flex justify-between w-full p-4 space-x-4">

				<div className="flex flex-col w-1/2 p-4 space-y-4">
					<div className="bg-[#1f1f1f] shadow-md border border-white rounded-lg p-4">
						<p className="text-sm font-bold text-center text-white mb-2">Bloquear ADAs</p>
						<div className="flex flex-col space-y-6">
							<input
								type="text"
								placeholder="Lovelace"
								className="border border-gray-300 rounded px-3 py-1 bg-transparent text-white"
								onChange={(e) => setLovelaceFromInput(e.target.value)}
							/>
							{error && <span className="text-red-500 text-sm">{error}</span>}
							<div>
								<label className="text-white mr-4">
									<input
										type="radio"
										value="data"
										checked={datumType === "data"}
										onChange={() => setDatumType("data")}
										className="mr-2"
									/>
									Data
								</label>
								<label className="text-white">
									<input
										type="radio"
										value="constructor"
										checked={datumType === "constructor"}
										onChange={() => setDatumType("constructor")}
										className="mr-2"
									/>
									Constructor
								</label>
							</div>
							<input
								type="text"
								placeholder="Datum"
								className="border border-gray-300 rounded px-3 py-1 bg-transparent text-white"
								onChange={(e) => setDatumFromInput(e.target.value)}
							/>
							<button
								disabled={!connected}
								className="bg-[#c80e22] text-white font-semibold py-1 px-3 rounded hover:bg-black disabled:bg-gray-400 disabled:cursor-not-allowed"
								onClick={bloquear}
							>
								Bloquear ADAs
							</button>
						</div>
					</div>
				</div>

				<div className="bg-[#1f1f1f] shadow-md border border-white rounded-lg p-4 w-1/2">
					<p className="text-sm font-bold text-center text-white mb-4">
						{scriptAddress !== "" ? "UTxOs en " + scriptAddress : "Actualiza o pega el cbor para ver los UTxOs"}
					</p>
					<button
						className="bg-[#c80e22] text-white font-semibold py-1 px-3 rounded hover:bg-black disabled:bg-gray-400 disabled:cursor-not-allowed"
						onClick={reload}
					>
						Recargar
					</button>
					<div className="list space-y-2 mt-4">
						{scriptUTxOs.map((item) => (
							<button
								key={item.input.txHash + "#" + item.input.outputIndex}
								className="list-item bg-white text-black rounded-lg p-2 text-center"
								onClick={() => desbloquearDesdeScript(item.input.txHash, item.input.outputIndex)}
								disabled={!connected}
							>
								{item.output.amount.map(asset =>
									asset.unit === "lovelace" ?
										`Spend ${asset.quantity} ADAs ${item.output.plutusData ? JSON.stringify(deserializeDatum(item.output.plutusData), (_key, value) =>
  typeof value === 'bigint' ? value.toString() : value) : "No data"}`
										: ""
								)}
							</button>
						))}
					</div>

					<div className="relative mt-4">
						<label className="text-white mr-4">
							<input
								type="radio"
								value="data"
								checked={redeemerType === "data"}
								onChange={() => setRedeemerType("data")}
								className="mr-2"
							/>
							Data
						</label>
						<label className="text-white">
							<input
								type="radio"
								value="constructor"
								checked={redeemerType === "constructor"}
								onChange={() => setRedeemerType("constructor")}
								className="mr-2"
							/>
							Constructor
						</label>
					</div>
					<input
						type="text"
						placeholder="Redeemer"
						className="border border-gray-300 rounded px-3 py-1 pl-32 bg-transparent relative w-full text-white caret-white mt-4"
						onChange={(e) => setRedeemerFromInput(e.target.value)}
					/>
				</div>
			</div>
		</div>
	</div>

	);
};

export default Customized;
