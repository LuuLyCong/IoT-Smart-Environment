#ifndef DHT11_H
#define DHT11_H

#include <stdint.h>
#include "esp_err.h"
#include "driver/gpio.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Initialize the GPIO pin for DHT11.
 * @param pin GPIO pin connected to DHT11 DATA.
 * @return esp_err_t ESP_OK on success.
 */
esp_err_t dht11_init(gpio_num_t pin);

/**
 * @brief Read temperature and humidity from DHT11.
 * @param pin GPIO pin connected to DHT11 DATA.
 * @param temperature Pointer to float to store temperature in Celsius.
 * @param humidity Pointer to float to store relative humidity in %.
 * @return esp_err_t ESP_OK on success, error code otherwise.
 */
esp_err_t dht11_read(gpio_num_t pin, float *temperature, float *humidity);

#ifdef __cplusplus
}
#endif

#endif // DHT11_H

