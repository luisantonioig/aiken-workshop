import Head from "next/head";
import { CardanoWallet, useWallet } from "@meshsdk/react";
import {
    applyParamsToScript,
    resolvePlutusScriptAddress,
    BlockfrostProvider,
    PlutusScript,
    MeshTxBuilder,
    mConStr0,
    Asset,
    deserializeAddress,
    unixTimeToEnclosingSlot,
    SLOT_CONFIG_NETWORK,
} from "@meshsdk/core";
import { Dispatch, SetStateAction, useState, useEffect } from "react";
import cbor from "cbor";
import LockModal from "@/components/LockModal";
import plutusScripts from "../../onchain/plutus.json";

export type SetState<T> = Dispatch<SetStateAction<T>>;


const blockchainProvider = new BlockfrostProvider(process.env.BLOCKFROST_API_KEY as string);

enum States {
    init,
    locking,
    lockingConfirming,
    locked,
    unlocking,
    unlockingConfirming,
    unlocked,
}

export default function Home() {
    const [state, setState] = useState(States.init);
    const { wallet, connected } = useWallet();
    const [txLockHash, setTxLockHash] = useState<string | null>(null);
    const [lockUntilTimestamp, setLockUntilTimestamp] = useState<number | null>(null);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [unlockMinutes, setUnlockMinutes] = useState(3);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [adaQuantity, setAdaQuantity] = useState(3);
    const [beneficiaryAddress, setBeneficiaryAddress] = useState("");
    const [benPubKeyHash, setPubKeyHash] = useState("");
    const [plutusScript, setPlutusScript] = useState<null | PlutusScript>(null);
    
    
    const handleUnlockClick = () => setIsModalOpen(true);

    const lockAiken = async () => {
	

	const txBuilder = new MeshTxBuilder({
	    fetcher: blockchainProvider,
	    submitter: blockchainProvider,
	});

        const walletAddress = (await wallet.getUsedAddresses())[0];
        const utxos = await wallet.getUtxos();
        const assets: Asset[] = [{ unit: "lovelace", quantity: (adaQuantity * 1_000_000).toString() }];
        const lockUntilTimeStamp = new Date();
        lockUntilTimeStamp.setMinutes(lockUntilTimeStamp.getMinutes() + unlockMinutes);
	if (beneficiaryAddress != "") {
	    const { pubKeyHash: beneficiaryPubKeyHash } = deserializeAddress(beneficiaryAddress);
	    const script = getPlutusScript(beneficiaryPubKeyHash, lockUntilTimeStamp.getTime());
	    const scriptAddress = resolvePlutusScriptAddress(script);
	    
	    setState(States.locking);
	    await txBuilder
		.setNetwork("preprod")
		.txOut(scriptAddress, assets)
		.txOutInlineDatumValue(mConStr0([beneficiaryPubKeyHash, lockUntilTimeStamp.getTime()]))
		.changeAddress(walletAddress)
		.selectUtxosFrom(utxos)
		.complete();

            const unsignedTx = txBuilder.txHex;
            const signedTx = await wallet.signTx(unsignedTx);
            const txHash = await wallet.submitTx(signedTx);
	    
            console.log("Locked Funds Tx Hash:", txHash);
	    
            setTxLockHash(txHash);
            setLockUntilTimestamp(lockUntilTimeStamp.getTime());
            setIsModalOpen(false);
	    setPubKeyHash(benPubKeyHash);
	    setPlutusScript(script);
            txBuilder.reset();
	

            if (txHash) {
		setState(States.lockingConfirming);
		blockchainProvider.onTxConfirmed(txHash, () => setState(States.locked), 100);
            }    
	} else {
	    alert("Pega la dirección del beneficiario");
	}
    };

    useEffect(() => {
        if ((state === States.lockingConfirming || state === States.locked) && lockUntilTimestamp) {
            const interval = setInterval(() => {
                const timeRemaining = Math.max(0, Math.floor((lockUntilTimestamp - Date.now()) / 1000));
                setTimeLeft(timeRemaining);

                if (timeRemaining <= 0) {
                    clearInterval(interval);
                }
            }, 1000);

            return () => clearInterval(interval);
        }
	const processAddress = (a:string) => {
	    const {pubKeyHash} = deserializeAddress(a)
	    setPubKeyHash(pubKeyHash);
	}
	if (connected) {
		wallet.getUsedAddress().then((address) => processAddress(address.toBech32()))
	} else {
	    setPubKeyHash("");
	}
    }, [state, lockUntilTimestamp, wallet]);

    const copyToClipboard = () => {
	navigator.clipboard.writeText(plutusScript?.code? plutusScript.code : "").then(() => {
	    alert("Texto copiado al portapapeles");
	});
    };
	

		return (
		<div className="min-h-screen bg-[#1f1f1f] text-white flex flex-col">
			<Head>
				<title>Vesting Parametrizado</title>
				<meta name="description" content="Vesting dApp powered by Mesh" />
				<link rel="icon" href="https://meshjs.dev/favicon/favicon-32x32.png" />
			</Head>

			<main className="flex-grow container mx-auto px-4 py-8">
				<h1 className="text-4xl font-extrabold text-center text-[#c80e22] mb-6">Vesting Parametrizado</h1>
				<div className="text-center mb-8">

					<div>
						<div
							style={{
								border: "1px solid #ccc",
								padding: "10px",
								cursor: "pointer",
								whiteSpace: "pre-wrap",
								wordWrap: "break-word",
								width: "100%",
								maxWidth: "500px",
								textAlign: "center",
								margin: "0 auto",
							}}
							onClick={copyToClipboard}
						>
							{plutusScript ? plutusScript.code: ""}
						</div>
						<button onClick={copyToClipboard} style={{ marginLeft: "10px" }}>
							Copiar
						</button>
					</div>

					<p className="text-lg">
						Time left: {timeLeft !== null ? `${Math.floor(timeLeft / 60)}m ${timeLeft % 60}s` : "Loading..."}
					</p>
				</div>

				<div className="flex justify-center mb-10">
					<CardanoWallet />
				</div>

				{connected && (
					<div className="space-y-4 text-center mb-8">
						{state === States.locking || state === States.unlocking ? (
							<p className="text-yellow-400">Creating transaction...</p>
						) : state === States.lockingConfirming || state === States.unlockingConfirming ? (
							<p className="text-blue-400">Awaiting transaction confirmation...</p>
						) : state === States.unlocked ? (
							<p className="text-green-400">Unlocked.</p>
						) : state === States.locked ? (
							<p className="text-red-400">Locked.</p>
						) : null}
					</div>
				)}

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
					<div className="card border border-white rounded-lg p-6 shadow-md hover:shadow-lg transition duration-300 bg-[#1f1f1f]">
						<h2 className="text-xl font-semibold mb-4">Lock</h2>
						<LockButton onClick={handleUnlockClick} setState={setState} state={state} setTxLockHash={setTxLockHash} setLockUntilTimestamp={setLockUntilTimestamp} minutes={unlockMinutes} />
					</div>

					<div className="card border border-white rounded-lg p-6 shadow-md hover:shadow-lg transition duration-300 bg-[#1f1f1f]">
						<h2 className="text-xl font-semibold mb-4">Unlock</h2>
						<UnlockButton setState={setState} state={state} txLockHash={txLockHash} lockUntilTimestamp={lockUntilTimestamp} plutusScript={plutusScript} />
					</div>
				</div>
					<p style={{ textAlign: 'center' }}>PubKeyHash: {benPubKeyHash}</p>

				{isModalOpen && (
					<LockModal
					    adaQuantity={adaQuantity}
							setAdaQuantity={setAdaQuantity}
							unlockMinutes={unlockMinutes}
							setUnlockMinutes={setUnlockMinutes}
					    setBeneficiaryAddress={setBeneficiaryAddress}
						onConfirm={lockAiken}
						onCancel={() => setIsModalOpen(false)}
					/>
				)}
			</main>
		</div>
	);
}

type ButtonParamsLock = {
    onClick:any
    setState: SetState<States>;
    state: States;
    setTxLockHash: SetState<string | null>;
    setLockUntilTimestamp: SetState<number | null>;
    minutes: number;
};
type ButtonParamsUnlock = {
    setState: SetState<States>;
    state: States;
    txLockHash: string | null;
    lockUntilTimestamp: number | null;
    plutusScript: null | PlutusScript; 
};
function LockButton({ onClick, state }: ButtonParamsLock) {
    const { connected } = useWallet();
    return (
        <button
    type="button"
    onClick={onClick}
    className={`${
        !connected || state !== States.init
            ? "bg-gray-400 text-gray-700 cursor-not-allowed"
            : "bg-[#c80e22] hover:bg-black text-white"
    } font-bold py-2 px-4 rounded w-full`}
    disabled={!connected || state !== States.init}
    >
        Lock
    </button>

    );
}
function UnlockButton({ setState, state, txLockHash, lockUntilTimestamp, plutusScript }: ButtonParamsUnlock) {
    const { wallet } = useWallet();
    function calculateInvalidBefore(lockUntilTimestamp: number): number {
        return unixTimeToEnclosingSlot(
            Math.min(lockUntilTimestamp, Date.now() - 15000),
            SLOT_CONFIG_NETWORK.preprod
        ) + 1;
    }
    const unlockAiken = async () => {
        if (!txLockHash || !lockUntilTimestamp) {
            console.error("Error: txHash o lockUntilTimestamp are not defined.");
            return;
        }
        setState(States.unlocking);
        const txBuilder = new MeshTxBuilder({
            fetcher: blockchainProvider,
            submitter: blockchainProvider,
        });
	if (plutusScript) {
	
        const vestingUtxos = await blockchainProvider.fetchUTxOs(txLockHash);
        const vestingUtxo = vestingUtxos[0];
        const walletAddress = (await wallet.getUsedAddresses())[0];
        const scriptAddress = resolvePlutusScriptAddress(plutusScript?.code? plutusScript:{code: "", version:"V3"}, 0);
        const utxos = await wallet.getUtxos();
        const collateral = (await wallet.getCollateral())[0];
        const collateralInput = collateral.input;
        const collateralOutput = collateral.output;
        const { pubKeyHash } = deserializeAddress(walletAddress);
        const invalidBefore = calculateInvalidBefore(lockUntilTimestamp);
        await txBuilder
            .setNetwork("preprod")
            .spendingPlutusScriptV3()
            .txIn(vestingUtxo.input.txHash, vestingUtxo.input.outputIndex, vestingUtxo.output.amount, scriptAddress)
            .spendingReferenceTxInInlineDatumPresent()
            .spendingReferenceTxInRedeemerValue("")
            .txInScript(plutusScript?.code? plutusScript.code : "")
            .txOut(walletAddress, [])
            .txInCollateral(collateralInput.txHash, collateralInput.outputIndex, collateralOutput.amount, collateralOutput.address)
            .invalidBefore(invalidBefore)
            .requiredSignerHash(pubKeyHash)
            .changeAddress(walletAddress)
            .selectUtxosFrom(utxos)
            .complete();
        try{
            const unsignedTx = txBuilder.txHex;
            const signedTx = await wallet.signTx(unsignedTx, true);
            const txHash = await wallet.submitTx(signedTx);
            console.log("Unlocked Funds Tx Hash:", txHash);
            if (txHash) {
                setState(States.unlockingConfirming);
                blockchainProvider.onTxConfirmed(txHash, () => setState(States.unlocked));
            }
        }catch(e){
            console.log(e);
            setState(States.locked);
            txBuilder.reset();
        }
	
    }
};
    return (
        <button
        type="button"
        onClick={unlockAiken}
        className={`${
            state !== States.locked
                ? "bg-gray-400 text-gray-700 cursor-not-allowed"
                : "bg-[#c80e22] hover:bg-black text-white"
        } font-bold py-2 px-4 rounded w-full`}
        disabled={state !== States.locked}
        >
            Unlock
        </button>
        );
}
function getPlutusScript(pkh:string, time:number): PlutusScript {
    const params = { alternative: 0, fields: [pkh,time]}
    return {
        code: applyParamsToScript(cbor
            .encode(Buffer.from(plutusScripts.validators.filter((val: any) => val.title == "parameterized_vesting.vesting.spend")[0].compiledCode, "hex"))
            .toString("hex"),
	[params], "Mesh"),
        version: "V3",
    };
}
