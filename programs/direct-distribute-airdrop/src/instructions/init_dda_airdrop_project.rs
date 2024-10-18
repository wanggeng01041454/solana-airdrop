use anchor_lang::prelude::*;

/// 初始化 direct-distribute-airdrop 项目
pub fn init_dda_airdrop_project(ctx: Context<InitDdaAirdropProjectAccounts>) -> Result<()> {
    msg!("initialize direct-distribute-airdrop project");

    ctx.accounts
        .dda_airdrop_project
        .set_inner(DdaAirdropProject {
            dda_airdrop_admin: ctx.accounts.airdrop_admin.key(),
        });

    Ok(())
}

#[account]
pub struct DdaAirdropProject {
    /// 管理员账户
    /// 修改 airdrop 项目的参数时，需要管理员签名
    /// 执行空投时，需要管理员签名
    pub dda_airdrop_admin: Pubkey,
}

impl DdaAirdropProject {
    const LEN: usize = 8 + 32;
}

#[derive(Accounts)]
pub struct InitDdaAirdropProjectAccounts<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: 这个账户可以放这里，也可以放参数中
    pub airdrop_admin: AccountInfo<'info>,

    #[account(
        init,
        payer = payer,
        space = DdaAirdropProject::LEN
    )]
    pub dda_airdrop_project: Account<'info, DdaAirdropProject>,

    pub system_program: Program<'info, System>,
}

// #[derive(AnchorSerialize, AnchorDeserialize, Default, Debug, Clone)]
// pub struct InitDdaAirdropProjectParams {
//     pub airdrop_admin: Pubkey,

// }
