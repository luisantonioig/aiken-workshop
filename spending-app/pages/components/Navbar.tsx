import { CardanoWallet } from "@meshsdk/react";
import { PubKeyHash } from "./Label"

export const Navbar = () => {

  return (
    <nav className="bg-customBackground p-4">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <PubKeyHash />
        </div>
        <div className="text-customFonts text-xl font-light">
          <CardanoWallet isDark={true} />
        </div>
      </div>
    </nav>
  );
};
