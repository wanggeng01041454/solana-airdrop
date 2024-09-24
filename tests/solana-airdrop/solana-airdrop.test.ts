import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";

import * as Token from '@solana/spl-token';

import path from "path";

import { describe, expect, test } from "vitest"
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { AirdropUtils, SolanaAirdropProvider } from "../../api/SolanaAirdropProvider";

import { Keypair, PublicKey } from "@solana/web3.js";
import { initNonceProjectAndRegisterBusinessProject4Test, runAppAndGetStdout, transferSol } from "../utils";
import { NonceVerifyProvider } from "../../api/NonceVerifyProvider";
import { BuildType, DEFAULT_CU_FACTOR } from "../../api/baseTypes";
import nacl from "tweetnacl";
import { sign } from "crypto";


// 测试时使用的，全局的payer账户
const GlobalPayerKeypair = (anchor.AnchorProvider.env().wallet as NodeWallet).payer;

// fixme: 这里必须使用 path.resolve, 否则无法找到可执行程序
const sign_checker_path = path.resolve(__dirname, "../../target/debug/sign_checker");


describe("solana-airdrop 合约测试", async () => {
  const connection = anchor.AnchorProvider.env().connection;
  const nonceVerifyProvider = new NonceVerifyProvider(connection);
  const airdropProvider = new SolanaAirdropProvider(connection);

  const nonceVerifyProjectAdminKeypair = Keypair.generate();
  const nonceVerifyBaseKeypair = Keypair.generate();
  const nonceVerifyBusinessProjectId = Keypair.generate().publicKey;

  const airdropProjectAdminKeypair = Keypair.generate();
  const airdropProjectId = Keypair.generate().publicKey;

  // 初始化一个 airdrop-project
  const txIdInitAirdropProject = await airdropProvider.initializeAirdropProjectAction({
    buildType: BuildType.SendAndFinalizeTx,
    cuPrice: 1 * 10 ** 6,
    cuFactor: DEFAULT_CU_FACTOR,
    payer: GlobalPayerKeypair.publicKey,
    payerKeypair: GlobalPayerKeypair,
    projectId: airdropProjectId,
    projectAdmin: airdropProjectAdminKeypair.publicKey
  });

  // 获取 nonce-verify-business-project 的地址
  const businessProjectAddress = nonceVerifyProvider.findBusinessProjectAddress({
    nonceBase: nonceVerifyBaseKeypair.publicKey,
    projectId: nonceVerifyBusinessProjectId
  });

  // 获取 nonce-verify-business-project 的 authority
  const airdropProjectAddress = airdropProvider.findAirdropProjectAddress(airdropProjectId);
  const nonceVerifyBusinessProjectAuthority = await airdropProvider.findNonceVerifyBusinessAuthorityAddress({
    airdropProjectPubkey: airdropProjectAddress,
    nonceVerifyBusinessProjectPubkey: businessProjectAddress
  });
  console.log(`nonceVerifyBusinessProjectAuthority: ${nonceVerifyBusinessProjectAuthority.toBase58()}`);


  // 初始化 nonce-project, 并注册业务工程
  await initNonceProjectAndRegisterBusinessProject4Test({
    provider: nonceVerifyProvider,
    pyaerKeypair: GlobalPayerKeypair,
    baseKeypair: nonceVerifyBaseKeypair,
    adminKeypair: nonceVerifyProjectAdminKeypair,
    projectId: nonceVerifyBusinessProjectId,
    projectAuthorityPubkey: nonceVerifyBusinessProjectAuthority
  });


  // 校验alice的nonce变化, alice 是一个随机生成的账户
  const aliceKeypair = Keypair.generate();
  // 给 alice 转钱，以便alice可以支付nonce-verify的费用
  {
    const txId = await transferSol({
      connection: connection,
      fromKeypair: GlobalPayerKeypair,
      toPubkey: aliceKeypair.publicKey,
      amountInSol: 5
    });
    console.log(`transfer-sol transaction txId: ${txId}, has finitialized`);
  }


  async function getAliceNonce() {
    return await nonceVerifyProvider.getUserBusinessNonceValue({
      userPubkey: aliceKeypair.publicKey,
      businessProject: businessProjectAddress
    });
  }

  const mintAccountKeypair = Keypair.generate();
  const mintAuthorityPubkey = airdropProvider.findAirdropMintAuthorityAddress({
    airdropProjectPubkey: airdropProjectAddress,
    mintAccountPubkey: mintAccountKeypair.publicKey
  });
  console.log(`mintAuthorityPubkey: ${mintAuthorityPubkey.toBase58()}`);

  const tokenDecimals = 8;
  await Token.createMint(
    connection,
    GlobalPayerKeypair,
    mintAuthorityPubkey,
    null,
    tokenDecimals,
    mintAccountKeypair,
    {
      commitment: 'finalized',
    }
  );
  console.log(`create-mint-account success, mintAccountPubkey: ${mintAccountKeypair.publicKey.toBase58()}`);

  // 计算 alice 的 ata-token-address
  const aliceAtaTokenAccountAddress = await Token.getAssociatedTokenAddressSync(mintAccountKeypair.publicKey, aliceKeypair.publicKey);
  console.log(`aliceAtaTokenAccountAddress: ${aliceAtaTokenAccountAddress.toBase58()}`);


  test("验证 airdrop project 的 Account", async () => {
    const airdropProjectAddress = airdropProvider.findAirdropProjectAddress(airdropProjectId);
    const airdropProjectAccount = await airdropProvider.getAirdropProjectAccount(airdropProjectAddress);

    console.log(`airdropProjectAddress: ${airdropProjectAddress.toBase58()}`);
    console.log(`airdropProjectAccount: ${JSON.stringify(airdropProjectAccount, undefined, 2)}`);
    expect(airdropProjectAccount.airdropProjectId.toBase58()).toBe(airdropProjectId.toBase58());
    expect(airdropProjectAccount.airdropProjectAdmin.toBase58()).toBe(airdropProjectAdminKeypair.publicKey.toBase58());
  });

  test("比较 typescript中生成的和rust中生成的 待签名数据 & 签名数据", async () => {

    //[nonce, amount, mint_address, user_address, airdrop_project_address, nonce_business_project_address]
    const nonceInfo = await getAliceNonce();
    const amount = new BN(30 * 10 ** 8);
    const mintAddress = mintAccountKeypair.publicKey;
    const userAddress = aliceKeypair.publicKey;
    const airdropProjectAddress = airdropProvider.findAirdropProjectAddress(airdropProjectId);
    const nonceBusinessProjectAddress = businessProjectAddress;

    // 比较 typescript中生成的待签名数据和rust中生成的待签名数据
    const rustResult = await runAppAndGetStdout(sign_checker_path,
      [
        "sign-data",
        nonceInfo.nonceValue.toString(),
        amount.toString(),
        mintAddress.toString(),
        userAddress.toString(),
        airdropProjectAddress.toString(),
        nonceBusinessProjectAddress.toString()
      ]);

    console.log(`rustResult: ${rustResult}`);

    const tsResultBuffer = await airdropProvider.buildClaimFtSignData({
      tokenAmount: amount,
      mintAccountPubkey: mintAddress,
      claimer: userAddress,
      airdropProjectPubkey: airdropProjectAddress,
      nonceVerifyBusinessProjectPubkey: nonceBusinessProjectAddress
    });
    const tsHexResult = tsResultBuffer.toString('hex');
    console.log(`tsHexResult: ${tsHexResult}`);

    expect(rustResult).toEqual(tsHexResult);


    // 使用 typescript 进行签名，使用 rust 进行签名验证
    const signature = AirdropUtils.sign(tsResultBuffer, airdropProjectAdminKeypair);
    const isValid = nacl.sign.detached.verify(
      tsResultBuffer,
      signature,
      airdropProjectAdminKeypair.publicKey.toBuffer()
    );
    expect(isValid).toBeTruthy();

    const rustVerifyResult = await runAppAndGetStdout(sign_checker_path, [
      "verify-sign",
      tsHexResult,
      signature.toString('hex'),
      airdropProjectAdminKeypair.publicKey.toBase58(),
    ]);
    expect(rustVerifyResult).toEqual("pass");

  });


  test("申领空投测试- 空投前 & 1次空投 & 2次空投", async () => {
    // 先获取 nonce-verify-business-project 的信息
    const businessProjectAccount = await nonceVerifyProvider.getBusinessProjectAccount(businessProjectAddress);
    console.log(`businessProjectAddress: ${businessProjectAddress.toBase58()}`);
    console.log(`businessProjectAccount: ${JSON.stringify(businessProjectAccount, undefined, 2)}`);
    expect(businessProjectAccount.businessProjectId.toBase58()).toBe(nonceVerifyBusinessProjectId.toBase58());
    expect(businessProjectAccount.businessProjectAuthority.toBase58()).toBe(nonceVerifyBusinessProjectAuthority.toBase58());

    // 空投前，账户不存在
    {
      const aliceAtaTokenAccountInfo = await connection.getAccountInfo(aliceAtaTokenAccountAddress);
      expect(aliceAtaTokenAccountInfo).toBeNull();
    }

    function printMintInfo(mint: Token.Mint) {
      console.log(`\t mintAuthority: ${mint.mintAuthority.toBase58()}`);
      console.log(`\t supply: ${mint.supply.toString()}`);
      console.log(`\t decimals: ${mint.decimals}`);
      console.log(`\t isInitialized: ${mint.isInitialized}`);
      console.log(`\t freezeAuthority: ${mint.freezeAuthority?.toBase58()}`);
    }

    // 校验 mint-account 及权限
    {
      const mintAccountInfo = await Token.getMint(connection, mintAccountKeypair.publicKey);
      console.log(`mintAccountAddress: ${mintAccountKeypair.publicKey.toBase58()}`);
      printMintInfo(mintAccountInfo);

      expect(mintAccountInfo.mintAuthority.toBase58()).toBe(mintAuthorityPubkey.toBase58());
    }

    let nonceInfo = await getAliceNonce();
    expect(nonceInfo.nonceValue).toBe(0); // nonce 初始值为0
    expect(nonceInfo.isExist).toBeFalsy(); // nonce 不存在
    const amountInNumber = 3000;
    const amount = new BN(amountInNumber);
    const mintAddress = mintAccountKeypair.publicKey;
    const userAddress = aliceKeypair.publicKey;
    const airdropProjectAddress = airdropProvider.findAirdropProjectAddress(airdropProjectId);
    const nonceBusinessProjectAddress = businessProjectAddress;

    async function claimFt(): Promise<string> {
      const signData = await airdropProvider.buildClaimFtSignData({
        tokenAmount: amount,
        mintAccountPubkey: mintAddress,
        claimer: userAddress,
        airdropProjectPubkey: airdropProjectAddress,
        nonceVerifyBusinessProjectPubkey: nonceBusinessProjectAddress
      });

      const signature = AirdropUtils.sign(signData, airdropProjectAdminKeypair);

      const txId = await airdropProvider.claimFtAction({
        buildType: BuildType.SendAndFinalizeTx,
        cuPrice: 1 * 10 ** 6,
        cuFactor: DEFAULT_CU_FACTOR,

        payer: GlobalPayerKeypair.publicKey,
        payerKeypair: GlobalPayerKeypair,

        nonceFeePayer: aliceKeypair.publicKey,
        nonceFeePayerKeypair: aliceKeypair,

        claimer: aliceKeypair.publicKey,
        claimerKeypair: aliceKeypair,

        spaceFeePayer: aliceKeypair.publicKey,
        spaceFeePayerKeypair: aliceKeypair,

        airdropProjectPubkey: airdropProjectAddress,

        mintAccountPubkey: mintAddress,
        nonceVerifyBusinessProjectPubkey: nonceBusinessProjectAddress,

        tokenAmount: amount,
        signData: signData,
        signature: signature
      });

      return txId as string;
    }

    // 1次申领空投
    const txId1 = await claimFt();
    console.log(`claimFtAction transaction txId1: ${txId1}, has finitialized`);

    function printTokenAccount(tokenAccount: Token.Account) {
      console.log(`\t mint: ${tokenAccount.mint.toBase58()}`);
      console.log(`\t owner: ${tokenAccount.owner.toBase58()}`);
      console.log(`\t amount: ${tokenAccount.amount.toString()}`);
      console.log(`\t address: ${tokenAccount.address.toBase58()}`);
    }
    // 检查tokenAccount
    {
      const aliceAtaTokenAccountInfo = await Token.getAccount(connection, aliceAtaTokenAccountAddress);
      printTokenAccount(aliceAtaTokenAccountInfo);
      const localAmount = Number(aliceAtaTokenAccountInfo.amount.toString());
      expect(localAmount).toBe(amountInNumber);
    }
    nonceInfo = await getAliceNonce();
    console.log(`nonceInfo: ${JSON.stringify(nonceInfo, undefined, 2)}`);
    expect(nonceInfo.nonceValue).toBe(1);
    expect(nonceInfo.isExist).toBeTruthy();

    // 2次申领空投
    const txId2 = await claimFt();
    console.log(`claimFtAction transaction txId2: ${txId2}, has finitialized`);

    // 检查tokenAccount
    {
      const aliceAtaTokenAccountInfo = await Token.getAccount(connection, aliceAtaTokenAccountAddress);
      printTokenAccount(aliceAtaTokenAccountInfo);
      const localAmount = Number(aliceAtaTokenAccountInfo.amount.toString());
      expect(localAmount).toBe(amountInNumber * 2);
    }
    nonceInfo = await getAliceNonce();
    console.log(`nonceInfo: ${JSON.stringify(nonceInfo, undefined, 2)}`);
    expect(nonceInfo.nonceValue).toBe(2);

    // 调整数据后，签名验证不通过， 
    // 情况1： signature 和 signData 不匹配
    {
      let err = undefined
      try {
        const signData = await airdropProvider.buildClaimFtSignData({
          tokenAmount: amount,
          mintAccountPubkey: mintAddress,
          claimer: userAddress,
          airdropProjectPubkey: airdropProjectAddress,
          nonceVerifyBusinessProjectPubkey: nonceBusinessProjectAddress
        });
  
        const signature = AirdropUtils.sign(signData, airdropProjectAdminKeypair);

        const signData2 = await airdropProvider.buildClaimFtSignData({
          tokenAmount: new BN(100),
          mintAccountPubkey: mintAddress,
          claimer: userAddress,
          airdropProjectPubkey: airdropProjectAddress,
          nonceVerifyBusinessProjectPubkey: nonceBusinessProjectAddress
        });
  
        const signature2 = AirdropUtils.sign(signData2, airdropProjectAdminKeypair);
  
        const txId = await airdropProvider.claimFtAction({
          buildType: BuildType.SendAndFinalizeTx,
          cuPrice: 1 * 10 ** 6,
          cuFactor: DEFAULT_CU_FACTOR,
  
          payer: GlobalPayerKeypair.publicKey,
          payerKeypair: GlobalPayerKeypair,
  
          nonceFeePayer: aliceKeypair.publicKey,
          nonceFeePayerKeypair: aliceKeypair,
  
          claimer: aliceKeypair.publicKey,
          claimerKeypair: aliceKeypair,
  
          spaceFeePayer: aliceKeypair.publicKey,
          spaceFeePayerKeypair: aliceKeypair,
  
          airdropProjectPubkey: airdropProjectAddress,
  
          mintAccountPubkey: mintAddress,
          nonceVerifyBusinessProjectPubkey: nonceBusinessProjectAddress,
  
          tokenAmount: amount,
          signData: signData,
          signature: signature2
        });
      } catch (error) {
        console.log('=======使签名数据和签名不匹配，期望抛出异常, catch error.');
        console.log(error.message.toString());
        err = error;
      }
      expect(err).toBeDefined();
    }

   // 调整数据后，签名验证不通过， 
    // 情况2： 合成数据 和 signData 不匹配
    {
      let err = undefined
      try {
        const signData = await airdropProvider.buildClaimFtSignData({
          tokenAmount: amount,
          mintAccountPubkey: mintAddress,
          claimer: userAddress,
          airdropProjectPubkey: airdropProjectAddress,
          nonceVerifyBusinessProjectPubkey: nonceBusinessProjectAddress
        });
  
        const signature = AirdropUtils.sign(signData, airdropProjectAdminKeypair);

  
        const txId = await airdropProvider.claimFtAction({
          buildType: BuildType.SendAndFinalizeTx,
          cuPrice: 1 * 10 ** 6,
          cuFactor: DEFAULT_CU_FACTOR,
  
          payer: GlobalPayerKeypair.publicKey,
          payerKeypair: GlobalPayerKeypair,
  
          nonceFeePayer: aliceKeypair.publicKey,
          nonceFeePayerKeypair: aliceKeypair,
  
          claimer: aliceKeypair.publicKey,
          claimerKeypair: aliceKeypair,
  
          spaceFeePayer: aliceKeypair.publicKey,
          spaceFeePayerKeypair: aliceKeypair,
  
          airdropProjectPubkey: airdropProjectAddress,
  
          mintAccountPubkey: mintAddress,
          nonceVerifyBusinessProjectPubkey: nonceBusinessProjectAddress,
  
          tokenAmount: new BN(20),
          signData: signData,
          signature: signature
        });
      } catch (error) {
        console.log('=======使签名数据和合成数据不匹配，期望抛出异常');
        console.log(error.message.toString());
        err = error;
      }
      expect(err).toBeDefined();
    }


  })

});
