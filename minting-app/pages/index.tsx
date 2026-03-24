import type { NextPage } from "next";
import "@meshsdk/react/styles.css";
import { Navbar } from "../components/Navbar";
import Mint from "../components/Mint";
const Home: NextPage = () => {
    return (
	<div className="min-h-screen w-full bg-gray-100 flex flex-col">
	    <Navbar />
	    <Mint  />
	</div>
    );
};

export default Home;
