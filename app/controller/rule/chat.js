module.exports = {
    sendMessage: {
        content: {type: 'string', required: true, allowEmpty: false},
        roomId: {type: 'number', required: true, allowEmpty: false}
    }
};
