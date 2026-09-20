#include "soil_moisture.h"
#include "esp_adc/adc_oneshot.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

static const char *TAG = "SOIL_MOISTURE";

// On ESP32-S3, GPIO 5 corresponds to ADC1 Channel 4
#define SOIL_ADC_UNIT                ADC_UNIT_1
#define SOIL_ADC_CHANNEL             ADC_CHANNEL_4

// =====================================================
// SOIL CALIBRATION (Cảm biến HW-103)
// =====================================================
// - Chưa cắm cảm biến / Floating / ADC thấp (< 1100) -> 0%
// - Đất khô / Ngoài không khí (ADC >= 2800)          -> 0%
// - Đất ẩm (Khoảng 1200 - 2800)                     -> Tăng dần từ 0% đến 100%
// - Đất rất ướt / Cốc nước (ADC <= 1200)            -> 100%
#define SOIL_DRY_VALUE               2800
#define SOIL_WET_VALUE               1200
#define SOIL_DISCONNECTED_THRESHOLD  1100

static adc_oneshot_unit_handle_t s_adc_handle = NULL;
static bool s_initialized = false;

esp_err_t soil_sensor_init(void)
{
    if (s_initialized && s_adc_handle != NULL) {
        return ESP_OK;
    }

    adc_oneshot_unit_init_cfg_t init_config = {
        .unit_id = SOIL_ADC_UNIT,
    };

    esp_err_t ret = adc_oneshot_new_unit(&init_config, &s_adc_handle);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to initialize ADC1 oneshot unit: %s", esp_err_to_name(ret));
        return ret;
    }

    adc_oneshot_chan_cfg_t chan_config = {
        .bitwidth = ADC_BITWIDTH_DEFAULT,
        .atten = ADC_ATTEN_DB_12,
    };

    ret = adc_oneshot_config_channel(s_adc_handle, SOIL_ADC_CHANNEL, &chan_config);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Failed to configure ADC channel 4 (GPIO 5): %s", esp_err_to_name(ret));
        return ret;
    }

    s_initialized = true;
    ESP_LOGI(TAG, "Soil moisture ADC initialized successfully on GPIO 5 (ADC1_CH4)");
    return ESP_OK;
}

esp_err_t soil_sensor_read(float *moisture_percent, int *raw_out)
{
    if (!moisture_percent) {
        return ESP_ERR_INVALID_ARG;
    }

    if (!s_initialized || s_adc_handle == NULL) {
        esp_err_t err = soil_sensor_init();
        if (err != ESP_OK) {
            return err;
        }
    }

    // Take 7 samples and use a Median Filter to discard RF/Wi-Fi noise spikes
    int samples[7];
    int valid_count = 0;
    for (int i = 0; i < 7; i++) {
        int sample = 0;
        esp_err_t err = adc_oneshot_read(s_adc_handle, SOIL_ADC_CHANNEL, &sample);
        if (err == ESP_OK) {
            samples[valid_count++] = sample;
        }
        vTaskDelay(pdMS_TO_TICKS(15));
    }

    if (valid_count == 0) {
        ESP_LOGE(TAG, "Failed to read ADC from GPIO 5");
        return ESP_FAIL;
    }

    // Sort samples to find median
    for (int i = 0; i < valid_count - 1; i++) {
        for (int j = i + 1; j < valid_count; j++) {
            if (samples[i] > samples[j]) {
                int tmp = samples[i];
                samples[i] = samples[j];
                samples[j] = tmp;
            }
        }
    }

    int median_raw = samples[valid_count / 2];
    if (raw_out) {
        *raw_out = median_raw;
    }

    // 1. Kiểm tra trạng thái chưa cắm / không có tín hiệu / floating:
    // Theo quy ước HW-103: ADC thấp (< 700) -> 0%
    if (median_raw < SOIL_DISCONNECTED_THRESHOLD) {
        *moisture_percent = 0.0f;
        return ESP_OK;
    }

    // 2. Chuyển đổi ADC -> Phần trăm
    // SOIL_DRY_VALUE = 3000 -> 0%
    // SOIL_WET_VALUE = 1200 -> 100%
    int denominator = SOIL_DRY_VALUE - SOIL_WET_VALUE;
    if (denominator == 0) {
        *moisture_percent = 0.0f;
        return ESP_OK;
    }

    float pct = (float)(SOIL_DRY_VALUE - median_raw) * 100.0f / (float)denominator;

    if (pct < 0.0f) pct = 0.0f;
    if (pct > 100.0f) pct = 100.0f;

    *moisture_percent = pct;
    return ESP_OK;
}
