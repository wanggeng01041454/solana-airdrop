use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::constants::*;
use crate::errors::DirectDistributeAirdropErrors;

/// @description 初始化直接空投合约的manager singleton project
/// 只能初始化一次，全局只有一个 manager singleton project
pub fn init_singleton_manage_project(
    ctx: Context<InitSingletonManageProjectAccounts>,
    params: InitSingletonManageProjectParams,
) -> Result<()> {
    msg!("initialize singleton manage project");

    if ctx.accounts.singlton_manage_project.inintialized {
        return Err(DirectDistributeAirdropErrors::AlreadyInitialized.into());
    }

    ctx.accounts
        .singlton_manage_project
        .set_inner(SingletonManageProject {
            inintialized: true,
            manage_admin: ctx.accounts.manage_admin.key(),
            fee_receiver: ctx.accounts.fee_receiver.key(),
            user_fee: params.user_fee,
        });

    // 获取租金豁免金额
    let rent = Rent::get()?;
    let minimum_balance = rent.minimum_balance(0);

    let cpi_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        system_program::Transfer {
            from: ctx.accounts.payer.to_account_info(),
            to: ctx.accounts.fee_receiver.to_account_info(),
        },
    );
    system_program::transfer(cpi_ctx, minimum_balance)?;

    Ok(())
}

#[account]
pub struct SingletonManageProject {
    /// 标记是否初始化了
    pub inintialized: bool,

    /// 管理员账户
    /// 提取费用时，需要管理员账户签名
    pub manage_admin: Pubkey,

    /// 专门用来收钱的pda账户, 没有account-data
    pub fee_receiver: Pubkey,

    /// 每次使用合约进行空投时需要支付的费用, lamports
    pub user_fee: u32,
}

impl SingletonManageProject {
    const LEN: usize = 8 + 1 + 32 + 32 + 4;
}

#[derive(Accounts)]
pub struct InitSingletonManageProjectAccounts<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// 管理员账户
    pub manage_admin: Signer<'info>,

    #[account(
        init_if_needed,
        payer = payer,
        seeds = [
            DIRECT_DISTRIBUTE_AIRDROP_MANAGER_SEED
        ],
        bump,
        space = SingletonManageProject::LEN
    )]
    pub singlton_manage_project: Account<'info, SingletonManageProject>,

    #[account(
        mut,
        seeds = [
            DIRECT_DISTRIBUTE_AIRDROP_FEE_RECEIVER_SEED,
        ],
        bump
    )]
    pub fee_receiver: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Default, Debug, Clone)]
pub struct InitSingletonManageProjectParams {
    /// 每次使用时需要支付的费用
    pub user_fee: u32,
}
