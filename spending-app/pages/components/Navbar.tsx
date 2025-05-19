import { CardanoWallet } from "@meshsdk/react";
import { PubKeyHash } from "./Label"

export const Navbar = () => {

  return (
    <nav className="bg-customBackground p-4">
      <div className="container mx-auto flex justify-between items-center">

        <div className="flex items-center space-x-2">
          
          <span className="text-customFonts font-light text-3xl">Spending Application</span>
        </div>
        <div className="relative group inline-block overflow-visible">
          
          <PubKeyHash />
          <span
      className="pointer-events-none absolute -top-6 left-1/2 transform -translate-x-1/2
             opacity-0 group-hover:opacity-100 text-xs text-white bg-black bg-opacity-60
             px-2 py-1 rounded transition-opacity duration-200"
    >
      Copy
    </span>
         
        </div>
        
        <div className="text-customFonts text-xl font-light">
          <CardanoWallet isDark={true} />
        </div>
      </div>
    </nav>
  );
};
