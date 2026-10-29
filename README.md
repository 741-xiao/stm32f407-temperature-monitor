# STM32F407 温湿度监测

基于 STM32F407、SHT30 和 ESP8266 的温湿度采集、LCD/串口显示与 Java 中文网页监测实验。

## 功能

- SHT30 温湿度采集与 CRC 校验
- LCD 和串口实时显示，按键控制采集
- 温度阈值报警与蜂鸣器控制
- ESP8266 WiFi TCP 上传，断网自动重试
- Spring Boot/MySQL 网页、历史曲线和 CSV 导出

## 目录

- `Main/`：应用逻辑、硬件配置和采样控制
- `USER/`：LCD、I2C、串口、WiFi 等驱动
- `Project/`：Keil 工程
- `web/`：Java 上位机与网页
- `tools/`：固件测试、构建和字模工具

## 快速开始

1. 编辑 `Main/app_config.h`，填写自己的 2.4 GHz WiFi 名称、密码和电脑局域网 IP。
2. 建立 `mytest` 数据库，并在 PowerShell 设置 `$env:DB_PASSWORD`。
3. 运行 `启动温湿度上位机.cmd`，浏览器打开 `http://localhost:8080/`。
4. 使用 Keil 打开 `Project/LCD.uvprojx` 编译并烧录开发板。

完整接线、编译、测试和硬件验收步骤见 `使用说明.md`。

## 开发信息

姓名：肖肃  
学号：202440700102  
邮箱：xiao6665678@qq.com

## 许可证

本项目采用 MIT License，详见 `LICENSE`。
