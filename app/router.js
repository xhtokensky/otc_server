'use strict';

/**
 * @param {Egg.Application} app - egg application
 */
module.exports = app => {
    const isAuthenticated = app.middleware.isAuthenticated();
    const {router, controller} = app;
    const jiguang = require('./utils/jiguang');
    jiguang.__init.call(app);

    router.post('/otc/conf', controller.home.getOtcConf);
    router.post('/otc/verify/payway', isAuthenticated, controller.home.verifyPayway);//验证支付方式是否有设置
    router.post('/otc/buyin/entrust', isAuthenticated, controller.home.buyinEntrust);//买入委托单
    router.post('/otc/buyout/entrust/verify', isAuthenticated, controller.home.buyoutEntrustVerify);
    router.post('/otc/buyout/entrust', isAuthenticated, controller.home.buyoutEntrust);//卖出委托单
    router.post('/otc/cancel/entrust', isAuthenticated, controller.home.cancelEntrust);//取消委托单
    router.get('/otc/buyin/entrust', controller.home.getBuyinEntrust);//获取买入列表  对应卖单
    router.get('/otc/buyout/entrust', controller.home.getBuyoutEntrust);//获取卖出列表  对应买单
    router.get('/otc/my/entrust', isAuthenticated, controller.home.getMyEntrust);//获取我的委托单

    router.post('/otc/buyin/order', isAuthenticated, controller.order.buyinOrder);//买入订单
    router.post('/otc/verifyPaywayAndRealAuth', isAuthenticated, controller.home.verifyPaywayAndRealAuth);//验证是否身份认证和支付方式
    router.post('/otc/buyout/order', isAuthenticated, controller.order.buyoutOrder);//卖出订单
    router.get('/otc/orders/:action', isAuthenticated, controller.order.getOtcOrders);//获取订单
    router.get('/otc/order/details/:orderId', isAuthenticated, controller.order.getOrderDetails);//订单详情
    router.post('/otc/order/payment', isAuthenticated, controller.order.orderPayment);//买方付款
    router.post('/otc/cancel/order', isAuthenticated, controller.order.cancelOrder);//取消交易 买家
    router.post('/otc/order/phone', isAuthenticated, controller.order.getUserPhone);//获取用户手机号
    router.post('/otc/order/appeal', isAuthenticated, controller.order.orderAppeal);//申诉
    router.post('/otc/order/affirm/proceeds', isAuthenticated, controller.order.affirmProceeds);//卖家确认收款

    router.get('/otc/coin/list', controller.home.getCoinList);//获取otc支持币种


    router.get('/otc/chat/list', isAuthenticated, controller.chat.chatList);//获取聊天列表
    router.post('/otc/chat/sendMessage', isAuthenticated, controller.chat.sendMessage);//发送消息
    router.get('/otc/chat/messageList', isAuthenticated, controller.chat.getChatMessageList);//获取消息
    router.get('/otc/chat/readMessage', isAuthenticated, controller.chat.readMessage);//读消息
    router.get('/otc/chat/redPort', isAuthenticated, controller.chat.redPort);//红点
    router.post('/otc/test', controller.home.test);
    router.post('/otc/test2', controller.home.test2);
    router.post('/otc/test3', controller.home.test3);
    router.post('/otc/test4', controller.home.test4);

};
