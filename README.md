

``` bash
# 构建 nonce-verify 程序
cd programs/nonce-verify
anchor build

cd ../..
# 将 target/idl/nonce_verify.json 拷贝到 idls 目录下
# cp target/idl/nonce_verify.json idls/
copy_idl.sh

# 再次构建
anchor build

# 构建测试辅助程序
cd rust_app/sign_checker
cargo build

# 执行测试
anchor test

```


