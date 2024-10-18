use anchor_lang::prelude::*;


#[error_code]
pub enum DirectDistributeAirdropErrors {
    #[msg("direct distribute airdrop singleton manager project already initialized")]
    AlreadyInitialized,

    #[msg("airdrop receiver's count not match with parameters's amount count")]
    AirdropReceiverCountNotMatch,

    #[msg("airdrop receiver's token account not match receiver's ata token account")]
    ReceiverTokenAccountNotMatchReceiverAccount,
}