const _ = require('lodash');
const code = require("../utils/code");
const dateUtil = require("../utils/dateUtil");
module.exports = options => {
    //验证token是否失效
    return async function isAuthenticated(ctx, next) {

        // 检测token是否失效
        let tokenVisable = await ctx.checkTokenVisiable();
        if (!tokenVisable) {
            return ctx.body = {
                code: code.ERROR_TOKEN_OVERDUE,
                type: "ERROR_TOKEN_OVERDUE",
                msg: '重新登录 token已经过期'
            }
        }
        let json = await ctx.checkToken();
        let uid
        if (json !== false) {
            uid = json.uid;
        }
        const userInfo = await ctx.service.user.getUserByUid(uid);
        let authorization = ctx.header.token.split(' ')
        if (_.isEmpty(userInfo)) {
            return ctx.body = {
                code: code.ERROR_USER_NOTFOUND,
                type: "ERROR_USER_NOTFOUND",
                msg: '用户不存在'
            };
        } else if (userInfo.token == "") {
            return ctx.body = {
                code: code.ERROR_TOKEN_OVERDUE,
                type: "ERROR_TOKEN_OVERDUE",
                msg: '重新登录 token已经过期'
            }
        } else if (userInfo.token != authorization[0]) {//表示传过来的token不是原来的token
            return ctx.body = {
                code: code.ERROR_TOKEN_OVERDUE,
                type: "ERROR_TOKEN_OVERDUE",
                msg: '重新登录 token已经过期'
            }
        }

        let roleBlack = await ctx.service.user.findOneRoleBlack(1, userInfo.phone);
        if (roleBlack && new Date(roleBlack.end_time).getTime() > new Date().getTime()) {
            return ctx.body = {
                code: code.ERROR_USER_BLACK,
                type: "ERROR_USER_BLACK",
                msg: `账号已被禁止登录,将于${dateUtil.format(roleBlack.end_time)}解除`
            }
        }
        await next();
    };
}
