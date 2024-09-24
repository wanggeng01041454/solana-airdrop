import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Keypair
} from "@solana/web3.js";

import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";

import { describe, expect, test, beforeAll, assertType } from "vitest"

import {
  InitializeNonceProjectActionParams,
  NonceVerifyProvider,
  RegisterBusinessProjectActionParams,
  VerifyUserBusinessNonceActionParams,
} from "../../api/NonceVerifyProvider";

import {
  BuildType,
  DEFAULT_CU_FACTOR
} from "../../api/baseTypes";

import {
  initNonceProjectAndRegisterBusinessProject4Test,
  initNonceVerifyProject4Test,
  registerBusinessProject4Test,
  transferSol
} from "../utils";
import { aw } from "vitest/dist/chunks/reporters.WnPwkmgA";


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
    const businessFee = 0;
    const userFee = 2;
    const txId = await initNonceVerifyProject4Test({
      provider: nonceVerifyProvider,
      pyaerKeypair: GlobalPayerKeypair,
      baseKeypair: baseKeypair,
      adminKeypair: adminKeypair,
      userFee: userFee,
      businessFee: businessFee,
    });

    // 查询 nonce-project
    const nonceProjectAccount = await nonceVerifyProvider.getNonceProjectAccount(baseKeypair.publicKey);
    console.log(`nonceProjectAccount: ${JSON.stringify(nonceProjectAccount, undefined, 2)}`);

    expect(businessFee).toBe(businessFee);
    expect(userFee).toBe(nonceProjectAccount.userFee);
    expect(adminKeypair.publicKey.toBase58()).toBe(nonceProjectAccount.nonceProjectAdmin.toBase58());

    // 注册业务工程
    const projectId = Keypair.generate().publicKey;
    const projectAuthority = Keypair.generate();

    const nonceProjectPubkey = nonceVerifyProvider.findNonceProjectAddress(baseKeypair.publicKey);
    const nonceProjectBeforeBalance = await connection.getBalance(nonceProjectPubkey);

    const txId2 = await registerBusinessProject4Test({
      provider: nonceVerifyProvider,
      pyaerKeypair: GlobalPayerKeypair,
      baseKeypair: baseKeypair,
      adminKeypair: adminKeypair,
      projectId: projectId,
      projectAuthorityPubkey: projectAuthority.publicKey
    });

    const nonceProjectAfterBalance = await connection.getBalance(nonceProjectPubkey);

    // 查询 business-project
    const businessProjectAccount = await nonceVerifyProvider.getBusinessProjectAccount({
      nonceBase: baseKeypair.publicKey,
      projectId: projectId
    });
    console.log(`businessProjectAccount: ${JSON.stringify(businessProjectAccount, undefined, 2)}`);

    expect(nonceProjectBeforeBalance + businessFee).toBe(nonceProjectAfterBalance);
    expect(businessProjectAccount.businessProjectId.toBase58()).toBe(projectId.toBase58());
    expect(businessProjectAccount.businessProjectAuthority.toBase58()).toBe(projectAuthority.publicKey.toBase58());
  });


  test("initializeProject指令 - admin为None & 并注册业务工程 & businessFee>0", async () => {
    const baseKeypair = Keypair.generate();

    const initializeProjectParams: InitializeNonceProjectActionParams = {
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

    expect(nonceProjectAccount.nonceProjectAdmin).toBe(null);

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
    const businessProjectAccount = await nonceVerifyProvider.getBusinessProjectAccount({
      nonceBase: baseKeypair.publicKey,
      projectId: projectId
    });
    console.log(`businessProjectAccount: ${JSON.stringify(businessProjectAccount, undefined, 2)}`);

    expect(nonceProjectBeforeBalance + initializeProjectParams.businessFee).toBe(nonceProjectAfterBalance);
    expect(businessProjectAccount.businessProjectId.toBase58()).toBe(projectId.toBase58());
    expect(businessProjectAccount.businessProjectAuthority.toBase58()).toBe(projectAuthority.publicKey.toBase58());
    expect(businessProjectAccount.nonceProject.toBase58()).toBe(nonceProjectPubkey.toBase58());
  });


  test("verifyBusinessNonce指令 - 验证业务nonce的变化符合预期 & 关闭userBusinessNonceAccount", async () => {
    const adminKeypair = Keypair.generate();
    const baseKeypair = Keypair.generate();
    const projectId = Keypair.generate().publicKey;
    const projectAuthority = Keypair.generate();


    // 初始化 nonce-project, 并注册业务工程
    await initNonceProjectAndRegisterBusinessProject4Test({
      provider: nonceVerifyProvider,
      pyaerKeypair: GlobalPayerKeypair,
      baseKeypair: baseKeypair,
      adminKeypair: adminKeypair,
      projectId: projectId,
      projectAuthorityPubkey: projectAuthority.publicKey
    });

    const businessProject = nonceVerifyProvider.findBusinessProjectAddress({
      nonceBase: baseKeypair.publicKey,
      projectId: projectId
    });

    // 校验alice的nonce变化
    const aliceKeypair = Keypair.generate();

    // 给 alice 转钱，以便alice可以支付nonce-verify的费用
    {
      const txId = await transferSol({
        connection: connection,
        fromKeypair: GlobalPayerKeypair,
        toPubkey: aliceKeypair.publicKey,
        amountInSol: 1
      });
      console.log(`transfer-sol transaction txId: ${txId}, has finitialized`);
    }

    // 首先初始化alice的business-nonce
    const txId0 = await nonceVerifyProvider.initUserBusinessNonceStateAction({
      buildType: BuildType.SendAndFinalizeTx,
      cuPrice: 1 * 10 ** 6,
      cuFactor: DEFAULT_CU_FACTOR,

      payer: GlobalPayerKeypair.publicKey,
      payerKeypair: GlobalPayerKeypair,

      user: aliceKeypair.publicKey,
      userKeypair: aliceKeypair,

      businessProject: businessProject,
    });
    console.log(`init-user-business-nonce-state transaction txId: ${txId0}, has finitialized`);

    async function getAliceNonce() {
      return await nonceVerifyProvider.getUserBusinessNonceValue({
        userPubkey: aliceKeypair.publicKey,
        businessProject: businessProject
      });
    }

    // alice的nonce初始值
    let nonceInfo = await getAliceNonce();
    expect(nonceInfo.nonceValue).toBe(0);

    // 增加alice的nonce
    async function increaseAliceNonce() {
      const params: VerifyUserBusinessNonceActionParams = {
        buildType: BuildType.SendAndFinalizeTx,
        cuPrice: 1 * 10 ** 6,
        cuFactor: DEFAULT_CU_FACTOR,

        payer: GlobalPayerKeypair.publicKey,
        payerKeypair: GlobalPayerKeypair,

        user: aliceKeypair.publicKey,
        userKeypair: aliceKeypair,

        curNonceValue: nonceInfo.nonceValue,

        userFeePayer: GlobalPayerKeypair.publicKey,
        userFeePayerKeypair: GlobalPayerKeypair,

        businessProject: businessProject,
        businessProjectAuthorityKeypair: projectAuthority
      };

      console.log(`curNonceValue: ${params.curNonceValue}`);

      let txId = await nonceVerifyProvider.doVerifyUserBusinessNonce(params) as string;
      console.log(`verify-user-business-nonce transaction txId: ${txId}, has finitialized`);
    }
    await increaseAliceNonce();

    nonceInfo = await getAliceNonce();
    expect(nonceInfo.nonceValue).toBe(1);

    // 增加alice的nonce
    await increaseAliceNonce();
    nonceInfo = await getAliceNonce();
    expect(nonceInfo.nonceValue).toBe(2);

    const userBusinessNonceAddress = nonceVerifyProvider.findUserBusinessNonceAccountAddress({
      user: aliceKeypair.publicKey,
      businessProject: businessProject
    });

    // 关闭alice的business-nonce
    const txIdCloseUserBusinessNonce = await nonceVerifyProvider.closeUserBusinessNonceAccountAction({
      buildType: BuildType.SendAndFinalizeTx,
      cuPrice: 1 * 10 ** 6,
      cuFactor: DEFAULT_CU_FACTOR,

      nonceUser: aliceKeypair.publicKey,
      nonceUserKeypair: aliceKeypair,

      userBusinessNonceAccountPubkey: userBusinessNonceAddress,
    });
    console.log(`close-user-business-nonce-account transaction txId: ${txIdCloseUserBusinessNonce}, has finitialized`);
    {
      console.log('关闭后， userBusindessNonceAccount 应该是不存在的');
      let nonceInfo = await getAliceNonce();
      expect(nonceInfo.isExist).toBe(false);
    }

  });
});

