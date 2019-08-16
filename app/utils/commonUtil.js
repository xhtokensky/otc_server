"use strict";
const crypto = require('crypto');
const BigNumber = require('bignumber.js');
var CryptoJS = require("crypto-js");
/*
exports.encrypt = function (params, key) {
    var cipher = crypto.createCipher('aes-256-cbc', 'tokenKeyabcd1234');
    var crypted = cipher.update(params.toString(), 'utf8', 'hex');
    crypted += cipher.final('hex');
    return crypted;
};


exports.decrypt = function (params, key) {
    var decipher = crypto.createDecipher('aes-256-cbc', 'tokenKeyabcd1234');
    var dec = decipher.update(params, 'hex', 'utf8');
    dec += decipher.final('utf8');
    return dec;
};*/

/**
 * 服务端内部加密
 * @param message
 * @param key
 * @returns {string}
 */
exports.encrypt = function (message, key) {
    if(!message){
        return '';
    }
    let iv = [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d,
        0x0e, 0x0f];
    let md5 = crypto.createHash('md5').update('tokensky_' + key + "_tranpwd").digest('hex');
    const cipher = crypto.createCipheriv(
        'aes-128-cbc',
        new Buffer(md5, 'hex'),
        new Buffer(iv)
    );
    var encrypted = cipher.update(message, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;
};

/**
 * 服务端内部解密
 * @param message
 * @param key
 */
exports.decrypt = function (message, key) {
    if(!message){
        return '';
    }
    let iv = [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d,
        0x0e, 0x0f];
    let md5 = crypto.createHash('md5').update('tokensky_' + key + "_tranpwd").digest('hex');
    const decipher = crypto.createDecipheriv(
        'aes-128-cbc',
        new Buffer(md5, 'hex'),
        new Buffer(iv)
    );
    var decrypted = decipher.update(message, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
};

/**
 * 客户端交易密码解密
 * @param message
 */
exports.decryptTranPWDByClient = function (message, key) {
    message = decodeURIComponent(message);
    var bytes  = CryptoJS.AES.decrypt(message.toString(), '2019tokensky'+key);
    var plaintext = bytes.toString(CryptoJS.enc.Utf8);
    return plaintext;
};


/**
 * 订单生成规则  年(后2位)月日十分秒毫秒+业务码+5位随机数
 * 业务码：00(OTC买入) 01(OTC卖出) 02(购买算力合约) 03(充币) 04(提币) 05(发放合约收益)
 */
exports.orderId = function (code) {
    if (!code) {
        return null;
    }
    const date = new Date();
    const year = date.getFullYear();
    let month = date.getMonth() + 1;
    if (month < 10) month = `0${month}`;
    let day = date.getDate();
    if (day < 10) day = `0${day}`;
    const hours = date.getHours();
    const minute = date.getMinutes();
    const secound = date.getSeconds();
    const millisecond = date.getMilliseconds();
    let numberDate = `${year}${month}${day}${hours}${minute}${secound}${millisecond}`;
    numberDate = numberDate.substring(2, numberDate.length);


    let rand = Math.floor(Math.random() * 90000) + 10000;

    return numberDate + code + rand;
};

/**
 * 加
 * @param x
 * @param y
 * @returns {number}
 */
exports.bigNumberPlus = function (x, y, n) {
    let a = new BigNumber(x);
    let b = new BigNumber(y);
    let c = a.plus(b);
    c = c.toNumber();
    if (n) {
        c = c.toFixed(n);
        c = parseFloat(c);
    }
    return c;
};

/**
 * 减
 * @param x
 * @param y
 * @returns {number}
 */
exports.bigNumberMinus = function (x, y, n) {
    let a = new BigNumber(x);
    a = a.minus(y);
    a = a.toNumber();
    if (n) {
        a = a.toFixed(n);
        a = parseFloat(a);
    }
    return a;
};

/**
 * 乘
 * @param x
 * @param y
 * @returns {number}
 */
exports.bigNumberMultipliedBy = function (x, y, n) {
    let a = new BigNumber(x);
    let b = a.multipliedBy(y);
    b = b.toNumber();
    if (n) {
        b = b.toFixed(n);
        b = parseFloat(b);
    }
    return b;
};

/**
 * 除
 * @param x
 * @param y
 * @returns {number}
 */
exports.bigNumberDiv = function (x, y, n) {
    let a = new BigNumber(x);
    a = a.div(y);
    a = a.toNumber();
    if (n) {
        a = a.toFixed(n);
        a = parseFloat(a);
    }
    return a;
};


exports.getExtras = function (route, order_id, message_id, go_view) {
    let res = {};
    res.category = 'otc';
    res.msg_route = route;
    res.id = order_id;
    res.message_id = message_id;
    /*res.go_view = go_view;*/
    return res;
};
