'use strict';
const Service = require('egg').Service;
const code = require("../utils/code");
const moment = require('moment');
const dateUtil = require('../utils/dateUtil');
const commonUtil = require('../utils/commonUtil');
const requestHttp = require('../utils/requestHttp');
const table = require('../../config/constant/table');
const dbName = table.TokenskyAvatarDB;

class HomeService extends Service {

    async verifyRealAuth(userId) {
        let object = await this.app.mysql.get(dbName).get(table.TOKENSKY_REAL_AUTH, {user_id: userId, status: 1});
        if (!object) {
            return {
                success: false,
                code: code.ERROR_REAL_AUTH_UN,
                type: 'ERROR_REAL_AUTH_UN',
                msg: this.ctx.I18nMsg(I18nConst.Verify)
            }
        }
        if (!object.name || !object.identity_card || !object.identity_card_picture || !object.identity_card_picture2 || !object.person_picture) {
            return {
                success: false,
                code: code.ERROR_REAL_AUTH_UN,
                type: 'ERROR_REAL_AUTH_UN',
                msg: this.ctx.I18nMsg(I18nConst.Verify)
            }
        }
        return {
            success: true
        }
    }

    async getUserPayWay(userId) {
        try {
            let arr = ['1', '2', '3'];
            let result = [];
            for (let i = 0; i < arr.length; i++) {
                let count = await this.app.mysql.get(dbName).count(table.TOKENSKY_ACCOUNT_BANK, {
                        user_id: userId,
                        type: arr[i]
                    }
                );
                if (count > 0) {
                    result.push(arr[i]);
                }
            }
            return result;
        } catch (e) {
            return [];
        }
    }

    async verifyPayWay(userId, types) {
        let count = await this.app.mysql.get(dbName).count(table.TOKENSKY_ACCOUNT_BANK, {user_id: userId});
        if (count == 0) {
            return {
                success: false,
                code: code.ERROR_PAYWAY_UNCENSORED,
                type: 'ERROR_PAYWAY_UNCENSORED',
                msg: '您还未设置收款方式,\n请先去设置'
            }
        }
        if (types && Array.isArray(types)) {
            for (let i = 0; i < types.length; i++) {
                let count = await this.app.mysql.get(dbName).count(table.TOKENSKY_ACCOUNT_BANK, {
                    user_id: userId,
                    type: types[i]
                });
                if (count == 0) {
                    if (types[i] == 1) {
                        return {
                            success: false,
                            code: code.ERROR_PAYWAY_UNCENSORED_BANK,
                            type: 'ERROR_PAYWAY_UNCENSORED_BANK',
                            msg: '未设置银行收款方式'
                        }
                    } else if (types[i] == 2) {
                        return {
                            success: false,
                            code: code.ERROR_PAYWAY_UNCENSORED_ALIPAY,
                            type: 'ERROR_PAYWAY_UNCENSORED_ALIPAY',
                            msg: '未设置支付宝收款方式'
                        }
                    } else if (types[i] == 3) {
                        return {
                            success: false,
                            code: code.ERROR_PAYWAY_UNCENSORED_WECHAT,
                            type: 'ERROR_PAYWAY_UNCENSORED_WECHAT',
                            msg: '未设置微信收款方式'
                        }
                    }

                }
            }
        }
        return {
            success: true
        }
    }


    async addOtcEntrustOrder(params) {
        let result = await this.app.mysql.get(dbName).insert(table.OTC_ENTRUST_ORDER, params);
        if (result.affectedRows == 1) {
            return true;
        }
        return false;
    }

    async getOtcEntrustOrderList(entrustType, coinType) {
        let sql = `SELECT a.key_id,a.user_id,a.vendee_service_charge,a.vendor_service_charge,a.coin_type,a.money_type,a.unit_price,a.quantity,a.quantity_left,a.pay_type,a.min,a.max,b.nick_name,b.head_img,b.is_login FROM ${table.OTC_ENTRUST_ORDER} a,${table.TOKENSKY_USER} b WHERE a.user_id = b.user_id and a.entrust_type = ? and a.status = ? and b.user_status=? and a.quantity_left >? and a.quantity_left>=a.min `;
        if (coinType) {
            sql += ` and a.coin_type = '${coinType}' `;
        }
        if (entrustType == 1) {
            sql += ` ORDER BY a.unit_price DESC,a.push_time DESC `;
        } else {
            sql += ` ORDER BY a.unit_price ASC,a.push_time DESC `;
        }
        let result = await this.app.mysql.get(dbName).query(sql, [entrustType, 1, 1, 0]);
        return result;
    }

    async getMyEntrustList(userId, coinType, pageIndex, pageSize) {
        let sql = `SELECT a.key_id,a.coin_type,a.money_type,a.unit_price,a.quantity,a.quantity_left,a.pay_type,a.status,a.min,a.max,b.nick_name,b.head_img,b.is_login,a.push_time,a.entrust_type
                      FROM ${table.OTC_ENTRUST_ORDER} a,${table.TOKENSKY_USER} b
                      WHERE a.user_id = b.user_id and b.user_status=? AND a.user_id=? AND a.status = 1 `;
        if (coinType) {
            sql += ` AND a.coin_type='${coinType}' `;
        }
        sql += ` ORDER BY a.push_time DESC LIMIT ?,? `;

        let result = await this.app.mysql.get(dbName).query(sql, [1, userId, parseInt(pageIndex), parseInt(pageSize)]);
        return result;
    }

    async getMyEntrustCount(userId, coinType) {
        let sql = `SELECT count(*) count
                      FROM ${table.OTC_ENTRUST_ORDER} a,${table.TOKENSKY_USER} b
                      WHERE a.user_id = b.user_id and b.user_status=? AND a.user_id=? AND a.status = 1  `;
        if (coinType) {
            sql += ` AND a.coin_type='${coinType}' `;
        }

        let result = await this.app.mysql.get(dbName).query(sql, [1, userId]);
        return result[0].count ? result[0].count : 0;
    }

    async findOneOtcEntrustOrder(params) {
        let obj = await this.app.mysql.get(dbName).get(table.OTC_ENTRUST_ORDER, params);
        return obj;
    }


    async createOtcEntrustOrderBuyout(params) {
        const conn = await this.app.mysql.get(dbName).beginTransaction(); // 初始化事务
        try {
            let frozen_balance = params.frozen_balance;
            let service_charge_balance = params.service_charge_balance;
            let user_id = params.user_id;
            let coin_type = params.coin_type;
            delete params.frozen_balance;
            delete params.service_charge_balance;
            let addResult = await conn.insert(table.OTC_ENTRUST_ORDER, params);
            if (addResult.affectedRows != 1) {
                await conn.rollback();
                return false
            }
            let params2 = {
                user_id: params.user_id,
                relevance_id: addResult.insertId,
                type: 1,
                frozen_balance: frozen_balance,
                service_charge_balance: service_charge_balance
            };
            let addResult2 = await conn.insert(table.OTC_USER_FROZEN_BALANCE, params2);
            if (addResult2.affectedRows != 1) {
                await conn.rollback();
                return false
            }

            /*let sql = `update ${table.TOKENSKY_USER_BALANCE} ub set ub.frozen_balance = ub.frozen_balance+? where user_id=? and coin_type = ? `;

            let r = await conn.query(sql, [frozen_balance, user_id, coin_type]);
            if (r.affectedRows == 0) {
                await conn.rollback();
                return false;
            }*/

            /**
             * 二次验证
             */
            let userBalance = await this.ctx.service.user.findOneUserBalance({user_id: user_id, coin_type: coin_type});
            let usableCoin = commonUtil.bigNumberMinus(userBalance.balance, userBalance.frozen_balance, 8);
            if (usableCoin < frozen_balance) {
                await conn.rollback();
                return -1;
            }

            //修改用户资产
            let assetsParams = {
                change: {
                    uid: user_id,
                    methodFrozenBalance: 'add',
                    frozenBalance: frozen_balance,
                    symbol: coin_type,
                    signId: addResult.insertId
                },
                mold: 'OTC',
                cont: 'OTC新增委托单(卖单)'
            };
            let assetsResult = await requestHttp.postAssets.call(this, assetsParams);
            if (!assetsResult.success) {
                await conn.rollback();
                return false;
            }
            let hashId = assetsResult.hashId;

            let hashSql = `update ${table.TOKENSKY_USER_BALANCE_HASH} set model_status=? where hash_id=? `;
            let hashResult = await conn.query(hashSql, [1, hashId]);
            if (hashResult.affectedRows == 0) {
                this.ctx.logger.error(`tibi update hash fail:hashId==${hashId},userId=${user_id}`);
            }


            await conn.commit();
            return true;
        } catch (e) {
            await conn.rollback();
            throw e;
            this.ctx.logger.error(`createOtcEntrustOrderBuyout error : ${e.message}`);
            return false;
        }
    }

    async findOneOtcConf() {
        let conf = await await this.app.mysql.get(dbName).get(table.OTC_CONF);
        return conf;
    }

    /**
     * 是否可以取消订单
     * @param entrustOrderId
     * @returns {Promise<void>}
     */
    async isCancelEntrust(entrustOrderId) {
        let sql = `select order_id from ${table.OTC_ORDER} where status!=? and status !=? and entrust_order_id=? `;
        let result = await this.app.mysql.get(dbName).query(sql, [1, 4, entrustOrderId]);
        if (result && result.length > 0) {
            return false;
        }
        return true;
    }


    async isCancelEntrust2(entrustOrderId, orderId) {
        let sql = `select order_id from ${table.OTC_ORDER} where status!=? and status !=? and entrust_order_id=? and order_id !=? `;
        let result = await this.app.mysql.get(dbName).query(sql, [1, 4, entrustOrderId, orderId]);
        if (result && result.length > 0) {
            return false;
        }
        return true;
    }

    async findOneUserFrozenBalance(params) {
        let obj = await await this.app.mysql.get(dbName).get(table.OTC_USER_FROZEN_BALANCE, params);
        return obj;
    }

    /**
     * 取消委托单
     * 设置已冻结的金额
     * 更改委托单状态
     * @returns {Promise<void>}
     */
    async cancelEntrust(params) {
        const conn = await this.app.mysql.get(dbName).beginTransaction(); // 初始化事务
        try {
            let entrust_order_id = params.entrust_order_id;
            let cancel_time = params.cancel_time;
            let entrust_type = params.entrust_type;
            let curSumCoin = params.curSumCoin;
            let user_id = params.user_id;
            let coin_type = params.coin_type;
            if (entrust_type == 2) {
                let us = await conn.update(table.OTC_USER_FROZEN_BALANCE, {status: 0}, {
                    where: {
                        type: 1,
                        relevance_id: entrust_order_id
                    }
                });
                if (us.affectedRows == 0) {
                    await conn.rollback();
                    return false
                }
            }
            let us2 = await conn.update(table.OTC_ENTRUST_ORDER, {
                status: 0,
                cancel_time: cancel_time
            }, {where: {key_id: entrust_order_id}});
            if (us2.affectedRows == 0) {
                await conn.rollback();
                return false
            }
            //如果为卖单
            /*if (entrust_type == 2) {
                const userBalance = await this.ctx.service.user.findOneUserBalance({
                    user_id: user_id,
                    coin_type: coin_type
                });
                if (!userBalance) {
                    this.ctx.logger.error(`cancelEntrust error: no such userBalance`);
                    await conn.rollback();
                    return false;
                }
                if (userBalance.frozen_balance < 0) {
                    this.ctx.logger.error(`cancelEntrust error: 冻结金额数据异常; curSumCoin=${curSumCoin},frozen_balance=${userBalance.frozen_balance}`);
                    await conn.rollback();
                    return false;
                }
                if (userBalance.frozen_balance < curSumCoin) {
                    this.ctx.logger.error(`cancelEntrust error: curSumCoin=${curSumCoin},frozen_balance=${userBalance.frozen_balance}`);
                    curSumCoin = userBalance.frozen_balance;
                }
                let sql = `update ${table.TOKENSKY_USER_BALANCE} ub set ub.frozen_balance = ub.frozen_balance-? where user_id=? and coin_type = ? `;

                let r = await conn.query(sql, [curSumCoin, user_id, coin_type]);
                if (r.affectedRows == 0) {
                    await conn.rollback();
                    return false;
                }
            }*/

            /**
             * 二次验证
             */
            let entrustOrder = await this.ctx.service.home.findOneOtcEntrustOrder({key_id: entrust_order_id});
            if (entrustOrder.status != 1) {
                await conn.rollback();
                return -1;
            }

            if (entrust_type == 2) {
                const userBalance = await this.ctx.service.user.findOneUserBalance({
                    user_id: user_id,
                    coin_type: coin_type
                });
                if (!userBalance) {
                    this.ctx.logger.error(`cancelEntrust error: no such userBalance,user_id:${user_id}`);
                    await conn.rollback();
                    return false;
                }
                if (userBalance.frozen_balance < 0) {
                    this.ctx.logger.error(`cancelEntrust error: 冻结金额数据异常; curSumCoin=${curSumCoin},frozen_balance=${userBalance.frozen_balance},user_id:${user_id}`);
                    await conn.rollback();
                    return false;
                }
                if (userBalance.frozen_balance < curSumCoin) {
                    this.ctx.logger.error(`cancelEntrust error: curSumCoin=${curSumCoin},frozen_balance=${userBalance.frozen_balance},user_id=${user_id}`);
                    curSumCoin = userBalance.frozen_balance;
                }
                //修改用户资产
                let assetsParams = {
                    change: {
                        uid: user_id,
                        methodFrozenBalance: 'sub',
                        frozenBalance: curSumCoin,
                        symbol: coin_type,
                        signId: entrust_order_id
                    },
                    mold: 'OTC',
                    cont: 'OTC取消委托单(卖单)'
                };
                let assetsResult = await requestHttp.postAssets.call(this, assetsParams);
                if (!assetsResult.success) {
                    await conn.rollback();
                    return false;
                }
                let hashId = assetsResult.hashId;

                let hashSql = `update ${table.TOKENSKY_USER_BALANCE_HASH} set model_status=? where hash_id=? `;
                let hashResult = await conn.query(hashSql, [1, hashId]);
                if (hashResult.affectedRows == 0) {
                    this.ctx.logger.error(`tibi update hash fail:hashId==${hashId},userId=${user_id}`);
                }

            }

            await conn.commit();
            return true;
        } catch (e) {
            await conn.rollback();
            throw e;
            this.ctx.logger.error(`cancelEntrust service error : ${e.message}`);
            return false;
        }
    }


    async isOTC(userId, phone, cancel_number = 3) {
        try {

            if (phone) {
                let roleBlack = await this.ctx.service.user.findOneRoleBlack(2, phone);
                if (roleBlack && new Date(roleBlack.end_time).getTime() > new Date().getTime()) {
                    return {
                        success: false,
                        code: code.ERROR_OTC_BLACK,
                        type: "ERROR_OTC_BLACK",
                        msg: `账号已被禁止OTC交易,将于 ${dateUtil.format(roleBlack.end_time)} 解除`
                    }
                }
            } else {
                const userInfo = await this.ctx.service.user.getUserByUid(userId);
                let roleBlack = await this.ctx.service.user.findOneRoleBlack(2, userInfo.phone);
                if (roleBlack && new Date(roleBlack.end_time).getTime() > new Date().getTime()) {
                    return {
                        success: false,
                        code: code.ERROR_OTC_BLACK,
                        type: "ERROR_OTC_BLACK",
                        msg: `账号已被禁止OTC交易,将于 ${dateUtil.format(roleBlack.end_time)} 解除`
                    }
                }
            }

            let sql = `select count(*) count from ${table.OTC_ORDER} where order_type = 1 and date_format(buy_order_time,'%Y-%M-%D') = '${dateUtil.formatBirthday()}' and vendee_user_id = ${userId} `;

            let result = await this.app.mysql.get(dbName).query(sql);
            if (result[0]) {
                if (result[0].count > cancel_number) {
                    return {
                        success: false,
                        code: code.ERROR_OTC_BLACK,
                        type: "ERROR_OTC_BLACK",
                        msg: `账号已被禁止OTC交易,将于${moment(moment().add(1, 'day')).format('YYYY-MM-DD')} 00:00:00 解除`
                    }
                }
            } else {
                return {
                    success: true
                }
            }
            return {
                success: true
            }

        } catch (e) {
            return {
                success: false,
                code: code.ERROR_OTC_BLACK,
                type: 'ERROR_OTC_BLACK',
                msg: e.message
            }
        }
    }


    async getCoinList() {
        let sql = `select * from ${table.OTC_COIN_LIST} where status=?`;
        let result = await this.app.mysql.get(dbName).query(sql, [1]);
        return result;
    }

    async getEntrustOrderRateForUser(userId) {

        let sql = `select count(*) count from ${table.OTC_ORDER} where vendor_user_id=? or vendee_user_id = ? `;
        let result = await this.app.mysql.get(dbName).query(sql, [userId, userId]);

        let sumCount = result[0] ? result[0].count : 0;

        if (sumCount == 0) {
            return {
                sumCount: sumCount,
                rate: 0
            }
        }

        let sql2 = `select count(*) count from ${table.OTC_ORDER} where order_type=? and status =? and vendee_user_id = ? `;
        let result2 = await this.app.mysql.get(dbName).query(sql2, [1, 4, userId]);
        let vcount = result2[0] ? result2[0].count : 0;

        if (vcount == 0) {
            return {
                sumCount: sumCount,
                rate: 1
            }
        }

        let rate = (sumCount - vcount) / sumCount;
        rate = parseFloat(rate.toFixed(2));

        return {
            sumCount: sumCount,
            rate: rate
        }
    }

    async findOneOrderIds(orderId) {
        let obj = await await this.app.mysql.get(dbName).get(table.TOKENSKY_ORDER_IDS, {order_id: orderId});
        return obj;
    }


}


module.exports = HomeService;
