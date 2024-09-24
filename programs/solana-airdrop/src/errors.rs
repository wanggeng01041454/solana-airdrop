use anchor_lang::prelude::*;


#[error_code]
pub enum AirdropErrors {
    #[msg("Missing Ed25519 instruction before current instruction")]
    MissingEd25519Instruction,

    #[msg("Invalid Ed25519 instruction")]
    InvalidEd25519Instruction,

    #[msg("verify signature failed")]
    SigVerificationFailed,
}