use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod outer_program;

use instructions::*;

declare_id!("GMznVrvA9P4WfBzJPWq92BWmsBMQUo6pb8B7CMSvgX9n");

#[program]
pub mod solana_airdrop {
    use super::*;

    /// 初始化-airdrop-project
    pub fn initialize_airdrop(
        ctx: Context<InitializeAirdropProjectAccounts>,
        params: InitializeAirdropProjectParams,
    ) -> Result<()> {
        instructions::initialize_airdrop(ctx, params)
    }

    /// claim 接口
    pub fn claim_ft(ctx: Context<ClaimFtAccounts>, params: ClaimFtParams) -> Result<()> {
        instructions::claim_ft(ctx, params)
    }

    /// 转移 mint-account 的 mint-authority
    pub fn transfer_mint_authority(
        ctx: Context<TransferMintAuthAccounts>,
        params: TransferMintAuthParams,
    ) -> Result<()> {
        instructions::transfer_mint_authority(ctx, params)
    }

}
