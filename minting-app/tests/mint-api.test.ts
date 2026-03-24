import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextApiRequest, NextApiResponse } from "next";
import type { MintBuildRequest, MintSubmitRequest } from "../lib/mint";

// This test file focuses on the API route contract:
// - how the route builds the mint transaction
// - how it submits a signed transaction
// - how it responds to invalid requests
//
// We intentionally mock Mesh SDK internals so the tests stay deterministic
// and do not depend on Blockfrost, a browser wallet, or Cardano network access.
const mockState = vi.hoisted(() => {
  const transactionOptions: Array<unknown> = [];
  const builderCalls: Array<{ method: string; args: unknown[] }> = [];
  const submitTxMock = vi.fn(async (tx: string) => `hash:${tx}`);
  const applyCborEncodingMock = vi.fn((code: string) => `encoded:${code}`);
  const isNetworkMock = vi.fn((value: unknown) =>
    ["testnet", "preview", "preprod", "mainnet"].includes(String(value)),
  );

  class MockTransaction {
    // Capture the exact builder calls made by the route so we can assert
    // that the transaction is assembled with the expected values.
    txBuilder = {
      mintPlutusScriptV3: () => {
        builderCalls.push({ method: "mintPlutusScriptV3", args: [] });
        return this.txBuilder;
      },
      mint: (cantidad: string, policyId: string, tokenNameHex: string) => {
        builderCalls.push({
          method: "mint",
          args: [cantidad, policyId, tokenNameHex],
        });
        return this.txBuilder;
      },
      mintingScript: (script: string) => {
        builderCalls.push({ method: "mintingScript", args: [script] });
        return this.txBuilder;
      },
      mintRedeemerValue: (redeemer: string) => {
        builderCalls.push({ method: "mintRedeemerValue", args: [redeemer] });
        return this.txBuilder;
      },
      selectUtxosFrom: (utxos: unknown[]) => {
        builderCalls.push({ method: "selectUtxosFrom", args: [utxos] });
        return this.txBuilder;
      },
      changeAddress: (address: string) => {
        builderCalls.push({ method: "changeAddress", args: [address] });
        return this.txBuilder;
      },
      txInCollateral: (txHash: string, outputIndex: number) => {
        builderCalls.push({ method: "txInCollateral", args: [txHash, outputIndex] });
        return this.txBuilder;
      },
      setNetwork: (network: string) => {
        builderCalls.push({ method: "setNetwork", args: [network] });
        return this.txBuilder;
      },
      complete: async () => {
        builderCalls.push({ method: "complete", args: [] });
        return "unsigned-tx";
      },
    };

    constructor(options: unknown) {
      transactionOptions.push(options);
    }
  }

  class MockBlockfrostProvider {
    projectId: string;

    constructor(projectId: string) {
      this.projectId = projectId;
    }

    submitTx = submitTxMock;
  }

  return {
    MockBlockfrostProvider,
    MockTransaction,
    applyCborEncodingMock,
    builderCalls,
    isNetworkMock,
    submitTxMock,
    transactionOptions,
  };
});

vi.mock("@meshsdk/core", async () => {
  const actual = await vi.importActual<typeof import("@meshsdk/core")>("@meshsdk/core");

  return {
    ...actual,
    applyCborEncoding: mockState.applyCborEncodingMock,
    BlockfrostProvider: mockState.MockBlockfrostProvider,
    isNetwork: mockState.isNetworkMock,
    Transaction: mockState.MockTransaction,
  };
});

type TestResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  status: (code: number) => TestResponse;
  setHeader: (key: string, value: string) => void;
  json: (payload: unknown) => TestResponse;
};

// Minimal response double for Next.js API handlers.
// It stores the status code, headers, and response body so tests can inspect them.
function createResponse(): TestResponse {
  const response: TestResponse = {
    statusCode: 200,
    headers: {},
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    setHeader(key: string, value: string) {
      this.headers[key] = value;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };

  return response;
}

const sampleUtxo = {
  input: { txHash: "abc123", outputIndex: 0 },
  output: {
    address: "addr_test1...",
    amount: [{ unit: "lovelace", quantity: "5000000" }],
  },
};

describe("pages/api/mint", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockState.transactionOptions.length = 0;
    mockState.builderCalls.length = 0;
    process.env.BLOCKFROST_API_KEY = "test-project-id";
    process.env.CARDANO_NETWORK = "preprod";
  });

  it("builds a mint transaction with the expected parameters", async () => {
    const { default: handler } = await import("../pages/api/mint");
    const req = {
      method: "POST",
      body: {
        action: "build",
        cantidad: "10",
        name: "Euro",
        redeemer: "Minting",
        code: "raw-cbor",
        policyId: "policy123",
        utxos: [sampleUtxo],
        collaterals: [sampleUtxo],
        changeAddress: "addr_test1_change",
      } satisfies MintBuildRequest,
    } as NextApiRequest;
    const res = createResponse();

    await handler(req, res as unknown as NextApiResponse);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ tx: "unsigned-tx", network: "preprod" });
    expect(mockState.applyCborEncodingMock).toHaveBeenCalledWith("raw-cbor");
    expect(mockState.builderCalls).toContainEqual({
      method: "mint",
      args: ["10", "policy123", "4575726f"],
    });
    expect(mockState.builderCalls).toContainEqual({
      method: "mintingScript",
      args: ["encoded:raw-cbor"],
    });
    expect(mockState.builderCalls).toContainEqual({
      method: "txInCollateral",
      args: ["abc123", 0],
    });
    expect(mockState.builderCalls).toContainEqual({
      method: "setNetwork",
      args: ["preprod"],
    });
    expect(mockState.transactionOptions).toHaveLength(1);
  });

  it("rejects build requests without collateral", async () => {
    const { default: handler } = await import("../pages/api/mint");
    const req = {
      method: "POST",
      body: {
        action: "build",
        cantidad: "10",
        name: "Euro",
        redeemer: "Minting",
        code: "raw-cbor",
        policyId: "policy123",
        utxos: [sampleUtxo],
        collaterals: [],
        changeAddress: "addr_test1_change",
      } satisfies MintBuildRequest,
    } as NextApiRequest;
    const res = createResponse();

    await handler(req, res as unknown as NextApiResponse);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({
      error: "La wallet no tiene collateral disponible.",
    });
  });

  it("submits a signed transaction through Blockfrost", async () => {
    const { default: handler } = await import("../pages/api/mint");
    const req = {
      method: "POST",
      body: {
        action: "submit",
        signedTx: "signed-tx-cbor",
      } satisfies MintSubmitRequest,
    } as NextApiRequest;
    const res = createResponse();

    await handler(req, res as unknown as NextApiResponse);

    expect(res.statusCode).toBe(200);
    expect(mockState.submitTxMock).toHaveBeenCalledWith("signed-tx-cbor");
    expect(res.body).toEqual({ txHash: "hash:signed-tx-cbor" });
  });

  it("returns 405 for non-POST methods", async () => {
    const { default: handler } = await import("../pages/api/mint");
    const req = {
      method: "GET",
      body: {},
    } as NextApiRequest;
    const res = createResponse();

    await handler(req, res as unknown as NextApiResponse);

    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe("POST");
    expect(res.body).toEqual({ error: "Metodo no permitido." });
  });
});
