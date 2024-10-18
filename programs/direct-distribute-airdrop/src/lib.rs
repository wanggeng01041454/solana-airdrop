use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod instructions;

use instructions::*;

declare_id!("GaHqnnZv2CeZYEA23V1zGuADSFhWnJZSmFzLeje1H2T1");

#[program]
pub mod direct_distribute_airdrop {
    use super::*;

    ///================== singleton_manage_project ==================///
    /// 初始化-单例管理项目
    pub fn init_singleton_manage_project(
        ctx: Context<InitSingletonManageProjectAccounts>,
        params: InitSingletonManageProjectParams,
    ) -> Result<()> {
        instructions::init_singleton_manage_project(ctx, params)
    }

    /// 更新-单例管理项目
    pub fn update_manager_singleton_project(
        ctx: Context<UpdateSingletonManageProjectAccounts>,
        params: UpdateSingletonManageProjectParams,
    ) -> Result<()> {
        instructions::update_singleton_manage_project(ctx, params)
    }

    /// 领取费用
    pub fn claim_fee(ctx: Context<ClaimFeeAccounts>, params: ClaimFeeParams) -> Result<()> {
        instructions::claim_fee(ctx, params)
    }

    ///================== dda_airdrop_project ==================///

    /// 初始化（创建）-直接分发空投项目
    pub fn init_dda_airdrop_project(ctx: Context<InitDdaAirdropProjectAccounts>) -> Result<()> {
        instructions::init_dda_airdrop_project(ctx)
    }

    /// 更新 direct distribute airdrop project 的 admin
    pub fn update_dda_airdrop_project(
        ctx: Context<UpdateDdaAirdropProjectAccounts>,
        params: UpdateDdaAirdropProjectParams,
    ) -> Result<()> {
        instructions::update_dda_airdrop_project(ctx, params)
    }

    /// 转移 mint 权限
    pub fn transfer_dda_mint_authority(ctx: Context<TransferMintAuthAccounts>) -> Result<()> {
        instructions::transfer_dda_mint_authority(ctx)
    }

    /// 发起空投
    pub fn dda_airdrop_ft<'info>(
        ctx: Context<'_, '_, '_, 'info, DdaAirdropFtAccounts<'info>>,
        params: DdaAirdropFtParams,
    ) -> Result<()> {
        instructions::dda_airdrop_ft(ctx, params)
    }

    
}
