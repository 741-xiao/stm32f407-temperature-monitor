-- Dedicated table: preserves any previous multi-sensor records in coll_data.
CREATE TABLE IF NOT EXISTS sht30_samples (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    temp DECIMAL(5,2) NOT NULL COMMENT '温度（摄氏度）',
    hum DECIMAL(5,2) NOT NULL COMMENT '相对湿度（%RH）',
    threshold DECIMAL(5,2) NOT NULL COMMENT '开发板报警阈值',
    alarm TINYINT NOT NULL COMMENT '本次采集报警状态：0关闭，1开启',
    ip VARCHAR(45) NOT NULL COMMENT '设备IP',
    colltime DATETIME NOT NULL COMMENT '电脑接收时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
