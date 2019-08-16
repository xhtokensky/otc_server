const JPush = require("jpush-async").JPushAsync;
let client = null;
const rp = require('request-promise');


exports.__init = async function () {
    let key = this.config.jiguang.key;
    let secret = this.config.jiguang.secret;
    if (!client) {
        client = await JPush.buildClient(key, secret);
    }
};


/**
 * 通知 所有用户
 * @returns {Promise<void>}
 * @constructor
 */
exports.SendNotificationAll = async function ({content, title, extras}) {
    try {
        let result = await client.push().setPlatform(JPush.ALL)
            .setAudience(JPush.ALL)
            .setNotification(
                JPush.android(content, title, 1, extras),
                JPush.ios({title: title, body: content}, 'sound', 1, true, extras),
                JPush.winphone(content, title, '', extras))
            .setOptions(null, null, null, true)
            .send();
        return {success: true, result: result};
    } catch (e) {
        console.error(`SendNotificationAll error: ${e.message}`);
        this.ctx.logger.error(`SendNotificationAll error: ${e.message}`);
        return {success: false, result: {}};
    }
};

/**
 * 通知 单个用户
 * @returns {Promise<void>}
 * @constructor
 */
exports.SendNotificationByUser = async function ({content, title, userId, extras}) {
    try {
        let result = await client.push().setPlatform(JPush.ALL)
            .setAudience(JPush.registration_id(userId))
            .setNotification(
                JPush.android(content, title, 1, extras),
                JPush.ios({title: title, body: content}, 'sound', 1, true, extras),
                JPush.winphone(content, title, '', extras))
            .setOptions(null, null, null, true)
            .send();
        return {success: true, result: result};
    } catch (e) {
        console.error(`SendNotificationByUser error: ${e.message}`);
        this.ctx.logger.error(`SendNotificationByUser error: ${e.message}`);
        return {success: false, result: {}};
    }
};

/**
 * 自定义消息  全部
 * @returns {Promise<void>}
 * @constructor
 */
exports.SendMessageAll = async function ({content, title, contentType, extras}) {
    try {
        let result = await client.push().setPlatform(JPush.ALL)
            .setAudience(JPush.ALL)
            .setMessage(content, title, contentType, extras)
            .setOptions(null, null, null, true)
            .send();
        return {success: true, result: result};
    } catch (e) {
        console.error(`SendMessageAll error: ${e.message}`);
        this.ctx.logger.error(`SendMessageAll error: ${e.message}`);
        return {success: false, result: {}};
    }
};


/**
 * 自定义消息  个人
 * @returns {Promise<void>}
 * @constructor
 */
exports.SendMessageByUser = async function ({userId, content, title, contentType, extras}) {
    try {
        let result = await client.push().setPlatform(JPush.ALL)
            .setAudience(JPush.registration_id(userId))
            .setMessage(content, title, contentType, extras)
            .setOptions(null, null, null, true)
            .send();
        return {success: true, result: result};
    } catch (e) {
        console.error(`SendMessageByUser error: ${e.message}`);
        this.ctx.logger.error(`SendMessageByUser error: ${e.message}`);
        return {success: false, result: {}};
    }
};


let __getSign = function () {
    const base64Str = new Buffer(`${this.app.config.jiguang.key}:${this.app.config.jiguang.secret}`).toString('base64');
    return `Basic ${base64Str}`;
};


/**
 * im聊天发送消息
 * @param targetId
 * @param fromId
 * @param message
 * @param roomId
 * @returns {Promise<*>}
 * @constructor
 */
exports.ImSendMessage = async function ({targetId, fromId, message, roomId, chatRecordId, createdAt}) {
    try {
        const options = {
            method: 'POST',
            json: true,
            url: 'https://api.im.jpush.cn/v1/messages',
            body:
                {
                    "version": 1,
                    "target_type": "single",
                    "target_id": `User${targetId}`,
                    "from_type": 'user',
                    "from_id": `User${fromId}`,
                    "msg_type": "text",
                    "msg_body": {
                        "extras": {
                            type: 'OTC-IM'
                        },
                        "text": JSON.stringify({
                            text: message,
                            roomId: roomId,
                            _id: chatRecordId,
                            createdAt: createdAt,
                            fromUserId: fromId
                        })
                    }
                },////"text": '123'//JSON.stringify({message: message, roomId: roomId, chatRecordId: chatRecordId})
            headers:
                {
                    Authorization: __getSign.call(this),
                    "Content-Type": "application/json;charset=UTF-8"
                }
        };
        console.log(options)
        let body = await rp(options);
        console.log('ImSendMessage:', body);
        if (body) {
            return body;
        }
        return null;
    } catch (e) {
        console.error(`ImSendMessage error:${e.message}`);
        this.ctx.logger.error(`ImSendMessage error:${e.message}`);
        return null;
    }
};


exports.getImUserStat = async function ({targetId}) {
    try {
        const options = {
            method: 'GET',
            url: `https://api.im.jpush.cn/v1/users/User${targetId}/userstat`,
            headers:
                {
                    Authorization: __getSign.call(this),
                    "Content-Type": "application/json;charset=UTF-8"
                }
        };
        let body = await rp(options);
        if (!body) {
            return null;
        }
        if (body.online) {
            return true;
        }
        return false;
    } catch (e) {
        console.error(`getImUserStat error:${e.message}`);
        this.ctx.logger.error(`getImUserStat error:${e.message}`);
        return null;
    }
};
