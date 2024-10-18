use anchor_lang::prelude::*;
use anchor_lang::system_program;

use anchor_spl::token;
use anchor_spl::{
    associated_token,
    associated_token::AssociatedToken,
    token::{Mint, Token},
};

use crate::constants::*;
use crate::errors::DirectDistributeAirdropErrors;
use crate::instructions::*;

/// 对用户FT空投
pub fn dda_airdrop_ft<'info>(
    ctx: Context<'_, '_, '_, 'info, DdaAirdropFtAccounts<'info>>,
    params: DdaAirdropFtParams,
) -> Result<()> {
    let receiver_count = params.amounts.len();
    msg!("airdrop to {} users", receiver_count);

    // 在 anchor 中使用可变个数的
    // remaining_accounts 中循环放置 receiver_count, receivert_token_account 两个账户
    let remain_accounts_count = ctx.remaining_accounts.len();
    if remain_accounts_count != receiver_count * 2 {
        return Err(DirectDistributeAirdropErrors::AirdropReceiverCountNotMatch.into());
    }

    // 首先支付费用
    // 检查是否要收取业务注册费用，配置了则收取, 每个空投用户收取一次空投费用
    let fee = ctx.accounts.singlton_manage_project.user_fee as u64;
    let fee = fee * receiver_count as u64;
    if fee > 0 {
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.payer.to_account_info(),
                to: ctx.accounts.fee_receiver.to_account_info(),
            },
        );
        system_program::transfer(cpi_ctx, fee as u64)?;
    }

    // 计算mint-authority
    let mint_authority_bump = ctx.bumps.mint_authority;
    let dda_airdrop_project_pubkey = ctx.accounts.dda_airdrop_project.key();
    let mint_pubkey = ctx.accounts.mint.key();
    let mint_authority_seeds = &[
        DIRECT_DISTRIBUTE_AIRDROP_MINT_AUTHORITY_SEED,
        dda_airdrop_project_pubkey.as_ref(),
        mint_pubkey.as_ref(),
        &[mint_authority_bump],
    ];

    let cpi_signer = &[&mint_authority_seeds[..]];

    // 遍历所有的 receiver 和 receiver-token-account, 校验后，为每个receiver空投
    let remaining_accounts_iter = &mut ctx.remaining_accounts.iter();
    for i in 0..receiver_count {
        // 取出账户
        let receiver = remaining_accounts_iter.next().unwrap();
        let receiver_token_account = remaining_accounts_iter.next().unwrap();

        // 校验 receiver_token_account 是否正确，
        let pda_token_pub_key = associated_token::get_associated_token_address_with_program_id(
            &receiver.key,
            &ctx.accounts.mint.key(),
            &ctx.accounts.token_program.key,
        );
        if pda_token_pub_key != receiver_token_account.key() {
            return Err(
                DirectDistributeAirdropErrors::ReceiverTokenAccountNotMatchReceiverAccount.into(),
            );
        }

        // receiver_token_account 如果不存在则创建， 由payer支付费用
        if **receiver_token_account.lamports.borrow() == 0 {
            let create_ctx = CpiContext::new(
                ctx.accounts.associated_token_program.to_account_info(),
                associated_token::Create {
                    payer: ctx.accounts.payer.to_account_info(),
                    associated_token: receiver_token_account.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    authority: receiver.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                },
            );
            associated_token::create(create_ctx)?;
        }

        // 为receiver-token-account进行空投
        let mint_to_accounts = token::MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: receiver_token_account.to_account_info(),
            authority: ctx.accounts.mint_authority.to_account_info(),
        };

        let mint_to_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            mint_to_accounts,
            cpi_signer,
        );

        // 空投
        token::mint_to(mint_to_ctx, params.amounts[i])?;
    }

    Ok(())
}

#[derive(Accounts)]
pub struct DdaAirdropFtAccounts<'info> {
    // 交易 gas 费用支付者
    #[account(mut)]
    pub payer: Signer<'info>,

    /// singlton_manage_project 账户
    #[account(
        has_one = fee_receiver,
        seeds = [
            DIRECT_DISTRIBUTE_AIRDROP_MANAGER_SEED
        ],
        bump,
    )]
    pub singlton_manage_project: Box<Account<'info, SingletonManageProject>>,

    /// 收款账户
    #[account(
        mut,
        seeds = [
            DIRECT_DISTRIBUTE_AIRDROP_FEE_RECEIVER_SEED,
        ],
        bump
    )]
    pub fee_receiver: SystemAccount<'info>,

    /// 需要 airdrop_admin 签名
    pub dda_airdrop_admin: Signer<'info>,

    /// 关联的 airdrop 项目账户
    #[account(
        has_one = dda_airdrop_admin,
    )]
    pub dda_airdrop_project: Box<Account<'info, DdaAirdropProject>>,

    /// mint 账户
    #[account(mut)]
    pub mint: Box<Account<'info, Mint>>,

    // mint 账户的权限管理账户, 为用户铸造时，需要该账户的签名
    ///CHECK: 该账户只是用来控制权限，并不实际存在
    #[account(
        seeds = [
            DIRECT_DISTRIBUTE_AIRDROP_MINT_AUTHORITY_SEED,
            dda_airdrop_project.key().as_ref(),
            mint.key().as_ref(),
        ],
        bump,
    )]
    pub mint_authority: AccountInfo<'info>,

    // 系统程序
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    // 接下来是 这2个账户重复出现，出现次数是 params.amounts.len() 次
    // 空投接收者
    // pub airdrop_receiver: AccountInfo<'info>,

    // 空投接收者 的 token 账户
    // #[account(
    //     init_if_needed,
    //     payer = payer,
    //     associated_token::mint = mint,
    //     associated_token::authority = airdrop_receiver,
    // )]
    // pub receiver_token_account: Box<Account<'info, TokenAccount>>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Default, Debug, Clone)]
pub struct DdaAirdropFtParams {
    // 给每个receiver空投的数量
    pub amounts: Vec<u64>,
}
