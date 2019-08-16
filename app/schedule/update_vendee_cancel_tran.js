let dateUtil = require('../utils/dateUtil');
module.exports = {
    schedule: {
        interval: '2s', // 1 分钟间隔
        type: 'worker', // 指定所有的 worker 都需要执行
    },
    async task(ctx) {
        try {
            /**
             * 买家自动取消交易
             * 待支付状态 和 卖方申诉状态  0
             *
             * 更改订单信息
             * 更改otc_entrust_order中的quantity_left   需要加上订单中的quantity
             * 卖单 >> 修改otc_user_freeze_coin表中的 status为0
             * 卖单 >> tokensky_user_balance 表中的frozen_balance字段  frozen_balance=frozen_balance-?
             */

           /* let otcConf = await ctx.service.home.findOneOtcConf();
            if (!otcConf) {
                console.error('no such otcconf');
                return;
            }
            let buyer_overtime = otcConf.buyer_overtime;

            //获取需要取消的订单
            let data = await ctx.service.order.queryOrderList(buyer_overtime,0);

            for (let i = 0; i < data.length; i++) {
                let entrustOrder = await ctx.service.home.findOneOtcEntrustOrder({key_id: data[i].entrust_order_id});

                let service_charge_balance = (data[i].quantity * entrustOrder.seller_cost).toFixed(6);

                let params = {
                    status: 6,
                    cancel_order_time: dateUtil.currentDate(),
                    order_id: data[i].order_id,
                    order_type: data[i].order_type,
                    vendor_user_id: data[i].vendor_user_id,
                    total_amount: data[i].total_amount,
                    coin_type: entrustOrder.coin_type,
                    entrust_order_id: data[i].entrust_order_id,
                    quantity: data[i].quantity,
                    service_charge_balance: service_charge_balance
                };

                let us = await ctx.service.order.cancelOrder(params);
                if (!us) {
                    console.error('task >> update vendee cancel tran error ');
                    return
                }
            }

            return;*/
        } catch (e) {
            console.error('task >> update vendee cancel tran error : ' + e.message);
            return;
        }

    },
};
