import "@/styles/globals.css";
import { MeshProvider } from "@meshsdk/react";
import type { AppProps } from "next/app";
import Head from "next/head";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <MeshProvider>
      <Head>
        <title>Customized types - Spend</title>
      </Head>
      <Component {...pageProps} />
    </MeshProvider>
  );
}
