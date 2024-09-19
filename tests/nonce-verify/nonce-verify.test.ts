import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Keypair
} from "@solana/web3.js";

import {
  InitializeNonceProjectActionParams,
  NonceVerifyProvider,
  RegisterBusinessProjectActionParams,
} from "../../api/NonceVerifyProvider";
import {
  BuildType,
  DEFAULT_CU_FACTOR
} from "../../api/baseTypes";

import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";


import { describe, expect, test, beforeAll } from "vitest"


// 测试时使用的，全局的payer账户
const GlobalPayerKeypair = (anchor.AnchorProvider.env().wallet as NodeWallet).payer;

// prepare
beforeAll(async () => {
  const connection = anchor.AnchorProvider.env().connection;

  const balance = await connection.getBalance(GlobalPayerKeypair.publicKey);
  console.log(`payer balance: ${balance}`);
});


describe("nonce-verify 合约测试", async () => {
  const connection = anchor.AnchorProvider.env().connection;
  const nonceVerifyProvider = new NonceVerifyProvider(connection);

  test("initializeProject指令 - 设置admin & 并注册业务工程 & businessFee=0", async () => {
    const adminKeypair = Keypair.generate();
    const baseKeypair = Keypair.generate();

    // 初始化 nonce-project
    const initializeProjectParams : InitializeNonceProjectActionParams = {
      buildType: BuildType.SendAndFinalizeTx,
      cuPrice: 1 * 10 ** 6,
      cuFactor: DEFAULT_CU_FACTOR,

      businessFee: 0,
      userFee: 2,
      payer: GlobalPayerKeypair.publicKey,
      payerKeypair: GlobalPayerKeypair,

      base: baseKeypair.publicKey,
      baseKeypair: baseKeypair,

      admin: adminKeypair.publicKey,
    };


    const txId = await nonceVerifyProvider.initializeNonceProjectAction(initializeProjectParams) as string;
    console.log(`initialize-nonce-project transaction txId: ${txId}, has finitialized`);

    // 查询 nonce-project
    const nonceProjectAccount = await nonceVerifyProvider.getNonceProjectAccount(baseKeypair.publicKey);
    console.log(`nonceProjectAccount: ${JSON.stringify(nonceProjectAccount, undefined, 2)}`);

    expect(initializeProjectParams.businessFee).toBe(nonceProjectAccount.businessFee);
    expect(initializeProjectParams.userFee).toBe(nonceProjectAccount.userFee);
    expect(adminKeypair.publicKey.toBase58()).toBe(nonceProjectAccount.admin.toBase58());

    // 注册业务工程
    const projectId = Keypair.generate().publicKey;
    const projectAuthority = Keypair.generate();

    const registerBusinessProjectParams: RegisterBusinessProjectActionParams = {
      buildType: BuildType.SendAndFinalizeTx,
      cuPrice: 1 * 10 ** 6,
      cuFactor: DEFAULT_CU_FACTOR,

      projectId: projectId,
      projectAuthority: projectAuthority.publicKey,

      payer: GlobalPayerKeypair.publicKey,
      payerKeypair: GlobalPayerKeypair,
      registerFeePayer: GlobalPayerKeypair.publicKey,
      registerFeePayerKeypair: GlobalPayerKeypair,

      nonceBase: baseKeypair.publicKey,

      nonceAdmin: adminKeypair.publicKey,
      nonceAdminKeypair: adminKeypair,
    };

    const nonceProjectPubkey = nonceVerifyProvider.findNonceProjectAddress(baseKeypair.publicKey);
    const nonceProjectBeforeBalance = await connection.getBalance(nonceProjectPubkey);
    
    const txId2 = await nonceVerifyProvider.registerBusinessProjectAction(registerBusinessProjectParams) as string;
    console.log(`register-business-project transaction txId: ${txId2}, has finitialized`);

    const nonceProjectAfterBalance = await connection.getBalance(nonceProjectPubkey);

    // 查询 business-project
    const businessProjectAccount = await nonceVerifyProvider.getBusinessProjectAccount(baseKeypair.publicKey, projectId);
    console.log(`businessProjectAccount: ${JSON.stringify(businessProjectAccount, undefined, 2)}`);

    expect(nonceProjectBeforeBalance + initializeProjectParams.businessFee).toBe(nonceProjectAfterBalance);
    expect(businessProjectAccount.projectId.toBase58()).toBe(projectId.toBase58());
    expect(businessProjectAccount.authority.toBase58()).toBe(projectAuthority.publicKey.toBase58());
  });


  test("initializeProject指令 - admin为None & 并注册业务工程 & businessFee>0", async () => {
    const baseKeypair = Keypair.generate();

    const initializeProjectParams : InitializeNonceProjectActionParams = {
      buildType: BuildType.SendAndFinalizeTx,
      cuPrice: 1 * 10 ** 6,
      cuFactor: DEFAULT_CU_FACTOR,

      businessFee: 8,
      userFee: 9,

      payer: GlobalPayerKeypair.publicKey,
      payerKeypair: GlobalPayerKeypair,

      base: baseKeypair.publicKey,
      baseKeypair: baseKeypair,
    };


    const txId = await nonceVerifyProvider.initializeNonceProjectAction(initializeProjectParams) as string;
    console.log(`initialize-nonce-project transaction txId: ${txId}, has finitialized`);

    // 查询 nonce-project
    const nonceProjectAccount = await nonceVerifyProvider.getNonceProjectAccount(baseKeypair.publicKey);
    console.log(`projectAccount: ${JSON.stringify(nonceProjectAccount, undefined, 2)}`);

    expect(initializeProjectParams.businessFee).toBe(nonceProjectAccount.businessFee);
    expect(initializeProjectParams.userFee).toBe(nonceProjectAccount.userFee);

    expect(nonceProjectAccount.admin).toBe(null);

    // 注册业务工程
    const projectId = Keypair.generate().publicKey;
    const projectAuthority = Keypair.generate();

    const registerBusinessProjectParams: RegisterBusinessProjectActionParams = {
      buildType: BuildType.SendAndFinalizeTx,
      cuPrice: 1 * 10 ** 6,
      cuFactor: DEFAULT_CU_FACTOR,

      projectId: projectId,
      projectAuthority: projectAuthority.publicKey,

      payer: GlobalPayerKeypair.publicKey,
      payerKeypair: GlobalPayerKeypair,
      registerFeePayer: GlobalPayerKeypair.publicKey,
      registerFeePayerKeypair: GlobalPayerKeypair,

      nonceBase: baseKeypair.publicKey,
    };

    const nonceProjectPubkey = nonceVerifyProvider.findNonceProjectAddress(baseKeypair.publicKey);
    const nonceProjectBeforeBalance = await connection.getBalance(nonceProjectPubkey);
    
    const txId2 = await nonceVerifyProvider.registerBusinessProjectAction(registerBusinessProjectParams) as string;
    console.log(`register-business-project transaction txId: ${txId2}, has finitialized`);

    const nonceProjectAfterBalance = await connection.getBalance(nonceProjectPubkey);

    // 查询 business-project
    const businessProjectAccount = await nonceVerifyProvider.getBusinessProjectAccount(baseKeypair.publicKey, projectId);
    console.log(`businessProjectAccount: ${JSON.stringify(businessProjectAccount, undefined, 2)}`);

    expect(nonceProjectBeforeBalance + initializeProjectParams.businessFee).toBe(nonceProjectAfterBalance);
    expect(businessProjectAccount.projectId.toBase58()).toBe(projectId.toBase58());
    expect(businessProjectAccount.authority.toBase58()).toBe(projectAuthority.publicKey.toBase58());
  });

});

