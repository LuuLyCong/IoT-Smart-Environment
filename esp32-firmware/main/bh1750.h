#ifndef BH1750_H
#define BH1750_H

#include "esp_err.h"
#include "driver/gpio.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Initialize BH1750 I2C master driver
 * @param sda_pin GPIO pin for SDA (default GPIO 8)
 * @param scl_pin GPIO pin for SCL (default GPIO 9)
 * @return ESP_OK on success, or error code
 */
esp_err_t bh1750_init(gpio_num_t sda_pin, gpio_num_t scl_pin);

/**
 * @brief Read ambient light level in Lux
 * @param[out] lux Pointer to float receiving the illuminance in Lux
 * @return ESP_OK on success, or error code if communication failed
 */
esp_err_t bh1750_read_lux(float *lux);

#ifdef __cplusplus
}
#endif

#endif // BH1750_H

