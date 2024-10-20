import {
  AccountMeta,
  AddressLookupTableAccount,
  AddressLookupTableProgram,
  Commitment,
  ComputeBudgetProgram,
  Connection,
  Ed25519Program,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction
} from "@solana/web3.js";

import * as anchor from "@coral-xyz/anchor";
import * as Token from '@solana/spl-token';

import {
  BuildType,
  BaseActionParams,
  ActionResult
} from "./baseTypes";

import {
  BuildActionResultParams,
  buildActionResult
} from "./utils";

import { DirectDistributeAirdrop } from "../target/types/direct_distribute_airdrop";
import DirectDistributeAirdropIDL from "../target/idl/direct_distribute_airdrop.json";


// 合约接口类型定义
export type ProgramInitSingletonManageProjectParams = anchor.IdlTypes<DirectDistributeAirdrop>["initSingletonManageProjectParams"];
export type ProgramUpdateSingletonManageProjectParams = anchor.IdlTypes<DirectDistributeAirdrop>["updateSingletonManageProjectParams"];
export type ProgramClaimFeeParams = anchor.IdlTypes<DirectDistributeAirdrop>["claimFeeParams"];

export type ProgramUpdateDdaAirdropProjectParams = anchor.IdlTypes<DirectDistributeAirdrop>["updateDdaAirdropProjectParams"];
export type ProgramDdaAirdropFtParams = anchor.IdlTypes<DirectDistributeAirdrop>["ddaAirdropFtParams"];


export type ProgramSingletonManageProjectAccount = anchor.IdlTypes<DirectDistributeAirdrop>["singletonManageProject"];
export type ProgramAirdropProjectAccount = anchor.IdlTypes<DirectDistributeAirdrop>["ddaAirdropProject"];

// 辅助类型参数
/**
 * @description 初始化 单例的 manage-project 的参数
 * 特别说明： 所有的 *Keypair参数，都是可选的，只有在 buildType 为 SendAndFinalizeTx 或 SendAndConfirmTx 时，才需要传入
 */
export interface InitSingletonManageProjectActionParams extends BaseActionParams {
  // 交易费支付者
  payer: PublicKey,
  payerKeypair?: Keypair,

  // 管理员, 
  manageAdmin: PublicKey,
  manageAdminKeypair?: Keypair,

  // 给每个用户空投需要支付的费用
  userFee: number,
}

/**
 * @description 初始化 单例的 manage-project 的参数
 * 特别说明： 所有的 *Keypair参数，都是可选的，只有在 buildType 为 SendAndFinalizeTx 或 SendAndConfirmTx 时，才需要传入
 */
export interface UpdateSingletonManageProjectActionParams extends BaseActionParams {
  // 交易费支付者
  payer: PublicKey,
  payerKeypair?: Keypair,

  // 原有的管理员, 
  originManageAdmin: PublicKey,
  originManageAdminKeypair?: Keypair,

  // 新管理员, 
  newManageAdmin?: PublicKey,

  // 新的费用值
  newUserFee?: number,
}

/**
 * @description 取走空投得到的费用
 * 特别说明： 所有的 *Keypair参数，都是可选的，只有在 buildType 为 SendAndFinalizeTx 或 SendAndConfirmTx 时，才需要传入
 */
export interface ClaimFeeActionParams extends BaseActionParams {
  // 交易费支付者
  payer: PublicKey,
  payerKeypair?: Keypair,

  // 管理员, 
  manageAdminPubkey: PublicKey,
  manageAdminKeypair?: Keypair,

  // claim费用时，接收资金的账户
  receiver: PublicKey,

  // 给每个用户空投需要支付的费用
  amount: anchor.BN,
}

/**
 * @description 初始化空投项目的参数
 * 特别说明： 所有的 *Keypair参数，都是可选的，只有在 buildType 为 SendAndFinalizeTx 或 SendAndConfirmTx 时，才需要传入
 */
export interface InitAirdropProjectActionParams extends BaseActionParams {
  // 交易费支付者
  payer: PublicKey,
  payerKeypair?: Keypair,

  // airdrop project account 地址和对应私钥
  // airdrop project 是一个 EOA 账户
  airdropProjectPubkey: PublicKey,
  airdropProjectKeypair?: Keypair,

  // 空投项目的管理员
  airdropAdmin: PublicKey,
}


/**
 * @description 转移 mint-account 的 mint-authority 参数
 * 特别说明： 所有的 *Keypair参数，都是可选的，只有在 buildType 为 SendAndFinalizeTx 或 SendAndConfirmTx 时，才需要传入
 */
export interface TransferMintAuthorityActionParams extends BaseActionParams {
  // 交易费支付者
  payer: PublicKey,
  payerKeypair?: Keypair,

  // 相关的 airdrop 项目
  airdropProjectPubkey: PublicKey,

  // airdrop project 的管理员, 需要它的签名
  airdropAdminPubkey: PublicKey,
  airdropAdminKeypair?: Keypair,

  // 要转移权限的的 mint-account
  mintAccountPubkey: PublicKey,

  // mint-account 的新 authority
  newMintAuthority: PublicKey
}

/**
 * @description 关闭 airdrop 项目的参数
 * 特别说明： 所有的 *Keypair参数，都是可选的，只有在 buildType 为 SendAndFinalizeTx 或 SendAndConfirmTx 时，才需要传入
 */
export interface UpdateDdaAirdropProjectActionParams extends BaseActionParams {
  // 交易费支付者
  payer: PublicKey,
  payerKeypair?: Keypair,

  // 相关的 airdrop 项目
  airdropProjectPubkey: PublicKey,

  // airdrop project 的管理员, 需要它的签名
  originAirdroptAdminPubkey: PublicKey,
  originAirdropProjectAdminKeypair?: Keypair,

  // 新的管理员
  newAirdropProjectAdminPubkey: PublicKey,
}


/**
 * @description 空投的接收者信息
 */
export interface AirdropReceiverInfo {
  // 接收空投的账户
  receiver: PublicKey,
  // 空投的数量
  amount: anchor.BN,
}

/**
 * @description 空投 FT 的参数
 * 特别说明： 所有的 *Keypair参数，都是可选的，只有在 buildType 为 SendAndFinalizeTx 或 SendAndConfirmTx 时，才需要传入
 */
export interface AirdropFtActionParams extends BaseActionParams {
  // 交易费支付者
  payer: PublicKey,
  payerKeypair?: Keypair,

  // airdrop project account 地址和对应私钥
  airdropProjectPubkey: PublicKey,

  // 空投项目的管理员
  airdropAdminPubkey: PublicKey,
  airdropAdminKeypair?: Keypair,

  // 空投的 mint-account
  mintAccountPubkey: PublicKey,

  // 空投的接收者信息
  receivers: AirdropReceiverInfo[],

  // 使用 addressLookupTables , 可选参数
  addressLookupTablePubkeyArray?: PublicKey[]
}

// 在不使用 lookup table 的情况下，最多能空投的个数
const MAX_AIRDROP_IN_ONE_TX = 8;

// 在使用 lookup table 存放所有 非空投地址的情况下，最多能空投的个数
const MAX_AIRDROP_IN_ONE_TX_WITH_LOOKUP_TABLE = 10;

/**
 * @description 构建空投 FT 除空投地址外的 lookup table 的参数
 * 特别说明： 所有的 *Keypair参数，都是可选的，只有在 buildType 为 SendAndFinalizeTx 或 SendAndConfirmTx 时，才需要传入
 */
export interface BuildAirdropFtLookupTableActionParams extends BaseActionParams {
  // 交易费支付者
  payer: PublicKey,
  payerKeypair?: Keypair,

  // address-lookup-table 的 管理者地址
  altAuthorityPubkey: PublicKey,
  altAuthorityKeypair?: Keypair,

  // 待加入 lookup table 的空投项目的地址
  airdropProjectPubkey: PublicKey,

  // 待加入 lookup table 的 mint-account 的地址
  mintAccountPubkey: PublicKey,

  // 待加入 lookup table 的空投 payer 的地址
  airdropPayerPubkey?: PublicKey,
}


const DIRECT_DISTRIBUTE_AIRDROP_MANAGER_SEED = Buffer.from("dda_manager");
const DIRECT_DISTRIBUTE_AIRDROP_FEE_RECEIVER_SEED = Buffer.from("dda_fee_recv");
const DIRECT_DISTRIBUTE_AIRDROP_MINT_AUTHORITY_SEED = Buffer.from("dda_mint_auth");


export class DirectDistributeAirdropProvider {
  private connection: Connection;
  private program: anchor.Program<DirectDistributeAirdrop>;


  /**
   * @description 构造函数
   * @param connection 
   */
  constructor(
    connection: Connection,
    commitment?: Commitment
  ) {
    this.connection = connection;

    const options = anchor.AnchorProvider.defaultOptions();
    if (commitment) {
      options.commitment = commitment;
    }
    // 创建 anchor-provider
    const provider = new anchor.AnchorProvider(
      this.connection,
      {} as anchor.Wallet,
      options
    );

    // 可以访问合约的 program
    this.program = new anchor.Program(DirectDistributeAirdropIDL as DirectDistributeAirdrop, provider);

  }

  /**
   * @description 获得单例合约管理账户的地址
   * @returns 
   */
  public findSingletonManageProjectAddress(): PublicKey {
    return PublicKey.findProgramAddressSync([
      DIRECT_DISTRIBUTE_AIRDROP_MANAGER_SEED,
    ], this.program.programId)[0];
  }

  /**
   * @description 获得单例合约的 fee-receiver 账户的地址
   * @returns 
   */
  public findSingletonFeeReceiverAddress(): PublicKey {
    return PublicKey.findProgramAddressSync([
      DIRECT_DISTRIBUTE_AIRDROP_FEE_RECEIVER_SEED,
    ], this.program.programId)[0];
  }

  /**
   * @description 计算被空投的mint-account的 authority 地址
   * 需要将 mint-account 的 authority 设置为该地址， 才能使用空投合约对该 mint-account 进行空投
   * @param params
   */
  public findAirdropMintAuthorityAddress(params: {
    airdropProjectPubkey: PublicKey,
    mintAccountPubkey: PublicKey
  }): PublicKey {
    return PublicKey.findProgramAddressSync([
      DIRECT_DISTRIBUTE_AIRDROP_MINT_AUTHORITY_SEED,
      params.airdropProjectPubkey.toBuffer(),
      params.mintAccountPubkey.toBuffer()
    ], this.program.programId)[0];
  }

  /**
   * @description 获得单例合约管理账户的信息
   * @returns 
   */
  public getSingletonManageProjectAccount(): Promise<ProgramSingletonManageProjectAccount> {
    return this.program.account.singletonManageProject.fetch(this.findSingletonManageProjectAddress());
  }

  /**
   * @description 获得空投项目账户的信息
   * @param airdropProjectPubkey 
   * @returns 
   */
  public getAirdropProjectAccount(airdropProjectPubkey: PublicKey): Promise<ProgramAirdropProjectAccount> {
    return this.program.account.ddaAirdropProject.fetch(airdropProjectPubkey);
  }

  /**
 * @description 初始化 单例的 manage-project
 * 必须在部署合约后立即初始化
 * 进行初始化时设定的 manageAdmin 能够获取合约收到的所有费用
 * 
 * @param params 
 * @returns 
 */
  public async initSingletonManageProjectAction(params: InitSingletonManageProjectActionParams): Promise<ActionResult> {
    const initSingletonManageProjectParams: ProgramInitSingletonManageProjectParams = {
      userFee: params.userFee,
    };

    // 构造指令
    const ix = await this.program.methods
      .initSingletonManageProject(initSingletonManageProjectParams)
      .accounts({
        payer: params.payer,
        manageAdmin: params.manageAdmin,
      }).instruction();

    const buildParams: BuildActionResultParams = {
      buildType: params.buildType,
      cuPrice: params.cuPrice,
      cuFactor: params.cuFactor,

      connection: this.connection,
      ixs: [ix],
      payer: params.payer,
      signers: [params.payerKeypair, params.manageAdminKeypair]
    };

    return await buildActionResult(buildParams);
  }

  /**
   * @description 更新 单例的 manage-project
   * @param params 
   * @returns 
   */
  public async UpdateSingletonManageProjectAction(params: UpdateSingletonManageProjectActionParams): Promise<ActionResult> {

    // optional 参数，不需要时要填入 null
    const updateSingletonManageProjectParams: ProgramUpdateSingletonManageProjectParams = {
      newManageAdmin: params.newManageAdmin ? params.newManageAdmin : null,
      newUserFee: params.newUserFee ? params.newUserFee : null,
    };

    const accounts = {
      payer: params.payer,
      manageAdmin: params.originManageAdmin,
    }
    // 构造指令
    const ix = await this.program.methods
      .updateSingletonManageProject(updateSingletonManageProjectParams)
      .accounts(accounts).instruction();

    const buildParams: BuildActionResultParams = {
      buildType: params.buildType,
      cuPrice: params.cuPrice,
      cuFactor: params.cuFactor,

      connection: this.connection,
      ixs: [ix],
      payer: params.payer,
      signers: [params.payerKeypair, params.originManageAdminKeypair]
    };

    return await buildActionResult(buildParams);
  }

  /**
   * @description 取走空投得到的费用
   * @param params 
   * @returns 
   */
  public async claimFeeAction(params: ClaimFeeActionParams): Promise<ActionResult> {
    const claimFeeParams: ProgramClaimFeeParams = {
      amount: params.amount,
    };

    const accounts = {
      payer: params.payer,
      manageAdmin: params.manageAdminPubkey,
      receiver: params.receiver,
    }
    // 构造指令
    const ix = await this.program.methods
      .claimFee(claimFeeParams)
      .accounts(accounts).instruction();

    const buildParams: BuildActionResultParams = {
      buildType: params.buildType,
      cuPrice: params.cuPrice,
      cuFactor: params.cuFactor,

      connection: this.connection,
      ixs: [ix],
      payer: params.payer,
      signers: [params.payerKeypair, params.manageAdminKeypair]
    };

    return await buildActionResult(buildParams);
  }

  /**
   * @description 初始化空投项目
   * @param params 
   * @returns 
   */
  public async initAirdropProjectAction(params: InitAirdropProjectActionParams): Promise<ActionResult> {
    // 构造指令
    const ix = await this.program.methods
      .initDdaAirdropProject()
      .accounts({
        payer: params.payer,
        ddaAirdropProject: params.airdropProjectPubkey,
        airdropAdmin: params.airdropAdmin,
      }).instruction();

    const buildParams: BuildActionResultParams = {
      buildType: params.buildType,
      cuPrice: params.cuPrice,
      cuFactor: params.cuFactor,

      connection: this.connection,
      ixs: [ix],
      payer: params.payer,
      signers: [params.payerKeypair, params.airdropProjectKeypair]
    };

    return await buildActionResult(buildParams);
  }


  /**
   * @description 转移 mint-account 的 mint-authority
   * @param params 
   * @returns 
   */
  public async transferMintAuthorityAction(params: TransferMintAuthorityActionParams): Promise<ActionResult> {

    const accounts = {
      payer: params.payer,
      ddaAirdropProject: params.airdropProjectPubkey,
      mint: params.mintAccountPubkey,
      newMintAuthority: params.newMintAuthority,
      airdropAdmin: params.airdropAdminPubkey,
    };

    // 构造指令
    const ix = await this.program.methods
      .transferDdaMintAuthority()
      .accounts(accounts).instruction();

    const buildParams: BuildActionResultParams = {
      buildType: params.buildType,
      cuPrice: params.cuPrice,
      cuFactor: params.cuFactor,

      connection: this.connection,
      ixs: [ix],
      payer: params.payer,
      signers: [params.payerKeypair, params.airdropAdminKeypair]
    };

    return await buildActionResult(buildParams);
  }


  /**
   * @description 更新空投项目信息
   * @param params 
   * @returns 
   */
  public async updateDdaAirdropProjectAction(params: UpdateDdaAirdropProjectActionParams): Promise<ActionResult> {
    const updateDdaAirdropProjectParams: ProgramUpdateDdaAirdropProjectParams = {
      newAirdropAdmin: params.newAirdropProjectAdminPubkey
    };

    const accounts = {
      payer: params.payer,
      ddaAirdropProject: params.airdropProjectPubkey,
      ddaAirdropAdmin: params.originAirdroptAdminPubkey,
    };

    // 构造指令
    const ix = await this.program.methods
      .updateDdaAirdropProject(updateDdaAirdropProjectParams)
      .accounts(accounts).instruction();

    const buildParams: BuildActionResultParams = {
      buildType: params.buildType,
      cuPrice: params.cuPrice,
      cuFactor: params.cuFactor,

      connection: this.connection,
      ixs: [ix],
      payer: params.payer,
      signers: [params.payerKeypair, params.originAirdropProjectAdminKeypair]
    };

    return await buildActionResult(buildParams);
  }


  /**
   * @description 空投 FT
   * 在空投前，必须要将 mint-account 的 authority 设置为合约的PDA地址，才能进行空投
   * @param params 
   * @returns 
   */
  public async doDirectAirdropFtAction(params: AirdropFtActionParams): Promise<ActionResult> {
    // todo 检查是否超过最多能空投的个数

    // 检查 mint-account 的 authority 是否设置为合约的PDA地址
    const mintAuthority = this.findAirdropMintAuthorityAddress({
      airdropProjectPubkey: params.airdropProjectPubkey,
      mintAccountPubkey: params.mintAccountPubkey
    });

    const mintAccountInfo = await Token.getMint(this.connection, params.mintAccountPubkey);
    if (mintAccountInfo.mintAuthority.equals(mintAuthority) === false) {
      throw new Error("mint-account 的 authority 没有设置为合约的PDA地址");
    }

    const ddaAirdropFtParams: ProgramDdaAirdropFtParams = {
      amounts: params.receivers.map((receiver) => receiver.amount),
    };


    const accounts = {
      payer: params.payer,
      ddaAirdropProject: params.airdropProjectPubkey,
      ddaAirdropAdmin: params.airdropAdminPubkey,
      mint: params.mintAccountPubkey,
    };

    const remainingAccounts: AccountMeta[] = [];
    for (const receiver of params.receivers) {
      remainingAccounts.push({
        pubkey: receiver.receiver,
        isWritable: false,
        isSigner: false,
      });

      const ata = await Token.getAssociatedTokenAddressSync(params.mintAccountPubkey, receiver.receiver);
      remainingAccounts.push({
        pubkey: ata,
        isWritable: true,
        isSigner: false,
      });
    }

    // 构造指令
    const ix = await this.program.methods
      .ddaAirdropFt(ddaAirdropFtParams)
      .accounts(accounts)
      .remainingAccounts(remainingAccounts).instruction();

    const buildParams: BuildActionResultParams = {
      buildType: params.buildType,
      cuPrice: params.cuPrice,
      cuFactor: params.cuFactor,

      connection: this.connection,
      ixs: [ix],
      payer: params.payer,
      signers: [params.payerKeypair, params.airdropAdminKeypair],
      tryToSetMaxCu: true
    };

    // 如果使用了 addressLookupTable, 则需要将其加入到 buildParams 中
    if (params.addressLookupTablePubkeyArray) {
      buildParams.addressLookupTables = [];
      for (const alt of params.addressLookupTablePubkeyArray) {
        const table = (await this.connection.getAddressLookupTable(alt)).value;
        buildParams.addressLookupTables.push(table);
      }
    }

    return await buildActionResult(buildParams);
  }


  /**
   * @description 创建 airdrop 的lookup table
   * 将除被空投地址外的所有相关地址都存放在 lookup table 中， 以减少交易的大小
   * 本函数会一次性将包括mint地址在内的所有相关地址都存放在lookup table中
   * 
   * 如如果后面用其他mint账户进行空投时，可以复用该look-up table，也可以创建新的lookup table
   * @param params 
   */
  public async buildAirdropFtLookupTableAction(params: BuildAirdropFtLookupTableActionParams): Promise<{
    actionResult: ActionResult,
    addressLookupTablePubkey: PublicKey
  }> {
    // 所有待加入地址的lookup table
    const addressSet = new Set<PublicKey>();

    // 所有相关的 program 地址
    addressSet.add(ComputeBudgetProgram.programId);
    addressSet.add(SystemProgram.programId);
    addressSet.add(Token.TOKEN_PROGRAM_ID);
    addressSet.add(Token.ASSOCIATED_TOKEN_PROGRAM_ID);

    // 按合约中出现的顺序添加
    if (params.airdropPayerPubkey) {
      addressSet.add(params.airdropPayerPubkey);
    }
    addressSet.add(this.findSingletonManageProjectAddress());
    addressSet.add(this.findSingletonFeeReceiverAddress());

    addressSet.add(params.airdropProjectPubkey);
    const airdropProjectAccount = await this.getAirdropProjectAccount(params.airdropProjectPubkey);
    addressSet.add(airdropProjectAccount.ddaAirdropAdmin);

    addressSet.add(params.mintAccountPubkey);
    addressSet.add(this.findAirdropMintAuthorityAddress({
      airdropProjectPubkey: params.airdropProjectPubkey,
      mintAccountPubkey: params.mintAccountPubkey
    }));

    // 这里必须要用 'finalized'， 确保是有区块的slot
    // 参考： https://solana.stackexchange.com/questions/8642/creating-address-lookup-table-in-localnet-fails-with-invalid-instruction-data
    const recentSlot = await this.connection.getSlot('finalized');
    const [ix1, altAccountPubkey] = AddressLookupTableProgram.createLookupTable({
      payer: params.payer,
      authority: params.altAuthorityPubkey,
      recentSlot: recentSlot
    });

    const ix2 = AddressLookupTableProgram.extendLookupTable({
      lookupTable: altAccountPubkey,
      authority: params.altAuthorityPubkey,
      payer: params.payer,
      addresses: Array.from(addressSet)
    });

    const buildParams: BuildActionResultParams = {
      buildType: params.buildType,
      cuPrice: params.cuPrice,
      cuFactor: params.cuFactor,

      connection: this.connection,
      ixs: [ix1, ix2],
      payer: params.payer,
      signers: [params.payerKeypair, params.altAuthorityKeypair]
    };

    const actionResult = await buildActionResult(buildParams);

    return {
      actionResult,
      addressLookupTablePubkey: altAccountPubkey
    };
  }
}






