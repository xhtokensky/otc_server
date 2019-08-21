// this 就是 ctx 对象，在其中可以调用 ctx 上的其他方法，或访问属性
const Parameter = require('parameter');
const Check = new Parameter();
const fs = require('fs');
const uuidv1 = require('uuid/v1');
var BigNumber = require('bignumber.js');
const i18nEnUs = require('../../config/locale/en-US');
const i18nZhCn = require('../../config/locale/zh-CN');
module.exports = {
    /**
     * 验证参数规则
     * @param {*Obj M} createRule
     * @param {*Obj O} body  默认 this.request.body
     */
    Rulevalidate(createRule,body) {
        // 默认request的body
        if (body == undefined) {
            body = this.request.body
        }
        const errors = Check.validate(createRule, body);
        // const errors = Check.validate(createRule, this.decryptBody());
        return  errors;
    },
    async sleep(t) {
        let st = 1000 * 5;
        if (t) {
            st = t;
        }
        return new Promise(function (resolve, reject) {
            setTimeout(function () {
                resolve('ok');
            }, st);
        })
    },

    I18nMsg(code) {
        console.error('i18n:',this.header.i18n);
        let headerI18n = this.header.i18n || 'zh-CN';
        if (headerI18n === 'en-US') {
            return i18nEnUs[code];
        } else {
            return i18nZhCn[code];
        }
    },

    /**
     * 验证设备注册来源
     * @param {*String M} deviceType
     */
    validateDeviceType(deviceType) {
        switch(deviceType) {
            case "IOS" :
            return true
            case "AND" :
            return true
            case "WEB" :
            return true
            default:
            return false
        }
    },
    /**
    * 获取token
    * @return {*json}
    */
   async checkToken()
   {
       //console.error('token:',this.header.token)
       let headerToken = this.header.token;
       if (headerToken == undefined){
           return false
       }
       let objectToken = headerToken.split('.');
       if (objectToken.length < 2){
           return false
       }
       let tokenInfo = objectToken[1];
       //通过登录状态获取token的中间部分
       let token = new Buffer(tokenInfo,"base64");//base64反解
       token = token.toString();
       let json = JSON.parse(token)
       return json;
   },
   /**
    * 检测token有效性
    * @param {*string} headerToken
    * @return {*boolean}
    */
   async checkTokenVisiable()
   {
       let json = await this.checkToken(this.header.token);
       if (json == false){
           return false
       }
       let expTime = json.exp*1000;
       if (expTime < Date.now()){
           return false
       }else{
           return true
       }
   },
   /**
    * 检测token是否存在
    */
   async tokenIsExist() {
    let headerToken = this.header.token;
    if (headerToken == undefined){
        return false
    }
    let objectToken = headerToken.split(' ');
    if (objectToken.length < 2){
        return false
    }
    let token = objectToken[1];
     let count = await this.service.c2c.userTokenService.tokenIsExist(token)
     if (count > 0) {
         return true
     }
     return false
   },
   /**
    * 封装文件上传
    */
   async uploadFile() {
    const parts = this.multipart();
    let part;
    let result = [];
    while ((part = await parts()) != null) {
      if (part.length) {
        // arrays are busboy fields
        console.log('field: ' + part[0]);
        console.log('value: ' + part[1]);
        console.log('valueTruncated: ' + part[2]);
        console.log('fieldnameTruncated: ' + part[3]);
      } else {
        if (!part.filename) {
          // user click `upload` before choose a file,
          // `part` will be file stream, but `part.filename` is empty
          // must handler this, such as log error.
          return;
        }
        // otherwise, it's a stream
        // console.log('field: ' + part.fieldname);
        // console.log('filename: ' + part.filename);
        // console.log('encoding: ' + part.encoding);
        // console.log('mime: ' + part.mime);

        try {
          // 转换成buffer
          let buf = await this.stramToBuffer(part)
          let base64Data = buf.toString('base64')
        //   let path = 'app/upload/'+ part.filename;
            result.push({fieldname: part.fieldname, data: base64Data})
        //   result = await this.saveBase64Data(path,base64Data)
        } catch (err) {
          await sendToWormhole(part);
          throw err;
        }
      }
    }
    return result
   },
   /**
    * 存储图片
    * @param {*String M} path  存放的路径地址
    * @param {*String M} base64Data
    */
   saveBase64Data(path,base64Data){
        return new Promise((resolve,reject)=>{
            fs.writeFile(path, base64Data,'base64', function(err) {
                if(err){
                    reject(err);
                }else{
                    resolve(true)
                }
            });
        })
    },
    /**
     * stram to buffer
     * @param {*Binary} stream 二进制流
     */
    stramToBuffer(stream) {
        return new Promise((resolve, reject) => {
          let buffers = []
          stream.on('error',reject)
          stream.on('data', (data) => buffers.push(data))
          stream.on('end', () => resolve(Buffer.concat(buffers)))
        })
    },
    /**
     * 获取平台直接币的列表
     */
    async getPlatformSupportCurrency() {
        let coinList = await this.service.c2c.coinListService.getPlatformSupportCurrency()
        return coinList
    },
    // 生成uuid
    uuid() {
       return uuidv1();
    },
    // 价格计算 7,6,07.99亿
    async cnyToUsd(cnyString,usdPrice) {
        let moneyStr = cnyString.substring(1,cnyString.length-1)
        let uint = cnyString.substring(cnyString.length-1) // 单位
        let money = moneyStr.replace(/,/g,'') // 替换所有的逗号
        let bigMoney = new BigNumber(money)
        let priceList = await this.service.exchangeRate.getExchangeRateBySymbol("USDT")
        let cnyPrice = priceList[0].cny
        // 拿bignum计算
        switch(uint) {
            case "亿":
            bigMoney = bigMoney.multipliedBy(100000000)
            break
            case "万":
            bigMoney = bigMoney.multipliedBy(10000)
            break
            default:
            bigMoney = bigMoney.multipliedBy(1)
        }
        bigMoney = bigMoney.dividedBy(cnyPrice)
        return bigMoney.toString()
    }
};
