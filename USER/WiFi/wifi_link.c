#include "wifi_link.h"
#include "serial.h"
#include "app_config.h"
#include <stdio.h>
#include <string.h>

typedef enum { BOOT, RESET, ECHO, MODE, JOIN, MUX, NORMAL,
               CONNECT, READY, PROMPT, SENDING, RETRY } WiFiState;
static WiFiState state;
static uint32_t started, timeout, sent;
static char response[512], pending[96], active[96];
static unsigned int used;

static void ClearResponse(void) { used = 0U; response[0] = '\0'; }
static int Has(const char *word) { return strstr(response, word) != NULL; }
static void Retry(uint32_t now)
{
    state = RETRY;
    started = now;
    timeout = 5000U;
    pending[0] = active[0] = '\0';
    ClearResponse();
}
static void Command(const char *command, WiFiState next, uint32_t wait, uint32_t now)
{
    ClearResponse();
    state = next;
    started = now;
    timeout = wait;
    if (!Serial_Write(SERIAL_WIFI, command)) Retry(now);
}
void WiFi_Init(uint32_t now)
{
    state = BOOT;
    started = now;
    timeout = 1500U;
    sent = 0U;
    pending[0] = active[0] = '\0';
    ClearResponse();
}
int WiFi_IsReady(void) { return state == READY || state == PROMPT || state == SENDING; }
uint32_t WiFi_SentCount(void) { return sent; }
void WiFi_CancelPending(void) { pending[0] = '\0'; }
int WiFi_Submit(const char *frame)
{
    size_t length = strlen(frame);
    if (!WiFi_IsReady() || !length || length >= sizeof(pending)) return 0;
    memcpy(pending, frame, length + 1U); /* Bounded latest sample, no offline backlog. */
    return 1;
}

void WiFi_Task(uint32_t now)
{
    uint8_t byte;
    char command[256];
    int length;
    if (Serial_TakeError(SERIAL_WIFI)) {
        /* ESP8266 ROM boot text uses 74880 baud. Ignore framing errors while
           resetting; wait for the AT firmware's 115200-baud ready line. */
        ClearResponse();
        if (state != BOOT && state != RESET && state != RETRY) { Retry(now); return; }
    }
    while (Serial_Read(SERIAL_WIFI, &byte)) {
        if ((byte < 32U && byte != '\r' && byte != '\n') || byte > 126U) continue;
        if (used + 1U >= sizeof(response)) { Retry(now); return; }
        response[used++] = (char)byte;
        response[used] = '\0';
    }
    if (state == BOOT || state == RETRY) {
        ClearResponse();
        if ((uint32_t)(now - started) >= timeout)
            Command("AT+RST\r\n", RESET, 5000U, now);
        return;
    }
    /* Asynchronous link loss must take precedence over an OK in the same burst. */
    if (Has("ERROR") || Has("FAIL") || Has("CLOSED") || Has("busy") ||
        (state != RESET && (Has("WIFI DISCONNECT") || Has("ready\r\n")))) { Retry(now); return; }
    if (state == READY) {
        if (pending[0]) {
            strcpy(active, pending);
            pending[0] = '\0';
            (void)snprintf(command, sizeof(command), "AT+CIPSEND=%u\r\n", (unsigned int)strlen(active));
            Command(command, PROMPT, 2000U, now);
        }
        return;
    }
    if (state == PROMPT && Has(">")) {
        Command(active, SENDING, 5000U, now);
        return;
    }
    if (state == SENDING && Has("SEND OK")) {
        sent++;
        state = READY;
        ClearResponse();
        return;
    }
    if ((state == RESET && Has("ready\r\n")) ||
        (state >= ECHO && state <= CONNECT && Has("\r\nOK\r\n"))) {
        switch (state) {
        case RESET: Command("ATE0\r\n", ECHO, 2000U, now); break;
        case ECHO: Command("AT+CWMODE=1\r\n", MODE, 2000U, now); break;
        case MODE:
            length = snprintf(command, sizeof(command), "AT+CWJAP=\"%s\",\"%s\"\r\n", WIFI_SSID, WIFI_PASSWORD);
            if (length <= 0 || (size_t)length >= sizeof(command)) Retry(now);
            else Command(command, JOIN, 20000U, now);
            break;
        case JOIN: Command("AT+CIPMUX=0\r\n", MUX, 2000U, now); break;
        case MUX: Command("AT+CIPMODE=0\r\n", NORMAL, 2000U, now); break;
        case NORMAL:
            length = snprintf(command, sizeof(command), "AT+CIPSTART=\"TCP\",\"%s\",%u\r\n",
                              WIFI_SERVER_IP, (unsigned int)WIFI_SERVER_PORT);
            if (length <= 0 || (size_t)length >= sizeof(command)) Retry(now);
            else Command(command, CONNECT, 10000U, now);
            break;
        case CONNECT: state = READY; ClearResponse(); break;
        default: break;
        }
        return;
    }
    if ((uint32_t)(now - started) >= timeout) Retry(now);
}
