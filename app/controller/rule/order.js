module.exports = {
    buyinOrder: {
        quantity: {type: 'number', required: true, allowEmpty: false},
        keyId: {type: 'number', required: true, allowEmpty: false},
        money: {type: 'number', required: true, allowEmpty: false},
        transactionPassword: {type: 'string', required: true, allowEmpty: false}
    },
    buyoutOrder: {
        quantity: {type: 'number', required: true, allowEmpty: false},
        keyId: {type: 'number', required: true, allowEmpty: false},
        money: {type: 'number', required: true, allowEmpty: false},
        transactionPassword: {type: 'string', required: true, allowEmpty: false}
    },
    getOrderDetails: {
        orderId: {type: 'string', required: true, allowEmpty: false}
    },
    orderPayment: {
        orderId: {type: 'string', required: true, allowEmpty: false},
        payType: {type: 'string', required: true, allowEmpty: false}
    },
    upTransactionVoucher: {
        orderId: {type: 'string', required: true, allowEmpty: false},
        vendeeRemark: {type: 'string', required: true, allowEmpty: false},
        vendeeVoucher: {type: 'string', required: true, allowEmpty: false}
    },
    getUserPhone: {
        orderId: {type: 'string', required: true, allowEmpty: false}
    },
    orderAppeal: {
        orderId: {type: 'string', required: true, allowEmpty: false},
        cause: {type: 'string', required: true, allowEmpty: false},
        voucher: {type: 'string', required: true, allowEmpty: false}
    },
    cancelOrder: {
        orderId: {type: 'string', required: true, allowEmpty: false}
    },
    affirmProceeds: {
        orderId: {type: 'string', required: true, allowEmpty: false},
        transactionPassword: {type: 'string', required: true, allowEmpty: false}
    }
};
