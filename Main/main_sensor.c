#include "common.h"
#include "lcd.h"
#include "key.h"
#include "beep.h"
#include "sht30.h"
#include "chinese_lcd.h"
#include "app_config.h"
#include "app_logic.h"
#include "serial.h"
#include "wifi_link.h"
#include <stdio.h>

static AppState app;
static AppKeys keys;
static uint32_t last_sample;
static IWDG_HandleTypeDef watchdog;

static void Console(const char *text)
{
    (void)Serial_Write(SERIAL_CONSOLE, text);
}

static void Line(u16 y, const char *text, u16 color)
{
    BRUSH_COLOR = color;
    LCD_Fill_onecolor(0U, y, (u16)(lcd_width - 1U), (u16)(y + 25U), WHITE);
    LCD_TextUTF8(4U, y, text);
}

static void ShowReadings(void)
{
    char text[64], value[12];
    if (app.valid) App_FormatValue(value, sizeof(value), app.temperature);
    else (void)snprintf(value, sizeof(value), "--");
    (void)snprintf(text, sizeof(text), "温度:%s C", value);
    Line(90U, text, BLUE);
    if (app.valid) App_FormatValue(value, sizeof(value), app.humidity);
    else (void)snprintf(value, sizeof(value), "--");
    (void)snprintf(text, sizeof(text), "湿度:%s %%", value);
    Line(122U, text, BLUE);
    App_FormatValue(value, sizeof(value), app.threshold);
    (void)snprintf(text, sizeof(text), "阈值:%s C", value);
    Line(154U, text, BLUE);
    Line(186U, app.running ? "状态:采集中" : "状态:已停止", BLUE);
    Line(218U, app.alarm ? "报警:开启" : "报警:关闭", app.alarm ? RED : BLUE);
}

static void ApplyAlarm(void) { BEEP = app.alarm ? 1U : 0U; }

static void HandleKeys(uint32_t now)
{
    uint8_t mask = 0U, action, was_running = app.running;
    if (!KEY0) mask |= 1U;
    if (!KEY1) mask |= 2U;
    if (!KEY2) mask |= 4U;
    if (!KEY3) mask |= 8U;
    action = App_Key(&app, App_Debounce(&keys, mask, now));
    if (!action) return;
    ApplyAlarm();
    if (action == APP_KEY_START) {
        if (!was_running) last_sample = now - APP_SAMPLE_MS;
        Console("开始采集\r\n");
        Line(282U, "开始采集", BLUE);
    } else if (action == APP_KEY_STOP) {
        WiFi_CancelPending();
        Console("停止采集，报警关闭\r\n");
        Line(282U, "停止采集", BLUE);
    } else {
        Console("按键错误\r\n");
        Line(282U, "按键错误", RED);
    }
    ShowReadings();
}

static void HandleConsole(void)
{
    static char command[40];
    static unsigned int length;
    static uint8_t discard;
    uint8_t byte;
    char text[96], value[12];
    if (Serial_TakeError(SERIAL_CONSOLE)) { length = 0U; discard = 1U; }
    while (Serial_Read(SERIAL_CONSOLE, &byte)) {
        if (byte == '\r' || byte == '\n') {
            if (discard) Console("命令过长或串口错误，请重发 TH=26.00\r\n");
            else if (length) {
                command[length] = '\0';
                if (App_SetThreshold(&app, command)) {
                    ApplyAlarm();
                    App_FormatValue(value, sizeof(value), app.threshold);
                    (void)snprintf(text, sizeof(text), "报警阈值:%s C（重启恢复默认值）\r\n", value);
                    Console(text);
                    ShowReadings();
                    Line(282U, "阈值已更新", BLUE);
                } else Console("命令错误，例: TH=28.00，范围 -40.00~125.00\r\n");
            }
            length = 0U;
            discard = 0U;
        } else if (!discard) {
            if (byte < 32U || byte > 126U || length + 1U >= sizeof(command)) discard = 1U;
            else command[length++] = (char)byte;
        }
    }
}

static void Sample(uint32_t now)
{
    static uint8_t sensor_error;
    uint16_t temperature, humidity;
    char frame[96], text[192], t[12], h[12], threshold[12];
    if (!app.running || (uint32_t)(now - last_sample) < APP_SAMPLE_MS) return;
    last_sample = now;
    if (SHT30_ReadRaw(&temperature, &humidity) != HAL_OK ||
        !App_Sample(&app, temperature, humidity)) {
        App_SensorError(&app);
        ApplyAlarm();
        WiFi_CancelPending();
        Console("SHT30读取错误，请检查接线；本次数据不上传\r\n");
        Line(282U, "传感器错误", RED);
        sensor_error = 1U;
    } else {
        if (sensor_error) {
            Line(282U, "传感器正常", BLUE);
            sensor_error = 0U;
        }
        ApplyAlarm();
        App_FormatValue(t, sizeof(t), app.temperature);
        App_FormatValue(h, sizeof(h), app.humidity);
        App_FormatValue(threshold, sizeof(threshold), app.threshold);
        (void)snprintf(text, sizeof(text), "编号:%lu 温度:%s C 湿度:%s %%RH 阈值:%s C 报警:%s WiFi:%s\r\n",
                       (unsigned long)app.samples, t, h, threshold,
                       app.alarm ? "开启" : "关闭", WiFi_IsReady() ? "已连接" : "未连接");
        Console(text);
        if (App_FormatFrame(&app, frame, sizeof(frame))) (void)WiFi_Submit(frame);
    }
    ShowReadings();
}

int main(void)
{
    int previous_wifi = -1, current_wifi;
    char text[80];
    HAL_Init();
    Stm32_Clock_Init(336U, 8U, 2U, 7U);
    delay_init();
    BEEP_Init();
    KEY_Init();
    Serial_Init();
    LCD_Init();
    App_Init(&app);
    LCD_Clear(WHITE);
    BACK_COLOR = WHITE;
    Line(0U, "SHT30 温湿度", BLUE);
    (void)snprintf(text, sizeof(text), "姓名:%s", APP_DEVELOPER_NAME);
    Line(28U, text, BLUE);
    (void)snprintf(text, sizeof(text), "学号:%s", APP_STUDENT_ID);
    Line(58U, text, BLUE);
    ShowReadings();
    Line(282U, "按键1开始", BLUE);
    Console("\r\nSTM32F407ZG SHT30 温湿度采集\r\n");
    Console("开发者:" APP_DEVELOPER_NAME " 学号:" APP_STUDENT_ID "\r\n");
    Console("KEY1(PF8)开始，KEY2(PF7)停止；其它按键错误\r\n");
    Console("阈值命令: TH=26.00 + 回车\r\n");
    if (SHT30_Init() != HAL_OK) {
        Console("SHT30初始化错误\r\n");
        Line(282U, "传感器错误", RED);
    }
    WiFi_Init(HAL_GetTick());
#if APP_WATCHDOG_ENABLED
    watchdog.Instance = IWDG;
    watchdog.Init.Prescaler = IWDG_PRESCALER_64;
    watchdog.Init.Reload = 2499U;
    __HAL_DBGMCU_FREEZE_IWDG();
    if (HAL_IWDG_Init(&watchdog) != HAL_OK) NVIC_SystemReset();
#endif
    while (1) {
        uint32_t now = HAL_GetTick();
        HandleKeys(now);
        HandleConsole();
        WiFi_Task(now);
        current_wifi = WiFi_IsReady();
        if (current_wifi != previous_wifi) {
            Line(250U, current_wifi ? "WiFi:已连接" : "WiFi:连接中", BLUE);
            Console(current_wifi ? "WiFi已连接上位机\r\n" : "WiFi连接中，请检查配置及上位机\r\n");
            previous_wifi = current_wifi;
        }
        Sample(now);
#if APP_WATCHDOG_ENABLED
        (void)HAL_IWDG_Refresh(&watchdog);
#endif
        __WFI();
    }
}
