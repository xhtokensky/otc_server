'use strict';
const Service = require('egg').Service;
const table = require('../../config/constant/table');
const dbName = table.TokenskyAvatarDB;
const moment = require('moment');

class ChatService extends Service {


    async getChatList(userId) {
        let sql = `select cr.*,o.buy_order_time,o.status,o.vendor_user_id,o.vendee_user_id from tokensky_otc_chat_room cr,otc_order o where cr.order_id=o.order_id and cr.create_time>=? and (cr.user_id=? or cr.user_id2=?) order by cr.create_time desc `;
        let _D = moment().subtract(7, 'days');
        let _SD = moment(_D).format('YYYY-MM-DD');
        let result = await this.app.mysql.get(dbName).query(sql, [_SD, userId, userId]);
        return result;
    }

    async redPort(userId) {
        let sql = `select count(*) as  count from tokensky_otc_chat_record where to_user_id=? and status=? `;
        let result = await this.app.mysql.get(dbName).query(sql, [userId, 0]);
        return result[0].count ? result[0].count : 0;
    }

    async addOtcChatRecord(params) {
        let result = await this.app.mysql.get(dbName).insert(table.TOKENSKY_OTC_CHAT_RECORD, params);
        if (result.affectedRows == 0) {
            return false;
        }
        return result.insertId;
    }

    async findOneOtcChatRoom(params) {
        let obj = await await this.app.mysql.get(dbName).get(table.TOKENSKY_OTC_CHAT_ROOM, params);
        return obj;
    }

    async getChatMessageList({roomId, pageIndex, pageSize}) {
        let sql = `select * from ${table.TOKENSKY_OTC_CHAT_RECORD} where order_id=? order by send_time desc limit ?,? `;
        let result = await this.app.mysql.get(dbName).query(sql, [roomId, parseInt(pageIndex), parseInt(pageSize)]);
        return result;
    }

    async getChatMessageCount({roomId}) {
        let sql = `select count(*) count from ${table.TOKENSKY_OTC_CHAT_RECORD} where order_id=? `;
        let result = await this.app.mysql.get(dbName).query(sql, [roomId]);
        return result[0].count ? result[0].count : 0;
    }

    async updateOtcChatRecord(updateObj, whereObj) {
        let updateStatus = await this.app.mysql.get(dbName).update(table.TOKENSKY_OTC_CHAT_RECORD, updateObj, {where: whereObj});
        if (updateStatus.affectedRows > 0) {
            return true;
        }
        return false;
    }


    async findOneOrder(orderId) {
        let sql = `
                    SELECT
                        oe.coin_type,
                        oe.money_type,
                        o.buy_order_time,
                        o.order_type,
                        o.unit_price,
                        o.total_amount,
                        o.quantity,
                        o.order_id,
                        o.\`status\`
                    FROM
                        otc_entrust_order oe,
                        otc_order o
                    WHERE
                        oe.key_id = o.entrust_order_id
                        and o.order_id =?
                  `;
        let result = await this.app.mysql.get(dbName).query(sql, [orderId]);
        return result[0];
    }

    async getFirstMessage(orderId, userId) {
        let sql = `select * from tokensky_otc_chat_record where order_id=? and (from_user_id=? or to_user_id=?) order by send_time desc limit 1 `;
        let result = await this.app.mysql.get(dbName).query(sql, [orderId, userId, userId]);
        return result[0];
    }

}


module.exports = ChatService;
