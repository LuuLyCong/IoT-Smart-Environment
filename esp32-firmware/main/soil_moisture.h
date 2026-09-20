#ifndef SOIL_MOISTURE_H
#define SOIL_MOISTURE_H

#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Initialize Soil Moisture ADC driver on ESP32-S3 GPIO 5 (ADC1 Channel 4)
 * @return ESP_OK on success, or error code
 */
esp_err_t soil_sensor_init(void);

/**
 * @brief Read soil moisture percentage and raw ADC value
 * @param[out] moisture_percent Soil moisture in percentage (0.0% to 100.0%)
 * @param[out] raw_out Optional pointer to receive raw ADC reading (0 to 4095)
 * @return ESP_OK on success, or error code
 */
esp_err_t soil_sensor_read(float *moisture_percent, int *raw_out);

#ifdef __cplusplus
}
#endif

#endif // SOIL_MOISTURE_H

