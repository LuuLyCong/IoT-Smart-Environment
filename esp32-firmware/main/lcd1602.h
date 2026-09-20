#ifndef LCD1602_H
#define LCD1602_H

#include <stdbool.h>
#include <stdint.h>
#include <stddef.h>
#include "esp_err.h"
#include "driver/gpio.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Initialize LCD1602 with PCF8574 backpack over I2C.
 * Automatically scans and probes common I2C addresses (0x27, 0x3F, etc.).
 *
 * @param sda_pin GPIO number for I2C SDA
 * @param scl_pin GPIO number for I2C SCL
 * @return ESP_OK on success, or appropriate error code.
 */
esp_err_t lcd1602_init(gpio_num_t sda_pin, gpio_num_t scl_pin);

/**
 * @brief Clear the LCD display.
 */
esp_err_t lcd1602_clear(void);

/**
 * @brief Move cursor to specified column and row.
 * @param col Column (0 to 15)
 * @param row Row (0 to 1)
 */
esp_err_t lcd1602_set_cursor(uint8_t col, uint8_t row);

/**
 * @brief Write an ASCII string at current cursor position.
 * Strings longer than remaining columns in row will truncate.
 */
esp_err_t lcd1602_write_string(const char *str);

/**
 * @brief Turn LCD backlight ON or OFF.
 */
esp_err_t lcd1602_set_backlight(bool enable);

/**
 * @brief Display 2 lines of text on the LCD.
 * Clears display, pads with spaces or truncates to 16 chars per line.
 * Automatically converts Vietnamese accented characters to standard ASCII.
 *
 * @param line1 Text for Row 0 (max 16 visible characters)
 * @param line2 Text for Row 1 (max 16 visible characters)
 */
esp_err_t lcd1602_display_lines(const char *line1, const char *line2);

/**
 * @brief Helper utility to convert Vietnamese accented UTF-8 string to plain ASCII
 * to prevent garbled characters on HD44780 ROM-A00/A02 character generator.
 */
void lcd1602_remove_accents(const char *src, char *dst, size_t max_len);

/**
 * @brief Get the shared I2C master bus handle created by LCD1602
 * Allows other I2C devices (e.g. BH1750 light sensor) to attach to the same bus.
 */
void* lcd1602_get_i2c_bus_handle(void);

#ifdef __cplusplus
}
#endif

#endif // LCD1602_H

