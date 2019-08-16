'use strict';
const Service = require('egg').Service;
const code = require("../utils/code");
const table = require('../../config/constant/table');
const dbName = table.TokenskyAvatarDB;

class UserService extends Service {


    /**
     * 通过用户ID获取用户信息
     * @param {*Int M} userId
     */
    async getUserByUid(userId) {
        let sql = `SELECT yu.*, yut.token
            FROM ${table.TOKENSKY_USER} AS yu
            LEFT JOIN ${table.TOKENSKY_USER_TOKEN} AS yut
            ON yut.user_id=yu.user_id
            WHERE yu.user_id = ?`;
        let userInfo = await this.app.mysql.get(dbName).query(sql, [userId]);
        if (userInfo.length < 1) {
            return null
        }
        return userInfo[0]
    }

    /**
     * 获取用户总资产
     * @param userId
     * @param coinType
     * @returns {Promise<*>}
     */
    async getSumUserProperty(userId, coinType) {
        let sql = `select sum(balance) balance from ${table.TOKENSKY_USER} u,${table.TOKENSKY_USER_BALANCE} up where u.user_id=up.user_id and u.user_id = ? and up.coin_type = ? `;
        let info = await this.app.mysql.get(dbName).query(sql, [userId, coinType]);
        if (info.length < 1) {
            return 0
        }
        return info[0].balance;
    }

    async findOneAccountBank(params) {
        let obj = await await this.app.mysql.get(dbName).get(table.TOKENSKY_ACCOUNT_BANK, params);
        return obj;
    }


    async findOneRoleBlack(balckType, phone) {
        let sql = `select * from ${table.ROLE_BLACK_LIST} where balck_type = ? and phone=? order by end_time desc `;
        let result = await this.app.mysql.get(dbName).query(sql, [balckType, phone]);
        if (result.length < 1) {
            return null;
        }
        return result[0];
    }

    async findOneUserBalance(params) {
        let sql = `select * from ${table.TOKENSKY_USER_BALANCE} where user_id = ? and coin_type = ? `;
        let result = await this.app.mysql.get(dbName).query(sql, [params.user_id, params.coin_type]);
        if (result.length < 1) {
            return null;
        }
        return result[0];
    }

    async findOneJiguangRegistrationid(where) {
        let obj = await this.app.mysql.get(dbName).get(table.TOKENSKY_JIGUANG_REGISTRATIONID, where);
        return obj;
    }

    async addMessage(params) {
        params.system = 1;
        params.type = 1;
        let result = await this.app.mysql.get(dbName).insert(table.TOKENSKY_MESSAGE, params);
        return result;
    }
}


module.exports = UserService;
