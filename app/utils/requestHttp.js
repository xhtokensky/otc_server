"use strict";

const rp = require('request-promise');
const crypto = require('crypto');
const dateUtil = require('./dateUtil');

/**
 *
 * @param user_id                 用户ID
 * @param method_balance          更改balance的方法 ['add', 'sub', 'mul', 'quo']
 * @param balance                更改的balance
 * @param method_frozen_balance
 * @param frozen_balance
 * @param symbol                 货币类型
 * @param push_time               时间（时间戳 毫秒）
 * @param sign_id                 订单ID
 * @param mold                   模型 如：OTC
 * @param cont                   说明 如：OTC确认收款
 * @returns {Promise<*>}
 */
exports.postAssets = async function ({change, mold, cont}) {

    try {
        let mes = ['add', 'sub', 'mul', 'quo'];

        let uid = change.uid;
        let methodBalance = change.methodBalance;
        let balance = change.balance;
        let methodFrozenBalance = change.methodFrozenBalance;
        let frozenBalance = change.frozenBalance;
        let symbol = change.symbol;
        let signId = change.signId;

        let assetsUrl = this.app.config.assetsUrl;

        const options = {
            timeout: 5000,
            method: 'POST',
            json: true,
            url: assetsUrl,
            body: {
                source: 1,// 1app端 2admin端 3tick端
                change: {
                    uid: uid,
                    methodBalance: methodBalance || '',
                    balance: balance ? balance + '' : '',
                    methodFrozenBalance: methodFrozenBalance || '',
                    frozenBalance: frozenBalance ? frozenBalance + '' : '',
                    symbol: symbol,
                    signId: signId + ""
                },
                pushTime: dateUtil.currentTimestamp(),
                mold: mold,
                cont: cont
            },
            headers:
                {
                    'cache-control': 'no-cache',
                    Connection: 'keep-alive',
                    Accept: '*!/!*',
                    'Content-Type': 'application/json'
                }
        };
        if (!uid || !symbol || !signId || !mold || !cont) {
            this.ctx.logger.error(`body>> postAssets error: uid or symbol or sign_id or mold is empty`);
            return {
                success: false,
                msg: 'uid or symbol or sign_id or mold is empty '
            }
        }
        if (!mes.includes(methodBalance) && balance) {
            this.ctx.logger.error(`body>> postAssets error:method_balance is empty`);
            return {
                success: false,
                msg: 'method_balance is empty'
            }
        }
        if (!mes.includes(methodFrozenBalance) && frozenBalance) {
            this.ctx.logger.error(`body>> postAssets error:methodFrozenBalance is empty`);
            return {
                success: false,
                msg: 'methodFrozenBalance is empty'
            }
        }

        const hash = crypto.createHash('sha256');
        hash.update(JSON.stringify(options.body));
        let hashId = hash.digest('hex');

        options.body.hashId = hashId;
        this.ctx.logger.error('postAssets options:', JSON.stringify(options.body));
        let body = await rp(options);
        if (body.code == 0) {
            return {
                success: true,
                hashId: body.hashId
            }
        } else {
            this.ctx.logger.error(`body>> postAssets error:${body.msg}`);
            return {
                success: false,
                msg: body.msg
            }
        }
    } catch (e) {
        this.ctx.logger.error(`postAssets error:${e.message}`);
        return {
            success: false,
            msg: e.message
        }
    }
};


exports.postAssetsMulti = async function ({changes, mold, cont}) {

    try {
        let assetsUrlMulti = this.app.config.assetsUrlMulti;

        for (let i = 0; i < changes.length; i++) {
            if (changes[i].balance) {
                changes[i].balance = changes[i].balance + "";
            }
            if (changes[i].frozenBalance) {
                changes[i].frozenBalance = changes[i].frozenBalance + "";
            }
            if (changes[i].signId) {
                changes[i].signId = changes[i].signId + ""
            }

        }
        const options = {
            timeout: 5000,
            method: 'POST',
            json: true,
            url: assetsUrlMulti,
            body: {
                source: 1,// 1app端 2admin端 3tick端
                changes: changes,//数组
                pushTime: dateUtil.currentTimestamp(),
                mold: mold,
                cont: cont
            },
            headers:
                {
                    'cache-control': 'no-cache',
                    Connection: 'keep-alive',
                    Accept: '*!/!*',
                    'Content-Type': 'application/json'
                }
        };

        const hash = crypto.createHash('sha256');
        hash.update(JSON.stringify(options.body));
        let hashId = hash.digest('hex');

        options.body.hashId = hashId;
        this.ctx.logger.error('postAssets options:', JSON.stringify(options.body));
        let body = await rp(options);
        if (body.code == 0) {
            return {
                success: true,
                hashId: body.hashId
            }
        } else {
            this.ctx.logger.error(`body>> postAssets error:${body.msg}`);
            return {
                success: false,
                msg: body.msg
            }
        }
    } catch (e) {
        this.ctx.logger.error(`postAssetsMulti error:${e.message}`);
    }
};
