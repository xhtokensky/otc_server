'use strict';
const Service = require('egg').Service;
const moment = require('moment');
const code = require("../utils/code");
const dateUtil = require("../utils/dateUtil");
const commonUtil = require("../utils/commonUtil");
const requestHttp = require("../utils/requestHttp");
const jiguangUtil = require("../utils/jiguang");
const BigNumber = require('bignumber.js');
const table = require('../../config/constant/table');
const jpushConst = require('../../config/constant/jpush');
const dbName = table.TokenskyAvatarDB;

class OrderService extends Service {


    async addOtcOrder(params) {


        const conn = await this.app.mysql.get(dbName).beginTransaction(); // 初始化事务
        try {

            let order_type = params.order_type;
            let vendor_user_id = params.vendor_user_id;
            let coin_type = params.coin_type;
            let quantity = params.quantity;
            let order_id = params.order_id;
            let service_charge_balance = params.service_charge_balance;
            let frozen_balance = params.frozen_balance;
            delete params.coin_type;
            delete params.service_charge_balance;
            delete params.frozen_balance;
            let result = await conn.insert(table.OTC_ORDER, params);
            if (result.affectedRows == 0) {
                await conn.rollback();
                return false;
            }
            let _oid = await conn.get(table.TOKENSKY_ORDER_IDS, {order_id: order_id});
            if (_oid) {
                this.ctx.logger.error(`addOtcOrder error:order_id已存在;order_id=${order_id},_oid:`, _oid);
                await conn.rollback();
                return false;
            }
            let orderidsResult = await conn.insert(table.TOKENSKY_ORDER_IDS, {order_id: order_id});
            if (orderidsResult.affectedRows == 0) {
                await conn.rollback();
                return false;
            }
            let entrust_order_id = params.entrust_order_id;
            let obj = await await conn.get(table.OTC_ENTRUST_ORDER, {key_id: entrust_order_id});
            if (!obj) {
                await conn.rollback();
                return false;
            }
            if ((obj.quantity_left) < obj.min || (obj.quantity_left) <= 0) {
                await conn.rollback();
                return false;
            }

            //更改otc_entrust_order 中的quantity_left
            let sql_entrust = `update ${table.OTC_ENTRUST_ORDER} set quantity_left = quantity_left-? where key_id = ? and quantity_left >= ? `;
            let r_entrust = await conn.query(sql_entrust, [quantity, entrust_order_id, quantity]);
            if (r_entrust.affectedRows == 0) {
                await conn.rollback();
                return -1;
            }


            //卖出  冻结卖方资产值
            /*if (order_type == 2) {
                let sql = `update ${table.TOKENSKY_USER_BALANCE} ub set ub.frozen_balance = ub.frozen_balance+? where user_id=? and coin_type = ? `;
                let r = await conn.query(sql, [quantity, vendor_user_id, coin_type]);
                if (r.affectedRows == 0) {
                    await conn.rollback();
                    return false;
                }

                let params2 = {
                    user_id: vendor_user_id,
                    relevance_id: order_id,
                    type: 2,
                    frozen_balance: frozen_balance,
                    service_charge_balance: service_charge_balance
                };
                let addResult2 = await conn.insert(table.OTC_USER_FROZEN_BALANCE, params2);
                if (addResult2.affectedRows != 1) {
                    await conn.rollback();
                    return false
                }
            }


            if (order_type == 2) {
                let userBalance = await this.ctx.service.user.findOneUserBalance({
                    user_id: vendor_user_id,
                    coin_type: coin_type
                });
                //账户余额
                let usableCoin = commonUtil.bigNumberMinus(userBalance.balance, userBalance.frozen_balance, this.app.config.decimalPoint.v6);
                if (usableCoin < frozen_balance) {
                    await conn.rollback();
                    return -1;
                }
            }*/

            /**
             * 创建聊天室
             * @type {{order_id: *}}
             */
            let chatRoomParams = {
                order_id: order_id
            };
            if (order_type == 1) {
                chatRoomParams.user_id = params.vendor_user_id;
                chatRoomParams.user_id2 = params.vendee_user_id;
            } else {
                chatRoomParams.user_id = params.vendee_user_id;
                chatRoomParams.user_id2 = params.vendor_user_id;
            }

            let chatRoomResult = await conn.insert(table.TOKENSKY_OTC_CHAT_ROOM, chatRoomParams);
            if (chatRoomResult.affectedRows == 0) {
                await conn.rollback();
                return false;
            }


            //修改用户资产
            if (order_type == 2) {

                let params2 = {
                    user_id: vendor_user_id,
                    relevance_id: order_id,
                    type: 2,
                    frozen_balance: frozen_balance,
                    service_charge_balance: service_charge_balance
                };
                let addResult2 = await conn.insert(table.OTC_USER_FROZEN_BALANCE, params2);
                if (addResult2.affectedRows != 1) {
                    await conn.rollback();
                    return false
                }

                //卖出  冻结卖方资产值
                let assetsParams = {
                    change: {
                        uid: vendor_user_id,
                        methodFrozenBalance: 'add',
                        frozenBalance: quantity,
                        symbol: coin_type,
                        signId: order_id
                    },
                    mold: 'OTC',
                    cont: 'OTC下单'
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
                    this.ctx.logger.error(`tibi update hash fail:hashId==${hashId},userId=${vendor_user_id}`);
                }
            }


            await conn.commit();
            return true;
        } catch (e) {
            await conn.rollback();
            throw e;
            this.ctx.logger.error(`addOtcOrder service error : ${e.message}`);
            return false;
        }
    }

    async getOtcOrderList(userId, action, coinType, pageIndex, pageSize) {
        if (action === 'undergoing') {
            let sql = `SELECT eo.coin_type,eo.money_type,o.buy_order_time,o.status,o.unit_price,o.quantity,o.total_amount,o.vendor_user_id,o.vendee_user_id,o.order_id
                      FROM ${table.OTC_ORDER} o,${table.OTC_ENTRUST_ORDER} eo
                      WHERE o.entrust_order_id = eo.key_id and eo.coin_type=? and (o.vendor_user_id = ? or o.vendee_user_id = ? ) and (o.status = 0 or o.status = 2 or o.status=3 ) order by o.buy_order_time DESC LIMIT ?,? `;
            let result = await this.app.mysql.get(dbName).query(sql, [coinType, userId, userId, parseInt(pageIndex), parseInt(pageSize)]);
            return result;
        } else if (action === 'finish') {
            let sql = `SELECT eo.coin_type,eo.money_type,o.buy_order_time,o.status,o.unit_price,o.quantity,o.total_amount,o.vendor_user_id,o.vendee_user_id,o.order_id
                      FROM ${table.OTC_ORDER} o,${table.OTC_ENTRUST_ORDER} eo
                      WHERE o.entrust_order_id = eo.key_id and eo.coin_type=? and (o.vendor_user_id = ? or o.vendee_user_id = ? ) and o.status = 1 order by o.buy_order_time DESC LIMIT ?,? `;
            let result = await this.app.mysql.get(dbName).query(sql, [coinType, userId, userId, parseInt(pageIndex), parseInt(pageSize)]);
            return result;
        } else if (action === 'cancel') {
            let sql = `SELECT eo.coin_type,eo.money_type,o.buy_order_time,o.status,o.unit_price,o.quantity,o.total_amount,o.vendor_user_id,o.vendee_user_id,o.order_id
                      FROM ${table.OTC_ORDER} o,${table.OTC_ENTRUST_ORDER} eo
                      WHERE o.entrust_order_id = eo.key_id and eo.coin_type=? and (o.vendor_user_id = ? or o.vendee_user_id = ? ) and o.status = 4 order by o.buy_order_time DESC LIMIT ?,? `;
            let result = await this.app.mysql.get(dbName).query(sql, [coinType, userId, userId, parseInt(pageIndex), parseInt(pageSize)]);
            return result;
        } else {
            return [];
        }
    }

    async getOtcOrderCount(userId, action, coinType) {
        if (action === 'undergoing') {
            let sql = `SELECT count(*) count
                      FROM ${table.OTC_ORDER} o,${table.OTC_ENTRUST_ORDER} eo
                      WHERE o.entrust_order_id = eo.key_id and eo.coin_type=? and (o.vendor_user_id = ? or o.vendee_user_id = ? ) and (o.status = 0 or o.status = 2 or o.status=3 ) `;
            let result = await this.app.mysql.get(dbName).query(sql, [coinType, userId, userId]);
            return result[0].count ? result[0].count : 0;
        } else if (action === 'finish') {
            let sql = `SELECT count(*) count
                      FROM ${table.OTC_ORDER} o,${table.OTC_ENTRUST_ORDER} eo
                      WHERE o.entrust_order_id = eo.key_id and eo.coin_type=? and (o.vendor_user_id = ? or o.vendee_user_id = ? ) and o.status = 1 `;
            let result = await this.app.mysql.get(dbName).query(sql, [coinType, userId, userId]);
            return result[0].count ? result[0].count : 0;
        } else if (action === 'cancel') {
            let sql = `SELECT count(*) count
                      FROM ${table.OTC_ORDER} o,${table.OTC_ENTRUST_ORDER} eo
                      WHERE o.entrust_order_id = eo.key_id and eo.coin_type=? and (o.vendor_user_id = ? or o.vendee_user_id = ? ) and o.status = 4  `;
            let result = await this.app.mysql.get(dbName).query(sql, [coinType, userId, userId]);
            return result[0].count ? result[0].count : 0;
        } else {
            return 0;
        }
    }


    async findOneOtcOrder(params) {
        let obj = await await this.app.mysql.get(dbName).get(table.OTC_ORDER, params);
        return obj;
    }

    async updateOtcOrder(updateObj, whereObj) {
        let updateStatus = await this.app.mysql.get(dbName).update(table.OTC_ORDER, updateObj, {where: whereObj});
        if (updateStatus.affectedRows > 0) {
            return true;
        }
        return false;
    }

    async cancelOrder(params) {
        const conn = await this.app.mysql.get(dbName).beginTransaction(); // 初始化事务
        try {
            let status = params.status;
            let cancel_order_time = params.cancel_order_time;
            let order_id = params.order_id;
            let order_type = params.order_type;
            let vendor_user_id = params.vendor_user_id;
            let total_amount = params.total_amount;
            let entrust_order_id = params.entrust_order_id;
            let quantity = params.quantity;
            let coin_type = params.coin_type;
            let frozen_balance = params.frozen_balance;
            /* if (order_type == 2) {
                 let us = await conn.update(table.OTC_USER_FROZEN_BALANCE, {status: 0}, {
                     where: {
                         type: 2,
                         relevance_id: order_id
                     }
                 });
                 if (us.affectedRows == 0) {
                     await conn.rollback();
                     return false
                 }
                 const userBalance = await this.ctx.service.user.findOneUserBalance({
                     user_id: vendor_user_id,
                     coin_type: coin_type
                 });
                 if (!userBalance) {
                     this.ctx.logger.error(`cancelOrder error: no such userBalance`);
                     await conn.rollback();
                     return false;
                 }
                 if (userBalance.frozen_balance < 0) {
                     this.ctx.logger.error(`cancelOrder error: 冻结金额数据异常; frozen_balance=${frozen_balance},frozen_balance=${userBalance.frozen_balance},user_id=${vendor_user_id}`);
                     await conn.rollback();
                     return false;
                 }
                 if (userBalance.frozen_balance < frozen_balance) {
                     this.ctx.logger.error(`cancelOrder error: 冻结金额数据异常; frozen_balance=${frozen_balance},frozen_balance=${userBalance.frozen_balance},user_id=${vendor_user_id}`);
                     frozen_balance = userBalance.frozen_balance;
                 }
                 let sql = `update ${table.TOKENSKY_USER_BALANCE} ub set ub.frozen_balance = ub.frozen_balance-? where user_id=? and coin_type = ? `;
                 let r = await conn.query(sql, [frozen_balance, vendor_user_id, coin_type]);
                 if (r.affectedRows == 0) {
                     await conn.rollback();
                     return false;
                 }
             }*/
            let updateStatus = await conn.update(table.OTC_ORDER, {
                status: status,
                cancel_order_time: cancel_order_time
            }, {where: {order_id: order_id}});
            if (updateStatus.affectedRows == 0) {
                await conn.rollback();
                return false
            }
            //更改otc_entrust_order 中的quantity_left
            let sql_entrust = `update ${table.OTC_ENTRUST_ORDER} set quantity_left = quantity_left+? where key_id = ? `;
            let r_entrust = await conn.query(sql_entrust, [quantity, entrust_order_id]);
            if (r_entrust.affectedRows == 0) {
                await conn.rollback();
                return false;
            }

            /**
             * 二次验证
             */
            let order = await this.ctx.service.order.findOneOtcOrder({order_id: order_id});
            if (order.status == 1 || order.status == 4) {
                await conn.rollback();
                return -1;
            }

            if (order_type == 2) {
                let us = await conn.update(table.OTC_USER_FROZEN_BALANCE, {status: 0}, {
                    where: {
                        type: 2,
                        relevance_id: order_id
                    }
                });
                if (us.affectedRows == 0) {
                    await conn.rollback();
                    return false
                }
                const userBalance = await this.ctx.service.user.findOneUserBalance({
                    user_id: vendor_user_id,
                    coin_type: coin_type
                });
                if (!userBalance) {
                    this.ctx.logger.error(`cancelOrder error: no such userBalance`);
                    await conn.rollback();
                    return false;
                }
                if (userBalance.frozen_balance < 0) {
                    this.ctx.logger.error(`cancelOrder error: 冻结金额数据异常; frozen_balance=${frozen_balance},frozen_balance=${userBalance.frozen_balance},user_id=${vendor_user_id}`);
                    await conn.rollback();
                    return false;
                }
                if (userBalance.frozen_balance < frozen_balance) {
                    this.ctx.logger.error(`cancelOrder error: 冻结金额数据异常; frozen_balance=${frozen_balance},frozen_balance=${userBalance.frozen_balance},user_id=${vendor_user_id}`);
                    frozen_balance = userBalance.frozen_balance;
                }
                //修改用户资产
                let assetsParams = {
                    change: {
                        uid: vendor_user_id,
                        methodFrozenBalance: 'sub',
                        frozenBalance: frozen_balance,
                        symbol: coin_type,
                        signId: order_id
                    },
                    mold: 'OTC',
                    cont: 'OTC取消订单'
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
                    this.ctx.logger.error(`tibi update hash fail:hashId==${hashId},userId=${vendor_user_id}`);
                }
            }


            await conn.commit();
            return true;

        } catch (e) {
            await conn.rollback();
            throw e;
            this.ctx.logger.error(`cancelOrder service error : ${e.message}`);
            return false;
        }
    }

    async affirmProceeds(params) {
        const conn = await this.app.mysql.get(dbName).beginTransaction(); // 初始化事务
        try {
            let vendee_user_id = params.vendee_user_id;//买
            let vendor_user_id = params.vendor_user_id;//卖
            let vendor_service_charge_coin = params.vendor_service_charge_coin;
            let vendee_service_charge_coin = params.vendee_service_charge_coin;
            let vendor_total_amount = params.vendor_total_amount;
            let vendee_total_amount = params.vendee_total_amount;
            let send_coin_time = params.send_coin_time;
            let coin_type = params.coin_type;
            let order_id = params.order_id;
            let entrust_order_id = params.entrust_order_id;
            let entrust_type = params.entrust_type;
            let order_type = params.order_type;
            let quantity = params.quantity;
            let _quantity_left = params._quantity_left;
            let _min = params._min;
            let _user_id = params._user_id;
            let __vendor_service_charge = params._vendor_service_charge;
            //如果是卖单

            if (!coin_type) {
                this.ctx.logger.error(`affirmProceeds coin_type不存在：params:`, JSON.stringify(params));
                await conn.rollback();
                return false;
            }
            //扣除卖家币
            /* let sql = `update ${table.TOKENSKY_USER_BALANCE} set frozen_balance = frozen_balance-? where user_id=? and coin_type = ? `;
             let r = await conn.query(sql, [vendor_total_amount, vendor_user_id, coin_type]);
             if (r.affectedRows == 0) {
                 await conn.rollback();
                 return false;
             }
             let sql2 = `update ${table.TOKENSKY_USER_BALANCE} set balance = balance-? where user_id=? and coin_type = ? `;
             let r2 = await conn.query(sql2, [vendor_total_amount, vendor_user_id, coin_type]);
             if (r2.affectedRows == 0) {
                 await conn.rollback();
                 return false;
             }*/


            //买家得到币
            /*let userBalanceCount = await this.app.mysql.get(dbName).count(table.TOKENSKY_USER_BALANCE, {
                user_id: vendee_user_id,
                coin_type: coin_type
            });
            if (userBalanceCount > 0) {
                let sql = `update ${table.TOKENSKY_USER_BALANCE} set balance = balance+? where user_id=? and coin_type=?`;
                let r = await conn.query(sql, [vendee_total_amount, vendee_user_id, coin_type]);
                if (r.affectedRows == 0) {
                    await conn.rollback();
                    return false;
                }
            } else {
                let _p = {
                    user_id: vendee_user_id,
                    coin_type: coin_type,
                    balance: vendee_total_amount
                };
                let result = await conn.insert(table.TOKENSKY_USER_BALANCE, _p);
                if (result.affectedRows == 0) {
                    await conn.rollback();
                    return false;
                }
            }*/


            //修改订单信息
            let sql_order = `update ${table.OTC_ORDER} set status=?,send_coin_time=? where order_id=? `;
            let order_r = await conn.query(sql_order, [1, send_coin_time, order_id]);
            if (order_r.affectedRows == 0) {
                await conn.rollback();
                return false;
            }


            if (order_type == 2) {
                let us = await conn.update(table.OTC_USER_FROZEN_BALANCE, {status: 0}, {
                    where: {
                        type: 2,
                        relevance_id: order_id
                    }
                });
                if (us.affectedRows == 0) {
                    await conn.rollback();
                    return false
                }
            }

            //生成交易明细
            //收入

            let otcTranTime = dateUtil.currentDate();
            let otcBuyinParams = {
                coin_type: coin_type,
                tran_type: 'OTC买入',
                category: 1,//收入
                user_id: vendee_user_id,
                push_time: otcTranTime,
                money: quantity,
                status: 1,
                relevance_category: "otcOrder",
                relevance_id: order_id
            };
            let otcBuyinResult = await conn.insert(table.TOKENSKY_TRANSACTION_RECORD, otcBuyinParams);
            if (otcBuyinResult.affectedRows == 0) {
                await conn.rollback();
                return false;
            }

            //支出
            //卖出
            let otcBuyoutParams = {
                coin_type: coin_type,
                tran_type: 'OTC卖出',
                category: 2,
                user_id: vendor_user_id,
                push_time: otcTranTime,
                money: quantity,
                status: 1,
                relevance_category: "otcOrder",
                relevance_id: order_id
            };
            let otcBuyoutResult = await conn.insert(table.TOKENSKY_TRANSACTION_RECORD, otcBuyoutParams);
            if (otcBuyoutResult.affectedRows == 0) {
                await conn.rollback();
                return false;
            }


            //买入手续费
            let otcBuyinServiceChargeParams = {
                coin_type: coin_type,
                tran_type: 'OTC买入手续费',
                category: 2,
                user_id: vendee_user_id,
                push_time: otcTranTime,
                money: vendee_service_charge_coin,
                status: 1,
                relevance_category: "otcOrder",
                relevance_id: order_id
            };
            let otcBuyinServiceChargeResult = await conn.insert(table.TOKENSKY_TRANSACTION_RECORD, otcBuyinServiceChargeParams);
            if (otcBuyinServiceChargeResult.affectedRows == 0) {
                await conn.rollback();
                return false;
            }


            //剩下的小于最小额的话  自动归还余额
            let autoObject = {
                balance: 0,
                exec: false
            };

            if (entrust_type == 1) {//买单
                if (_quantity_left < _min) {
                    const isCancelEntrust = await this.ctx.service.home.isCancelEntrust2(entrust_order_id, order_id);
                    if (isCancelEntrust) {//可以取消订单
                        //记录自动取消订单纪录
                        //修改委托单表中的自动取消时间与委托单状态
                        let entrustAutoCancelRecord = {
                            entrust_order_id: entrust_order_id,
                            money: _quantity_left,
                            entrust_type: entrust_type,
                            user_id: _user_id
                        };
                        let entrustAutoCancelRecordResult = await conn.insert(table.OTC_ENTRUST_AUTO_CANCEL_RECORD, entrustAutoCancelRecord);
                        if (entrustAutoCancelRecordResult.affectedRows == 0) {
                            await conn.rollback();
                            return false;
                        }
                        let sqlAutoCancelTime = `update ${table.OTC_ENTRUST_ORDER} set auto_cancel_time = ? where key_id=? `;
                        let rAutoCancelTime = await conn.query(sqlAutoCancelTime, [dateUtil.currentDate(), entrust_order_id]);
                        if (rAutoCancelTime.affectedRows == 0) {
                            await conn.rollback();
                            return false;
                        }
                    }
                }
            } else if (entrust_type == 2) {//卖单
                if (_quantity_left < _min) {
                    const isCancelEntrust = await this.ctx.service.home.isCancelEntrust2(entrust_order_id, order_id);
                    if (isCancelEntrust) {//可以取消订单
                        //记录自动取消订单纪录
                        //修改委托单表中的自动取消时间与委托单状态
                        //解冻数字货币

                        let m = _quantity_left;

                        let entrustAutoCancelRecord = {
                            entrust_order_id: entrust_order_id,
                            money: _quantity_left,
                            entrust_type: entrust_type,
                            user_id: _user_id,
                            service_charge: __vendor_service_charge,
                            sum_money: m
                        };
                        let entrustAutoCancelRecordResult = await conn.insert(table.OTC_ENTRUST_AUTO_CANCEL_RECORD, entrustAutoCancelRecord);
                        if (entrustAutoCancelRecordResult.affectedRows == 0) {
                            await conn.rollback();
                            return false;
                        }
                        let sqlAutoCancelTime = `update ${table.OTC_ENTRUST_ORDER} set auto_cancel_time = ? where key_id=? `;
                        let rAutoCancelTime = await conn.query(sqlAutoCancelTime, [dateUtil.currentDate(), entrust_order_id]);
                        if (rAutoCancelTime.affectedRows == 0) {
                            await conn.rollback();
                            return false;
                        }

                        const userBalance = await this.ctx.service.user.findOneUserBalance({
                            user_id: _user_id,
                            coin_type: coin_type
                        });
                        if (!userBalance) {
                            this.ctx.logger.error(`affirmProceeds error: no such userBalance`);
                            await conn.rollback();
                            return false;
                        }
                        if (userBalance.frozen_balance < 0) {
                            this.ctx.logger.error(`affirmProceeds error: 冻结金额数据异常; m=${m},frozen_balance=${userBalance.frozen_balance}`);
                            await conn.rollback();
                            return false;
                        }
                        if (userBalance.frozen_balance < m) {
                            this.ctx.logger.error(`affirmProceeds error: m=${m},frozen_balance=${userBalance.frozen_balance}`);
                            m = userBalance.frozen_balance;
                        }
                        autoObject.exec = true;
                        autoObject.balance = m;

                        /*let sql = `update ${table.TOKENSKY_USER_BALANCE} set frozen_balance = frozen_balance-? where user_id=? and coin_type=?`;
                        let r = await conn.query(sql, [m, _user_id, coin_type]);
                        if (r.affectedRows == 0) {
                            await conn.rollback();
                            return false;
                        }*/

                    }
                }
            }


            /**
             * 二次验证
             */

            let order = await this.ctx.service.order.findOneOtcOrder({order_id: order_id});
            if (order.status == 1) {
                await conn.rollback();
                return -1;
            }

            //修改用户资产
            /**
             * 卖家减去冻结金额
             * 卖家减去金额
             * 买家得到金额
             *
             * @type {{changes: *[], mold: string, cont: string}}
             */
            let assetsParams = {
                changes: [{
                    uid: vendor_user_id,
                    methodFrozenBalance: 'sub',
                    frozenBalance: vendor_total_amount,
                    symbol: coin_type,
                    signId: order_id
                }, {
                    uid: vendor_user_id,
                    methodBalance: 'sub',
                    balance: vendor_total_amount,
                    symbol: coin_type,
                    signId: order_id
                }, {
                    uid: vendee_user_id,
                    methodBalance: 'add',
                    balance: vendee_total_amount,
                    symbol: coin_type,
                    signId: order_id
                }],
                mold: 'OTC',
                cont: 'OTC确认收款'
            };
            if (autoObject.exec) {
                assetsParams.changes.push({
                    uid: _user_id,
                    methodFrozenBalance: 'sub',
                    frozenBalance: autoObject.balance,
                    symbol: coin_type,
                    signId: order_id
                })
            }
            this.ctx.logger.error('post params:', JSON.stringify(assetsParams));
            let assetsResult = await requestHttp.postAssetsMulti.call(this, assetsParams);
            if (!assetsResult.success) {
                await conn.rollback();
                return false;
            }
            let hashId = assetsResult.hashId;

            let hashSql = `update ${table.TOKENSKY_USER_BALANCE_HASH} set model_status=? where hash_id=? `;
            let hashResult = await conn.query(hashSql, [1, hashId]);
            if (hashResult.affectedRows == 0) {
                this.ctx.logger.error(`tibi update hash fail:hashId==${hashId},userId=${_user_id}`);
            }

            await conn.commit();
            return true;
        } catch (e) {
            await conn.rollback();
            throw e;
            this.ctx.logger.error(`affirmProceeds service error : ${e.message}`);
            return false;
        }
    }

    async upTransactionVoucher(params) {
        const conn = await this.app.mysql.get(dbName).beginTransaction(); // 初始化事务
        try {
            let order_id = params.order_id;
            let us = await conn.update(table.OTC_ORDER, {status: 4}, {where: {order_id: order_id}});
            if (us.affectedRows == 0) {
                await conn.rollback();
                return false
            }
            let us2 = await conn.update(table.OTC_APPEAL, {
                up_voucher_time: params.up_voucher_time,
                vendee_remark: params.vendee_remark,
                vendee_voucher: params.vendee_voucher
            }, {where: {order_id: order_id}});
            if (us2.affectedRows == 0) {
                await conn.rollback();
                return false
            }
            await conn.commit();
            return true;
        } catch (e) {
            await conn.rollback();
            throw e;
            this.ctx.logger.error(`upTransactionVoucher service error : ${e.message}`);
            return false;
        }
    }

    /**
     * 是否申诉过
     * @param orderId
     * @returns {Promise<boolean>}
     */
    async isOrderAppeal(orderId, userId, vendorUserId, vendeeUserId) {
        let appeal = await this.app.mysql.get(dbName).get(table.OTC_APPEAL, {order_id: orderId});
        if (!appeal) {
            return false;
        }
        if (userId == vendorUserId) {
            if (appeal.appeal_time) {
                return true;
            }
        } else if (userId == vendeeUserId) {
            if (appeal.up_voucher_time) {
                return true;
            }
        }
        return false;
    }

    /**
     * 买家是否上传过凭证
     * @param orderId
     * @returns {Promise<boolean>}
     */
    async isUpTransactionVoucher(orderId) {
        let sql = `SELECT count(*) as count
                      FROM ${table.OTC_APPEAL} ap
                      WHERE ap.order_id = ? AND ap.up_voucher_time != null  `;
        let result = await this.app.mysql.get(dbName).query(sql, [orderId]);
        if (result[0].count > 0) {
            return true;
        } else {
            return false;
        }
    }


    async orderAppeal(params) {
        let order_id = params.order_id;
        const conn = await this.app.mysql.get(dbName).beginTransaction(); // 初始化事务
        try {
            let appeal = await conn.get(table.OTC_APPEAL, {order_id: order_id});
            if (!appeal) {
                let result = await conn.insert(table.OTC_APPEAL, params);
                if (result.affectedRows == 0) {
                    await conn.rollback();
                    return false
                }
            } else {
                delete params.order_id;
                let result = await conn.update(table.OTC_APPEAL, params, {where: {order_id: order_id}});
                if (result.affectedRows == 0) {
                    await conn.rollback();
                    return false
                }
            }
            let updateStatus = await conn.update(table.OTC_ORDER, {
                status: 3
            }, {where: {order_id: order_id}});
            if (updateStatus.affectedRows == 0) {
                await conn.rollback();
                return false
            }
            await conn.commit();
            return true;
        } catch (e) {
            await conn.rollback();
            throw e;
            this.ctx.logger.error(`orderAppeal service error : ${e.message}`);
            return false;
        }

    }


    //获取需要给用户发送短信的订单
    async getOrdersForSMS() {
        let t = moment().subtract('3', 'm').format('YYYY-MM-DD HH:mm:ss');
        let sql = `select order_id,buy_order_time,vendee_user_id from ${table.OTC_ORDER} where status = 1 and buy_order_time <= ? `;
        let orders = await this.app.mysql.get(dbName).query(sql, [t]);

        let result = [];
        for (let i = 0; i < orders.length; i++) {
            let obj = await await this.app.mysql.get(dbName).get(table.OTC_ORDER_SMS, {where: {order_id: orders[i].order_id}});
            if (!obj) {
                result.push(orders[i]);
            }
        }

        if (result.length > 0) {
            for (let j = 0; j < result.length; j++) {
                let obj = await await this.app.mysql.get(dbName).get(table.TOKENSKY_USER, {where: {user_id: result[j].vendee_user_id}});
                if (obj) {
                    result[j].phone = obj.phone;
                } else {
                    result.splice(j, 1);
                }
            }
        }

        return result;
    }


    async queryOrderList(tnum, status) {
        let t = moment().subtract(tnum, 's').format('YYYY-MM-DD HH:mm:ss');
        let sql = `select * from ${table.OTC_ORDER} where status = ? and buy_order_time <= ? `;
        let result = await this.app.mysql.get(dbName).query(sql, [status, t]);
        return result;
    }


}


module.exports = OrderService;
