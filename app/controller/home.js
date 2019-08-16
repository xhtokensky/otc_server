'use strict';

const code = require("../utils/code");
const Controller = require('egg').Controller;
let Response = require('./../utils/resObj');
let commonUtil = require('./../utils/commonUtil');
let dateUtil = require('./../utils/dateUtil');
let qiniuUtil = require('./../utils/qiniu');
const homeRule = require("./rule/home");
const BigNumber = require('bignumber.js');
const moment = require('moment');
const I18nConst = require('./../../config/constant/i18n');

class HomeController extends Controller {


    async getOtcConf() {
        const {ctx} = this;
        let response = Response();
        try {
            let otcConf = await this.ctx.service.home.findOneOtcConf();
            response.content.data = otcConf;
            return this.ctx.body = response;
        } catch (e) {
            ctx.logger.error('getOtcConf > 系统错误,' + e.message);
            response.errMsg(this.ctx.I18nMsg(I18nConst.SystemError) + e.message, code.ERROR_SYSTEM, 'ERROR_SYSTEM');
            return this.ctx.body = response;
        }
    }

    async verifyPayway() {
        const {ctx} = this;
        let response = Response();
        try {
            let json = await this.ctx.checkToken();
            let userId = json.uid;
            let body = this.ctx.request.body;
            let type = body.pay_type;
            if (type != 1 && type != 2 && type != 3) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.IllegalCollectionType), code.ERROR_PARAMS, 'ERROR_PARAMS');
                return this.ctx.body = response;
            }
            let payWay = await this.ctx.service.home.verifyPayWay(userId, [type]);
            if (!payWay.success) {
                response.errMsg(payWay.msg, payWay.code, payWay.type);
                return this.ctx.body = response;
            }
            return this.ctx.body = response;
        } catch (e) {
            ctx.logger.error('verifyPayway > 系统错误,' + e.message);
            response.errMsg(this.ctx.I18nMsg(I18nConst.SystemError) + e.message, code.ERROR_SYSTEM, 'ERROR_SYSTEM');
            return this.ctx.body = response;
        }
    }


    /**
     * 验证参数
     * @param userId
     * @param body
     * @param otcConf
     * @returns {Promise<*>}
     * @private
     */
    async __verifyEntrustParams(userId, body, otcConf) {
        let RuleErrors = this.ctx.Rulevalidate(homeRule.buyinEntrust, body);
        if (RuleErrors != undefined) {
            let errors = RuleErrors[0];
            return {
                success: false,
                msg: this.ctx.I18nMsg(I18nConst.VerifyFailed) + errors.field + " " + errors.message,
                code: code.ERROR_PARAMS,
                type: 'ERROR_PARAMS'
            }
        }
        /**
         * number转换
         */
        let b_unitPrice = new BigNumber(body.unitPrice);
        body.unitPrice = parseFloat(b_unitPrice.toFixed(this.app.config.decimalPoint.v2));
        let b_quantity = new BigNumber(body.quantity);
        body.quantity = parseFloat(b_quantity.toFixed(this.app.config.decimalPoint.v6));

        let b_min = new BigNumber(body.min);
        body.min = parseFloat(b_min.toFixed(this.app.config.decimalPoint.v6));

        let b_max = new BigNumber(body.max);
        body.max = parseFloat(b_max.toFixed(this.app.config.decimalPoint.v6));

        if (body.quantity <= 0) {
            return {
                success: false,
                msg: this.ctx.I18nMsg(I18nConst.IlegalParameters),
                code: code.ERROR_PARAMS,
                type: 'ERROR_PARAMS'
            };
        }

        if (!otcConf) {
            return {
                success: false,
                msg: this.ctx.I18nMsg(I18nConst.SyetemErrorNotOtcConfig),
                code: code.ERROR_PARAMS,
                type: 'ERROR_PARAMS'
            };
        }
        this.ctx.logger.error(`min:${body.min},orders_min_quota:${otcConf.orders_min_quota};max:${body.max},orders_max_quota:${otcConf.orders_max_quota}`);
        if (body.min < otcConf.orders_min_quota) {
            return {
                success: false,
                msg: this.ctx.I18nMsg(I18nConst.IncorrectLimit),
                code: code.ERROR_PARAMS,
                type: 'ERROR_PARAMS'
            };
        }
        if (body.max > otcConf.orders_max_quota) {
            return {
                success: false,
                msg: this.ctx.I18nMsg(I18nConst.IncorrectLimit),
                code: code.ERROR_PARAMS,
                type: 'ERROR_PARAMS'
            };
        }

        if (body.min <= 0 || body.max <= 0) {
            return {
                success: false,
                msg: this.ctx.I18nMsg(I18nConst.IncorrectLimit),
                code: code.ERROR_PARAMS,
                type: 'ERROR_PARAMS'
            };
        }

        if (body.min > body.max) {
            return {
                success: false,
                msg: this.ctx.I18nMsg(I18nConst.IncorrectLimit),
                code: code.ERROR_PARAMS,
                type: 'ERROR_PARAMS'
            };
        }

        if (body.max > body.quantity) {
            return {
                success: false,
                msg: this.ctx.I18nMsg(I18nConst.IncorrectLimit),
                code: code.ERROR_PARAMS,
                type: 'ERROR_PARAMS'
            };
        }
        return {
            success: true
        }
    }


    /**
     * 验证前置逻辑
     * @param userId
     * @param body
     * @returns {Promise<*>}
     * @private
     */
    async __verifyEntrustPrepositionLogic(userId, body, otcConf, entrustType) {

        //是否完成身份认证
        let realAuth = await this.ctx.service.home.verifyRealAuth(userId);
        if (!realAuth.success) {
            return {
                success: false,
                msg: realAuth.msg,
                code: realAuth.code,
                type: realAuth.type
            };
        }

        //是否有设置收款方式
        let types = body.payType;
        if (!types) {
            return {
                success: false,
                msg: this.ctx.I18nMsg(I18nConst.PleaseSelectCollectionType),
                code: code.ERROR_PARAMS,
                type: 'ERROR_PARAMS'
            };
        }
        let typesArray = types.split(',');
        let tf = true;
        for (let i = 0; i < typesArray.length; i++) {
            if (typesArray[i] != 1 && typesArray[i] != 2 && typesArray[i] != 3) {
                tf = false;
            }
        }
        if (!tf) {
            return {
                success: false,
                msg: this.ctx.I18nMsg(I18nConst.IllegalCollectionType),
                code: code.ERROR_PARAMS,
                type: 'ERROR_PARAMS'
            };
        }

        if (entrustType == 2) {
            let payWay = await this.ctx.service.home.verifyPayWay(userId, typesArray);
            if (!payWay.success) {
                return {
                    success: false,
                    msg: payWay.msg,
                    code: payWay.code,
                    type: payWay.type
                };
            }
        }
        //是否设置交易密码
        const userInfo = await this.ctx.service.user.getUserByUid(userId);
        if (!userInfo.transaction_password) {
            return {
                success: false,
                msg: this.ctx.I18nMsg(I18nConst.PleaseSetTransactionPassword),
                code: code.ERROR_SET_PWD,
                type: 'ERROR_SET_PWD'
            };
        }


        if (commonUtil.encrypt(commonUtil.decryptTranPWDByClient(body.transactionPassword, userId), userId) != userInfo.transaction_password) {
            return {
                success: false,
                msg: this.ctx.I18nMsg(I18nConst.IncorrectPassword),
                code: code.ERROR_PARAMS,
                type: 'ERROR_PARAMS'
            };
        }

        if (!userInfo.level || userInfo.level < 3) {
            return {
                success: false,
                msg: this.ctx.I18nMsg(I18nConst.Vip),
                code: code.ERROR_PARAMS,
                type: 'ERROR_PARAMS'
            };
        }
        const isOTCInfo = await this.ctx.service.home.isOTC(userId, userInfo.phone, otcConf.cancel_number);
        if (!isOTCInfo.success) {
            return ctx.body = {
                code: isOTCInfo.code,
                type: isOTCInfo.type,
                msg: isOTCInfo.msg
            }
        }

        return {
            success: true
        }
    }

    /**
     * 买入委托
     *
     *
     * @returns {Promise<Response|Object>}
     */
    async buyinEntrust() {
        const {ctx} = this;
        let response = Response();
        try {

            let json = await this.ctx.checkToken();
            let userId = json.uid;

            let body = this.ctx.request.body;


            let otcConf = await this.ctx.service.home.findOneOtcConf();

            let verifyEntrustParamsResult = await this.__verifyEntrustParams(userId, body, otcConf);
            if (!verifyEntrustParamsResult.success) {
                response.errMsg(verifyEntrustParamsResult.msg, verifyEntrustParamsResult.code, verifyEntrustParamsResult.type);
                return this.ctx.body = response;
            }

            let verifyEntrustPrepositionLogicResult = await this.__verifyEntrustPrepositionLogic(userId, body, otcConf, 1);
            if (!verifyEntrustPrepositionLogicResult.success) {
                response.errMsg(verifyEntrustPrepositionLogicResult.msg, verifyEntrustPrepositionLogicResult.code, verifyEntrustPrepositionLogicResult.type);
                return this.ctx.body = response;
            }

            let params = {
                entrust_type: 1,
                user_id: userId,
                unit_price: body.unitPrice,
                coin_type: body.coinType,
                quantity: body.quantity,
                quantity_left: body.quantity,
                min: body.min,
                max: body.max,
                pay_type: body.payType,
                vendee_service_charge: otcConf.buyer_cost ? otcConf.buyer_cost : 0,
                vendor_service_charge: otcConf.seller_cost ? otcConf.seller_cost : 0,
                push_time: dateUtil.currentDate(),
                status: 1
            };
            ctx.getLogger('recordLogger').info("OTC buyinEntrust >> " + JSON.stringify(params));
            const addStatus = await ctx.service.home.addOtcEntrustOrder(params);
            if (!addStatus) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.AddFailed), code.ERROR_ADD_DATA, 'ERROR_ADD_DATA');
                return this.ctx.body = response;
            }
            return this.ctx.body = response;
        } catch (e) {
            ctx.logger.error('buyinEntrust > 系统错误,' + e.message);
            response.errMsg(this.ctx.I18nMsg(I18nConst.SystemError) + e.message, code.ERROR_SYSTEM, 'ERROR_SYSTEM');
            return this.ctx.body = response;
        }
    }


    /**
     * 验证卖出委托前置验证
     * @returns {Promise<void>}
     */
    async buyoutEntrustVerify() {
        const {ctx} = this;
        let response = Response();
        try {
            let json = await this.ctx.checkToken();
            let userId = json.uid;

            let body = this.ctx.request.body;

            let otcConf = await this.ctx.service.home.findOneOtcConf();


            let verifyEntrustParamsResult = await this.__verifyEntrustParams(userId, body, otcConf);
            if (!verifyEntrustParamsResult.success) {
                response.errMsg(verifyEntrustParamsResult.msg, verifyEntrustParamsResult.code, verifyEntrustParamsResult.type);
                return ctx.body = response;
            }

            let verifyEntrustPrepositionLogicResult = await this.__verifyEntrustPrepositionLogic(userId, body, otcConf, 2);
            if (!verifyEntrustPrepositionLogicResult.success) {
                response.errMsg(verifyEntrustPrepositionLogicResult.msg, verifyEntrustPrepositionLogicResult.code, verifyEntrustPrepositionLogicResult.type);
                return ctx.body = response;
            }

            return ctx.body = response;

        } catch (e) {
            ctx.logger.error('buyoutEntrustVerify > 系统错误,' + e.message);
            response.errMsg(this.ctx.I18nMsg(I18nConst.SystemError) + e.message, code.ERROR_SYSTEM, 'ERROR_SYSTEM');
            return ctx.body = response;
        }
    }

    async verifyPaywayAndRealAuth() {
        let response = Response();
        let {ctx} = this;
        try {
            let json = await this.ctx.checkToken();
            let userId = json.uid;
            let body = this.ctx.request.body;
            let keyId = body.keyId;
            let entrustType = body.entrustType;//1买 2卖
            if (!keyId || !entrustType) {
                response.errMsg('keyId or entrustType is empty', code.ERROR_PARAMS, 'ERROR_PARAMS');
                return ctx.body = response;
            }
            //是否完成身份认证
            let realAuth = await this.ctx.service.home.verifyRealAuth(userId);
            if (!realAuth.success) {
                response.errMsg(realAuth.msg, realAuth.code, realAuth.type);
                return ctx.body = response;
            }

            if (entrustType == 2) {
                //是否设置收款方式
                const verifyPayWay = await ctx.service.home.verifyPayWay(userId);
                if (!verifyPayWay.success) {
                    response.errMsg(verifyPayWay.msg, verifyPayWay.code, verifyPayWay.type);
                    return ctx.body = response;
                }

                //买家是否支持您的收款方式
                let entrustOrder = await ctx.service.home.findOneOtcEntrustOrder({key_id: keyId});
                if (!entrustOrder) {
                    response.errMsg(this.ctx.I18nMsg(I18nConst.NoSuchOrder), code.ERROR_PARAMS, 'ERROR_PARAMS');
                    return ctx.body = response;
                }
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
            }

            return ctx.body = response;

        } catch (e) {
            console.error(`verifyPaywayAndRealAuth error : ${e.message}`);
            ctx.logger.error(`verifyPaywayAndRealAuth error : ${e.message}`);
            response.errMsg(e.message, code.ERROR_SYSTEM, 'ERROR_SYSTEM');
            return ctx.body = response;
        }
    }

    /**
     * 挂单--发布卖出委托单
     *
     * 卖出委托单
     * 金额是否足够
     * 是否满足otc配置条件
     * 前置验证
     * 冻结金额
     * @returns {Promise<Response|Object>}
     */
    async buyoutEntrust() {
        const {ctx} = this;
        let response = Response();
        try {

            let json = await this.ctx.checkToken();
            let userId = json.uid;

            let body = this.ctx.request.body;

            this.ctx.logger.error(`buyoutEntrust body: ${JSON.stringify(body)}`)
            let coinType = body.coinType;
            let otcConf = await this.ctx.service.home.findOneOtcConf();


            let verifyEntrustParamsResult = await this.__verifyEntrustParams(userId, body, otcConf);
            if (!verifyEntrustParamsResult.success) {
                response.errMsg(verifyEntrustParamsResult.msg, verifyEntrustParamsResult.code, verifyEntrustParamsResult.type);
                return ctx.body = response;
            }

            let verifyEntrustPrepositionLogicResult = await this.__verifyEntrustPrepositionLogic(userId, body, otcConf, 2);
            if (!verifyEntrustPrepositionLogicResult.success) {
                response.errMsg(verifyEntrustPrepositionLogicResult.msg, verifyEntrustPrepositionLogicResult.code, verifyEntrustPrepositionLogicResult.type);
                return ctx.body = response;
            }

            let transactionPassword = body.transactionPassword;
            if (!transactionPassword) {
                response.errMsg('require transactionPassword ', code.ERROR_PARAMS, 'ERROR_PARAMS');
                return this.ctx.body = response;
            }

            let userInfo = await this.ctx.service.user.getUserByUid(userId);
            if (!userInfo) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.UserDoesNotExist), code.ERROR_PARAMS, 'ERROR_PARAMS');
                return this.ctx.body = response;
            }

            //判断货币是否足够
            let userBalance = await ctx.service.user.findOneUserBalance({user_id: userId, coin_type: coinType});
            if (!userBalance) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.InsufficientBalance), code.ERROR_PARAMS, 'ERROR_PARAMS');
                return this.ctx.body = response;
            }
            let usableCoin = commonUtil.bigNumberMinus(userBalance.balance, userBalance.frozen_balance);

            if (usableCoin < body.quantity) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.InsufficientBalance), code.ERROR_PARAMS, 'ERROR_PARAMS');
                return this.ctx.body = response;
            }


            let params = {
                entrust_type: 2,
                user_id: userId,
                unit_price: body.unitPrice,
                quantity: body.quantity,
                quantity_left: body.quantity,
                min: body.min,
                max: body.max,
                pay_type: body.payType,
                vendee_service_charge: otcConf.buyer_cost ? otcConf.buyer_cost : 0,
                vendor_service_charge: otcConf.seller_cost ? otcConf.seller_cost : 0,
                push_time: dateUtil.currentDate(),
                status: 1,
                frozen_balance: body.quantity,
                service_charge_balance: 0,
                coin_type: coinType

            };
            ctx.getLogger('recordLogger').info("OTC buyoutEntrust >> " + JSON.stringify(params));
            let addStatus = await this.ctx.service.home.createOtcEntrustOrderBuyout(params);
            if (!addStatus) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.AddFailed), code.ERROR_ADD_DATA, 'ERROR_ADD_DATA');
                return this.ctx.body = response;
            } else if (addStatus == -1) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.FrequentOperation), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return this.ctx.body = response;
            }
            return this.ctx.body = response;
        } catch (e) {
            ctx.logger.error('buyoutEntrust > 系统错误,' + e.message);
            response.errMsg(this.ctx.I18nMsg(I18nConst.SystemError) + e.message, code.ERROR_SYSTEM, 'ERROR_SYSTEM');
            return ctx.body = response;
        }
    }

    /**
     * 取消委托单
     *
     * * 如果此委托单有正在进行的订单不能取消
     * 设置已冻结的金额
     * 更改委托单状态
     * @returns {Promise<void>}
     */
    async cancelEntrust() {
        const {ctx} = this;
        let response = Response();
        try {
            let json = await this.ctx.checkToken();
            let userId = json.uid;

            let body = this.ctx.request.body;
            let RuleErrors = this.ctx.Rulevalidate(homeRule.cancelEntrust, body);
            if (RuleErrors != undefined) {
                let errors = RuleErrors[0];
                response.errMsg(this.ctx.I18nMsg(I18nConst.VerifyFailed) + errors.field + " " + errors.message, code.ERROR_PARAMS, 'ERROR_PARAMS');
                return ctx.body = response;
            }
            let entrustOrderId = body.entrustOrderId;
            /* const isCancelEntrust = await ctx.service.home.isCancelEntrust(entrustOrderId);
             if (!isCancelEntrust) {
                 response.errMsg(this.ctx.I18nMsg(I18nConst.OrderProgress), code.ERROR_PARAMS, 'ERROR_PARAMS');
                 return ctx.body = response;
             }*/
            let entrustOrder = await ctx.service.home.findOneOtcEntrustOrder({key_id: entrustOrderId});
            if (!entrustOrder) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.NoSuchOrder), code.ERROR_PARAMS, 'ERROR_PARAMS');
                return ctx.body = response;
            }
            if (entrustOrder.status != 1) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.NoSuchOrder2), code.ERROR_PARAMS, 'ERROR_PARAMS');
                return ctx.body = response;
            }
            if (entrustOrder.user_id != userId) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.YouCanNotCancelThisOrder), code.ERROR_PARAMS, 'ERROR_PARAMS');
                return ctx.body = response;
            }

            let frozen_balance = 0;

            if (entrustOrder.entrust_type == 2) {
                let userFrozenBalance = await ctx.service.home.findOneUserFrozenBalance({
                    relevance_id: entrustOrder.key_id,
                    type: 1,
                    status: 1
                });
                if (!userFrozenBalance) {
                    response.errMsg('no such userFrozenBalance', code.ERROR_PARAMS, 'ERROR_PARAMS');
                    return ctx.body = response;
                }
                frozen_balance = userFrozenBalance.frozen_balance;
            }


            let params = {
                entrust_order_id: entrustOrderId,
                cancel_time: dateUtil.currentDate(),
                entrust_type: entrustOrder.entrust_type,
                user_id: entrustOrder.user_id,
                coin_type: entrustOrder.coin_type,
                curSumCoin: frozen_balance
            };
            ctx.getLogger('recordLogger').info("OTC cancelEntrust >> " + JSON.stringify(params));
            let us = await this.ctx.service.home.cancelEntrust(params);
            if (!us) {
                this.ctx.logger.error(`cancelEntrust error:us:`, us);
                response.errMsg(this.ctx.I18nMsg(I18nConst.SystemError), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            } else if (us == -1) {
                response.errMsg(this.ctx.I18nMsg(I18nConst.FrequentOperation), code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }
            return ctx.body = response;
        } catch (e) {
            ctx.logger.error('cancelEntrust > 系统错误,' + e.message);
            response.errMsg(this.ctx.I18nMsg(I18nConst.SystemError) + e.message, code.ERROR_SYSTEM, 'ERROR_SYSTEM');
            return ctx.body = response;
        }
    }

    async getBuyinEntrust() {
        //1发布中 2已完成 0已取消 3系统自动取消
        const {ctx} = this;
        let response = Response();
        try {
            let coinType = ctx.query.coinType;

            const result = await ctx.service.home.getOtcEntrustOrderList(2, coinType);//1买单 2卖单
            for (let i = 0; i < result.length; i++) {
                let rateObj = await ctx.service.home.getEntrustOrderRateForUser(result[i].user_id);
                result[i].sum_count = rateObj.sumCount;
                result[i].rate = rateObj.rate;
                result[i].head_img = qiniuUtil.getSignAfterUrl(result[i].head_img, this.app.config.qiniuConfig);
            }
            response.content.data = result;
            return ctx.body = response;
        } catch (e) {
            ctx.logger.error('getBuyinEntrust > 系统错误,' + e.message);
            response.errMsg(this.ctx.I18nMsg(I18nConst.SystemError) + e.message, code.ERROR_SYSTEM, 'ERROR_SYSTEM');
            return ctx.body = response;
        }
    }

    async getBuyoutEntrust() {
        const {ctx} = this;
        let response = Response();
        try {
            let coinType = ctx.query.coinType;
            const result = await ctx.service.home.getOtcEntrustOrderList(1, coinType);//1买单 2卖单
            for (let i = 0; i < result.length; i++) {
                let rateObj = await ctx.service.home.getEntrustOrderRateForUser(result[i].user_id);
                result[i].sum_count = rateObj.sumCount;
                result[i].rate = rateObj.rate;
                result[i].head_img = qiniuUtil.getSignAfterUrl(result[i].head_img, this.app.config.qiniuConfig);
            }
            response.content.data = result;
            return ctx.body = response;
        } catch (e) {
            ctx.logger.error('getBuyoutEntrust > 系统错误,' + e.message);
            response.errMsg(this.ctx.I18nMsg(I18nConst.SystemError) + e.message, code.ERROR_SYSTEM, 'ERROR_SYSTEM');
            return ctx.body = response;
        }
    }

    async getMyEntrust() {
        const {ctx} = this;
        let response = Response();
        try {
            let query = this.ctx.query;
            let index = query.pageIndex || 1;
            let pageSize = query.pageSize ? query.pageSize : 20;
            let pageIndex = (index - 1) * pageSize;
            if (pageSize > 20) {
                pageSize = 20;
            }
            let json = await this.ctx.checkToken();
            let userId = json.uid;
            let coinType = ctx.query.coinType;
            const result = await ctx.service.home.getMyEntrustList(userId, coinType, pageIndex, pageSize);
            if (result.length > 0) {
                for (let i = 0; i < result.length; i++) {
                    if (result[i].quantity_left < result[i].min) {
                        const isCancelEntrust = await ctx.service.home.isCancelEntrust(result[i].key_id);
                        if (isCancelEntrust) {
                            result.splice(i, 1);
                        }
                    }
                    if (result[i]) {
                        let entrust_type_text = '';
                        if (result[i].entrust_type == 1) {
                            entrust_type_text = this.ctx.I18nMsg(I18nConst.Buy)
                        } else if (result[i].entrust_type == 2) {
                            entrust_type_text = this.ctx.I18nMsg(I18nConst.Sell)
                        }
                        result[i].entrust_type_text = entrust_type_text;

                        result[i].push_time = dateUtil.format(new Date(result[i].push_time))
                    }

                }
            }
            let count = await ctx.service.home.getMyEntrustCount(userId, coinType);
            response.content.currentPage = index;
            response.content.totalPage = count;
            response.content.data = result;
            return ctx.body = response;

        } catch (e) {
            ctx.logger.error('getMyEntrust > 系统错误,' + e.message);
            response.errMsg(this.ctx.I18nMsg(I18nConst.SystemError) + e.message, code.ERROR_SYSTEM, 'ERROR_SYSTEM');
            return ctx.body = response;
        }
    }

    async getCoinList() {
        const {ctx} = this;
        let response = Response();
        try {
            const result = await ctx.service.home.getCoinList();
            response.content.data = result;
            return ctx.body = response;
        } catch (e) {
            ctx.logger.error('getCoinList > 系统错误,' + e.message);
            response.errMsg(this.ctx.I18nMsg(I18nConst.SystemError) + e.message, code.ERROR_SYSTEM, 'ERROR_SYSTEM');
            return ctx.body = response;
        }
    }


    async test() {
        let jiguang = require('./../utils/jiguang');

        let d = await jiguang.SendNotificationByUser.call(this, {
            content: "hkshfksdhk",
            userId: "191e35f7e031c6333e0",
            title: "标题",
            extras: {
                "category": "OTC",
                "msg_route": "otcDetails",
                "id": "191e35f7e031c6333e0",
                "message_id": "message_id"
            }
        });

        this.ctx.body = d;
    }


    async test2() {
        let jiguang = require('./../utils/jiguang');

        let d = await jiguang.SendMessageByUser.call(this, {
            content: 'test',
            title: 'test',
            contentType: 'OTC',
            userId: '101d8559093e046ca12',
            extras: {type: "OTC"}
        })
        this.ctx.body = d;
    }

    async test3() {

        let jiguang = require('./../utils/jiguang');
        let msgObj = await jiguang.ImSendMessage.call(this, {
            targetId: 1001,
            fromId: 1002,
            message: 'test msg',
            roomId: 1,
            createdAt: dateUtil.formatDate(),
            chatRecordId: 1
        });
        this.ctx.body = msgObj;
    }

    async test4 (){
        let sms253Utils = require('./../utils/sms253');
        let params = {
            phone:'15614015231',
            msg:'你的订单号是190716151514740187383'
        };
        let result = await sms253Utils.SendSms.call(this,params);
        console.log(result)
        return this.ctx.body = result;
    }


}

module.exports = HomeController;
