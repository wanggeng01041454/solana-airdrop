use anchor_lang::prelude::*;

use crate::instructions::DdaAirdropProject;

/// 更新 direct distribute airdrop project 的 admin
pub fn update_dda_airdrop_project(
    ctx: Context<UpdateDdaAirdropProjectAccounts>,
    params: UpdateDdaAirdropProjectParams,
) -> Result<()> {
    msg!("update direct distribute airdrop project admin");

    ctx.accounts.dda_airdrop_project.dda_airdrop_admin = params.new_airdrop_admin;

    Ok(())
}

#[derive(Accounts)]
pub struct UpdateDdaAirdropProjectAccounts<'info> {
    /// 交易 gas 费用支付者
    #[account(mut)]
    pub payer: Signer<'info>,

    /// 需要 dda_airdrop_admin 签名
    pub dda_airdrop_admin: Signer<'info>,

    /// dda_airdrop_project 账户
    #[account(
        mut,
        has_one = dda_airdrop_admin,
    )]
    pub dda_airdrop_project: Box<Account<'info, DdaAirdropProject>>,

    /// 系统程序
    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Default, Debug, Clone)]
pub struct UpdateDdaAirdropProjectParams {
    // 新的 admin
    pub new_airdrop_admin: Pubkey,
}
