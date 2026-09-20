#include "dht11.h"
#include <stdio.h>
#include <string.h>
#include "esp_timer.h"
#include "esp_rom_sys.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

static const char *TAG = "DHT11";
static portMUX_TYPE dht_mux = portMUX_INITIALIZER_UNLOCKED;

esp_err_t dht11_init(gpio_num_t pin)
{
    gpio_config_t io_conf = {
        .pin_bit_mask = (1ULL << pin),
        .mode = GPIO_MODE_INPUT,
        .pull_up_en = GPIO_PULLUP_ENABLE,
        .pull_down_en = GPIO_PULLDOWN_DISABLE,
        .intr_type = GPIO_INTR_DISABLE,
    };
    esp_err_t ret = gpio_config(&io_conf);
    if (ret == ESP_OK) {
        ESP_LOGI(TAG, "Initialized DHT11 on GPIO %d with internal pull-up", pin);
    }
    return ret;
}

static inline int wait_for_level(gpio_num_t pin, int level, int timeout_us)
{
    int elapsed = 0;
    while (gpio_get_level(pin) != level) {
        if (elapsed >= timeout_us) {
            return -1;
        }
        esp_rom_delay_us(2);
        elapsed += 2;
    }
    return elapsed;
}

esp_err_t dht11_read(gpio_num_t pin, float *temperature, float *humidity)
{
    if (!temperature || !humidity) {
        return ESP_ERR_INVALID_ARG;
    }

    uint8_t data[5] = {0, 0, 0, 0, 0};

    // Step 1: Send Start Signal
    // MCU pulls line LOW for at least 18ms (20ms is recommended for reliable detection)
    gpio_set_direction(pin, GPIO_MODE_OUTPUT);
    gpio_set_level(pin, 0);
    vTaskDelay(pdMS_TO_TICKS(20));

    // Pull line HIGH for 30us
    gpio_set_level(pin, 1);
    esp_rom_delay_us(30);

    // Step 2: Switch to input mode with pull-up and wait for DHT11 response
    gpio_set_direction(pin, GPIO_MODE_INPUT);

    // Enter critical section to ensure precise timing during bit reception
    portENTER_CRITICAL(&dht_mux);

    // Wait for DHT11 to pull line LOW (response signal ~80us)
    if (wait_for_level(pin, 0, 100) < 0) {
        portEXIT_CRITICAL(&dht_mux);
        ESP_LOGE(TAG, "Timeout waiting for DHT11 initial LOW response");
        return ESP_ERR_TIMEOUT;
    }

    // Wait for DHT11 to pull line HIGH (~80us)
    if (wait_for_level(pin, 1, 100) < 0) {
        portEXIT_CRITICAL(&dht_mux);
        ESP_LOGE(TAG, "Timeout waiting for DHT11 initial HIGH response");
        return ESP_ERR_TIMEOUT;
    }

    // Wait for DHT11 to pull line LOW (start of data transmission)
    if (wait_for_level(pin, 0, 100) < 0) {
        portEXIT_CRITICAL(&dht_mux);
        ESP_LOGE(TAG, "Timeout waiting for DHT11 start of data bits");
        return ESP_ERR_TIMEOUT;
    }

    // Step 3: Read 40 data bits (5 bytes)
    for (int i = 0; i < 40; i++) {
        // Wait for line to go HIGH (each bit starts with ~50us LOW)
        if (wait_for_level(pin, 1, 70) < 0) {
            portEXIT_CRITICAL(&dht_mux);
            ESP_LOGE(TAG, "Timeout waiting for bit %d HIGH", i);
            return ESP_ERR_TIMEOUT;
        }

        // Measure HIGH duration (26-28us for '0', ~70us for '1')
        int high_duration = wait_for_level(pin, 0, 90);
        if (high_duration < 0) {
            portEXIT_CRITICAL(&dht_mux);
            ESP_LOGE(TAG, "Timeout waiting for bit %d LOW", i);
            return ESP_ERR_TIMEOUT;
        }

        int byte_idx = i / 8;
        data[byte_idx] <<= 1;
        if (high_duration > 40) {
            data[byte_idx] |= 1;
        }
    }

    portEXIT_CRITICAL(&dht_mux);

    // Step 4: Verify Checksum
    uint8_t checksum = (data[0] + data[1] + data[2] + data[3]) & 0xFF;
    if (checksum != data[4]) {
        ESP_LOGE(TAG, "Checksum mismatch! Got: 0x%02X, Expected: 0x%02X (Raw bytes: %02X %02X %02X %02X %02X)",
                 checksum, data[4], data[0], data[1], data[2], data[3], data[4]);
        return ESP_ERR_INVALID_CRC;
    }

    // For DHT11:
    // data[0] = Humidity integer, data[1] = Humidity decimal
    // data[2] = Temperature integer, data[3] = Temperature decimal
    *humidity = (float)data[0] + ((float)data[1] * 0.1f);
    *temperature = (float)data[2] + ((float)data[3] * 0.1f);

    ESP_LOGD(TAG, "Read success: Temp=%.1f C, Hum=%.1f %%", *temperature, *humidity);
    return ESP_OK;
}

