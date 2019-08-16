'use strict';

const code = require("../utils/code");
const Controller = require('egg').Controller;
let Response = require('./../utils/resObj');
let commonUtil = require('./../utils/commonUtil');
let dateUtil = require('./../utils/dateUtil');
let qiniuUtil = require('./../utils/qiniu');
let aliyunUtil = require('./../utils/aliyun');
let sms253Util = require('./../utils/sms253');
let jiguangUtil = require('./../utils/jiguang');
let orderRule = require('./rule/order');
const moment = require('moment');
const BigNumber = require('bignumber.js');
const I18nConst = require('./../../config/constant/i18n');
const jpushConst = require('./../../config/constant/jpush');

// order status

/**
 * table > otc_order status
 * 0:待支付 等待对方支付
 * 1:已完成 已完成 已完成
 * 2:已支付 等待对方放币 对方已支付
 * 3.已申诉 卖方已申诉 已申诉
 * 4:已取消 已取消 对方已取消
 */


class OrderController extends Controller {

    async buyinOrder() {
        const {ctx} = this;
        let response = Response();
        try {
            let json = await this.ctx.checkToken();
            let userId = json.uid;

            let body = this.ctx.request.body;

            let RuleErrors = this.ctx.Rulevalidate(orderRule.buyinOrder, body);
            if (RuleErrors != undefined) {
                let errors = RuleErrors[0];
                response.errMsg(this.ctx.I18nMsg(I18nConst.VerifyFailed) + errors.field + " " + errors.message, code.ERROR_PARAMS, 'ERROR_PARAMS');
                return ctx.body = response;
            }
            if (body.quantity < 0) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.IlegalParameters), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }

            // 是否限制交易  otc禁止交易  当天用户取消订单的次数

            const otcConf = await ctx.service.home.findOneOtcConf();
            if (!otcConf) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.SyetemErrorNotOtcConfig), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }
            let cancel_number = otcConf.cancel_number;
            const isOTCInfo = await ctx.service.home.isOTC(userId, null, cancel_number);
            if (!isOTCInfo.success) {
                return ctx.body = {
                    code: isOTCInfo.code,
                    type: isOTCInfo.type,
                    msg: isOTCInfo.msg
                }
            }


            //是否完成身份认证
            let realAuth = await this.ctx.service.home.verifyRealAuth(userId);
            if (!realAuth.success) {
                response.errMsg(realAuth.msg, realAuth.code, realAuth.type);
                return ctx.body = response;
            }

            //是否设置交易密码
            const userInfo = await ctx.service.user.getUserByUid(userId);
            if (!userInfo.transaction_password) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.PleaseSetTransactionPassword), code.ERROR_SET_PWD, 'ERROR_SET_PWD');
                return ctx.body = response;
            }

            console.log(commonUtil.encrypt(commonUtil.decryptTranPWDByClient(body.transactionPassword, userId), userId))
            console.log(commonUtil.decryptTranPWDByClient(body.transactionPassword, userId))
            console.log(body.transactionPassword)

            if (commonUtil.encrypt(commonUtil.decryptTranPWDByClient(body.transactionPassword, userId), userId) != userInfo.transaction_password) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.IncorrectPassword), code.ERROR_PARAMS, 'ERROR_PARAMS');
                return ctx.body = response;
            }

            let b_quantity = new BigNumber(body.quantity);

            let quantity = parseFloat(b_quantity.toFixed(this.app.config.decimalPoint.v6));
            let keyId = body.keyId;
            let b_money = new BigNumber(body.money);
            let money = parseFloat(b_money.toFixed(this.app.config.decimalPoint.v2));


            let entrustOrder = await this.ctx.service.home.findOneOtcEntrustOrder({key_id: keyId});

            if (!entrustOrder) {

                response.errMsg(this.ctx.I18nMsg(I18nConst.NoSuchOrder), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }
            if (entrustOrder.status != 1) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.TheOrderHasCancelled), code.ERROR_PARAMS, 'ERROR_PARAMS');
                return ctx.body = response;
            }

            if (entrustOrder.entrust_type != 2) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.ItIsNotForSelling), code.ERROR_PARAMS, 'ERROR_PARAMS');
                return ctx.body = response;
            }
            let unit_price = entrustOrder.unit_price;
            let sumMoney = commonUtil.bigNumberMultipliedBy(quantity, unit_price, this.app.config.decimalPoint.v2);
            if (sumMoney != money) {
                money = sumMoney;
                /* response.errMsg(this.ctx.I18nMsg(I18nConst.IncorrectPrice), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                 return ctx.body = response;*/
            }

            if (quantity < entrustOrder.min) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.NotWithinTheLimit), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }

            if (quantity > entrustOrder.max) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.OverTheLimit), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }

            if (quantity > entrustOrder.quantity_left) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.NotWithinTheLimitChangeAmount), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }

            if (userId == entrustOrder.user_id) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.ThisOrderIsYours), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }

            let oid = commonUtil.orderId('00');
            if (!oid) {
                this.ctx.logger.error(`buyinOrder 生成orderId 失败`);
                response.errMsg(this.ctx.I18nMsg(I18nConst.FrequentOperation), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }
            let params = {
                order_id: oid,
                order_type: 1,
                vendor_user_id: entrustOrder.user_id,//卖方
                vendee_user_id: userId,//买方
                entrust_order_id: keyId,
                unit_price: entrustOrder.unit_price,
                quantity: quantity,
                total_amount: money,
                buy_order_time: dateUtil.currentDate()
            };
            ctx.getLogger('recordLogger').info("OTC buyinOrder >> " + JSON.stringify(params));
            let orderStatus = await this.ctx.service.order.addOtcOrder(params);
            if (!orderStatus) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.TheOrderHasSoldOut), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return this.ctx.body = response;
            } else if (orderStatus == -1) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.FrequentOperation), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return this.ctx.body = response;
            }
            response.content.data = {
                order_id: oid
            };

            try {
                /**
                 * 推送
                 */
                let sendUserID = params.vendor_user_id;
                let sendTitle = "委托单卖出";
                let sendContent = `您有新的OTC订单生成，订单号: ${oid}，等待对方支付。`;
                let msgParams = {
                    title: sendTitle,
                    content: sendContent,
                    user_id: sendUserID,
                    relevance_id: oid,
                    msg_category: jpushConst.jpushType.BASE_OTC,
                    msg_route: jpushConst.jpushType.OTC_DETAILS
                };
                let res = await this.ctx.service.user.addMessage(msgParams);
                if (res && res.insertId) {
                    let message_id = res.insertId;
                    let jiguangReg = await this.ctx.service.user.findOneJiguangRegistrationid({user_id: sendUserID});
                    if (jiguangReg) {
                        let registration_id = jiguangReg.registration_id;
                        let extras = commonUtil.getExtras(jpushConst.jpushType.OTC_DETAILS, oid, message_id, true);
                        jiguangUtil.SendNotificationByUser.call(this, {
                            content: sendContent,
                            title: sendTitle,
                            userId: registration_id,
                            extras: extras
                        });

                        jiguangUtil.SendMessageByUser.call(this, {
                            content: 'red port',
                            title: 'red port',
                            userId: registration_id,
                            extras: {
                                category: jpushConst.jpushType.MSG_RED_PORT,
                                num: 1
                            }
                        })
                    }
                }

                //推送买家
                let sendUserID2 = params.vendee_user_id;
                let sendTitle2 = "买单生成";
                let sendContent2 = `您的订单: ${oid} 已生成，请尽快付款`;
                let msgParams2 = {
                    title: sendTitle2,
                    content: sendContent2,
                    user_id: sendUserID2,
                    relevance_id: oid,
                    msg_category: jpushConst.jpushType.BASE_OTC,
                    msg_route: jpushConst.jpushType.OTC_DETAILS
                };
                let res2 = await this.ctx.service.user.addMessage(msgParams2);
                if (res2 && res2.insertId) {
                    let message_id2 = res2.insertId;
                    let jiguangReg = await this.ctx.service.user.findOneJiguangRegistrationid({user_id: sendUserID2});
                    if (jiguangReg) {
                        let registration_id = jiguangReg.registration_id;
                        let extras = commonUtil.getExtras(jpushConst.jpushType.OTC_DETAILS, oid, message_id2, true);
                        jiguangUtil.SendNotificationByUser.call(this, {
                            content: sendContent2,
                            title: sendTitle2,
                            userId: registration_id,
                            extras: extras
                        });

                        jiguangUtil.SendMessageByUser.call(this, {
                            content: 'red port',
                            title: 'red port',
                            userId: registration_id,
                            extras: {
                                category: jpushConst.jpushType.MSG_RED_PORT,
                                num: 1
                            }
                        })
                    }
                }

            } catch (e) {
                this.ctx.logger.error(`buyinOrder addMessage error:${e.message};userId:${userId}`)
            }

            return this.ctx.body = response;
        } catch (e) {
            ctx.logger.error('buyinOrder > 系统错误,' + e.message);
            response.errMsg(e.message, code.ERROR_SYSTEM, 'ERROR_SYSTEM');
            return ctx.body = response;
        }

    }

    /**
     * 卖出
     * @returns {Promise<*>}
     */
    async buyoutOrder() {
        const {ctx} = this;
        let response = Response();
        try {
            let json = await this.ctx.checkToken();
            let userId = json.uid;

            let body = this.ctx.request.body;

            let RuleErrors = this.ctx.Rulevalidate(orderRule.buyoutOrder, body);
            if (RuleErrors != undefined) {
                let errors = RuleErrors[0];
                response.errMsg(this.ctx.I18nMsg(I18nConst.VerifyFailed) + errors.field + " " + errors.message, code.ERROR_PARAMS, 'ERROR_PARAMS');
                return ctx.body = response;
            }

            if (body.quantity < 0) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.IlegalParameters), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }

            let b_quantity = new BigNumber(body.quantity);

            let quantity = parseFloat(b_quantity.toFixed(this.app.config.decimalPoint.v6));
            let keyId = body.keyId;
            let b_money = new BigNumber(body.money);
            let money = parseFloat(b_money.toFixed(this.app.config.decimalPoint.v2));


            const otcConf = await ctx.service.home.findOneOtcConf();
            if (!otcConf) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.SyetemErrorNotOtcConfig), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }
            let cancel_number = otcConf.cancel_number;

            // 是否限制交易 包括用户otc禁止  当天用户取消订单的次数
            const isOTCInfo = await ctx.service.home.isOTC(userId, null, cancel_number);
            if (!isOTCInfo.success) {
                return ctx.body = {
                    code: isOTCInfo.code,
                    type: isOTCInfo.type,
                    msg: isOTCInfo.msg
                }
            }

            //是否为买单
            let entrustOrder = await ctx.service.home.findOneOtcEntrustOrder({key_id: keyId});
            if (!entrustOrder) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.NoSuchOrder), code.ERROR_PARAMS, 'ERROR_PARAMS');
                return ctx.body = response;
            }
            if (entrustOrder.status != 1) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.NoSuchOrder2), code.ERROR_PARAMS, 'ERROR_PARAMS');
                return ctx.body = response;
            }
            if (entrustOrder.entrust_type != 1) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.ItIsNotForBuying), code.ERROR_PARAMS, 'ERROR_PARAMS');
                return ctx.body = response;
            }

            let transactionPassword = body.transactionPassword;
            if (!transactionPassword) {
                response.errMsg('equire transactionPassword ', code.ERROR_PARAMS, 'ERROR_PARAMS');
                return this.ctx.body = response;
            }

            //是否完成身份认证
            let realAuth = await this.ctx.service.home.verifyRealAuth(userId);
            if (!realAuth.success) {
                response.errMsg(realAuth.msg, realAuth.code, realAuth.type);
                return ctx.body = response;
            }

            //是否设置交易密码
            const userInfo = await ctx.service.user.getUserByUid(userId);
            if (!userInfo.transaction_password) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.PleaseSetTransactionPassword), code.ERROR_SET_PWD, 'ERROR_SET_PWD');
                return ctx.body = response;
            }

            //是否设置收款方式
            const verifyPayWay = await ctx.service.home.verifyPayWay(userId);
            if (!verifyPayWay.success) {
                response.errMsg(verifyPayWay.msg, verifyPayWay.code, verifyPayWay.type);
                return ctx.body = response;
            }

            //买家是否支持您的收款方式
            let userPayWay = await ctx.service.home.getUserPayWay(userId);
            let pay_type = entrustOrder.pay_type;
            let payTypes = pay_type.split(',');
            let F = false;

            for (let i = 0; i < userPayWay.length; i++) {
                if (payTypes.includes(userPayWay[i])) {
                    F = true;
                    break;
                }
            }
            if (!F) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.PleaseCompletedYourCollectionTypes), code.ERROR_PAYWAY_UNCENSORED2, 'ERROR_PAYWAY_UNCENSORED2');
                return ctx.body = response;
            }

            //判断货币是否足够
            let coinType = entrustOrder.coin_type;
            let userBalance = await ctx.service.user.findOneUserBalance({user_id: userId, coin_type: coinType});
            if (!userBalance) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.InsufficientBalance), code.ERROR_PARAMS, 'ERROR_PARAMS');
                return this.ctx.body = response;
            }
            //账户余额
            let usableCoin = commonUtil.bigNumberMinus(userBalance.balance, userBalance.frozen_balance);

            if (usableCoin < quantity) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.InsufficientBalance), code.ERROR_PARAMS, 'ERROR_PARAMS');
                return this.ctx.body = response;
            }
            let b_unit_price = new BigNumber(entrustOrder.unit_price);
            let unit_price = parseFloat(b_unit_price.toFixed(this.app.config.decimalPoint.v2));

            let smoney = commonUtil.bigNumberMultipliedBy(quantity, unit_price, this.app.config.decimalPoint.v2);

            if (smoney != money) {
                money = smoney;
                /*response.errMsg(this.ctx.I18nMsg(I18nConst.IncorrectPrice), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;*/
            }

            if (quantity < entrustOrder.min) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.NotWithinTheLimit), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }

            if (quantity > entrustOrder.max) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.OverTheLimit), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }

            if (quantity > entrustOrder.quantity_left) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.NotWithinTheLimitChangeAmount), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }

            if (userId == entrustOrder.user_id) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.ThisOrderIsYours), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }

            if (commonUtil.encrypt(commonUtil.decryptTranPWDByClient(transactionPassword, userId), userId) != userInfo.transaction_password) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.IncorrectPassword), code.ERROR_PARAMS, 'ERROR_PARAMS');
                return ctx.body = response;
            }
            let oid = commonUtil.orderId('01');
            if (!oid) {
                this.ctx.logger.error(`buyoutOrder 生成orderId 失败`);
                response.errMsg(this.ctx.I18nMsg(I18nConst.FrequentOperation), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }
            let params = {
                order_id: oid,
                order_type: 2,
                vendor_user_id: userId,//卖方
                vendee_user_id: entrustOrder.user_id,//买方
                entrust_order_id: keyId,
                unit_price: entrustOrder.unit_price,
                quantity: quantity,
                total_amount: money,
                buy_order_time: dateUtil.currentDate(),
                coin_type: entrustOrder.coin_type,
                service_charge_balance: 0,
                frozen_balance: quantity
            };
            ctx.getLogger('recordLogger').info("OTC buyoutOrder >> " + JSON.stringify(params));
            let orderStatus = await this.ctx.service.order.addOtcOrder(params);
            if (!orderStatus) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.TheOrderHasSoldOut), code.ERROR_ADD_DATA, 'ERROR_ADD_DATA');
                return this.ctx.body = response;
            } else if (orderStatus == -1) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.FrequentOperation), code.ERROR_ADD_DATA, 'ERROR_ADD_DATA');
                return this.ctx.body = response;
            }
            response.content.data = {
                order_id: oid
            };

            /**
             * 推送
             */
            try {


                let sendUserID = params.vendor_user_id;
                let sendTitle = "卖单生成";
                let sendContent = `您的订单: ${oid} 已生成，请等待对方支付`;

                let msgParams = {
                    title: sendTitle,
                    content: sendContent,
                    user_id: sendUserID,
                    relevance_id: oid,
                    msg_category: jpushConst.jpushType.BASE_OTC,
                    msg_route: jpushConst.jpushType.OTC_DETAILS
                };
                let res = await this.ctx.service.user.addMessage(msgParams);
                if (res && res.insertId) {
                    let message_id = res.insertId;
                    let jiguangReg = await this.ctx.service.user.findOneJiguangRegistrationid({user_id: sendUserID});
                    if (jiguangReg) {
                        let registration_id = jiguangReg.registration_id;
                        let extras = commonUtil.getExtras(jpushConst.jpushType.OTC_DETAILS, oid, message_id, true);
                        jiguangUtil.SendNotificationByUser.call(this, {
                            content: sendContent,
                            title: sendTitle,
                            userId: registration_id,
                            extras: extras
                        });

                        jiguangUtil.SendMessageByUser.call(this, {
                            content: 'red port',
                            title: 'red port',
                            userId: registration_id,
                            extras: {
                                category: jpushConst.jpushType.MSG_RED_PORT,
                                num: 1
                            }
                        })
                    }

                }

                //推送给委托方（买方）
                let sendUserID2 = params.vendee_user_id;
                let sendTitle2 = "委托单买入";
                let sendContent2 = `您有新的OTC订单生成，订单号: ${oid}，请及时付款。`;

                let msgParams2 = {
                    title: sendTitle2,
                    content: sendContent2,
                    user_id: sendUserID2,
                    relevance_id: oid,
                    msg_category: jpushConst.jpushType.BASE_OTC,
                    msg_route: jpushConst.jpushType.OTC_DETAILS
                };
                let res2 = await this.ctx.service.user.addMessage(msgParams2);
                if (res2 && res2.insertId) {
                    let message_id = res2.insertId;
                    let jiguangReg = await this.ctx.service.user.findOneJiguangRegistrationid({user_id: sendUserID2});
                    if (jiguangReg) {
                        let registration_id = jiguangReg.registration_id;
                        let extras = commonUtil.getExtras(jpushConst.jpushType.OTC_DETAILS, oid, message_id, true);
                        jiguangUtil.SendNotificationByUser.call(this, {
                            content: sendContent2,
                            title: sendTitle2,
                            userId: registration_id,
                            extras: extras
                        });

                        jiguangUtil.SendMessageByUser.call(this, {
                            content: 'red port',
                            title: 'red port',
                            userId: registration_id,
                            extras: {
                                category: jpushConst.jpushType.MSG_RED_PORT,
                                num: 1
                            }
                        })
                    }

                }

                //发送短信
                let vendor_user_id = entrustOrder.user_id;
                if (vendor_user_id) {
                    const userInfo = await ctx.service.user.getUserByUid(vendor_user_id);
                    if (userInfo) {
                        let phone = userInfo.phone;
                        let phone_area_code = userInfo.phone_area_code;
                        if (phone) {
                            let smsParams = {
                                phone: phone,
                                msg: `您有新的订单生成，订单号${oid}，请及时付款。`
                            };
                            sms253Util.SendSms.call(this, smsParams);
                        }
                    }
                }

            } catch (e) {
                this.ctx.logger.error(`buyoutOrder addMessage error:${e.message};userId:${userId}`);
            }

            return this.ctx.body = response;
        } catch (e) {
            ctx.logger.error('buyinOrder > 系统错误,' + e.message);
            response.errMsg(e.message, code.ERROR_SYSTEM, 'ERROR_SYSTEM');
            return ctx.body = response;
        }
    }


    async getOtcOrders() {
        const {ctx} = this;
        let response = Response();
        try {
            let json = await this.ctx.checkToken();
            let userId = json.uid;
            let action = this.ctx.params.action;
            let arr = ['undergoing', 'finish', 'cancel'];
            if (!arr.includes(action)) {
                response.errMsg('action error', code.ERROR_PARAMS, 'ERROR_PARAMS');
                return ctx.body = response;
            }
            let query = this.ctx.query;
            let index = query.pageIndex || 1;
            let pageSize = query.pageSize ? query.pageSize : 20;
            let pageIndex = (index - 1) * pageSize;
            if (pageSize > 20) {
                pageSize = 20;
            }
            let coinType = query.coinType ? query.coinType : 'BTC';
            let data = await this.ctx.service.order.getOtcOrderList(userId, action, coinType, pageIndex, pageSize);
            for (let i = 0; i < data.length; i++) {
                data[i].buy_order_time = dateUtil.format(data[i].buy_order_time);
                if (!data[i].money_type) {
                    data[i].money_type = 'CNY';
                }
                if (userId == data[i].vendee_user_id) {//买方
                    data[i].user = 'vendee';
                    data[i].way_text = 'Buy';
                    //data[i].way_text = this.ctx.I18nMsg(I18nConst.Buy);
                    /* if (data[i].status == 0) {
                         data[i].status_text = this.ctx.I18nMsg(I18nConst.Unpaid);
                     } else if (data[i].status == 1) {
                         data[i].status_text = this.ctx.I18nMsg(I18nConst.Completed);
                     } else if (data[i].status == 2) {
                         data[i].status_text = this.ctx.I18nMsg(I18nConst.Unreleased);
                     } else if (data[i].status == 3) {
                         data[i].status_text = this.ctx.I18nMsg(I18nConst.Appealing);
                     } else if (data[i].status == 4) {
                         data[i].status_text = this.ctx.I18nMsg(I18nConst.Cancelled);
                     }*/
                } else if (userId == data[i].vendor_user_id) {//卖方
                    data[i].user = 'vendor';
                    data[i].way_text = 'Sell';
                    /* data[i].way_text = this.ctx.I18nMsg(I18nConst.Sell);
                     if (data[i].status == 0) {
                         data[i].status_text = this.ctx.I18nMsg(I18nConst.Unpaid2);
                     } else if (data[i].status == 1) {
                         data[i].status_text = this.ctx.I18nMsg(I18nConst.Completed);
                     } else if (data[i].status == 2) {
                         data[i].status_text = this.ctx.I18nMsg(I18nConst.Paid);
                     } else if (data[i].status == 3) {
                         data[i].status_text = this.ctx.I18nMsg(I18nConst.Appealing);
                     } else if (data[i].status == 4) {
                         data[i].status_text = this.ctx.I18nMsg(I18nConst.Cancelled2);
                     }*/
                }

            }
            let count = await this.ctx.service.order.getOtcOrderCount(userId, action, coinType);
            response.content.currentPage = index;
            response.content.totalPage = count;
            response.content.data = data;
            return ctx.body = response;

        } catch (e) {
            ctx.logger.error('getOtcOrders > 系统错误,' + e.message);
            response.errMsg(e.message, code.ERROR_SYSTEM, 'ERROR_SYSTEM');
            return ctx.body = response;
        }
    }

    async getOrderDetails() {
        const {ctx} = this;
        let response = Response();
        try {
            let json = await this.ctx.checkToken();
            let userId = json.uid;

            let RuleErrors = this.ctx.Rulevalidate(orderRule.getOrderDetails, this.ctx.params);

            // 验证参数
            if (RuleErrors != undefined) {
                let errors = RuleErrors[0];
                response.errMsg(this.ctx.I18nMsg(I18nConst.VerifyFailed) + errors.field + " " + errors.message, code.ERROR_PARAMS, 'ERROR_PARAMS');
                return this.ctx.body = response;
            }

            let orderId = this.ctx.params.orderId;
            console.log('orderId:', orderId);

            let order = await this.ctx.service.order.findOneOtcOrder({order_id: orderId});

            if (!order) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.NoSuchOrder3), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }
            let status = order.status;

            let otcConf = await this.ctx.service.home.findOneOtcConf();
            if (!otcConf) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.SyetemErrorNotOtcConfig), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }

            let entrustOrder = await this.ctx.service.home.findOneOtcEntrustOrder({key_id: order.entrust_order_id});
            if (!entrustOrder) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.NoSuchOrder), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }

            order.buy_order_time = dateUtil.format(order.buy_order_time);
            order.pay_order_time = order.pay_order_time ? dateUtil.format(order.pay_order_time) : '';
            order.send_coin_time = dateUtil.format(order.send_coin_time);
            order.coin_type = entrustOrder.coin_type;
            order.money_type = entrustOrder.money_type ? entrustOrder.money_type : 'CNY';
            if (order.vendee_user_id == userId) {//买方
                let user = await this.ctx.service.user.getUserByUid(order.vendor_user_id);
                order.user_nick_name = user ? user.nick_name : '';

                let pay_type = entrustOrder.pay_type;
                let payTypes = pay_type.split(',');

                let payWays = [];

                for (let i = 0; i < payTypes.length; i++) {
                    let accountBank = await this.ctx.service.user.findOneAccountBank({
                        type: payTypes[i],
                        user_id: order.vendor_user_id
                    });
                    if (accountBank) {
                        if (payTypes[i] == 1) {
                            payWays.push({
                                payType: 1,
                                name: accountBank.bank_user_name,
                                info: accountBank.bank_name + " " + accountBank.bank_branch_name,
                                code: accountBank.bank_card_no

                            })
                        } else if (payTypes[i] == 2) {
                            payWays.push({
                                payType: 2,
                                name: accountBank.alipay_user_name,
                                info: accountBank.alipay_account,
                                code: qiniuUtil.getSignAfterUrl(accountBank.alipay_qr_code, this.app.config.qiniuConfig),
                            })
                        } else if (payTypes[i] == 3) {
                            payWays.push({
                                payType: 3,
                                name: accountBank.wechat_user_name,
                                info: accountBank.wechat_account,
                                code: qiniuUtil.getSignAfterUrl(accountBank.wechat_qr_code, this.app.config.qiniuConfig),
                            })
                        }
                    }
                }


                /* if (status == 0) {
                     order.status_text = this.ctx.I18nMsg(I18nConst.Unpaid);
                 } else if (status == 1) {
                     order.status_text = this.ctx.I18nMsg(I18nConst.Completed);
                 } else if (status == 2) {
                     order.status_text = this.ctx.I18nMsg(I18nConst.Unreleased);
                 } else if (status == 3) {
                     order.status_text = this.ctx.I18nMsg(I18nConst.Appealing);
                 } else if (status == 4) {
                     order.status_text = this.ctx.I18nMsg(I18nConst.Cancelled);
                 }


                 order.way_text = this.ctx.I18nMsg((I18nConst.Buy));*/


                if (status == 2 || status == 3) {
                    let vendee_appeal_overtime = otcConf.vendee_appeal_overtime ? otcConf.vendee_appeal_overtime : 0;
                    let dt = moment(order.buy_order_time).add(vendee_appeal_overtime, 's').format('YYYY-MM-DD HH:mm:ss');
                    let t = new Date(dt).getTime();

                    let appealTempNum = parseInt((t - new Date().getTime()) / 1000);
                    if (appealTempNum < 0) {
                        appealTempNum = 0;
                    }

                    order.appeal_time_num = appealTempNum;

                    let isOrderAppeal = await this.ctx.service.order.isOrderAppeal(orderId, userId, order.vendor_user_id, order.vendee_user_id);

                    order.is_order_appeal = isOrderAppeal;
                }

                order.way_text = 'Buy';

                let result = {
                    order: order,
                    user: 'vendee'
                };
                if (order.status != 1 && order.status != 4) {
                    result.payWays = payWays;
                }
                response.content.data = result;
                return ctx.body = response;
            } else if (order.vendor_user_id == userId) {//卖方
                let user = await this.ctx.service.user.getUserByUid(order.vendee_user_id);
                order.user_nick_name = user ? user.nick_name : '';

                /* order.way_text = this.ctx.I18nMsg(I18nConst.Sell);

                 if (status == 0) {
                     order.status_text = this.ctx.I18nMsg(I18nConst.Unpaid2);
                 } else if (status == 1) {
                     order.status_text = this.ctx.I18nMsg(I18nConst.Completed);
                 } else if (status == 2) {
                     order.status_text = this.ctx.I18nMsg(I18nConst.Paid);
                 } else if (status == 3) {
                     order.status_text = this.ctx.I18nMsg(I18nConst.Appealing);
                 } else if (status == 4) {
                     order.status_text = this.ctx.I18nMsg(I18nConst.Cancelled2);
                 }*/

                if (status == 0 || status == 2 || status == 3) {
                    let appeal_overtime = otcConf.appeal_overtime ? otcConf.appeal_overtime : 0;
                    let dt = moment(order.buy_order_time).add(appeal_overtime, 's').format('YYYY-MM-DD HH:mm:ss');
                    let t = new Date(dt).getTime();

                    let appealTempNum = parseInt((t - new Date().getTime()) / 1000);
                    if (appealTempNum < 0) {
                        appealTempNum = 0;
                    }

                    order.appeal_time_num = appealTempNum;

                    let isOrderAppeal = await this.ctx.service.order.isOrderAppeal(orderId, userId, order.vendor_user_id, order.vendee_user_id);

                    order.is_order_appeal = isOrderAppeal;
                }

                order.way_text = 'Sell';

                response.content.data = {order: order, user: 'vendor'};
                return ctx.body = response;
            } else {
                response.errMsg('此订单异常', code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }

        } catch (e) {
            ctx.logger.error('getOrderDetails > 系统错误,' + e.message);
            response.errMsg(e.message, code.ERROR_SYSTEM, 'ERROR_SYSTEM');
            return ctx.body = response;
        }
    }


    /**
     * 付款
     * 只有买家才能付款
     * 前置条件 原order status 必须为0
     * @returns {Promise<void>}
     */
    async orderPayment() {
        const {ctx} = this;
        let response = Response();
        try {
            let json = await this.ctx.checkToken();
            let userId = json.uid;
            let body = this.ctx.request.body;

            let RuleErrors = this.ctx.Rulevalidate(orderRule.orderPayment, body);
            if (RuleErrors != undefined) {
                let errors = RuleErrors[0];
                response.errMsg(this.ctx.I18nMsg(I18nConst.VerifyFailed) + errors.field + " " + errors.message, code.ERROR_PARAMS, 'ERROR_PARAMS');
                return ctx.body = response;
            }

            let orderId = body.orderId;

            let order = await this.ctx.service.order.findOneOtcOrder({order_id: orderId});
            if (!order) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.NoSuchOrder3), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }
            if (order.vendee_user_id != userId) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.OnlyBuyerCanPay), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }
            if (order.status != 0) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.OnlyUnpaidOrderCanBePaid), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }
            if (body.payType != 1 && body.payType != 2 && body.payType != 3) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.IncorrectPaymentType), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }
            let params = {
                status: 2,
                pay_type: body.payType,
                pay_order_time: dateUtil.currentDate()
            };
            ctx.getLogger('recordLogger').info("OTC orderPayment >> " + JSON.stringify(params), +" where>> ", JSON.stringify({order_id: orderId}));
            let us = await this.ctx.service.order.updateOtcOrder(params, {order_id: orderId});
            if (!us) {
                response.errMsg('系统异常，付款失败', code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }
            response.content.data = {
                order_id: orderId,
                status: 2
            };
            try {
                //发送短信
                if (order.order_type == 2) {
                    let vendor_user_id = order.vendor_user_id;
                    if (vendor_user_id) {
                        const userInfo = await ctx.service.user.getUserByUid(vendor_user_id);
                        if (userInfo) {
                            let phone = userInfo.phone;
                            let phone_area_code = userInfo.phone_area_code;
                            if (phone) {
                                /*let smsParams = {
                                    phone: phone,
                                    smsType: 1,
                                    phoneAreaCode: phone_area_code,
                                    templateParam: {
                                        "orderId": orderId
                                    }
                                };
                                aliyunUtil.SendSms.call(this, smsParams);*/
                                let params = {
                                    phone: phone,
                                    msg: `您的订单${orderId}对方已确认付款，请您尽快查看账户并处理，若未到款可向客服申诉。`
                                };
                                sms253Util.SendSms.call(this, params);
                            }
                        }
                    }
                }
                /**
                 * 推送
                 */

                let sendUserID = order.vendor_user_id;
                let sendTitle = "对方已付款";
                let sendContent = `您的订单:${orderId} 对方已确认付款，${order.quantity}个${body.payType}-CNY，总价${order.total_amount}元，请您确认款项后及时放币，若未收到款项可向客服申诉`;

                let msgParams = {
                    title: sendTitle,
                    content: sendContent,
                    user_id: sendUserID,
                    relevance_id: orderId,
                    msg_category: jpushConst.jpushType.BASE_OTC,
                    msg_route: jpushConst.jpushType.OTC_DETAILS
                };
                let res = await this.ctx.service.user.addMessage(msgParams);
                if (res && res.insertId) {
                    let message_id = res.insertId;

                    let jiguangReg = await this.ctx.service.user.findOneJiguangRegistrationid({user_id: sendUserID});
                    if (jiguangReg) {
                        let registration_id = jiguangReg.registration_id;
                        let extras = commonUtil.getExtras(jpushConst.jpushType.OTC_DETAILS, orderId, message_id, true);
                        jiguangUtil.SendNotificationByUser.call(this, {
                            content: sendContent,
                            title: sendTitle,
                            userId: registration_id,
                            extras: extras
                        });

                        jiguangUtil.SendMessageByUser.call(this, {
                            content: sendContent,
                            title: sendTitle,
                            userId: registration_id,
                            extras: extras
                        });

                        jiguangUtil.SendMessageByUser.call(this, {
                            content: 'red port',
                            title: 'red port',
                            userId: registration_id,
                            extras: {
                                category: jpushConst.jpushType.MSG_RED_PORT,
                                num: 1
                            }
                        })
                    }

                }

            } catch (e) {
                this.ctx.logger.error(`addMessage error:${e.message};userId:${userId}`)
            }
            return ctx.body = response;
        } catch (e) {
            ctx.logger.error('orderPayment orderPayment > 系统错误,' + e.message);
            response.errMsg(e.message, code.ERROR_SYSTEM, 'ERROR_SYSTEM');
            return ctx.body = response;
        }
    }


    /**
     * 取消交易
     * 前置条件
     * 只有买家有权限
     * 只有不是已取消和已完成
     *
     * 把 otc_user_frozen_balance 状态置为0
     * 更改 tokensky_user_balance 中的值 卖单》因为只有卖单才会先冻结资产
     * @returns {Promise<void>}
     */
    async cancelOrder() {
        const {ctx} = this;
        let response = Response();
        try {
            let json = await this.ctx.checkToken();
            let userId = json.uid;
            let body = this.ctx.request.body;
            let RuleErrors = this.ctx.Rulevalidate(orderRule.cancelOrder, body);
            if (RuleErrors != undefined) {
                let errors = RuleErrors[0];
                response.errMsg(this.ctx.I18nMsg(I18nConst.VerifyFailed) + errors.field + " " + errors.message, code.ERROR_PARAMS, 'ERROR_PARAMS');
                return ctx.body = response;
            }
            let orderId = body.orderId;
            let order = await this.ctx.service.order.findOneOtcOrder({order_id: orderId});
            if (!order) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.NoSuchOrder3), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }
            if (order.vendee_user_id != userId) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.OnlyBuyerCanCancelTheOrder), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }

            if (order.status == 1 || order.status == 4) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.ThisOrderHasCancelledOrCompleted), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }

            let entrustOrder = await this.ctx.service.home.findOneOtcEntrustOrder({key_id: order.entrust_order_id});


            let frozen_balance = 0;
            if (order.order_type == 2) {
                let userFrozenBalance = await ctx.service.home.findOneUserFrozenBalance({
                    relevance_id: orderId,
                    type: 2,
                    status: 1
                });
                if (!userFrozenBalance) {
                    response.errMsg('no such userFrozenBalance.', code.ERROR_PARAMS, 'ERROR_PARAMS');
                    return ctx.body = response;
                }
                frozen_balance = userFrozenBalance.frozen_balance;
            }


            let params = {
                status: 4,
                cancel_order_time: dateUtil.currentDate(),
                order_id: orderId,
                order_type: order.order_type,
                vendor_user_id: order.vendor_user_id,
                total_amount: order.total_amount,
                coin_type: entrustOrder.coin_type,
                entrust_order_id: order.entrust_order_id,
                quantity: order.quantity,
                frozen_balance: frozen_balance
            };
            ctx.getLogger('recordLogger').info("OTC cancelOrder >> " + JSON.stringify(params));
            let us = await this.ctx.service.order.cancelOrder(params);
            if (!us) {
                response.errMsg('系统异常,取消失败', code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            } else if (us == -1) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.FrequentOperation), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }

            try {
                /**
                 * 推送
                 */
                let sendUserID = order.vendor_user_id;
                let sendTitle = "OTC取消";
                let sendContent = "您的订单已被取消：" + orderId;

                let msgParams = {
                    title: sendTitle,
                    content: sendContent,
                    user_id: sendUserID,
                    relevance_id: orderId,
                    msg_category: jpushConst.jpushType.BASE_OTC,
                    msg_route: jpushConst.jpushType.OTC_DETAILS
                };
                let res = await this.ctx.service.user.addMessage(msgParams);
                if (res && res.insertId) {
                    let message_id = res.insertId;
                    let jiguangReg = await this.ctx.service.user.findOneJiguangRegistrationid({user_id: sendUserID});
                    if (jiguangReg) {
                        let registration_id = jiguangReg.registration_id;
                        let extras = commonUtil.getExtras(jpushConst.jpushType.OTC_DETAILS, orderId, message_id, true);
                        jiguangUtil.SendNotificationByUser.call(this, {
                            content: sendContent,
                            title: sendTitle,
                            userId: registration_id,
                            extras: extras
                        });

                        jiguangUtil.SendMessageByUser.call(this, {
                            content: sendContent,
                            title: sendTitle,
                            userId: registration_id,
                            extras: extras
                        });

                        jiguangUtil.SendMessageByUser.call(this, {
                            content: 'red port',
                            title: 'red port',
                            userId: registration_id,
                            extras: {
                                category: jpushConst.jpushType.MSG_RED_PORT,
                                num: 1
                            }
                        })
                    }
                }
            } catch (e) {
                this.ctx.logger.error(`cancelOrder addMessage error:${e.message};userId:${userId}`);
            }

            return ctx.body = response;
        } catch (e) {
            ctx.logger.error('cancelOrder > 系统错误,' + e.message);
            response.errMsg(e.message, code.ERROR_SYSTEM, 'ERROR_SYSTEM');
            return ctx.body = response;
        }
    }

    /**
     * 买家已支付
     * 只有卖家才有权限调用
     * @returns {Promise<void>}
     */
    async getUserPhone() {
        const {ctx} = this;
        let response = Response();
        try {
            let json = await this.ctx.checkToken();
            let userId = json.uid;
            let body = this.ctx.request.body;
            console.log("orderIdorderId:", body.orderId)
            let RuleErrors = this.ctx.Rulevalidate(orderRule.getUserPhone, body);
            if (RuleErrors != undefined) {
                let errors = RuleErrors[0];
                response.errMsg(this.ctx.I18nMsg(I18nConst.VerifyFailed) + errors.field + " " + errors.message, code.ERROR_PARAMS, 'ERROR_PARAMS');
                return ctx.body = response;
            }
            let orderId = body.orderId;


            let order = await this.ctx.service.order.findOneOtcOrder({order_id: orderId});
            if (!order) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.NoSuchOrder3), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }
            /*if (order.vendor_user_id != userId) {
                response.errMsg('只有卖家才能联系', code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }*/

            if (order.status != 2) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.OnlyTheBuyerHasPermissionInThePaidState), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }

            let puid = 0;
            if (userId == order.vendor_user_id) {
                puid = order.vendee_user_id;
            } else {
                puid = order.vendor_user_id
            }

            let user = await this.ctx.service.user.getUserByUid(puid);
            if (!user) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.UserDoesNotExist), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }

            let phone = user.phone;
            response.content.data = {
                phone: phone
            };
            return ctx.body = response;
        } catch (e) {
            ctx.logger.error('getUserPhone > 系统错误,' + e.message);
            response.errMsg(e.message, code.ERROR_SYSTEM, 'ERROR_SYSTEM');
            return ctx.body = response;
        }
    }

    /**
     * 卖家申诉
     * 前置条件
     * 买家已支付
     * 必须是卖家
     * @returns {Promise<void>}
     */
    async orderAppeal() {
        const {ctx} = this;
        let response = Response();
        try {
            let json = await this.ctx.checkToken();
            let userId = json.uid;
            let body = this.ctx.request.body;

            let RuleErrors = this.ctx.Rulevalidate(orderRule.orderAppeal, body);
            if (RuleErrors != undefined) {
                let errors = RuleErrors[0];
                response.errMsg(this.ctx.I18nMsg(I18nConst.VerifyFailed) + errors.field + " " + errors.message, code.ERROR_PARAMS, 'ERROR_PARAMS');
                return ctx.body = response;
            }
            let orderId = body.orderId;

            let order = await this.ctx.service.order.findOneOtcOrder({order_id: orderId});
            if (!order) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.NoSuchOrder3), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }

            if (userId == order.vendee_user_id && order.status == 0) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.CanNotAppealYet), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }

            if (order.status == 1 || order.status == 4) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.CanNotAppealYet), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }

            //是否申诉过
            let isOrderAppeal = await this.ctx.service.order.isOrderAppeal(orderId, userId, order.vendor_user_id, order.vendee_user_id);

            if (isOrderAppeal) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.Appealed), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }


            let params = {};

            let otcConf = await this.ctx.service.home.findOneOtcConf();
            let sendUserID = 0;
            //卖家
            if (userId == order.vendor_user_id) {
                sendUserID = order.vendee_user_id;
                let appeal_overtime = otcConf.appeal_overtime ? otcConf.appeal_overtime : 0;
                let dt = moment(order.buy_order_time).add(appeal_overtime, 's').format('YYYY-MM-DD HH:mm:ss');
                let t = new Date(dt).getTime();

                let appealTempNum = parseInt((t - new Date().getTime()) / 1000);
                if (appealTempNum < 0) {
                    appealTempNum = 0;
                }

                if (appealTempNum > 0) {
                    response.errMsg(this.ctx.I18nMsg(I18nConst.UserCannotAppealUntil), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                    return ctx.body = response;
                }

                params.order_id = orderId;
                params.appeal_time = dateUtil.currentDate();
                params.vendor_cause = body.cause;
                params.vendor_voucher = body.voucher;
            } else if (userId == order.vendee_user_id) {//买家
                sendUserID = order.vendor_user_id;
                let vendee_appeal_overtime = otcConf.vendee_appeal_overtime ? otcConf.vendee_appeal_overtime : 0;
                let dt = moment(order.buy_order_time).add(vendee_appeal_overtime, 's').format('YYYY-MM-DD HH:mm:ss');
                let t = new Date(dt).getTime();

                let appealTempNum = parseInt((t - new Date().getTime()) / 1000);
                if (appealTempNum < 0) {
                    appealTempNum = 0;
                }

                if (appealTempNum > 0) {
                    response.errMsg(this.ctx.I18nMsg(I18nConst.UserCannotAppealUntil), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                    return ctx.body = response;
                }

                params.order_id = orderId;
                params.up_voucher_time = dateUtil.currentDate();
                params.vendee_remark = body.cause;
                params.vendee_voucher = body.voucher;
            } else {
                response.errMsg(this.ctx.I18nMsg(I18nConst.IncorrectData), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }
            ctx.getLogger('recordLogger').info("OTC orderAppeal >> " + JSON.stringify(params));
            let as = await this.ctx.service.order.orderAppeal(params);
            if (!as) {
                response.errMsg('系统异常，上传凭证失败', code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }
            try {
                if (userId == order.vendor_user_id) {
                    const userInfo = await ctx.service.user.getUserByUid(order.vendee_user_id);
                    if (userInfo) {
                        let phone = userInfo.phone;
                        let phone_area_code = userInfo.phone_area_code;
                        if (phone) {
                            /* let smsParams = {
                                 phone: phone,
                                 smsType: 2,
                                 phoneAreaCode: phone_area_code,
                                 templateParam: {
                                     "orderId": orderId
                                 }
                             };
                             aliyunUtil.SendSms.call(this, smsParams);*/
                            let smsParams = {
                                phone: phone,
                                msg: `您的订单${orderId}对方已申诉，您也可以申诉并上传交易凭证，请耐心等待客服处理。`
                            }
                            sms253Util.SendSms.call(this, smsParams);
                        }
                    }
                }

                /**
                 * 推送
                 */


                let sendTitle = "申诉";
                let sendContent = `您的订单:${orderId}对方已申诉，您也可以申诉并上传交易凭证，请耐心等待客服处理`;

                let msgParams = {
                    title: sendTitle,
                    content: sendContent,
                    user_id: sendUserID,
                    relevance_id: orderId,
                    msg_category: jpushConst.jpushType.BASE_OTC,
                    msg_route: jpushConst.jpushType.OTC_DETAILS
                };
                let res = await this.ctx.service.user.addMessage(msgParams);
                if (res && res.insertId) {
                    let message_id = res.insertId;
                    let jiguangReg = await this.ctx.service.user.findOneJiguangRegistrationid({user_id: sendUserID});
                    if (jiguangReg) {
                        let registration_id = jiguangReg.registration_id;
                        let extras = commonUtil.getExtras(jpushConst.jpushType.OTC_DETAILS, orderId, message_id, true);
                        jiguangUtil.SendNotificationByUser.call(this, {
                            content: sendContent,
                            title: sendTitle,
                            userId: registration_id,
                            extras: extras
                        });

                        jiguangUtil.SendMessageByUser.call(this, {
                            content: sendContent,
                            title: sendTitle,
                            userId: registration_id,
                            extras: extras
                        });

                        jiguangUtil.SendMessageByUser.call(this, {
                            content: 'red port',
                            title: 'red port',
                            userId: registration_id,
                            extras: {
                                category: jpushConst.jpushType.MSG_RED_PORT,
                                num: 1
                            }
                        })
                    }
                }
            } catch (e) {
                this.ctx.logger.error(`orderAppeal addMessage error:${e.message};userId:${userId}`);
            }
            return ctx.body = response;
        } catch (e) {
            ctx.logger.error('orderAppeal > 系统错误,' + e.message);
            response.errMsg(e.message, code.ERROR_SYSTEM, 'ERROR_SYSTEM');
            return ctx.body = response;
        }
    }

    /**
     * 交易密码是否正确
     * 不是已完成或已取消状态
     * 只有卖家才能确认收款
     * 交易密码是否正确
     *
     * 卖家扣除币，扣除手续费
     * 买家收到币，扣除手续费
     * 生成手续费买卖双方纪录
     * 修改订单信息
     * 如果为卖单 修改 otc_user_frozen_balance 状态 status为0
     * 生成交易明细
     * @returns {Promise<Response|Object>}
     */
    async affirmProceeds() {
        const {ctx} = this;
        let response = Response();
        try {
            let json = await this.ctx.checkToken();
            let userId = json.uid;
            let body = this.ctx.request.body;

            let RuleErrors = this.ctx.Rulevalidate(orderRule.affirmProceeds, body);
            if (RuleErrors != undefined) {
                let errors = RuleErrors[0];
                response.errMsg(this.ctx.I18nMsg(I18nConst.VerifyFailed) + errors.field + " " + errors.message, code.ERROR_PARAMS, 'ERROR_PARAMS');
                return ctx.body = response;
            }
            let orderId = body.orderId;
            let transactionPassword = body.transactionPassword;

            let order = await this.ctx.service.order.findOneOtcOrder({order_id: orderId});

            let userInfo = await this.ctx.service.user.getUserByUid(userId);
            if (!userInfo) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.UserDoesNotExist), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }
            if (commonUtil.encrypt(commonUtil.decryptTranPWDByClient(transactionPassword, userId), userId) != userInfo.transaction_password) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.IncorrectPassword), code.ERROR_TPWD_ERR, 'ERROR_TPWD_ERR');
                return ctx.body = response;
            }
            if (!order) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.NoSuchOrder3), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }
            if (order.status == 0) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.Unpaid3), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }
            if (order.status == 1) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.TheOrderHasCompleted), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }
            if (order.status == 3) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.TheOrderHasAppealed), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }
            if (order.status == 4) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.TheOrderHasCancelled2), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }
            if (order.vendor_user_id != userId) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.OnlySellerCanConfirmCollection), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }

            let entrustOrder = await this.ctx.service.home.findOneOtcEntrustOrder({key_id: order.entrust_order_id});
            if (!entrustOrder) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.NoSuchOrder), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }

            let coinType = entrustOrder.coin_type;

            let userBalance = await ctx.service.user.findOneUserBalance({user_id: userId, coin_type: coinType});
            if (!userBalance) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.InsufficientBalance), code.ERROR_PARAMS, 'ERROR_PARAMS');
                return this.ctx.body = response;
            }

            //可用资产
            let usableCoin = commonUtil.bigNumberMinus(userBalance.balance, userBalance.frozen_balance, this.app.config.decimalPoint.v6);

            let quantity = order.quantity;

            let vendee_service_charge_coin = commonUtil.bigNumberMultipliedBy(quantity, entrustOrder.vendee_service_charge, this.app.config.decimalPoint.v6);

            let vendor_total_amount = parseFloat(quantity.toFixed(this.app.config.decimalPoint.v6));

            let vendee_total_amount = commonUtil.bigNumberMinus(quantity, vendee_service_charge_coin, this.app.config.decimalPoint.v6);


            if (usableCoin < vendor_total_amount) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.InsufficientBalance), code.ERROR_PARAMS, 'ERROR_PARAMS');
                return this.ctx.body = response;
            }

            let coin_type = entrustOrder.coin_type;
            let params = {
                vendee_user_id: order.vendee_user_id,                 //买方ID
                vendor_user_id: userId,                               //卖方ID
                vendor_service_charge_coin: 0,
                vendee_service_charge_coin: vendee_service_charge_coin,
                vendor_total_amount: vendor_total_amount,
                vendee_total_amount: vendee_total_amount,
                send_coin_time: dateUtil.currentDate(),                //发币时间
                coin_type: coin_type,
                order_id: order.order_id,
                entrust_order_id: entrustOrder.key_id,
                entrust_type: entrustOrder.entrust_type,
                quantity: quantity,
                order_type: order.order_type,
                _quantity_left: entrustOrder.quantity_left,
                _min: entrustOrder.min,
                _user_id: entrustOrder.user_id,
                _vendor_service_charge: 0
            };
            ctx.getLogger('recordLogger').info("OTC affirmProceeds >> " + JSON.stringify(params));
            let us = await this.ctx.service.order.affirmProceeds(params);
            if (!us) {
                response.errMsg('收款失败', code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            } else if (us == -1) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.FrequentOperation), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return this.ctx.body = response;
            }
            try {
                if (order.order_type == 1) {
                    const userInfo = await ctx.service.user.getUserByUid(order.vendee_user_id);
                    if (userInfo) {
                        let phone = userInfo.phone;
                        let phone_area_code = userInfo.phone_area_code;
                        if (phone) {
                            /* let smsParams = {
                                 phone: phone,
                                 smsType: 3,
                                 phoneAreaCode: phone_area_code,
                                 templateParam: {
                                     "orderId": orderId
                                 }
                             };
                             aliyunUtil.SendSms.call(this, smsParams);*/
                            let smsParams = {
                                phone: phone,
                                msg: `您的订单${orderId}对方已确认收款，交易完成，请您及时查收。`
                            };
                            sms253Util.SendSms.call(this, smsParams);
                        }
                    }
                }

                /**
                 * 推送
                 */

                let sendUserID = order.vendee_user_id;
                let sendTitle = "对方已确认";
                let sendContent = `您的订单: ${orderId}对方已确认收款并放币，${quantity}个${coin_type}-CNY，总价${order.total_amount}元，请您及时查收`;

                let msgParams = {
                    title: sendTitle,
                    content: sendContent,
                    user_id: sendUserID,
                    relevance_id: orderId,
                    msg_category: jpushConst.jpushType.BASE_OTC,
                    msg_route: jpushConst.jpushType.OTC_DETAILS
                };
                let res = await this.ctx.service.user.addMessage(msgParams);
                if (res && res.insertId) {
                    let message_id = res.insertId;
                    let jiguangReg = await this.ctx.service.user.findOneJiguangRegistrationid({user_id: sendUserID});
                    if (jiguangReg) {
                        let registration_id = jiguangReg.registration_id;
                        let extras = commonUtil.getExtras(jpushConst.jpushType.OTC_DETAILS, orderId, message_id, true);
                        jiguangUtil.SendNotificationByUser.call(this, {
                            content: sendContent,
                            title: sendTitle,
                            userId: registration_id,
                            extras: extras
                        });

                        jiguangUtil.SendMessageByUser.call(this, {
                            content: sendContent,
                            title: sendTitle,
                            userId: registration_id,
                            extras: extras
                        });

                        jiguangUtil.SendMessageByUser.call(this, {
                            content: 'red port',
                            title: 'red port',
                            userId: registration_id,
                            extras: {
                                category: jpushConst.jpushType.MSG_RED_PORT,
                                num: 1
                            }
                        })
                    }
                }
            } catch (e) {
                this.ctx.logger.error(`affirmProceeds addMessage error:${e.message};userId:${userId}`);
            }
            return ctx.body = response;
        } catch (e) {
            ctx.logger.error('affirmProceeds > 系统错误,' + e.message);
            response.errMsg(e.message, code.ERROR_SYSTEM, 'ERROR_SYSTEM');
            return ctx.body = response;
        }
    }

    async test() {
        /*let smsParams = {
            phone: '15618788747',
            templateCodeId: this.app.config.aliYun.zh.TemplateCodeOTC1,
            templateParam: {
                "orderId": '123'
            }
        };
        let re = await aliyunUtil.SendSms.call(this, smsParams);*/
        this.ctx.getLogger('recordLogger').info("OTC affirmProceeds >> " + JSON.stringify({su: 'ok'}));
        this.ctx.body = 'ok';
    }


}

module.exports = OrderController;
