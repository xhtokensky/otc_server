module.exports = {
    schedule: {
        interval: '5s', // 1 分钟间隔
        type: 'worker', // 指定所有的 worker 都需要执行
    },
    async task(ctx) {
        /**
         * 从下单时间起，若3分钟还没进行操作，则发送短信提醒
         */
     /*   let data = await ctx.service.order.getOrdersForSMS();
        //发送短信
        console.log(data)
        console.log('zzzz...')*/
    },
};
