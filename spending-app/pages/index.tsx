import type { NextPage } from "next";
import "@meshsdk/react/styles.css";
import { Navbar } from "./components/Navbar";
import Spend from "./components/Spend";

const Home: NextPage = () => {
  return (
    <div className="min-h-screen w-full bg-gray-100 flex flex-col">
      <Navbar />
      <Spend />
    </div>
  );
};

export default Home;
