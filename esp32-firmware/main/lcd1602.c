#include "lcd1602.h"
#include <stdio.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/semphr.h"
#include "driver/i2c_master.h"
#include "esp_log.h"
#include "esp_rom_sys.h"

static const char *TAG = "LCD1602";

#define I2C_MASTER_NUM          I2C_NUM_0
#define LCD_DEFAULT_ADDR        0x27

#define LCD_BACKLIGHT           0x08
#define LCD_ENABLE              0x04
#define LCD_RS                  0x01

static i2c_master_bus_handle_t s_bus_handle = NULL;
static i2c_master_dev_handle_t s_lcd_handle = NULL;
static uint8_t s_lcd_addr = LCD_DEFAULT_ADDR;
static bool s_initialized = false;
static uint8_t s_backlight_val = LCD_BACKLIGHT;

// Mutex & Buffer phục vụ tính năng chạy chữ (Marquee / Scrolling text)
static SemaphoreHandle_t s_lcd_mutex = NULL;
static char s_line1_text[128] = "ESP32-S3 IoT";
static char s_line2_text[128] = "Coc coc! Mo cua cho anh di";
static int s_offset1 = 0;
static int s_offset2 = 0;
static int s_pause1 = 3; // Tạm dừng ~900ms ở đầu câu trước khi cuộn
static int s_pause2 = 3;
static bool s_need_redraw1 = true;
static bool s_need_redraw2 = true;

// ============================================================
// Gửi dữ liệu tới PCF8574
// ============================================================
static esp_err_t lcd_i2c_write(uint8_t data)
{
    if (!s_lcd_handle) {
        return ESP_ERR_INVALID_STATE;
    }
    return i2c_master_transmit(s_lcd_handle, &data, 1, 50);
}

// ============================================================
// Pulse Enable
// ============================================================
static void lcd_enable_pulse(uint8_t data)
{
    lcd_i2c_write(data | LCD_ENABLE);
    esp_rom_delay_us(5);

    lcd_i2c_write(data & ~LCD_ENABLE);
    esp_rom_delay_us(50);
}

// ============================================================
// Gửi 4 bit
// ============================================================
static void lcd_write4bits(uint8_t data)
{
    lcd_i2c_write(data | s_backlight_val);
    lcd_enable_pulse(data | s_backlight_val);
}

// ============================================================
// Gửi command
// ============================================================
static void lcd_send_command(uint8_t cmd)
{
    uint8_t high = cmd & 0xF0;
    uint8_t low  = (cmd << 4) & 0xF0;

    lcd_write4bits(high);
    lcd_write4bits(low);
}

// ============================================================
// Gửi ký tự
// ============================================================
static void lcd_send_data(uint8_t data)
{
    uint8_t high = data & 0xF0;
    uint8_t low  = (data << 4) & 0xF0;

    lcd_write4bits(high | LCD_RS);
    lcd_write4bits(low | LCD_RS);
}

// ============================================================
// Khởi tạo LCD 1602 HD44780
// ============================================================
static void lcd_init_hd44780(void)
{
    vTaskDelay(pdMS_TO_TICKS(100)); // Chờ nguồn LCD ổn định > 50ms

    // Đưa LCD về chế độ 4-bit chuẩn HD44780
    lcd_write4bits(0x30);
    esp_rom_delay_us(5000); // Chờ > 4.1ms

    lcd_write4bits(0x30);
    esp_rom_delay_us(1000); // Chờ > 100us

    lcd_write4bits(0x30);
    esp_rom_delay_us(1000);

    lcd_write4bits(0x20);
    esp_rom_delay_us(2000);

    // Function set (4-bit, 2 dòng, font 5x8)
    lcd_send_command(0x28);
    esp_rom_delay_us(2000);

    // Display OFF
    lcd_send_command(0x08);
    esp_rom_delay_us(2000);

    // Clear display
    lcd_send_command(0x01);
    esp_rom_delay_us(3000);

    // Entry mode (tự động tăng con trỏ)
    lcd_send_command(0x06);
    esp_rom_delay_us(2000);

    // Display ON, Cursor OFF, Blink OFF
    lcd_send_command(0x0C);
    esp_rom_delay_us(2000);
}

// ============================================================
// Task chạy chữ tự động (Auto Marquee Scrolling Task)
// ============================================================
static void lcd_scroll_task(void *pvParameters)
{
    // Chờ quá trình khởi tạo phần cứng hoàn tất
    while (!s_initialized) {
        vTaskDelay(pdMS_TO_TICKS(100));
    }

    ESP_LOGI(TAG, "Task chạy chữ LCD đã kích hoạt (chu kỳ 300ms/bước)!");

    while (1) {
        if (s_lcd_mutex && xSemaphoreTake(s_lcd_mutex, pdMS_TO_TICKS(50)) == pdTRUE) {

            // --- Xử lý Dòng 1 ---
            int len1 = strlen(s_line1_text);
            if (len1 <= 16) {
                if (s_need_redraw1) {
                    char disp1[17];
                    snprintf(disp1, sizeof(disp1), "%-16.16s", s_line1_text);
                    lcd1602_set_cursor(0, 0);
                    lcd1602_write_string(disp1);
                    s_need_redraw1 = false;
                }
            } else {
                // len1 > 16: Tự động chạy chữ mượt mà
                if (s_offset1 == 0 && s_pause1 > 0) {
                    s_pause1--;
                } else {
                    char scroll_buf1[160];
                    snprintf(scroll_buf1, sizeof(scroll_buf1), "%s   ", s_line1_text);
                    int total_len1 = len1 + 3;

                    char disp1[17];
                    for (int i = 0; i < 16; i++) {
                        disp1[i] = scroll_buf1[(s_offset1 + i) % total_len1];
                    }
                    disp1[16] = '\0';

                    lcd1602_set_cursor(0, 0);
                    lcd1602_write_string(disp1);

                    s_offset1 = (s_offset1 + 1) % total_len1;
                    if (s_offset1 == 0) {
                        s_pause1 = 3; // Tạm dừng 900ms khi trở về đầu câu
                    }
                }
            }

            // --- Xử lý Dòng 2 ---
            int len2 = strlen(s_line2_text);
            if (len2 <= 16) {
                if (s_need_redraw2) {
                    char disp2[17];
                    snprintf(disp2, sizeof(disp2), "%-16.16s", s_line2_text);
                    lcd1602_set_cursor(0, 1);
                    lcd1602_write_string(disp2);
                    s_need_redraw2 = false;
                }
            } else {
                // len2 > 16: Tự động chạy chữ mượt mà
                if (s_offset2 == 0 && s_pause2 > 0) {
                    s_pause2--;
                } else {
                    char scroll_buf2[160];
                    snprintf(scroll_buf2, sizeof(scroll_buf2), "%s   ", s_line2_text);
                    int total_len2 = len2 + 3;

                    char disp2[17];
                    for (int i = 0; i < 16; i++) {
                        disp2[i] = scroll_buf2[(s_offset2 + i) % total_len2];
                    }
                    disp2[16] = '\0';

                    lcd1602_set_cursor(0, 1);
                    lcd1602_write_string(disp2);

                    s_offset2 = (s_offset2 + 1) % total_len2;
                    if (s_offset2 == 0) {
                        s_pause2 = 3; // Tạm dừng 900ms khi trở về đầu câu
                    }
                }
            }

            xSemaphoreGive(s_lcd_mutex);
        }

        vTaskDelay(pdMS_TO_TICKS(300));
    }
}

// ============================================================
// KHỞI TẠO LCD VỚI CHÂN I2C SDA / SCL
// ============================================================
esp_err_t lcd1602_init(gpio_num_t sda_pin, gpio_num_t scl_pin)
{
    ESP_LOGI(TAG, "============================================================");
    ESP_LOGI(TAG, "  KHOI TAO MAN HINH LCD 1602 I2C (ESP-IDF 5.x)");
    ESP_LOGI(TAG, "  Chân giao tiếp: SDA = GPIO %d, SCL = GPIO %d", sda_pin, scl_pin);
    ESP_LOGI(TAG, "============================================================");

    if (!s_lcd_mutex) {
        s_lcd_mutex = xSemaphoreCreateMutex();
    }

    i2c_master_bus_config_t bus_config = {
        .i2c_port = I2C_MASTER_NUM,
        .sda_io_num = sda_pin,
        .scl_io_num = scl_pin,
        .clk_source = I2C_CLK_SRC_DEFAULT,
        .glitch_ignore_cnt = 7,
        .flags.enable_internal_pullup = true,
    };

    esp_err_t ret = i2c_new_master_bus(&bus_config, &s_bus_handle);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Lỗi tạo I2C master bus: %s", esp_err_to_name(ret));
        return ret;
    }

    // Tự động quét kiểm tra xem LCD ở địa chỉ 0x27 hay 0x3F
    ESP_LOGI(TAG, "[I2C Scanner] Đang quét kết nối tới module LCD 1602...");
    uint8_t target_addr = 0;

    if (i2c_master_probe(s_bus_handle, 0x27, 50) == ESP_OK) {
        target_addr = 0x27;
        ESP_LOGI(TAG, ">>> [I2C Scanner] TÌM THẤY LCD 1602 TẠI ĐỊA CHỈ: 0x27 <<<");
    } else if (i2c_master_probe(s_bus_handle, 0x3F, 50) == ESP_OK) {
        target_addr = 0x3F;
        ESP_LOGI(TAG, ">>> [I2C Scanner] TÌM THẤY LCD 1602 TẠI ĐỊA CHỈ: 0x3F <<<");
    } else {
        // Quét thêm dải phụ phòng khi người dùng hàn jump địa chỉ
        for (uint8_t a = 0x20; a <= 0x3F; a++) {
            if (i2c_master_probe(s_bus_handle, a, 20) == ESP_OK) {
                target_addr = a;
                ESP_LOGI(TAG, ">>> [I2C Scanner] TÌM THẤY THIẾT BỊ I2C TẠI: 0x%02X <<<", a);
                break;
            }
        }
    }

    if (target_addr != 0) {
        s_lcd_addr = target_addr;
        ESP_LOGI(TAG, "============================================================");
        ESP_LOGI(TAG, ">>> [LCD1602] ĐÃ BẮT ĐƯỢC KẾT NỐI VÀO LCD TẠI ĐỊA CHỈ: 0x%02X <<<", s_lcd_addr);
        ESP_LOGI(TAG, "============================================================");
    } else {
        ESP_LOGE(TAG, "************************************************************");
        ESP_LOGE(TAG, ">>> [LCD1602] KHÔNG TÌM THẤY MÀN HÌNH LCD TRÊN BUS I2C! <<<");
        ESP_LOGE(TAG, "VUI LÒNG KIỂM TRA LẠI 4 DÂY CỦA LCD:");
        ESP_LOGE(TAG, "  1. LCD GND -> ESP32-S3 GND");
        ESP_LOGE(TAG, "  2. LCD VCC -> ESP32-S3 5V (hoặc VIN/VBUS, BẮT BUỘC 5V)");
        ESP_LOGE(TAG, "  3. LCD SDA -> ESP32-S3 GPIO %d", sda_pin);
        ESP_LOGE(TAG, "  4. LCD SCL -> ESP32-S3 GPIO %d", scl_pin);
        ESP_LOGE(TAG, "************************************************************");
        s_lcd_addr = LCD_DEFAULT_ADDR; // Mặc định thử tiếp 0x27
    }

    i2c_device_config_t dev_config = {
        .dev_addr_length = I2C_ADDR_BIT_LEN_7,
        .device_address = s_lcd_addr,
        .scl_speed_hz = 100000,
    };

    ret = i2c_master_bus_add_device(s_bus_handle, &dev_config, &s_lcd_handle);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Lỗi thêm thiết bị LCD vào bus I2C: %s", esp_err_to_name(ret));
        return ret;
    }

    // Thực hiện chuỗi khởi tạo phần cứng
    lcd_init_hd44780();
    s_initialized = true;

    // Khởi tạo task chạy chữ chạy ngầm
    xTaskCreate(lcd_scroll_task, "lcd_scroll_task", 3072, NULL, 4, NULL);

    ESP_LOGI(TAG, ">>> [LCD1602] KHỞI TẠO HOÀN TẤT THÀNH CÔNG (16 cột x 2 dòng, hỗ trợ Chạy Chữ) <<<");
    ESP_LOGI(TAG, "[LCD1602] LƯU Ý: Nếu màn hình chỉ hiện ô vuông hoặc không rõ nét:");
    ESP_LOGI(TAG, "  -> Vui lòng vặn nhẹ chiết áp biến trở màu xanh (10K) ở sau lưng LCD để chỉnh độ tương phản (Contrast)!");

    return ESP_OK;
}

// ============================================================
// Xóa màn hình
// ============================================================
esp_err_t lcd1602_clear(void)
{
    if (!s_initialized) return ESP_ERR_INVALID_STATE;
    lcd_send_command(0x01);
    esp_rom_delay_us(3000);
    return ESP_OK;
}

// ============================================================
// Đặt vị trí con trỏ (col 0-15, row 0-1)
// ============================================================
esp_err_t lcd1602_set_cursor(uint8_t col, uint8_t row)
{
    if (!s_initialized) return ESP_ERR_INVALID_STATE;
    if (col >= 16) col = 15;
    uint8_t row_offsets[] = {0x00, 0x40};
    if (row > 1) row = 1;
    lcd_send_command(0x80 + row_offsets[row] + col);
    return ESP_OK;
}

// ============================================================
// In chuỗi ký tự ASCII
// ============================================================
esp_err_t lcd1602_write_string(const char *str)
{
    if (!s_initialized || !str) return ESP_ERR_INVALID_STATE;
    while (*str) {
        lcd_send_data((uint8_t)(*str++));
    }
    return ESP_OK;
}

// ============================================================
// Bật/Tắt đèn nền LCD
// ============================================================
esp_err_t lcd1602_set_backlight(bool enable)
{
    s_backlight_val = enable ? LCD_BACKLIGHT : 0;
    return lcd_i2c_write(s_backlight_val);
}

// ============================================================
// Chuyển đổi tiếng Việt có dấu sang ASCII không dấu
// ============================================================
void lcd1602_remove_accents(const char *src, char *dst, size_t max_len)
{
    if (!src || !dst || max_len == 0) return;

    size_t out_idx = 0;
    size_t in_idx = 0;
    size_t src_len = strlen(src);

    while (in_idx < src_len && out_idx < max_len - 1) {
        unsigned char c = (unsigned char)src[in_idx];

        if (c < 128) {
            dst[out_idx++] = (char)c;
            in_idx++;
        } else if (c == 0xC3) {
            in_idx++;
            if (in_idx >= src_len) break;
            unsigned char c2 = (unsigned char)src[in_idx++];
            if (c2 >= 0x80 && c2 <= 0x85) dst[out_idx++] = 'A';
            else if (c2 >= 0xA0 && c2 <= 0xA5) dst[out_idx++] = 'a';
            else if (c2 >= 0x88 && c2 <= 0x8B) dst[out_idx++] = 'E';
            else if (c2 >= 0xA8 && c2 <= 0xAB) dst[out_idx++] = 'e';
            else if (c2 >= 0x8C && c2 <= 0x8F) dst[out_idx++] = 'I';
            else if (c2 >= 0xAC && c2 <= 0xAF) dst[out_idx++] = 'i';
            else if (c2 >= 0x92 && c2 <= 0x96) dst[out_idx++] = 'O';
            else if (c2 >= 0xB2 && c2 <= 0xB6) dst[out_idx++] = 'o';
            else if (c2 >= 0x99 && c2 <= 0x9C) dst[out_idx++] = 'U';
            else if (c2 >= 0xB9 && c2 <= 0xBC) dst[out_idx++] = 'u';
            else if (c2 == 0x9D) dst[out_idx++] = 'Y';
            else if (c2 == 0xBD) dst[out_idx++] = 'y';
            else dst[out_idx++] = ' ';
        } else if (c == 0xC4 || c == 0xC5) {
            in_idx++;
            if (in_idx >= src_len) break;
            unsigned char c2 = (unsigned char)src[in_idx++];
            if (c == 0xC4 && (c2 == 0x90 || c2 == 0x91)) dst[out_idx++] = (c2 == 0x90) ? 'D' : 'd';
            else if (c == 0xC4 && (c2 == 0x82 || c2 == 0x83)) dst[out_idx++] = (c2 == 0x82) ? 'A' : 'a';
            else if (c == 0xC5 && (c2 == 0xA8 || c2 == 0xA9)) dst[out_idx++] = (c2 == 0xA8) ? 'U' : 'u';
            else dst[out_idx++] = ' ';
        } else if (c == 0xE1) {
            in_idx++;
            if (in_idx + 1 >= src_len) break;
            unsigned char c2 = (unsigned char)src[in_idx++];
            unsigned char c3 = (unsigned char)src[in_idx++];
            if (c2 == 0xBA || c2 == 0xBB) {
                if (c2 == 0xBA) {
                    if (c3 <= 0x9B) dst[out_idx++] = (c3 % 2 == 0) ? 'A' : 'a';
                    else if (c3 <= 0xB9) dst[out_idx++] = (c3 % 2 == 0) ? 'E' : 'e';
                    else dst[out_idx++] = (c3 % 2 == 0) ? 'I' : 'i';
                } else {
                    if (c3 <= 0x97) dst[out_idx++] = (c3 % 2 == 0) ? 'O' : 'o';
                    else if (c3 <= 0xB1) dst[out_idx++] = (c3 % 2 == 0) ? 'U' : 'u';
                    else dst[out_idx++] = (c3 % 2 == 0) ? 'Y' : 'y';
                }
            } else {
                dst[out_idx++] = ' ';
            }
        } else {
            in_idx++;
        }
    }
    dst[out_idx] = '\0';
}

// ============================================================
// Cập nhật nội dung hiển thị 2 dòng (Hỗ trợ câu dài, tự động chạy chữ)
// ============================================================
esp_err_t lcd1602_display_lines(const char *line1, const char *line2)
{
    if (!s_initialized) {
        ESP_LOGW(TAG, "LCD1602 chưa được khởi tạo!");
        return ESP_ERR_INVALID_STATE;
    }

    if (s_lcd_mutex && xSemaphoreTake(s_lcd_mutex, pdMS_TO_TICKS(100)) == pdTRUE) {
        char buf[128];

        if (line1 && strlen(line1) > 0) {
            lcd1602_remove_accents(line1, buf, sizeof(buf));
            strncpy(s_line1_text, buf, sizeof(s_line1_text) - 1);
            s_line1_text[sizeof(s_line1_text) - 1] = '\0';
        } else {
            s_line1_text[0] = '\0';
        }

        if (line2 && strlen(line2) > 0) {
            lcd1602_remove_accents(line2, buf, sizeof(buf));
            strncpy(s_line2_text, buf, sizeof(s_line2_text) - 1);
            s_line2_text[sizeof(s_line2_text) - 1] = '\0';
        } else {
            s_line2_text[0] = '\0';
        }

        s_offset1 = 0;
        s_offset2 = 0;
        s_pause1 = 3;
        s_pause2 = 3;
        s_need_redraw1 = true;
        s_need_redraw2 = true;

        xSemaphoreGive(s_lcd_mutex);
        ESP_LOGI(TAG, "LCD ĐÃ CẬP NHẬT: [Dòng 1: \"%s\"] [Dòng 2: \"%s\"]", s_line1_text, s_line2_text);
    }
    return ESP_OK;
}

void* lcd1602_get_i2c_bus_handle(void)
{
    return (void*)s_bus_handle;
}
