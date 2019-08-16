
SET NAMES utf8;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
--  Table structure for `otc_coin_list`
-- ----------------------------
DROP TABLE IF EXISTS `otc_coin_list`;
CREATE TABLE `otc_coin_list` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `name` varchar(255) DEFAULT NULL COMMENT '名称',
  `symbol` varchar(255) DEFAULT NULL COMMENT '标识',
  `sort` int(11) DEFAULT NULL COMMENT '排序',
  `status` int(1) DEFAULT '1' COMMENT '启动状态1为启动0为关闭',
  `avatar` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4;

-- ----------------------------
--  Records of `otc_coin_list`
-- ----------------------------
BEGIN;
INSERT INTO `otc_coin_list` VALUES ('1', 'Bitcon', 'BTC', '1', '1', null), ('2', 'Us', 'USDT', '1', '1', null), ('3', 'BCHNAME', 'BCH', '1', '1', null);
COMMIT;

SET FOREIGN_KEY_CHECKS = 1;



DROP TABLE IF EXISTS `otc_appeal`;
CREATE TABLE `otc_appeal` (
  `key_id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` varchar(100) NOT NULL COMMENT '订单ID',
  `appeal_time` datetime DEFAULT NULL COMMENT '申诉时间 卖方',
  `up_voucher_time` datetime DEFAULT NULL COMMENT '上传凭证时间 买方',
  `vendor_cause` varchar(255) DEFAULT '' COMMENT '卖方申诉原因',
  `vendor_voucher` varchar(2000) DEFAULT '' COMMENT '卖方上传凭证',
  `vendee_remark` varchar(255) DEFAULT '' COMMENT '买方凭证备注',
  `vendee_voucher` varchar(2000) DEFAULT '' COMMENT '买方凭证',
  `status` int(11) NOT NULL DEFAULT '0' COMMENT '0未处理 1确认放币 2取消订单',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`key_id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8 COMMENT='申诉表';



SET NAMES utf8;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
--  Table structure for `otc_conf`
-- ----------------------------
DROP TABLE IF EXISTS `otc_conf`;
CREATE TABLE `otc_conf` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT COMMENT 'id',
  `orders_max_quota` double(255,6) unsigned DEFAULT '0.000000' COMMENT '委托单最大交易限额',
  `orders_min_quota` double(255,6) unsigned DEFAULT '0.000000' COMMENT '委托单最小交易额度',
  `buyer_cost` double(255,6) unsigned DEFAULT '0.001000' COMMENT '买方手续费\n\n',
  `seller_cost` double(255,6) unsigned DEFAULT '0.001000' COMMENT '卖方手续费',
  `cancel_number` int(11) unsigned DEFAULT '3' COMMENT '取消次数',
  `buyer_overtime` int(11) DEFAULT '30' COMMENT '买方超时时间',
  `seller_overtime` int(11) DEFAULT NULL COMMENT '卖方超市时间',
  `appeal_overtime` int(11) unsigned DEFAULT '0' COMMENT '申诉超时时间',
  `vendee_appeal_overtime` int(11) DEFAULT '0' COMMENT '买家申诉时间',
  `order_entry_time` int(255) unsigned DEFAULT NULL COMMENT '委托单挂单时长\n\n委托单挂单时长\n\n',
  `user_id` int(11) DEFAULT NULL COMMENT '操作人id',
  `create_time` datetime DEFAULT NULL COMMENT '创建时间',
  `content` text CHARACTER SET utf8mb4 COMMENT '交易规则',
  `msg` varchar(255) CHARACTER SET utf8mb4 DEFAULT NULL COMMENT '说明',
  PRIMARY KEY (`id`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8;

-- ----------------------------
--  Records of `otc_conf`
-- ----------------------------
BEGIN;
INSERT INTO `otc_conf` VALUES ('1', '1000.000000', '0.001000', '0.001000', '0.001000', '3', '30', '0', '1', '0', '0', '0', null, '<p>测试的交易规则</p>', '');
COMMIT;

SET FOREIGN_KEY_CHECKS = 1;


DROP TABLE IF EXISTS `otc_conf_bak`;
CREATE TABLE `otc_conf_bak` (
  `id` int(11) NOT NULL,
  `orders_max_quota` double NOT NULL DEFAULT '0',
  `orders_min_quota` double NOT NULL DEFAULT '0',
  `buyer_cost` double NOT NULL DEFAULT '0',
  `seller_cost` double NOT NULL DEFAULT '0',
  `cancel_number` int(11) NOT NULL DEFAULT '0',
  `buyer_overtime` int(11) NOT NULL DEFAULT '0',
  `seller_overtime` int(11) NOT NULL DEFAULT '0',
  `appeal_overtime` int(11) NOT NULL DEFAULT '0',
  `vendee_appeal_overtime` int(11) NOT NULL DEFAULT '0',
  `order_entry_time` int(11) NOT NULL DEFAULT '0',
  `msg` varchar(255) CHARACTER SET latin1 NOT NULL DEFAULT '',
  `content` varchar(255) CHARACTER SET latin1 NOT NULL DEFAULT '',
  `user_id` int(11) NOT NULL DEFAULT '0',
  `create_time` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_bin;



DROP TABLE IF EXISTS `otc_entrust_auto_cancel_record`;
CREATE TABLE `otc_entrust_auto_cancel_record` (
  `key_id` int(11) NOT NULL AUTO_INCREMENT,
  `entrust_order_id` int(11) NOT NULL,
  `entrust_type` int(11) NOT NULL,
  `money` double(255,8) NOT NULL,
  `service_charge` double(255,8) DEFAULT NULL,
  `sum_money` double(255,8) DEFAULT NULL,
  `user_id` int(11) NOT NULL,
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`key_id`),
  KEY `entrust_order_id_index` (`entrust_order_id`),
  KEY `user_id` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8 COMMENT='委托单自动取消纪录';


DROP TABLE IF EXISTS `otc_entrust_order`;
CREATE TABLE `otc_entrust_order` (
  `key_id` int(11) NOT NULL AUTO_INCREMENT,
  `entrust_type` int(11) NOT NULL DEFAULT '1' COMMENT '1买单 2卖单',
  `user_id` int(11) NOT NULL,
  `coin_type` varchar(255) NOT NULL DEFAULT 'BTC' COMMENT '币种类型',
  `unit_price` double(255,2) NOT NULL,
  `money_type` varchar(50) NOT NULL DEFAULT 'CNY' COMMENT '钱的单位',
  `quantity` double(255,6) NOT NULL COMMENT '数量',
  `quantity_left` double(255,6) NOT NULL DEFAULT '0.000000' COMMENT '剩下的',
  `min` double(255,2) NOT NULL COMMENT '最小交易金额',
  `max` double(255,2) NOT NULL COMMENT '最大交易金额',
  `vendee_service_charge` double(255,6) DEFAULT '0.000000' COMMENT '买方手续费',
  `vendor_service_charge` double(255,6) NOT NULL DEFAULT '0.000000' COMMENT '卖方手续费',
  `pay_type` varchar(100) DEFAULT NULL COMMENT '支付方式 1银行卡 2支付宝 3微信',
  `push_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发布时间',
  `status` int(11) NOT NULL DEFAULT '1' COMMENT '1发布中 2已完成 0已取消 3系统自动取消',
  `cancel_time` datetime DEFAULT NULL COMMENT '取消时间',
  `auto_cancel_time` datetime DEFAULT NULL COMMENT '自动取消时间',
  `finish_time` datetime DEFAULT NULL,
  `cretae_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`key_id`),
  KEY `key_id_index` (`key_id`),
  KEY `user_id_index` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8 COMMENT='委托订单管理表';


DROP TABLE IF EXISTS `otc_order`;
CREATE TABLE `otc_order` (
  `order_id` varchar(50) NOT NULL,
  `pay_type` varchar(11) DEFAULT NULL COMMENT '支付方式 1银行卡 2支付宝 3微信',
  `order_type` int(11) NOT NULL COMMENT '订单类型  1买入 2卖出',
  `vendor_user_id` int(11) NOT NULL COMMENT '卖方用户ID',
  `vendee_user_id` int(11) NOT NULL COMMENT '买方用户ID',
  `entrust_order_id` int(11) NOT NULL COMMENT '委托单ID',
  `unit_price` double(255,2) NOT NULL COMMENT '单价',
  `quantity` double(255,6) NOT NULL COMMENT '数量',
  `total_amount` double(255,2) NOT NULL COMMENT '总额',
  `buy_order_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '下单时间',
  `pay_order_time` datetime DEFAULT NULL COMMENT '付款时间',
  `send_coin_time` datetime DEFAULT NULL COMMENT '放币时间',
  `cancel_order_time` datetime DEFAULT NULL COMMENT '取消订单时间',
  `status` int(11) NOT NULL DEFAULT '0' COMMENT '0:待支付 等待对方支付 1:已完成 已完成 已完成 2:已支付 等待对方放币 对方已支付 3.已申诉 卖方已申诉 已申诉 4:已取消 已取消 对方已取消 ',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`order_id`),
  KEY `order_id_index` (`order_id`),
  KEY `entrust_order_id_index` (`entrust_order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='下单订单表';


DROP TABLE IF EXISTS `otc_order_sms`;
CREATE TABLE `otc_order_sms` (
  `key_id` int(11) NOT NULL,
  `order_id` varchar(50) NOT NULL,
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`key_id`),
  KEY `key_id_index` (`key_id`),
  KEY `order_id_index` (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='订单短信表，纪录超时是否发了短信';


DROP TABLE IF EXISTS `otc_user_frozen_balance`;
CREATE TABLE `otc_user_frozen_balance` (
  `key_id` int(11) NOT NULL AUTO_INCREMENT,
  `type` int(11) NOT NULL DEFAULT '1' COMMENT '1委托卖出 2订单卖出',
  `user_id` int(11) NOT NULL,
  `relevance_id` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL COMMENT '关联id 委托单，订单ID',
  `frozen_balance` double(255,6) NOT NULL DEFAULT '0.000000' COMMENT '冻结金额 包含手续费',
  `service_charge_balance` double(255,6) NOT NULL COMMENT '手续费',
  `status` int(11) NOT NULL DEFAULT '1',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`key_id`)
) ENGINE=InnoDB AUTO_INCREMENT=1 DEFAULT CHARSET=utf8 COMMENT='卖出委托冻结金币表';



