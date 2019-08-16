let sms253Utils = require('../app/utils/sms253');


let send = async function () {
    let params = {
      phone:'15618788747',
        msg:'你的订单号是190716151514740187383'
    };
    let result = await sms253Utils.SendSms(params);
    console.log(result)
};



send()
