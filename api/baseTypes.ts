import {
  TransactionInstruction,
  VersionedMessage,
  VersionedTransaction
} from "@solana/web3.js";


/**
 * @description 构造类型, 用于指示 provider 访问合约的函数的构造类型
 * 
 */
export enum BuildType {
  /**
   * @description 仅返回指令集合
   */
  InstructionArray,

  /**
   * @description 返回 VersionedMessage
   */
  VersionMsg,

  /**
   * @description 返回 VersionedTransaction
   */
  VersionTx,

  /**
   * @description 构造交易后发送，并对交易进行确认， 返回 TxSignature, 
   */
  SendAndConfirmTx,

  /**
   * @description 构造交易后发送，并等待交易最终完成， 返回 TxSignature, 
   */
  SendAndFinalizeTx,
}


export const DEFAULT_CU_FACTOR = 1.2;

/**
 * @description 基础参数类型
 */
export interface BaseActionParams {
  buildType: BuildType;
  // cu 价格, 为空时，则不附加cu限制
  cuPrice?: number,
  // cu 估算因子, 默认 1.2
  cuFactor?: number,
}


export type ActionResult = TransactionInstruction[] | VersionedMessage | VersionedTransaction | string;

