

import React, { useEffect, useState, useCallback } from "react";
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
    
    const handleCopy = useCallback(() => {
    navigator.clipboard
      .writeText(pubKeyHash)
      .then(() => {
        alert('Tu llave pública ha sido copiada.');
      })
      .catch(err => {
        console.error('Error copiando al portapapeles:', err);
      });
  }, [pubKeyHash]);


    useEffect(() => {
      getPKH(wallet)
      .then(res => setPubKeyHash(res))
      .catch(err => console.error(err));
    },[connected]);
    return (
          <span onClick={handleCopy} style={{ cursor: 'pointer' }} className="text-customFonts font-light text-xl text-white
           hover:opacity-80 hover:underline transition duration-200">{connected ? pubKeyHash + "📋": "Conecta tu billetera"}</span>
	);
};
