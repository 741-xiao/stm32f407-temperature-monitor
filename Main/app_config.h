#ifndef APP_CONFIG_H
#define APP_CONFIG_H

/* UTF-8. Keep the identity consistent with web application.yml. */
#define APP_DEVELOPER_NAME "肖肃"
#define APP_STUDENT_ID "202440700102"
#define APP_SAMPLE_MS 2000U
#define APP_DEFAULT_THRESHOLD_CENTI 2600

/* Board silk labels KEY1=PF8, KEY2=PF7. KEY0=PF9, KEY3=PF6. */
#define APP_START_KEY_MASK 0x02U
#define APP_STOP_KEY_MASK  0x04U
#define APP_KEY_DEBOUNCE_MS 20U

/* ESP8266-01S with AT firmware on UART4, 2.4 GHz WiFi. */
/* 1: PC10 TX / PC11 RX. 0: PA0 TX / PA1 RX. Match the actual wiring. */
#define WIFI_UART4_USE_PC10_PC11 0
/* Fill these before flashing. */
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
#define WIFI_SERVER_IP "YOUR_PC_LAN_IP"
#define WIFI_SERVER_PORT 5107U
#define WIFI_BAUD_RATE 115200U
#define CONSOLE_BAUD_RATE 115200U
#define APP_WATCHDOG_ENABLED 1

#endif
