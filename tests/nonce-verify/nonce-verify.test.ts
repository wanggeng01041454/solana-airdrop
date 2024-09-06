import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { NonceVerify } from "../../target/types/nonce_verify";

import { describe, expect, test, beforeAll } from "vitest"
import { Keypair, PublicKey } from "@solana/web3.js";

import {
  findProjectAddress,
  InitializeProjectParams
} from "./utils";

import {
  mySendAndFinalizeTransaction
} from "../utils";


// prepare
beforeAll(async () => {
  const connection = anchor.AnchorProvider.env().connection;

  const wallet = anchor.AnchorProvider.env().wallet;
  console.log(`wallet address: ${wallet.publicKey.toBase58()}`);

  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`wallet balance: ${balance}`);
});


describe("nonce-verify 合约测试", async () => {

  const nonceVerifyProgram = anchor.workspace.NonceVerify as Program<NonceVerify>;
  const connection = anchor.AnchorProvider.env().connection;

  const wallet = anchor.AnchorProvider.env().wallet;

  test("initializeProject指令 - 设置admin", async () => {
    const initializeProjectParams = {
      businessFee: 3,
      userFee: 2,
    } as InitializeProjectParams;

    const adminKeypair = Keypair.generate();
    const baseKeypair = Keypair.generate();

    // 构造指令
    const ix = await nonceVerifyProgram.methods
      .initializeProject(initializeProjectParams)
      .accounts({
        payer: wallet.publicKey,
        admin: adminKeypair.publicKey,
        base: baseKeypair.publicKey
      }).instruction();

    // 发送交易
    await mySendAndFinalizeTransaction({
      connection: connection,
      ixs: [ix],
      payer: wallet.publicKey,
      cuPrice: 1 * 10 ** 6,
      signers: [baseKeypair],
      extraSigner: wallet
    });

    const projectAccountPubkey = findProjectAddress(baseKeypair.publicKey, nonceVerifyProgram.programId);
    // 查询账户
    const projectAccount = await nonceVerifyProgram.account.project.fetch(projectAccountPubkey);
    console.log(`projectAccount: ${JSON.stringify(projectAccount, undefined, 2)}`);

    expect(initializeProjectParams.businessFee).toBe(projectAccount.businessFee);
    expect(initializeProjectParams.userFee).toBe(projectAccount.userFee);
    expect(adminKeypair.publicKey.toBase58()).toBe(projectAccount.admin.toBase58());
  });


  test("initializeProject指令 - admin为None", async () => {
    const initializeProjectParams = {
      businessFee: 7,
      userFee: 8,
    } as InitializeProjectParams;
    const baseKeypair = Keypair.generate();

    // 构造指令
    const ix = await nonceVerifyProgram.methods
      .initializeProject(initializeProjectParams)
      .accounts({
        payer: wallet.publicKey,
        admin: null,
        base: baseKeypair.publicKey
      }).instruction();

    // 发送交易
    await mySendAndFinalizeTransaction({
      connection: connection,
      ixs: [ix],
      payer: wallet.publicKey,
      cuPrice: 1 * 10 ** 6,
      signers: [baseKeypair],
      extraSigner: wallet
    });

    const projectAccountPubkey = findProjectAddress(baseKeypair.publicKey, nonceVerifyProgram.programId);
    // 查询账户
    const projectAccount = await nonceVerifyProgram.account.project.fetch(projectAccountPubkey);
    console.log(`projectAccount: ${JSON.stringify(projectAccount, undefined, 2)}`);

    expect(initializeProjectParams.businessFee).toBe(projectAccount.businessFee);
    expect(initializeProjectParams.userFee).toBe(projectAccount.userFee);

    expect(projectAccount.admin).toBe(null);
  });

});

