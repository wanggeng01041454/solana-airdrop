#!/usr/bin/env bash

PWD=`cd $(dirname $0); pwd`

FILE_NAME=nonce_verify.json

echo "copy target/idl/$FILE_NAME to idls/$FILE_NAME"

cp $PWD/target/idl/nonce_verify.json $PWD/idls/nonce_verify.json


