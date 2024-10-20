import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";

import * as Token from '@solana/spl-token';

import path from "path";

import { describe, expect, test } from "vitest"
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import { AirdropReceiverInfo, DirectDistributeAirdropProvider } from "../../api/DirectDistributeAirdropProvider";

import { Keypair, PublicKey } from "@solana/web3.js";
import { BuildType, DEFAULT_CU_FACTOR } from "../../api/baseTypes";
import { mySendAndFinalizeTransaction } from "../../api/utils";
import { transferSol } from "../utils";




// 测试时使用的，全局的payer账户
const GlobalPayerKeypair = (anchor.AnchorProvider.env().wallet as NodeWallet).payer;


describe("direct-distribute-airdrop 合约测试", async () => {
  const connection = anchor.AnchorProvider.env().connection;

  const airdropProvider = new DirectDistributeAirdropProvider(connection);

  // 单例管理项目的管理员账户
  const singletonManageProjectAdminKeypair = Keypair.generate();
  const userFee = 10;

  // 空投工程账户
  const airdropProjectAccountKeypair = Keypair.generate();
  // 空投工程管理账户
  const airdropAdminKeypair = Keypair.generate();


  // 初始化 singleton-manage-project
  const txIdInitSingletonManageProject = await airdropProvider.initSingletonManageProjectAction({
    buildType: BuildType.SendAndFinalizeTx,
    cuPrice: 1 * 10 ** 6,
    cuFactor: DEFAULT_CU_FACTOR,
    payer: GlobalPayerKeypair.publicKey,
    payerKeypair: GlobalPayerKeypair,
    manageAdmin: singletonManageProjectAdminKeypair.publicKey,
    manageAdminKeypair: singletonManageProjectAdminKeypair,
    userFee: userFee
  });
  console.log(`initSingletonManageProjectAction transaction txId: ${txIdInitSingletonManageProject}, has finitialized`);
  {
    const manageProjectState = await airdropProvider.getSingletonManageProjectAccount();
    console.log(`manageProjectState: ${JSON.stringify(manageProjectState, null, 2)}`);
  }


  // 初始化一个 airdrop-project
  const txIdInitAirdropProject = await airdropProvider.initAirdropProjectAction({
    buildType: BuildType.SendAndFinalizeTx,
    cuPrice: 1 * 10 ** 6,
    cuFactor: DEFAULT_CU_FACTOR,
    payer: GlobalPayerKeypair.publicKey,
    payerKeypair: GlobalPayerKeypair,
    airdropProjectPubkey: airdropProjectAccountKeypair.publicKey,
    airdropProjectKeypair: airdropProjectAccountKeypair,
    airdropAdmin: airdropAdminKeypair.publicKey,
  });
  console.log(`initAirdropProjectAction transaction txId: ${txIdInitAirdropProject}, has finitialized`);
  {
    const airdropProjectState = await airdropProvider.getAirdropProjectAccount(
      airdropProjectAccountKeypair.publicKey
    );
    console.log(`airdropProjectState: ${JSON.stringify(airdropProjectState, null, 2)}`);
  }

  // 准备一个 mint-account
  const mintAccountKeypair = Keypair.generate();
  const mintAuthorityPubkey = airdropProvider.findAirdropMintAuthorityAddress({
    airdropProjectPubkey: airdropProjectAccountKeypair.publicKey,
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


  test("验证 singleton-manage-project 的管理员切换", async () => {

    // 获取当前管理员
    const curState = await airdropProvider.getSingletonManageProjectAccount();

    expect(curState.manageAdmin.toBase58()).toBe(singletonManageProjectAdminKeypair.publicKey.toBase58());

    // 新的管理员
    const newManageAdminKeypair = Keypair.generate();


    // 切换管理员
    const txId = await airdropProvider.UpdateSingletonManageProjectAction({
      buildType: BuildType.SendAndFinalizeTx,
      cuPrice: 1 * 10 ** 6,
      cuFactor: DEFAULT_CU_FACTOR,
      payer: GlobalPayerKeypair.publicKey,
      payerKeypair: GlobalPayerKeypair,

      originManageAdmin: singletonManageProjectAdminKeypair.publicKey,
      originManageAdminKeypair: singletonManageProjectAdminKeypair,

      newManageAdmin: newManageAdminKeypair.publicKey,
    });

    const newState = await airdropProvider.getSingletonManageProjectAccount();
    expect(newState.manageAdmin.toBase58()).toBe(newManageAdminKeypair.publicKey.toBase58());
    expect(newState.userFee).toBe(curState.userFee);
    expect(newState.userFee).toBe(userFee);

    // 恢复管理员
    const txId2 = await airdropProvider.UpdateSingletonManageProjectAction({
      buildType: BuildType.SendAndFinalizeTx,
      cuPrice: 1 * 10 ** 6,
      cuFactor: DEFAULT_CU_FACTOR,
      payer: GlobalPayerKeypair.publicKey,
      payerKeypair: GlobalPayerKeypair,

      originManageAdmin: newManageAdminKeypair.publicKey,
      originManageAdminKeypair: newManageAdminKeypair,

      newManageAdmin: singletonManageProjectAdminKeypair.publicKey,
    });

    const newState2 = await airdropProvider.getSingletonManageProjectAccount();
    expect(newState2.manageAdmin.toBase58()).toBe(singletonManageProjectAdminKeypair.publicKey.toBase58());
  });

  // 验证 airdrop-project 的管理员切换
  test("验证  airdrop-project 的管理员切换", async () => {

    // 获取当前管理员
    const curState = await airdropProvider.getAirdropProjectAccount(
      airdropProjectAccountKeypair.publicKey
    );

    expect(curState.ddaAirdropAdmin.toBase58()).toBe(airdropAdminKeypair.publicKey.toBase58());

    // 新的管理员
    const newManageAdminKeypair = Keypair.generate();


    // 切换管理员
    const txId = await airdropProvider.updateDdaAirdropProjectAction({
      buildType: BuildType.SendAndFinalizeTx,
      cuPrice: 1 * 10 ** 6,
      cuFactor: DEFAULT_CU_FACTOR,
      payer: GlobalPayerKeypair.publicKey,
      payerKeypair: GlobalPayerKeypair,

      airdropProjectPubkey: airdropProjectAccountKeypair.publicKey,

      originAirdroptAdminPubkey: airdropAdminKeypair.publicKey,
      originAirdropProjectAdminKeypair: airdropAdminKeypair,

      newAirdropProjectAdminPubkey: newManageAdminKeypair.publicKey,
    });

    const newState = await airdropProvider.getAirdropProjectAccount(
      airdropProjectAccountKeypair.publicKey
    );
    expect(newState.ddaAirdropAdmin.toBase58()).toBe(newManageAdminKeypair.publicKey.toBase58());

    // 恢复管理员
    const txId2 = await airdropProvider.updateDdaAirdropProjectAction({
      buildType: BuildType.SendAndFinalizeTx,
      cuPrice: 1 * 10 ** 6,
      cuFactor: DEFAULT_CU_FACTOR,
      payer: GlobalPayerKeypair.publicKey,
      payerKeypair: GlobalPayerKeypair,

      airdropProjectPubkey: airdropProjectAccountKeypair.publicKey,

      originAirdroptAdminPubkey: newManageAdminKeypair.publicKey,
      originAirdropProjectAdminKeypair: newManageAdminKeypair,

      newAirdropProjectAdminPubkey: airdropAdminKeypair.publicKey,
    });

    const newState2 = await airdropProvider.getAirdropProjectAccount(
      airdropProjectAccountKeypair.publicKey
    );
    expect(newState2.ddaAirdropAdmin.toBase58()).toBe(airdropAdminKeypair.publicKey.toBase58());
  });

  // 验证转移mint-authority， 再转移回去
  test("验证 转移mint-authority， 再转移回去", async () => {

    // 获取当前mint-account信息
    const curMintAccount = await Token.getMint(connection, mintAccountKeypair.publicKey);
    expect(curMintAccount.mintAuthority?.toBase58()).toBe(mintAuthorityPubkey.toBase58());

    // 新的管理员
    const aliceMintAdminKeypair = Keypair.generate();

    // 切换管理员
    const txId = await airdropProvider.transferMintAuthorityAction({
      buildType: BuildType.SendAndFinalizeTx,
      cuPrice: 1 * 10 ** 6,
      cuFactor: DEFAULT_CU_FACTOR,
      payer: GlobalPayerKeypair.publicKey,
      payerKeypair: GlobalPayerKeypair,

      airdropProjectPubkey: airdropProjectAccountKeypair.publicKey,
      airdropAdminPubkey: airdropAdminKeypair.publicKey,
      airdropAdminKeypair: airdropAdminKeypair,

      mintAccountPubkey: mintAccountKeypair.publicKey,
      newMintAuthority: aliceMintAdminKeypair.publicKey,
    });

    const newMintAccount = await Token.getMint(connection, mintAccountKeypair.publicKey);
    expect(newMintAccount.mintAuthority?.toBase58()).toBe(aliceMintAdminKeypair.publicKey.toBase58());

    // 恢复管理员
    {
      const ix = Token.createSetAuthorityInstruction(
        mintAccountKeypair.publicKey,
        aliceMintAdminKeypair.publicKey,
        Token.AuthorityType.MintTokens,
        mintAuthorityPubkey,
      );

      const txId2 = await mySendAndFinalizeTransaction({
        connection: connection,
        ixs: [ix],
        payer: GlobalPayerKeypair.publicKey,
        cuPrice: 1 * 10 ** 6,
        signers: [GlobalPayerKeypair, aliceMintAdminKeypair],
      })
    }
    const new2MintAccount = await Token.getMint(connection, mintAccountKeypair.publicKey);
    expect(new2MintAccount.mintAuthority?.toBase58()).toBe(mintAuthorityPubkey.toBase58());
  });


  // 验证执行空投，尝试空投可以进行多少次
  test("验证 空投（空投个数，token-account存在/不存在）& 尝试可以空投多少次", async () => {

    // 校验alice的nonce变化, alice 是一个随机生成的账户
    const aKeypair = Keypair.generate();
    const aCount = 10;
    const aAtaAccount = await Token.getAssociatedTokenAddressSync(mintAccountKeypair.publicKey, aKeypair.publicKey);

    const bKeypair = Keypair.generate();
    const bCount = 500000;
    const bAtaAccount = await Token.getAssociatedTokenAddressSync(mintAccountKeypair.publicKey, bKeypair.publicKey);
    {
      const ix = Token.createAssociatedTokenAccountIdempotentInstruction(
        GlobalPayerKeypair.publicKey,
        bAtaAccount,
        bKeypair.publicKey,
        mintAccountKeypair.publicKey,
      );

      const txId = await mySendAndFinalizeTransaction({
        connection: connection,
        ixs: [ix],
        payer: GlobalPayerKeypair.publicKey,
        cuPrice: 1 * 10 ** 6,
        signers: [GlobalPayerKeypair],
      });

      // bAtaAccount 一定存在
      const bAtaAccountInfo = await connection.getAccountInfo(bAtaAccount);
      expect(bAtaAccountInfo).not.toBeNull();
    }

    // 便捷空投函数
    const airdropFunction = async (receiverInfoArray: AirdropReceiverInfo[], lookupTableAccountPubkey?: PublicKey) => {

      const txId = await airdropProvider.doDirectAirdropFtAction({
        buildType: BuildType.SendAndFinalizeTx,
        cuPrice: 1 * 10 ** 6,
        cuFactor: DEFAULT_CU_FACTOR,
        payer: GlobalPayerKeypair.publicKey,
        payerKeypair: GlobalPayerKeypair,

        airdropProjectPubkey: airdropProjectAccountKeypair.publicKey,
        airdropAdminPubkey: airdropAdminKeypair.publicKey,
        airdropAdminKeypair: airdropAdminKeypair,

        mintAccountPubkey: mintAccountKeypair.publicKey,
        receivers: receiverInfoArray,

        addressLookupTablePubkeyArray: lookupTableAccountPubkey ? [lookupTableAccountPubkey] : undefined,
      });

      return txId;
    }

    // a. b 账户进行空投
    {
      const receivers: AirdropReceiverInfo[] = [];

      receivers.push({
        receiver: aKeypair.publicKey,
        amount: new BN(aCount),
      });
      receivers.push({
        receiver: bKeypair.publicKey,
        amount: new BN(bCount),
      });

      const txId = await airdropFunction(receivers);
      console.log(`===空投初步测试成功，txId: ${txId}`);

      const aTokenAccount = await Token.getAccount(connection, aAtaAccount);
      expect(aTokenAccount.amount.toString(10)).toBe(aCount.toString());

      const bTokenAccount = await Token.getAccount(connection, bAtaAccount);
      expect(bTokenAccount.amount.toString(10)).toBe(bCount.toString());
    }

    // 构造 lookup-table
    const lookupTableAdminKeypair = Keypair.generate();
    const buildLookupTableResult = await airdropProvider.buildAirdropFtLookupTableAction({
      buildType: BuildType.SendAndFinalizeTx,
      cuPrice: 1 * 10 ** 6,
      cuFactor: DEFAULT_CU_FACTOR,
      payer: GlobalPayerKeypair.publicKey,
      payerKeypair: GlobalPayerKeypair,

      altAuthorityPubkey: lookupTableAdminKeypair.publicKey,
      altAuthorityKeypair: lookupTableAdminKeypair,

      airdropProjectPubkey: airdropProjectAccountKeypair.publicKey,

      mintAccountPubkey: mintAccountKeypair.publicKey,
      airdropPayerPubkey: GlobalPayerKeypair.publicKey,
    });
    console.log(`buildAirdropFtLookupTableAction transaction txId: ${buildLookupTableResult.actionResult}, has finitialized`);

    // 打印lookup-table
    {
      const altAccount = (await connection.getAddressLookupTable(buildLookupTableResult.addressLookupTablePubkey)).value;

      expect(altAccount.state.authority?.toBase58()).toBe(lookupTableAdminKeypair.publicKey.toBase58());

      const addrArray = altAccount.state.addresses.map((item) => item.toBase58());
      console.log(`lookup-table: ${JSON.stringify(addrArray, null, 2)}`);

      expect(addrArray.includes(mintAccountKeypair.publicKey.toBase58())).toBeTruthy();
      expect(addrArray.includes(GlobalPayerKeypair.publicKey.toBase58())).toBeTruthy();
      expect(addrArray.includes(mintAuthorityPubkey.toBase58())).toBeTruthy();
    }
    const addressLookupTablePubkey = buildLookupTableResult.addressLookupTablePubkey;

    // a. b 账户进行空投
    {
      console.log(`===开始进行空投测试，使用lookup-table`);

      // 计算 a,b 空投前的余额
      let aOldAmount: bigint = BigInt(0);
      {
        try {
          const tmpTokenAccount = await Token.getAccount(connection, aAtaAccount);
          aOldAmount = tmpTokenAccount.amount;
        } catch (e) {
          aOldAmount = BigInt(0);
        }
      }
      let bOldAmount: bigint = BigInt(0);
      {
        try {
          const tmpTokenAccount = await Token.getAccount(connection, bAtaAccount);
          bOldAmount = tmpTokenAccount.amount;
        } catch (e) {
          bOldAmount = BigInt(0);
        }
      }


      const receivers: AirdropReceiverInfo[] = [];

      receivers.push({
        receiver: aKeypair.publicKey,
        amount: new BN(aCount),
      });
      receivers.push({
        receiver: bKeypair.publicKey,
        amount: new BN(bCount),
      });

      const txId = await airdropFunction(receivers, addressLookupTablePubkey);
      console.log(`===带 lookup-table 空投测试成功，txId: ${txId}`);

      aOldAmount += BigInt(aCount);
      bOldAmount += BigInt(bCount);

      const aTokenAccount = await Token.getAccount(connection, aAtaAccount);
      expect(aTokenAccount.amount.toString(10)).toBe(aOldAmount.toString());

      const bTokenAccount = await Token.getAccount(connection, bAtaAccount);
      expect(bTokenAccount.amount.toString(10)).toBe(bOldAmount.toString());
    }


    // 尝试看，可以进行多少次空投, 从5次开始
    let count = 5;
    while (true) {

      const receivers: AirdropReceiverInfo[] = [];
      for (let i = 0; i < count; i++) {
        const keypair = Keypair.generate();
        receivers.push({
          receiver: keypair.publicKey,
          amount: new BN(100),
        });
      }

      console.log(`==============尝试空投 ${receivers.length} 次`);

      try {
        const txId = await airdropFunction(receivers);
      } catch (e) {
        console.log(`=====================================尝试空投 ${count} 次，失败，原因:`);
        console.dir(e);
        break;
      }
      console.log(`==============尝试空投 ${count} 次，成功`);

      count += 1;
    }

    // 使用 lookup-table 尝试看，可以进行多少次空投, 从5次开始
    count = 5;
    while (true) {

      const receivers: AirdropReceiverInfo[] = [];
      for (let i = 0; i < count; i++) {
        const keypair = Keypair.generate();
        receivers.push({
          receiver: keypair.publicKey,
          amount: new BN(100),
        });
      }

      console.log(`==============尝试空投(使用lookup-table) ${receivers.length} 次`);

      try {
        const txId = await airdropFunction(receivers, addressLookupTablePubkey);
      } catch (e) {
        console.log(`=====================================尝试空投(使用lookup-table) ${count} 次，失败，原因:`);
        console.dir(e);
        break;
      }
      console.log(`==============尝试空投(使用lookup-table) ${count} 次，成功`);

      count += 1;
    }

  });


  test("尝试重复初始化 singletone-mange-project 会失败", async () => {

    const tmpManageAdminKeypair = Keypair.generate();

    let e: any = undefined;
    // 初始化 singleton-manage-project
    try {
      const txId = await airdropProvider.initSingletonManageProjectAction({
        buildType: BuildType.SendAndFinalizeTx,
        cuPrice: 1 * 10 ** 6,
        cuFactor: DEFAULT_CU_FACTOR,
        payer: GlobalPayerKeypair.publicKey,
        payerKeypair: GlobalPayerKeypair,
        manageAdmin: tmpManageAdminKeypair.publicKey,
        manageAdminKeypair: tmpManageAdminKeypair,
        userFee: userFee
      });
    } catch (err) {
      e = err;
    }
    expect(e).not.toBeUndefined();
    console.dir(e);
  });


  test("能够成功提取fee, 且额度正确", async () => {

    const aliceKeypair = Keypair.generate();
    // 给alice 1 sol
    const txId1 = await transferSol({
      connection: connection,
      fromKeypair: GlobalPayerKeypair,
      toPubkey: aliceKeypair.publicKey,
      amountInSol: 1,
    });

    const beforeBalance = await connection.getBalance(aliceKeypair.publicKey);

    const claimAmount = 10; // 10 个 lamport, 之前的空投肯定有 10 个 lamport了

    const txId = await airdropProvider.claimFeeAction({
      buildType: BuildType.SendAndFinalizeTx,
      cuPrice: 1 * 10 ** 6,
      cuFactor: DEFAULT_CU_FACTOR,
      payer: GlobalPayerKeypair.publicKey,
      payerKeypair: GlobalPayerKeypair,

      manageAdminPubkey: singletonManageProjectAdminKeypair.publicKey,
      manageAdminKeypair: singletonManageProjectAdminKeypair,
      receiver: aliceKeypair.publicKey,
      amount: new BN(claimAmount),
    });

    const afterBalance = await connection.getBalance(aliceKeypair.publicKey);
    console.log(` alice's beforeBalance: ${beforeBalance}, afterBalance: ${afterBalance}`);

    expect(afterBalance - beforeBalance).toBe(claimAmount);
  });

});
