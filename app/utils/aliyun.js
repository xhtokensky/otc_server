const Core = require('@alicloud/pop-core');

exports.SendSms = async function ({phone, templateParam, phoneAreaCode = '86', smsType}) {
    try {
        let client = new Core({
            accessKeyId: this.app.config.aliYun.AccessKeyID,
            accessKeySecret: this.app.config.aliYun.AccessKeySecret,
            endpoint: 'https://dysmsapi.aliyuncs.com',
            apiVersion: '2017-05-25'
        });

        let params = {
            "PhoneNumbers": phone,
            "SignName": this.app.config.aliYun.CommonSignName,
            "TemplateCode": '',
            "TemplateParam": JSON.stringify(templateParam)
        };


        if (phoneAreaCode && phoneAreaCode != '86') {
            params.PhoneNumbers = phoneAreaCode + phone;
        }

        if (smsType == 1) {
            let tid = this.app.config.aliYun.CN.TemplateCodeOTC1;
            if (phoneAreaCode != '86') {
                if (this.app.config.aliYun.US.TemplateCodeOTC1) {
                    tid = this.app.config.aliYun.US.TemplateCodeOTC1;
                }
            }
            params.TemplateCode = tid;
        } else if (smsType == 2) {
            let tid = this.app.config.aliYun.CN.TemplateCodeOTC2;
            if (phoneAreaCode != '86') {
                if (this.app.config.aliYun.US.TemplateCodeOTC2) {
                    tid = this.app.config.aliYun.US.TemplateCodeOTC2;
                }
            }
            params.TemplateCode = tid;

        } else if (smsType == 3) {
            let tid = this.app.config.aliYun.CN.TemplateCodeOTC3;
            if (phoneAreaCode != '86') {
                if (this.app.config.aliYun.US.TemplateCodeOTC3) {
                    tid = this.app.config.aliYun.US.TemplateCodeOTC3;
                }
            }
            params.TemplateCode = tid;
        }

        let requestOption = {
            method: 'POST'
        };

        let result = await client.request('SendSms', params, requestOption);
        return result;
    } catch (e) {
        this.ctx.logger.error('aliyun sendSms error ', e.message);
        console.error('aliyun sendSms error ', e.message);
        return {};
    }
};


