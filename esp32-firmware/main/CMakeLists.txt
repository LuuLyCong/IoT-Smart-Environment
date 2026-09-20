idf_component_register(
    SRCS "soil_moisture.c" "bh1750.c" "main.c" "dht11.c" "sntp_sync.c" "wifi_manager.c" "lcd1602.c"
    INCLUDE_DIRS "."
    REQUIRES json esp_wifi esp_event nvs_flash esp_netif mqtt driver esp_timer lwip esp_adc esp_driver_i2c
)
