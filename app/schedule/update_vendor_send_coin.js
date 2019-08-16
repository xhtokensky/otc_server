const dateUtil = require('../utils/dateUtil');
module.exports = {
    schedule: {
        interval: '2s', // 1 分钟间隔
        type: 'worker', // 指定所有的 worker 都需要执行
    },
    async task(ctx) {
        try {
            /**
             * 卖加自动放币
             *
             * 已支付  状态 2
             */
           /* let otcConf = await ctx.service.home.findOneOtcConf();
            if (!otcConf) {
                console.error('no such otcconf');
                return;
            }
            let seller_overtime = otcConf.seller_overtime;
            //获取需要取消的订单
            let data = await ctx.service.order.queryOrderList(seller_overtime, 2);
            for (let i = 0; i < data.length; i++) {
                let entrustOrder = await ctx.service.home.findOneOtcEntrustOrder({key_id: data[i].entrust_order_id});
                let vendor_service_charge_coin = (data[i].quantity * entrustOrder.vendor_service_charge).toFixed(6);//卖方手续费
                let vendee_service_charge_coin = (data[i].quantity * entrustOrder.vendee_service_charge).toFixed(6);//买方手续费
                let vendor_total_amount = (data[i].quantity + vendor_service_charge_coin).toFixed(6);
                let vendee_total_amount = (data[i].quantity - vendee_service_charge_coin).toFixed(6);

                let params = {
                    vendee_user_id: data[i].vendee_user_id,                 //买方ID
                    vendor_user_id: data[i].vendor_user_id,                               //卖方ID
                    vendor_service_charge_coin: vendor_service_charge_coin,
                    vendee_service_charge_coin: vendee_service_charge_coin,
                    vendor_total_amount: vendor_total_amount,
                    vendee_total_amount: vendee_total_amount,
                    send_coin_time: dateUtil.currentDate(),                //发币时间
                    coin_type: entrustOrder.coin_type,
                    order_id: data[i].order_id,
                    entrust_order_id: entrustOrder.key_id,
                    entrust_type: entrustOrder.entrust_type,
                    quantity: data[i].quantity,
                    order_type: data[i].order_type
                };

                let us = await ctx.service.order.affirmProceeds(params);
                if (!us) {
                    console.error('task >> update vendor send coin error ');
                    return
                }
            }
            return;*/
        } catch (e) {
            console.error('task >> update vendor send coin error :', e.message);
            return;
        }
    },
};
