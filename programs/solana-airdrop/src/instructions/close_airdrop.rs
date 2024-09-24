use anchor_lang::prelude::*;

use crate::instructions::AirdropProject;

pub fn close_airdrop(ctx: Context<CloseAirdropProjectAccounts>) -> Result<()> {
    msg!("close airdrop project");

    // 将账户余额转移到接收者账户
    let lamports = ctx.accounts.airdrop_project.to_account_info().lamports();

    **ctx
        .accounts
        .receiver
        .to_account_info()
        .lamports
        .borrow_mut() += lamports;

    **ctx
        .accounts
        .airdrop_project
        .to_account_info()
        .lamports
        .borrow_mut() = 0;

    // 将账户标记为已关闭
    ctx.accounts
        .airdrop_project
        .close(ctx.accounts.receiver.to_account_info())?;

    Ok(())
}

#[derive(Accounts)]
pub struct CloseAirdropProjectAccounts<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// 关闭时的资金接收方
    /// CHECK: 资金接收方不需要签名
    #[account(mut)]
    pub receiver: AccountInfo<'info>,

    // 需要 airdrop-project-admin 签名
    pub airdrop_project_admin: Signer<'info>,

    /// 被关闭的 airdrop 项目
    #[account(
        mut,
        has_one = airdrop_project_admin,
    )]
    pub airdrop_project: Box<Account<'info, AirdropProject>>,

    pub system_program: Program<'info, System>,
}
