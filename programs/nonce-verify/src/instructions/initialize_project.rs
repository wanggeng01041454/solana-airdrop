use anchor_lang::prelude::*;

use crate::constants::PROJECT_SEED;

pub fn initialize_project(ctx: Context<InitializeProject>, params: InitializeProjectParams) -> Result<()> {
    
    ctx.accounts.project.set_inner(Project {
        admin: params.admin,
        business_fee: params.business_fee,
        user_fee: params.user_fee,
    });

    Ok(())
}

#[account]
pub struct Project {
    /// 管理员账户
    /// 如果存在，则每次注册新的业务时，需要管理员签名
    admin: Option<Pubkey>,

    /// 业务费用
    /// 每次注册新业务时需要支付的费用
    business_fee: u16,

    /// 每次使用时需要支付的费用
    user_fee: u16,
}

impl Project {
    const LEN: usize = 8 + (1+32) + 2 + 2;
}

#[derive(Accounts)]
pub struct InitializeProject<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    pub base: Signer<'info>,

    #[account(
      init, 
      payer = payer, 
      seeds = [PROJECT_SEED, base.key().as_ref()],
      bump,
      space = Project::LEN
    )]
    pub project: Account<'info, Project>,

    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Default, Debug, Clone)]
pub struct InitializeProjectParams {
    /// 管理员账户
    /// 如果存在，则每次注册新的业务时，需要管理员签名
    pub admin: Option<Pubkey>,

    /// 业务费用
    /// 每次注册新业务时需要支付的费用
    pub business_fee: u16,

    /// 每次使用时需要支付的费用
    pub user_fee: u16,
}
