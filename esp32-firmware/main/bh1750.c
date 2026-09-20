#include "bh1750.h"
#include "lcd1602.h"
#include "driver/i2c_master.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

static const char *TAG = "BH1750";

#define BH1750_ADDR_PRIMARY    0x23
#define BH1750_ADDR_SECONDARY  0x5C

#define CMD_POWER_ON           0x01
#define CMD_RESET              0x07
#define CMD_CONTINUOUS_H_RES   0x10

static i2c_master_bus_handle_t s_bus_handle = NULL;
static i2c_master_dev_handle_t s_dev_handle = NULL;
static uint8_t s_active_addr = BH1750_ADDR_PRIMARY;
static bool s_initialized = false;

esp_err_t bh1750_init(gpio_num_t sda_pin, gpio_num_t scl_pin)
{
    // Kiểm tra xem LCD1602 đã tạo I2C bus chưa để dùng chung bus
    i2c_master_bus_handle_t bus = (i2c_master_bus_handle_t)lcd1602_get_i2c_bus_handle();
    if (bus) {
        s_bus_handle = bus;
        ESP_LOGI(TAG, "Sử dụng chung I2C Master Bus với LCD1602 (SDA=GPIO%d, SCL=GPIO%d)", sda_pin, scl_pin);
    } else {
        // Nếu LCD1602 chưa tạo, tự khởi tạo I2C Bus mới
        i2c_master_bus_config_t bus_config = {
            .i2c_port = I2C_NUM_0,
            .sda_io_num = sda_pin,
            .scl_io_num = scl_pin,
            .clk_source = I2C_CLK_SRC_DEFAULT,
            .glitch_ignore_cnt = 7,
            .flags.enable_internal_pullup = true,
        };
        esp_err_t ret = i2c_new_master_bus(&bus_config, &s_bus_handle);
        if (ret != ESP_OK) {
            ESP_LOGE(TAG, "Lỗi tạo I2C bus cho BH1750: %s", esp_err_to_name(ret));
            s_initialized = false;
            return ret;
        }
    }

    // Quét tìm BH1750 ở địa chỉ 0x23 hoặc 0x5C
    uint8_t target_addr = 0;
    if (i2c_master_probe(s_bus_handle, BH1750_ADDR_PRIMARY, 50) == ESP_OK) {
        target_addr = BH1750_ADDR_PRIMARY;
        ESP_LOGI(TAG, "Đã phát hiện cảm biến BH1750 tại địa chỉ 0x%02X!", target_addr);
    } else if (i2c_master_probe(s_bus_handle, BH1750_ADDR_SECONDARY, 50) == ESP_OK) {
        target_addr = BH1750_ADDR_SECONDARY;
        ESP_LOGI(TAG, "Đã phát hiện cảm biến BH1750 tại địa chỉ 0x%02X (ADDR=VCC)!", target_addr);
    } else {
        ESP_LOGW(TAG, "Không tìm thấy BH1750 ở địa chỉ 0x23 hay 0x5C. Vui lòng kiểm tra dây nối (SDA=GPIO%d, SCL=GPIO%d, VCC=3.3V, GND)", sda_pin, scl_pin);
        s_initialized = false;
        return ESP_ERR_NOT_FOUND;
    }

    s_active_addr = target_addr;

    i2c_device_config_t dev_cfg = {
        .dev_addr_length = I2C_ADDR_BIT_LEN_7,
        .device_address = target_addr,
        .scl_speed_hz = 100000,
    };

    if (s_dev_handle) {
        i2c_master_bus_rm_device(s_dev_handle);
        s_dev_handle = NULL;
    }

    esp_err_t ret = i2c_master_bus_add_device(s_bus_handle, &dev_cfg, &s_dev_handle);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Lỗi add BH1750 vào bus: %s", esp_err_to_name(ret));
        s_initialized = false;
        return ret;
    }

    // Gửi lệnh bật nguồn (Power On)
    uint8_t cmd = CMD_POWER_ON;
    i2c_master_transmit(s_dev_handle, &cmd, 1, 100);
    vTaskDelay(pdMS_TO_TICKS(10));

    // Cấu hình chế độ đo liên tục độ phân giải cao (Continuous H-Resolution Mode)
    cmd = CMD_CONTINUOUS_H_RES;
    ret = i2c_master_transmit(s_dev_handle, &cmd, 1, 100);
    if (ret == ESP_OK) {
        s_initialized = true;
        ESP_LOGI(TAG, "Khởi tạo BH1750 thành công! Chế độ: Continuous H-Res (SDA=GPIO%d, SCL=GPIO%d)", sda_pin, scl_pin);
    } else {
        ESP_LOGE(TAG, "Lỗi gửi lệnh cấu hình cho BH1750: %s", esp_err_to_name(ret));
        s_initialized = false;
    }
    return ret;
}

esp_err_t bh1750_read_lux(float *lux)
{
    if (!lux) {
        return ESP_ERR_INVALID_ARG;
    }

    if (!s_initialized || !s_dev_handle) {
        return ESP_ERR_INVALID_STATE;
    }

    uint8_t data[2] = {0};
    esp_err_t ret = i2c_master_receive(s_dev_handle, data, 2, 100);
    if (ret == ESP_OK) {
        uint16_t raw_val = (data[0] << 8) | data[1];
        // Công thức chuẩn Datasheet ROHM BH1750FVI: Lux = raw / 1.2
        *lux = (float)raw_val / 1.2f;
        return ESP_OK;
    } else {
        ESP_LOGW(TAG, "Lỗi đọc dữ liệu từ BH1750: %s", esp_err_to_name(ret));
        return ret;
    }
}
