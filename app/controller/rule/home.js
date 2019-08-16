module.exports = {
    buyinEntrust: {
        unitPrice: {type: 'number', required: true, allowEmpty: false},
        quantity: {type: 'number', required: true, allowEmpty: false},
        min: {type: 'number', required: true, allowEmpty: false},
        max: {type: 'number', required: true, allowEmpty: false},
        payType: {type: 'string', required: true, allowEmpty: false},
        coinType: {type: 'string', required: true, allowEmpty: false},
        transactionPassword:{type: 'string', required: true, allowEmpty: false}
    },
    cancelEntrust: {
        entrustOrderId: {type: 'number', required: true, allowEmpty: false}
    }
};
