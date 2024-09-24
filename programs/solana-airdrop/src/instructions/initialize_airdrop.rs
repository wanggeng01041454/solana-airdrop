use anchor_lang::prelude::*;

use crate::constants::AIRDROP_PROJECT_SEED;

pub fn initialize_airdrop(
    ctx: Context<InitializeAirdropProjectAccounts>,
    params: InitializeAirdropProjectParams,
) -> Result<()> {
    msg!("initialize airdrop project");

    ctx.accounts.airdrop_project.set_inner(AirdropProject {
        airdrop_project_id: params.project_id.clone(),
        airdrop_project_admin: params.project_admin.clone(),
    });

    Ok(())
}

#[account]
pub struct AirdropProject {
    /// airdrop_project_id, 用于标识一个 airdrop 项目
    pub airdrop_project_id: Pubkey,

    // todo, 可以调整为 n选1, 或者 n选m
    /// airdrop的admin账户，所有的claim需要该账户签名
    pub airdrop_project_admin: Pubkey,
}

impl AirdropProject {
    const LEN: usize = 8 + 32 + 32;
}

#[derive(Accounts)]
#[instruction(params: InitializeAirdropProjectParams)]
pub struct InitializeAirdropProjectAccounts<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        payer = payer,
        seeds = [
            AIRDROP_PROJECT_SEED,
            params.project_id.key().as_ref()
        ],
        bump,
        space = AirdropProject::LEN
    )]
    pub airdrop_project: Account<'info, AirdropProject>,

    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Default, Debug, Clone)]
pub struct InitializeAirdropProjectParams {
    /// 用于标识一个 airdrop 项目
    pub project_id: Pubkey,

    /// airdrop的admin账户，所有的claim需要该账户签名
    pub project_admin: Pubkey,
}
