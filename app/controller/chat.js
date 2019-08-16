'use strict';
const code = require("../utils/code");
const Controller = require('egg').Controller;
let Response = require('./../utils/resObj');
let commonUtil = require('./../utils/commonUtil');
let dateUtil = require('./../utils/dateUtil');
let jiguangUtil = require('./../utils/jiguang');
let qiniuUtil = require('./../utils/qiniu');
let chatRule = require('./rule/chat');
const I18nConst = require('./../../config/constant/i18n');

class ChatController extends Controller {


    async chatList() {
        let {ctx} = this;
        let response = Response();
        try {
            let json = await this.ctx.checkToken();
            let userId = json.uid;

            let body = this.ctx.request.body;

            let data = await ctx.service.chat.getChatList(userId);

            for (let i = 0; i < data.length; i++) {
                data[i].to_user_id = 0;
                if (userId != data[i].user_id) {
                    let user = await ctx.service.user.getUserByUid(data[i].user_id);
                    data[i].user_id = data[i].user_id;
                    if (user) {
                        data[i].avatar = user.head_img ? qiniuUtil.getSignAfterUrl(user.head_img, this.app.config.qiniuConfig) : '';
                        data[i].nick_name = user.nick_name;
                    }
                } else if (userId != data[i].user_id2) {
                    let user = await ctx.service.user.getUserByUid(data[i].user_id2);
                    data[i].user_id = data[i].user_id2;
                    if (user) {
                        data[i].avatar = user.head_img ? qiniuUtil.getSignAfterUrl(user.head_img, this.app.config.qiniuConfig) : '';
                        data[i].nick_name = user.nick_name;
                    }
                }
            }

            let result = [];
            for (let j = 0; j < data.length; j++) {
                let fmsg = await this.ctx.service.chat.getFirstMessage(data[j].order_id, userId);
                let msg = '';
                if (fmsg) {
                    msg = fmsg.content;
                }
                let orderUser = '';
                if (userId == data[j].vendee_user_id) {
                    orderUser = 'vendee'
                } else if (userId == data[j].vendor_user_id) {
                    orderUser = 'vendor'
                }
                result.push({
                    room_id: data[j].order_id,
                    avatar: data[j].avatar,
                    nick_name: data[j].nick_name,
                    msg: msg,
                    time: data[j].buy_order_time ? dateUtil.format(data[j].buy_order_time) : '',
                    order: {
                        user: orderUser,
                        status: data[j].status,
                        order_id: data[j].order_id
                    }
                })
            }

            response.content.data = result;


            return ctx.body = response;

        } catch (e) {
            console.error(`chatList error:${e.message}`);
            ctx.logger.error(`chatList error:${e.message}`);
            response.errMsg(e.message, code.ERROR_SYSTEM, 'ERROR_SYSTEM');
            return ctx.body = response;
        }
    }


    async sendMessage() {
        let {ctx} = this;
        let response = Response();
        let body = ctx.request.body;
        try {
            let content = body.content;
            //let orderId = body.orderId;
            let json = await this.ctx.checkToken();
            let userId = json.uid;
            let roomId = body.roomId;
            //let targetId = body.targetId;
            //let fromId = body.fromId;
            let RuleErrors = this.ctx.Rulevalidate(chatRule.sendMessage, body);
            if (RuleErrors != undefined) {
                let errors = RuleErrors[0];
                response.errMsg(errors.field + " " + errors.message, code.ERROR_PARAMS, 'ERROR_PARAMS');
                return ctx.body = response;
            }
            let room = await this.ctx.service.chat.findOneOtcChatRoom({order_id: roomId});
            if (!room) {
                response.errMsg('no such room', code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }
            let orderId = room.order_id;
            let targetId = '';
            if (userId != room.user_id) {
                targetId = room.user_id;
            } else if (userId != room.user_id2) {
                targetId = room.user_id2;
            }
            if (!targetId) {
                response.errMsg('no such targetId', code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }


            let chatRecordParams = {
                from_user_id: userId,
                to_user_id: targetId,
                order_id: orderId,
                content: content,
                room_id: roomId,
                status: 0
            };

            let insertId = await this.ctx.service.chat.addOtcChatRecord(chatRecordParams);
            if (!insertId) {
                response.errMsg('发送失败', code.ERROR_SYSTEM, 'ERROR_SYSTEM');
                return ctx.body = response;
            }
            let msgObj = await jiguangUtil.ImSendMessage.call(this, {
                targetId: targetId,
                fromId: userId,
                message: content,
                roomId: roomId,
                createdAt: dateUtil.formatDate(),
                chatRecordId: insertId
            });
            //let msg_id = msgObj.msg_id;

            let resObject = {
                _id: insertId,
                fromUserId: userId,
                createdAt: dateUtil.formatDate(),
                text: content
            };
            response.content.data = resObject;
            return ctx.body = response;
        } catch (e) {
            console.error(`sendMessage error:${e.message}`);
            this.ctx.logger.error(`sendMessage error:${e.message}`);
            response.errMsg(e.message, code.ERROR_SYSTEM, 'ERROR_SYSTEM');
            return ctx.body = response;
        }
    }


    async getChatMessageList() {
        let {ctx} = this;
        let roomId = ctx.query.roomId;
        let response = Response();
        try {
            if (!roomId) {
                response.errMsg('roomId require', code.ERROR_PARAMS, 'ERROR_PARAMS');
                return ctx.body = response;
            }
            let json = await this.ctx.checkToken();
            let userId = json.uid;
            let query = this.ctx.query;
            let index = query.pageIndex || 1;
            let pageSize = query.pageSize ? query.pageSize : 20;
            let pageIndex = (index - 1) * pageSize;
            if (pageSize > 20) {
                pageSize = 20;
            }

            let room = await ctx.service.chat.findOneOtcChatRoom({order_id: roomId});

            let targetId = '';
            let title_name = '';
            if (room) {
                if (userId != room.user_id) {
                    targetId = room.user_id;
                } else if (userId != room.user_id2) {
                    targetId = room.user_id2;
                }
                let user = await ctx.service.user.getUserByUid(targetId);
                if (user) {
                    title_name = user.nick_name;
                }
            }

            let data = await ctx.service.chat.getChatMessageList({roomId, pageIndex, pageSize});
            let count = await ctx.service.chat.getChatMessageCount({roomId});
            let result = [];
            for (let i = 0; i < data.length; i++) {
                let o = {
                    _id: data[i].id,
                    createdAt: data[i].send_time ? dateUtil.formatDate(data[i].send_time) : '',
                    text: data[i].content,
                    room_id: data[i].room_id,
                    from_user_avatar: '',
                    from_user_id: data[i].from_user_id,
                    to_user_avatar: ''
                };
                /* let fromuser = await ctx.service.user.getUserByUid(data[i].from_user_id);
                 if (fromuser) {
                     o.from_user_avatar = fromuser.head_img ? qiniuUtil.getSignAfterUrl(fromuser.head_img) : '';
                     o.from_user_nick_name = fromuser.nick_name;
                 }
                 let touser = await ctx.service.user.getUserByUid(data[i].to_user_id);
                 if (touser) {
                     o.to_user_avatar = touser.head_img ? qiniuUtil.getSignAfterUrl(touser.head_img) : '';
                     o.to_user_nick_name = touser.nick_name;
                 }*/
                result.push(o);
            }

            let order = await this.ctx.service.chat.findOneOrder(roomId);
            if (order && order.buy_order_time) {
                order.buy_order_time = dateUtil.format(order.buy_order_time);
            }


            result.sort(function (a, b) {
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            });

            response.content.data = result;
            response.content.currentPage = index;
            response.content.totalPage = count;
            response.content.order = order;
            response.content.title = title_name;
            return ctx.body = response;
        } catch (e) {
            console.error(`getMessageList error:${e.message}`);
            this.ctx.logger.error(`getMessageList error:${e.message}`);
            response.errMsg(e.message, code.ERROR_SYSTEM, 'ERROR_SYSTEM');
            return ctx.body = response;
        }
    }

    async readMessage() {
        let {ctx} = this;
        let chatRecordId = ctx.query.chatRecordId;
        let response = Response();
        try {
            if (chatRecordId) {
                await ctx.service.chat.updateOtcChatRecord({status: 1}, {id: chatRecordId});
            }
            return ctx.body = response;
        } catch (e) {
            console.error(`readMessage error:${e.message}`);
            this.ctx.logger.error(`readMessage error:${e.message}`);
            response.errMsg(e.message, code.ERROR_SYSTEM, 'ERROR_SYSTEM');
            return ctx.body = response;
        }
    }


    async redPort() {
        let {ctx} = this;
        let response = Response();
        try {
            let json = await this.ctx.checkToken();
            let userId = json.uid;

            let redProt = await this.ctx.service.chat.redPort(userId);

            response.content.redProt = redProt;

            return this.ctx.body = response;

        } catch (e) {
            console.error(`redPort error:${e.message}`);
            this.ctx.logger.error(`redPort error:${e.message}`);
            response.errMsg(e.message, code.ERROR_SYSTEM, 'ERROR_SYSTEM');
            return ctx.body = response;
        }

    }


}


module.exports = ChatController;
