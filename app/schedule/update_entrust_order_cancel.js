module.exports = {
    schedule: {
        interval: '10s', // 1 分钟间隔
        type: 'worker', // 指定所有的 worker 都需要执行
    },
    async task(ctx) {
        /**
         * 委托单超时自动取消
         */
       /* try {
            let otcConf = await ctx.service.home.findOneOtcConf();
            if (!otcConf) {
                console.error('no such otcconf');
                return;
            }
            let order_entry_time = otcConf.order_entry_time;

        } catch (e) {
            console.error('task >> update entrust order cancel error : ' + e.message);
            return;
        }*/

    }
};
