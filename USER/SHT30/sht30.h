#ifndef __SHT30_H
#define __SHT30_H

#include "stm32f4xx_hal.h"

/* SHT30 default address is 0x44 (HAL uses the 8-bit address 0x88). */
#define SHT30_I2C_ADDRESS       (0x44U << 1)

HAL_StatusTypeDef SHT30_Init(void);
HAL_StatusTypeDef SHT30_ReadRaw(uint16_t *temperature, uint16_t *humidity);

#endif
