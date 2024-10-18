use anchor_lang::prelude::*;

use crate::constants::*;
use crate::instructions::SingletonManageProject;

/// 更新 SingletonManageProject 的 admin-authority 和 user-fee
pub fn update_singleton_manage_project(
    ctx: Context<UpdateSingletonManageProjectAccounts>,
    params: UpdateSingletonManageProjectParams,
) -> Result<()> {
    msg!("update singleton manage project manage_admin [and|or] user_fee");

    if let Some(new_manage_admin) = params.new_manage_admin {
        ctx.accounts.singlton_manage_project.manage_admin = new_manage_admin;
    }

    if let Some(new_user_fee) = params.new_user_fee {
        ctx.accounts.singlton_manage_project.user_fee = new_user_fee;
    }

    Ok(())
}

#[derive(Accounts)]
pub struct UpdateSingletonManageProjectAccounts<'info> {
    /// 交易 gas 费用支付者
    #[account(mut)]
    pub payer: Signer<'info>,

    /// 需要 manage_admin 签名
    pub manage_admin: Signer<'info>,

    /// singlton_manage_project 账户
    #[account(
        mut,
        has_one = manage_admin,
        seeds = [
            DIRECT_DISTRIBUTE_AIRDROP_MANAGER_SEED
        ],
        bump,
    )]
    pub singlton_manage_project: Box<Account<'info, SingletonManageProject>>,

    /// 系统程序
    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Default, Debug, Clone)]
pub struct UpdateSingletonManageProjectParams {
    // 新的 manage_admin
    pub new_manage_admin: Option<Pubkey>,

    // 新的 user_fee
    pub new_user_fee: Option<u32>,
}
