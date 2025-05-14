import React, { useEffect, useState } from "react";
import { useWallet } from "@meshsdk/react";
import { IWallet, deserializeAddress } from "@meshsdk/core"

import "@meshsdk/react/styles.css";

const getPKH = async (wallet: IWallet) => {
  const addr = await wallet.getChangeAddress();
  const { pubKeyHash } = deserializeAddress(addr)
  return (pubKeyHash);
}

export const PubKeyHash = () => {
    const { wallet, connected } = useWallet();
    const [pubKeyHash, setPubKeyHash] = useState("")


    useEffect(() => {
      getPKH(wallet)
      .then(res => setPubKeyHash(res))
      .catch(err => console.error(err));
    },[connected]);
    return (
          <span className="text-customFonts font-light text-3xl">{connected ? pubKeyHash: "Conecta tu billetera"}</span>
	);
};
