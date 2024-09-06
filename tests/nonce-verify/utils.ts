import { 
  PublicKey 
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { NonceVerify } from "../../target/types/nonce_verify";

// 类型定义
export type InitializeProjectParams = anchor.IdlTypes<NonceVerify>["initializeProjectParams"];

export type ProjectAccount = anchor.IdlTypes<NonceVerify>["project"];


// 函数定义

const NONCE_VERIFY_PROJECT = Buffer.from("nonce_verify_project");

/**
 * @description 查找Project地址
 * @param base: project 所属的 base 账户
 * @param programId: programId
 * @returns 
 */
export function findProjectAddress(base: PublicKey, nonceVerifyProgramId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [NONCE_VERIFY_PROJECT, base.toBuffer()],
    nonceVerifyProgramId
  )[0];
}