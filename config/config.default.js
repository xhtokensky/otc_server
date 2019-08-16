/* eslint valid-jsdoc: "off" */

'use strict';
const path = require('path');

/**
 * @param {Egg.EggAppInfo} appInfo app info
 */
module.exports = appInfo => {
    /**
     * built-in config
     * @type {Egg.EggAppConfig}
     **/
    const config = exports = {};

    // use for cookie sign key, should change to your own and keep security
    config.keys = appInfo.name + '_1559020927731_7683';

    // add your middleware config here
    config.middleware = [];

    // add your user config here
    const userConfig = {
        // myAppName: 'egg',
    };

    // 配置mysql
    config.mysql = {
        clients: {
            TokenskyAvatarDB: {
                // 数据库名
                host: "118.31.121.239",//"127.0.0.1",
                user: "root",
                password: "root",
                database: 'tokensky',
            },
        },
        // 所有数据库配置的默认值
        default: {
            // host
            host: '127.0.0.1', // 54.179.154.12 139.224.115.73 172.31.21.72
            // 端口号
            port: '3306',
        },

        // 是否加载到 app 上，默认开启
        app: true,
        // 是否加载到 agent 上，默认关闭
        agent: false,
    };

    config.customLogger = {
        recordLogger: {
            file: path.join(appInfo.root, `logs/${appInfo.name}/info-record.log`)
        },
    };

    config.decimalPoint = {
        v2: 2,
        v6: 6
    };


    exports.security = {
        csrf: false
    };

    config.jiguang = {
        key: '9a11d6ce355150887087d0ca',
        secret: 'af4025100bbfc437e3df1726',
        sign_id: "7395",
        temp_id: "160654",
        temp_para_id: "160654",
        temp_para_login: "160654"
    };

    config.aliYun = {
        AppCode: "f9952ee8582742089a91867c84632d5d",
        AccessKeyID: "LTAI3oWNLw75Xqro",
        AccessKeySecret: "Jes3Hv329jAaxsC8m2adCrERAR9LZq",
        SignName: "TokenSky",
        CommonSignName: "深圳市融璟云科技有限公司",
        CN: {
            TemplateCodeLogin: "SMS_166980172",//登录模版
            TemplateCodeUpdate: "SMS_166980168",//修改信息模版
            TemplateCodeOTC1: "SMS_168305872",//用户卖币-对方打款
            TemplateCodeOTC2: "SMS_168310821",//用户买币-对方申诉
            TemplateCodeOTC3: "SMS_168310813",//用户买币-对方放币
        },
        US: {
            TemplateCodeLogin: "SMS_168345176",//登录模版 //国际
        }
    };


    config.sms253 = {
        Account:'N5332314',
        Password:'dzHv4iDfn',
        SignName:'【Tokensky】'
    };


    config.qiniuConfig = {
        bucketName: "test1",
        accessKey: 'gPoNjxfS1qvYnbMjccy-UbOzvviIIeOSu5xqCPa7',
        secretKey: "_hcWP1rxzAYaa75KSQGFZulSqbGzTisv4j79vmTx",
        qiniuServer: 'http://test2.hardrole.com/'
    };


    config.assetsUrl = 'http://118.31.121.239:8888/balance/one';
    config.assetsUrlMulti = 'http://118.31.121.239:8888/balance/multi';


    return {
        ...config,
        ...userConfig,
    };
};
