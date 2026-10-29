#include "app_logic.h"
#include "wifi_link.h"
#include "serial.h"
#include <assert.h>
#include <stdio.h>
#include <string.h>

static char incoming[2048], outgoing[256];
static size_t cursor;
static int serial_error;
int Serial_Read(uint8_t port, uint8_t *byte)
{
    (void)port;
    if (!incoming[cursor]) return 0;
    *byte = (uint8_t)incoming[cursor++];
    return 1;
}
int Serial_Write(uint8_t port, const char *text)
{
    assert(port == SERIAL_WIFI);
    assert(strlen(text) < sizeof(outgoing));
    strcpy(outgoing, text);
    return 1;
}
int Serial_TakeError(uint8_t port)
{
    int error = serial_error;
    (void)port;
    serial_error = 0;
    return error;
}
static void Reply(const char *response, uint32_t now)
{
    assert(strlen(response) < sizeof(incoming));
    strcpy(incoming, response);
    cursor = 0;
    outgoing[0] = '\0';
    WiFi_Task(now);
}
static uint16_t Raw(int32_t centi)
{
    return (uint16_t)(((centi + 4500L) * 65535L + 8750L) / 17500L);
}
static void ApplicationTests(void)
{
    AppState app;
    AppKeys keys = {0};
    char frame[96], value[16];
    unsigned int key;
    App_Init(&app);
    assert(!app.running && !app.alarm && app.threshold == 2600);
    assert(!App_Sample(&app, Raw(3000), 32768));
    assert(!App_FormatFrame(&app, frame, sizeof(frame)));
    assert(App_Key(&app, 2) == APP_KEY_START);
    assert(App_Sample(&app, Raw(2601), 32768) && app.alarm);
    assert(App_Sample(&app, Raw(2600), 32768) && app.alarm);
    assert(App_Sample(&app, Raw(2599), 32768) && !app.alarm);
    assert(App_Sample(&app, Raw(2600), 32768) && !app.alarm);
    assert(App_SetThreshold(&app, "TH=25.00") && app.alarm);
    assert(App_SetThreshold(&app, "TH=28") && !app.alarm);
    assert(App_SetThreshold(&app, "TH=-0.25") && app.threshold == -25);
    assert(!App_SetThreshold(&app, "TH=NaN"));
    assert(!App_SetThreshold(&app, "TH=26.001"));
    assert(!App_SetThreshold(&app, "TH=26garbage"));
    assert(!App_SetThreshold(&app, "TH=125.01"));
    assert(!App_SetThreshold(&app, "TH=-40.01"));
    assert(!App_SetThreshold(&app, "TH=9999999999999"));
    assert(app.threshold == -25);
    assert(App_SetThreshold(&app, "TH=26.00"));
    for (key = 1; key < 16; key++) {
        if (key == 2 || key == 4) continue;
        assert(App_Key(&app, (uint8_t)key) == APP_KEY_ERROR && app.running);
    }
    assert(App_Sample(&app, Raw(-25), 32768));
    assert(App_FormatFrame(&app, frame, sizeof(frame)));
    assert(strcmp(frame, "SHT30,-0.25,50.00,26.00,0\r\n") == 0);
    assert(!App_FormatFrame(&app, frame, 8));
    App_FormatValue(value, sizeof(value), -1);
    assert(strcmp(value, "-0.01") == 0);
    assert(App_Sample(&app, Raw(3000), 32768) && app.alarm);
    assert(App_Key(&app, 4) == APP_KEY_STOP && !app.running && !app.alarm);
    assert(!App_Sample(&app, Raw(3000), 32768));
    assert(!App_FormatFrame(&app, frame, sizeof(frame)));
    App_Key(&app, 2);
    assert(!app.valid);
    assert(App_Sample(&app, Raw(3000), 32768));
    App_SensorError(&app);
    assert(!app.valid && !app.alarm && !App_FormatFrame(&app, frame, sizeof(frame)));
    assert(!App_Sample(&app, 0, 32768)); /* Outside SHT30 rated range. */
    assert(!App_Debounce(&keys, 2, 100));
    assert(!App_Debounce(&keys, 0, 105));
    assert(!App_Debounce(&keys, 2, 110));
    assert(!App_Debounce(&keys, 2, 129));
    assert(App_Debounce(&keys, 2, 130) == 2);
    assert(!App_Debounce(&keys, 2, 30000)); /* Holding fires once. */
    App_Debounce(&keys, 0, 30001);
    App_Debounce(&keys, 0, 30021);
    App_Debounce(&keys, 4, 0xFFFFFFF0U);
    assert(App_Debounce(&keys, 4, 4U) == 4); /* Tick rollover. */
    puts("PASS: start/stop, invalid keys, debounce, threshold, alarm boundaries, sensor errors, wire format");
}
static void WiFiTests(void)
{
    const char *frame = "SHT30,27.50,60.00,26.00,1\r\n";
    WiFi_Init(0);
    assert(!WiFi_Submit(frame));
    Reply("", 1500); assert(strcmp(outgoing, "AT+RST\r\n") == 0);
    serial_error = 1; /* Boot ROM switches baud rates before AT firmware starts. */
    Reply("", 1550); assert(!outgoing[0]);
    serial_error = 1; /* A valid ready line can already be in the ring buffer. */
    Reply("\r\nready\r\n", 1600); assert(strcmp(outgoing, "ATE0\r\n") == 0);
    Reply("\r\nO", 1610); assert(!outgoing[0]);
    Reply("K\r\n", 1620); assert(strcmp(outgoing, "AT+CWMODE=1\r\n") == 0);
    Reply("\r\nOK\r\n", 1630); assert(strstr(outgoing, "AT+CWJAP="));
    Reply("WIFI CONNECTED\r\nWIFI GOT IP\r\n\r\nOK\r\n", 1640);
    assert(strcmp(outgoing, "AT+CIPMUX=0\r\n") == 0);
    Reply("\r\nOK\r\n", 1650); assert(strcmp(outgoing, "AT+CIPMODE=0\r\n") == 0);
    Reply("\r\nOK\r\n", 1660); assert(strstr(outgoing, "AT+CIPSTART=\"TCP\""));
    Reply("CONNECT\r\n\r\nOK\r\n", 1670); assert(WiFi_IsReady());
    assert(WiFi_Submit(frame));
    Reply("", 1680); assert(strstr(outgoing, "AT+CIPSEND="));
    Reply("\r\nOK\r\n> ", 1690); assert(strcmp(outgoing, frame) == 0);
    assert(WiFi_SentCount() == 0);
    Reply("Recv 28 bytes\r\nSEND ", 1700); assert(!WiFi_SentCount());
    Reply("OK\r\n", 1710); assert(WiFi_SentCount() == 1);
    assert(WiFi_Submit(frame));
    WiFi_CancelPending();
    Reply("", 1720); assert(!outgoing[0]);
    Reply("CLO", 1730); assert(WiFi_IsReady());
    Reply("SED\r\n", 1740); assert(!WiFi_IsReady());
    Reply("", 6740); assert(strcmp(outgoing, "AT+RST\r\n") == 0);
    Reply("", 11740); assert(!WiFi_IsReady()); /* AT timeout doesn't block caller. */
    Reply("", 16740); assert(strcmp(outgoing, "AT+RST\r\n") == 0);
    Reply("\r\nready\r\n", 16741);
    serial_error = 1;
    Reply("", 16742); assert(!WiFi_IsReady());
    puts("PASS: AT connection, split replies, CIPSEND, cancel pending, disconnect, timeout, UART overflow");
}
int main(void) { ApplicationTests(); WiFiTests(); return 0; }
