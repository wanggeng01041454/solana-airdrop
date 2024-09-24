use std::str::FromStr;

use anyhow::Result;
use anchor_lang::solana_program::pubkey::Pubkey;
use anchor_client::solana_sdk::signature::Signature;

/// README: 通过本应用，校验在链下比较 typescript 代码生成的待签名数据和签名是否和 rust 代码生成的一致
/// rust 代码生成的签名数据和签名和链上保持一致；
/// 采用简单的命令行模式

/// 生成签名数据的命令: <应用名> sign-data <nonce> <amount> <mint_address> <user_address> <airdrop_project_address> <nonce_business_project_address>
/// nonce, amount 是十进制的数字， mint_address, user_address, airdrop_project_address, nonce_business_project_address 是 base58 格式的地址
/// 输出： hex 格式的待签名数据
/// ------------------------
/// 校验签名的命令: <应用名> verify-sign <sign_data> <signature> <pk>
/// sign_data 是 hex 格式的待签名数据， signature 是 hex 格式的签名， pk 是 base58 格式的地址
/// 输出： pass 或者 failed
fn main() -> Result<()> {
    // 获取命令行参数
    let args: Vec<String> = std::env::args().collect();

    let mut index = 1;
    let cmd = args.get(index).expect("missing command");
    index += 1;

    if cmd.eq_ignore_ascii_case("sign-data") {
        let nonce = args.get(index).expect("missing nonce");
        index += 1;

        let amount = args.get(index).expect("missing amount");
        index += 1;

        let mint_address = args.get(index).expect("missing mint address");
        index += 1;

        let user_address = args.get(index).expect("missing user address");
        index += 1;

        let airdrop_project_address = args.get(index).expect("missing airdrop project address");
        index += 1;

        let nonce_business_project_address = args.get(index).expect("missing nonce business project address");

        sign_data(nonce, amount, mint_address, user_address, airdrop_project_address, nonce_business_project_address)?;
    } else if cmd.eq_ignore_ascii_case("verify-sign"){
        let sign_data = args.get(index).expect("missing sign data");
        index += 1;

        let signature = args.get(index).expect("missing signature");
        index += 1;

        let pk = args.get(index).expect("missing pk");

        verify_sign(sign_data, signature, pk)?;
    } else {
        println!("invalid command");
    }

    Ok(())
}

fn sign_data(
    nonce: &str,
    amount: &str,
    mint_address: &str,
    user_address: &str,
    airdrop_project_address: &str,
    nonce_business_project_address: &str,
) -> Result<()> {
    let mut data = vec![];

    let nonce: u32 = nonce.parse().expect("invalid nonce value");
    data.extend_from_slice(&nonce.to_le_bytes());

    let amount: u64 = amount.parse().expect("invalid amount");
    data.extend_from_slice(&amount.to_le_bytes());

    let mint_account = Pubkey::from_str(mint_address).expect("invalid mint address");
    data.extend_from_slice(&mint_account.to_bytes());

    let user_account = Pubkey::from_str(user_address).expect("invalid user address");
    data.extend_from_slice(&user_account.to_bytes());

    let airdrop_project_account = Pubkey::from_str(airdrop_project_address).expect("invalid airdrop project address");
    data.extend_from_slice(&airdrop_project_account.to_bytes());

    let nonce_business_project_account = Pubkey::from_str(nonce_business_project_address).expect("invalid nonce business project address");
    data.extend_from_slice(&nonce_business_project_account.to_bytes());

    let data_hex = hex::encode(data);
    print!("{}", data_hex);

    Ok(())
}


fn verify_sign(
    sign_data: &str,
    signature: &str,
    pk: &str,
) -> Result<()> {
    
    let pk = Pubkey::from_str(pk).expect("invalid pk");
    let signature = Signature::try_from(hex::decode(signature).expect("decode signature failed")).expect("invalid signature");

    let sign_data = hex::decode(sign_data).expect("decode sign data failed");

    if signature.verify(pk.as_ref(), sign_data.as_slice()) {
        print!("pass");
    } else {
        print!("failed");
    }

    Ok(())
}