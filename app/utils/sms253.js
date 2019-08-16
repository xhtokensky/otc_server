"use strict";

const rp = require('request-promise');

exports.SendSms = async function ({phone, phoneAreaCode, msg}) {

    try {
        let config = this.app.config.sms253;
        const options = {
            timeout: 5000,
            method: 'POST',
            json: true,
            url: 'http://smssh1.253.com/msg/send/json',
            body: {
                account: config.Account,
                password: config.Password,
                msg: config.SignName + msg,
                report: 'false',
                phone: phone
            },
            headers:
                {
                    'Content-Type': 'application/json; charset=UTF-8'
                }
        };

        let body = await rp(options);

        if (body.code == 0) {
            return true;
        } else {
            this.ctx.logger.error(`sms 253 send sms error:`, body);
            return false;
        }
    } catch (e) {
        this.ctx.logger.error(`sms 253 send sms error::`, e.message);
    }

};
