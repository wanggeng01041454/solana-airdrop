use anchor_lang::prelude::*;

// 注意！这里要用CpiContext 的transfer方法, 不能使用 anchor_lang::solana_program::system_program::transfer
use anchor_lang::system_program;

use crate::constants::*;
use crate::errors::NonceVerifyErrors;
use crate::instructions::initialize_nonce_project::NonceProject;

pub fn register_business_project(
    ctx: Context<RegisterBusinessProjectAccounts>,
    params: RegisterBusinessProjectParams,
) -> Result<()> {
    msg!("register business project");

    // 检查是否需要管理员签名, 并验证管理员签名
    if ctx.accounts.nonce_project.register_business_need_verify {
        if ctx.accounts.nonce_project_admin.is_none() {
            return err!(NonceVerifyErrors::RunOutOfAdminSignature);
        }
        let nonce_admin = ctx.accounts.nonce_project_admin.as_ref().unwrap();
        if nonce_admin.key() != ctx.accounts.nonce_project.nonce_project_admin {
            return err!(NonceVerifyErrors::RunOutOfAdminSignature);
        }
    }
    

    // 检查是否要收取业务注册费用，配置了则收取
    // 一个需要关注的BUG： 如果用EOA账户收款，如果该账户原本的lamports为0，（由于fee很少），受到fee后，账户的lamports不足以支付rent,会导致本交易失败
    let fee = ctx.accounts.nonce_project.business_fee;
    if fee > 0 {
        msg!("nonce project receive business fee: {}", fee);
        
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.register_fee_payer.to_account_info(),
                to: ctx.accounts.nonce_vault_account.to_account_info(),
            },
        );
        system_program::transfer(cpi_ctx, fee as u64)?;
    }

    // 创建 business-project 账户
    ctx.accounts.business_project.set_inner(BusinessProject {
        business_project_id: params.project_id,
        business_project_authority: params.business_project_authority,
        nonce_project: ctx.accounts.nonce_project.key(),
    });

    Ok(())
}


/// 业务工程的账户信息
#[account]
pub struct BusinessProject {
    /// 业务工程的唯一ID
    pub business_project_id: Pubkey,

    /// 授权账户
    /// 每次验证nonce需要该授权账户的签名
    pub business_project_authority: Pubkey,

    /// 关联的nonce-project
    pub nonce_project: Pubkey,
}

impl BusinessProject {
    const LEN: usize = 8 + 32 + 32 + 32;
}

#[derive(Accounts)]
#[instruction(params: RegisterBusinessProjectParams)]
pub struct RegisterBusinessProjectAccounts<'info> {
    /// 创建账户费用-支付账户
    #[account(mut)]
    pub payer: Signer<'info>,

    /// 注册费支付账户
    #[account(mut)]
    pub register_fee_payer: Signer<'info>,

    /// business-project账户
    #[account(
        init, 
        payer = payer, 
        seeds = [
            BUSINESS_PROJECT_SEED,
            nonce_project.key().as_ref(), 
            params.project_id.as_ref()
            ],
        bump,
        space = BusinessProject::LEN
    )]
    pub business_project: Account<'info, BusinessProject>,

    /// 如果nonce-project 的 admin 存在，则需要它的签名
    pub nonce_project_admin: Option<Signer<'info>>,

    /// nonce Project账户
    #[account(
        seeds = [
            NONCE_PROJECT_SEED, 
            nonce_project.project_id.key().as_ref()
            ],
        bump
    )]
    pub nonce_project: Box<Account<'info, NonceProject>>,

    /// 使用该账户收款
    #[account(
        mut,
        seeds = [
            NONCE_VAULT_ACCOUNT_SEED,
            nonce_project.project_id.key().as_ref()
        ],
        bump,
    )]
    pub nonce_vault_account: SystemAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Default, Debug, Clone)]
pub struct RegisterBusinessProjectParams {
    /// 业务工程的唯一ID
    pub project_id: Pubkey,

    /// 业务的权限管理账户
    /// fixme: 考虑到 business_authority 可以是pda, 也可以是普通账户, 所以只在验证nonce时检查，设置时则不检查
    pub business_project_authority: Pubkey,
}
