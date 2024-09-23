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

    pub fn initialize_airdrop(
        ctx: Context<InitializeAirdropProjectAccounts>,
        params: InitializeAirdropProjectParams,
    ) -> Result<()> {
        instructions::initialize_airdrop(ctx, params)
    }

    // claim 接口
    pub fn claim_ft(ctx: Context<ClaimFtAccounts>, params: ClaimFtParams) -> Result<()> {
        instructions::claim_ft(ctx, params)
    }

    // 权限设置接口

    // todo: mint-account 的 authority 需要设置为 airdrop 的 pda 地址，并可以转移走
}
