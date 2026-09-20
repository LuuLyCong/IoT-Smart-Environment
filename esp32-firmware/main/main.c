#include <stdio.h>
#include <stdint.h>
#include <stddef.h>
#include <string.h>
#include <inttypes.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/semphr.h"
#include "freertos/queue.h"

#include "esp_system.h"
#include "nvs_flash.h"
#include "esp_event.h"
#include "esp_netif.h"
#include "esp_log.h"
#include "mqtt_client.h"
#include "driver/gpio.h"
#include "cJSON.h"

#include "dht11.h"
#include "sntp_sync.h"
#include "wifi_manager.h"
#include "bh1750.h"
#include "soil_moisture.h"
#include "lcd1602.h"

static const char *TAG = "IOT_ESP32";

#ifdef CONFIG_IOT_DEVICE_ID
#define DEVICE_ID CONFIG_IOT_DEVICE_ID
#else
#define DEVICE_ID "esp32-001"
#endif

#define BUZZER_PIN              GPIO_NUM_18
#define LCD_SDA_PIN             GPIO_NUM_9
#define LCD_SCL_PIN             GPIO_NUM_10

#ifdef CONFIG_SOIL_MOISTURE_GPIO
#define SOIL_PIN ((gpio_num_t)CONFIG_SOIL_MOISTURE_GPIO)
#else
#define SOIL_PIN GPIO_NUM_5
#endif

#ifdef CONFIG_MQTT_BROKER_URL
#define MQTT_BROKER_URL CONFIG_MQTT_BROKER_URL
#else
#define MQTT_BROKER_URL "mqtt://10.205.26.168:1883"
#endif

#ifdef CONFIG_DHT_DATA_GPIO
#define DHT_PIN ((gpio_num_t)CONFIG_DHT_DATA_GPIO)
#else
#define DHT_PIN GPIO_NUM_15
#endif

#ifdef CONFIG_LED_GPIO
#define LED_PIN ((gpio_num_t)CONFIG_LED_GPIO)
#else
#define LED_PIN GPIO_NUM_2
#endif

#ifdef CONFIG_ESP_WIFI_SSID
#define WIFI_SSID CONFIG_ESP_WIFI_SSID
#else
#define WIFI_SSID "MyWiFiNetwork"
#endif

#ifdef CONFIG_ESP_WIFI_PASSWORD
#define WIFI_PASSWORD CONFIG_ESP_WIFI_PASSWORD
#else
#define WIFI_PASSWORD "MyWiFiPassword"
#endif

static bool s_led_state = false;
static bool s_buzzer_state = false;
static bool s_mqtt_connected = false;
static esp_mqtt_client_handle_t s_mqtt_client = NULL;

static void publish_online_status(esp_mqtt_client_handle_t client)
{
    char timestamp[32];
    if (!sntp_get_iso8601_utc(timestamp, sizeof(timestamp))) {
        strcpy(timestamp, "2026-09-14T00:00:00Z");
    }

    char status_topic[128];
    snprintf(status_topic, sizeof(status_topic), "device/%s/status", DEVICE_ID);

    cJSON *root = cJSON_CreateObject();
    cJSON_AddStringToObject(root, "deviceId", DEVICE_ID);
    cJSON_AddStringToObject(root, "status", "ONLINE");
    cJSON_AddStringToObject(root, "timestamp", timestamp);

    char *payload = cJSON_PrintUnformatted(root);
    if (payload) {
        // Publish ONLINE retained with QoS 1
        int msg_id = esp_mqtt_client_publish(client, status_topic, payload, 0, 1, 1);
        ESP_LOGI(TAG, "Published ONLINE status (retained) to %s (msg_id=%d): %s", status_topic, msg_id, payload);
        free(payload);
    }
    cJSON_Delete(root);
}

static void handle_command(esp_mqtt_client_handle_t client, const char *data, int data_len)
{
    if (data_len <= 0) return;

    // Allocate null-terminated buffer for JSON parsing
    char *json_buf = malloc(data_len + 1);
    if (!json_buf) {
        ESP_LOGE(TAG, "Failed to allocate memory for command JSON");
        return;
    }
    memcpy(json_buf, data, data_len);
    json_buf[data_len] = '\0';

    ESP_LOGI(TAG, "Processing incoming command: %s", json_buf);

    cJSON *root = cJSON_Parse(json_buf);
    free(json_buf);

    if (!root) {
        ESP_LOGE(TAG, "JSON parsing error: [%s]", cJSON_GetErrorPtr());
        return;
    }

    cJSON *cmd_id_item = cJSON_GetObjectItem(root, "commandId");
    cJSON *action_item = cJSON_GetObjectItem(root, "action");

    if (!cJSON_IsString(cmd_id_item) || !cJSON_IsString(action_item)) {
        ESP_LOGE(TAG, "Invalid command payload: missing commandId or action");
        cJSON_Delete(root);
        return;
    }

    const char *command_id = cmd_id_item->valuestring;
    const char *action = action_item->valuestring;

    ESP_LOGI(TAG, "Command ID: %s, Action: %s", command_id, action);

    // Execute hardware action
    if (strcmp(action, "LED_ON") == 0) {
        s_led_state = true;
        gpio_set_level(LED_PIN, 1);
        ESP_LOGI(TAG, "LED ON (GPIO %d = HIGH)", LED_PIN);
    } else if (strcmp(action, "LED_OFF") == 0) {
        s_led_state = false;
        gpio_set_level(LED_PIN, 0);
        ESP_LOGI(TAG, "LED OFF (GPIO %d = LOW)", LED_PIN);
    } else if (strcmp(action, "BUZZER_ON") == 0) {
        s_buzzer_state = true;
        gpio_set_level(BUZZER_PIN, 0); // Active-Low: Mức 0 = HÚ CÒI
        ESP_LOGI(TAG, "BUZZER ON (GPIO %d = LOW / Kêu còi)", BUZZER_PIN);
    } else if (strcmp(action, "BUZZER_OFF") == 0) {
        s_buzzer_state = false;
        gpio_set_level(BUZZER_PIN, 1); // Active-Low: Mức 1 = TẮT CÒI
        ESP_LOGI(TAG, "BUZZER OFF (GPIO %d = HIGH / Tắt còi)", BUZZER_PIN);
    } else if (strcmp(action, "DISPLAY_TEXT") == 0) {
        cJSON *line1_item = cJSON_GetObjectItem(root, "line1");
        cJSON *line2_item = cJSON_GetObjectItem(root, "line2");
        const char *l1 = cJSON_IsString(line1_item) ? line1_item->valuestring : "";
        const char *l2 = cJSON_IsString(line2_item) ? line2_item->valuestring : "";
        lcd1602_display_lines(l1, l2);
        ESP_LOGI(TAG, "LCD DISPLAY_TEXT executed: Line1=\"%s\", Line2=\"%s\"", l1, l2);
    } else {
        ESP_LOGW(TAG, "Unknown action received: %s", action);
    }

    // Build ACK JSON retaining EXACT commandId from backend
    char timestamp[32];
    if (!sntp_get_iso8601_utc(timestamp, sizeof(timestamp))) {
        strcpy(timestamp, "2026-09-14T00:00:00Z");
    }

    char ack_topic[128];
    snprintf(ack_topic, sizeof(ack_topic), "device/%s/command/ack", DEVICE_ID);

    cJSON *ack = cJSON_CreateObject();
    cJSON_AddStringToObject(ack, "commandId", command_id);
    cJSON_AddStringToObject(ack, "deviceId", DEVICE_ID);
    cJSON_AddStringToObject(ack, "action", action);
    cJSON_AddStringToObject(ack, "status", "ACKNOWLEDGED");
    cJSON_AddBoolToObject(ack, "led", s_led_state);
    cJSON_AddBoolToObject(ack, "buzzer", s_buzzer_state);
    cJSON_AddStringToObject(ack, "timestamp", timestamp);

    if (strcmp(action, "DISPLAY_TEXT") == 0) {
        cJSON *line1_item = cJSON_GetObjectItem(root, "line1");
        cJSON *line2_item = cJSON_GetObjectItem(root, "line2");
        if (cJSON_IsString(line1_item)) cJSON_AddStringToObject(ack, "line1", line1_item->valuestring);
        if (cJSON_IsString(line2_item)) cJSON_AddStringToObject(ack, "line2", line2_item->valuestring);
    }

    char *ack_str = cJSON_PrintUnformatted(ack);
    if (ack_str) {
        // Publish ACK QoS 1, Retain false
        int msg_id = esp_mqtt_client_publish(client, ack_topic, ack_str, 0, 1, 0);
        ESP_LOGI(TAG, "Sent ACK to %s (msg_id=%d): %s", ack_topic, msg_id, ack_str);
        free(ack_str);
    }
    cJSON_Delete(ack);
    cJSON_Delete(root);
}

static void mqtt_event_handler(void *handler_args, esp_event_base_t base, int32_t event_id, void *event_data)
{
    esp_mqtt_event_handle_t event = event_data;
    esp_mqtt_client_handle_t client = event->client;

    switch ((esp_mqtt_event_id_t)event_id) {
    case MQTT_EVENT_CONNECTED:
        s_mqtt_connected = true;
        ESP_LOGI(TAG, "MQTT_EVENT_CONNECTED to %s", MQTT_BROKER_URL);

        // Step 1: Publish ONLINE status retained
        publish_online_status(client);

        // Step 2: Subscribe to command topic with QoS 1
        char cmd_topic[128];
        snprintf(cmd_topic, sizeof(cmd_topic), "device/%s/command", DEVICE_ID);
        int sub_id = esp_mqtt_client_subscribe(client, cmd_topic, 1);
        ESP_LOGI(TAG, "Subscribed to %s (sub_id=%d, QoS=1)", cmd_topic, sub_id);
        break;

    case MQTT_EVENT_DISCONNECTED:
        s_mqtt_connected = false;
        ESP_LOGW(TAG, "MQTT_EVENT_DISCONNECTED");
        break;

    case MQTT_EVENT_DATA:
        ESP_LOGI(TAG, "MQTT_EVENT_DATA received on topic: %.*s", event->topic_len, event->topic);
        handle_command(client, event->data, event->data_len);
        break;

    case MQTT_EVENT_ERROR:
        ESP_LOGE(TAG, "MQTT_EVENT_ERROR");
        break;

    default:
        break;
    }
}

static char s_lwt_topic[128];
static char s_lwt_payload[256];

static void mqtt_app_start(void)
{
    snprintf(s_lwt_topic, sizeof(s_lwt_topic), "device/%s/status", DEVICE_ID);

    char timestamp[32];
    if (!sntp_get_iso8601_utc(timestamp, sizeof(timestamp))) {
        strcpy(timestamp, "2026-09-14T00:00:00Z");
    }

    cJSON *lwt_json = cJSON_CreateObject();
    cJSON_AddStringToObject(lwt_json, "deviceId", DEVICE_ID);
    cJSON_AddStringToObject(lwt_json, "status", "OFFLINE");
    cJSON_AddStringToObject(lwt_json, "timestamp", timestamp);
    char *printed = cJSON_PrintUnformatted(lwt_json);
    if (printed) {
        strncpy(s_lwt_payload, printed, sizeof(s_lwt_payload) - 1);
        s_lwt_payload[sizeof(s_lwt_payload) - 1] = '\0';
        free(printed);
    }
    cJSON_Delete(lwt_json);

    ESP_LOGI(TAG, "Configuring MQTT Last Will: topic=%s, payload=%s (QoS=1, Retain=true, Keepalive=5s)", s_lwt_topic, s_lwt_payload);

    esp_mqtt_client_config_t mqtt_cfg = {
        .broker.address.uri = MQTT_BROKER_URL,
        .session.keepalive = 5,
        .session.last_will = {
            .topic = s_lwt_topic,
            .msg = s_lwt_payload,
            .msg_len = strlen(s_lwt_payload),
            .qos = 1,
            .retain = 1
        }
    };

    s_mqtt_client = esp_mqtt_client_init(&mqtt_cfg);
    esp_mqtt_client_register_event(s_mqtt_client, ESP_EVENT_ANY_ID, mqtt_event_handler, NULL);
    esp_mqtt_client_start(s_mqtt_client);
}

static void telemetry_task(void *pvParameters)
{
    char telemetry_topic[128];
    snprintf(telemetry_topic, sizeof(telemetry_topic), "device/%s/telemetry", DEVICE_ID);

    // Allow sensor and network to stabilize
    vTaskDelay(pdMS_TO_TICKS(3000));

    while (1) {
        if (s_mqtt_connected) {
            float temp = 0.0f;
            float hum = 0.0f;
            esp_err_t err = dht11_read(DHT_PIN, &temp, &hum);

            if (err == ESP_OK) {
                ESP_LOGI(TAG, "DHT11 Sensor Read OK -> Temperature: %.1f C, Humidity: %.1f %%", temp, hum);

                // Advanced Feature check: High Temperature > 35°C
                if (temp > 35.0f) {
                    ESP_LOGW(TAG, ">>> ALERT: High temperature detected! Temp = %.1f C > 35.0 C <<<", temp);
                }

                char timestamp[32];
                if (!sntp_get_iso8601_utc(timestamp, sizeof(timestamp))) {
                    strcpy(timestamp, "2026-09-14T00:00:00Z");
                }

                // Build Telemetry JSON strictly following MQTT Contract
                // Round to 1 decimal place to prevent IEEE 754 floating-point artifacts
                double rounded_temp = ((int)(temp * 10.0f + (temp >= 0 ? 0.5f : -0.5f))) / 10.0;
                double rounded_hum = ((int)(hum * 10.0f + 0.5f)) / 10.0;

                // Read BH1750 Light Sensor (Shared I2C bus SDA=GPIO 9, SCL=GPIO 10)
                float lux = 0.0f;
                esp_err_t lux_err = bh1750_read_lux(&lux);
                if (lux_err == ESP_OK) {
                    ESP_LOGI(TAG, "BH1750 Light Sensor Read OK -> Illuminance: %.1f Lux", lux);
                } else {
                    ESP_LOGW(TAG, "BH1750 Sensor Read Failed or not plugged in (%s)", esp_err_to_name(lux_err));
                }

                // Read Soil Moisture Sensor (ADC GPIO 5)
                float soil_pct = 0.0f;
                int soil_raw = 0;
                esp_err_t soil_err = soil_sensor_read(&soil_pct, &soil_raw);
                if (soil_err == ESP_OK) {
                    ESP_LOGI(TAG, "Soil Moisture: %.1f %% (ADC raw: %d)", soil_pct, soil_raw);
                } else {
                    ESP_LOGW(TAG, "Soil Sensor Read Failed (%s)", esp_err_to_name(soil_err));
                }

                cJSON *root = cJSON_CreateObject();
                cJSON_AddStringToObject(root, "deviceId", DEVICE_ID);
                cJSON_AddNumberToObject(root, "temperature", rounded_temp);
                cJSON_AddNumberToObject(root, "humidity", rounded_hum);

                if (lux_err == ESP_OK) {
                    double rounded_lux = ((int)(lux * 10.0f + 0.5f)) / 10.0;
                    cJSON_AddNumberToObject(root, "illuminance", rounded_lux);
                } else {
                    cJSON_AddNullToObject(root, "illuminance");
                }

                if (soil_err == ESP_OK) {
                    double rounded_soil = ((int)(soil_pct * 10.0f + 0.5f)) / 10.0;
                    cJSON_AddNumberToObject(root, "soilMoisture", rounded_soil);
                } else {
                    cJSON_AddNullToObject(root, "soilMoisture");
                }

                cJSON_AddBoolToObject(root, "led", s_led_state);
                cJSON_AddBoolToObject(root, "buzzer", s_buzzer_state);
                cJSON_AddStringToObject(root, "timestamp", timestamp);

                char *payload = cJSON_PrintUnformatted(root);
                if (payload) {
                    // QoS 0, retain false
                    int msg_id = esp_mqtt_client_publish(s_mqtt_client, telemetry_topic, payload, 0, 0, 0);
                    ESP_LOGI(TAG, "Published Telemetry (msg_id=%d): %s", msg_id, payload);
                    free(payload);
                }
                cJSON_Delete(root);
            } else {
                ESP_LOGE(TAG, "DHT11 read failed (error: %s). Skipping cycle to prevent sending invalid/NaN data.", esp_err_to_name(err));
            }
        } else {
            ESP_LOGW(TAG, "Waiting for MQTT connection before publishing telemetry...");
        }

        // Loop every 5 seconds as required by specification
        vTaskDelay(pdMS_TO_TICKS(5000));
    }
}

void app_main(void)
{
    ESP_LOGI(TAG, "==================================================");
    ESP_LOGI(TAG, "  IoT Smart Environment Monitoring & Control");
    ESP_LOGI(TAG, "  ESP32-S3 Firmware (ESP-IDF 5.5.5)");
    ESP_LOGI(TAG, "  Device ID: %s", DEVICE_ID);
    ESP_LOGI(TAG, "==================================================");

    // Initialize NVS
    esp_err_t ret = nvs_flash_init();
    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);

    // Initialize Network Stack
    ESP_ERROR_CHECK(esp_netif_init());
    ESP_ERROR_CHECK(esp_event_loop_create_default());

    // Initialize GPIOs
    gpio_reset_pin(LED_PIN);
    gpio_set_direction(LED_PIN, GPIO_MODE_OUTPUT);
    gpio_set_level(LED_PIN, 0);
    ESP_LOGI(TAG, "Initialized LED GPIO %d (State: OFF)", LED_PIN);

    gpio_reset_pin(BUZZER_PIN);
    gpio_set_direction(BUZZER_PIN, GPIO_MODE_OUTPUT);
    gpio_set_level(BUZZER_PIN, 1);
    ESP_LOGI(TAG, "Initialized BUZZER GPIO %d (State: OFF, Active-Low)", BUZZER_PIN);

    dht11_init(DHT_PIN);

    // Initialize LCD1602 Display (I2C: SDA=GPIO 9, SCL=GPIO 10)
    ESP_LOGI(TAG, "Initializing LCD1602 Display (SDA=GPIO%d, SCL=GPIO%d)...", LCD_SDA_PIN, LCD_SCL_PIN);
    lcd1602_init(LCD_SDA_PIN, LCD_SCL_PIN);
    lcd1602_display_lines("ESP32-S3 IoT", "Coc coc! Mo cua cho anh di");

    // Initialize BH1750 Light Sensor (Shared I2C bus with LCD: SDA=GPIO 9, SCL=GPIO 10)
    ESP_LOGI(TAG, "Initializing BH1750 Light Sensor on shared I2C bus (SDA=GPIO%d, SCL=GPIO%d)...", LCD_SDA_PIN, LCD_SCL_PIN);
    esp_err_t bh_ret = bh1750_init(LCD_SDA_PIN, LCD_SCL_PIN);
    if (bh_ret == ESP_OK) {
        ESP_LOGI(TAG, "BH1750 Light Sensor Initialized Successfully!");
    } else {
        ESP_LOGW(TAG, "BH1750 Sensor not detected (%s). Illuminance will be sent as null until connected.", esp_err_to_name(bh_ret));
    }

    // Initialize Soil Moisture Sensor (ADC1_CH4, GPIO 5)
    ESP_LOGI(TAG, "Initializing Soil Moisture ADC (GPIO%d)...", SOIL_PIN);
    soil_sensor_init();

    // Connect to Wi-Fi
    ESP_LOGI(TAG, "Connecting to Wi-Fi (%s)...", WIFI_SSID);
    lcd1602_display_lines("Smart IoT S3", "Ket Noi WiFi...");
    ret = wifi_connect_sta(WIFI_SSID, WIFI_PASSWORD, 20000);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Wi-Fi connection failed! Continuing to retry in background...");
        lcd1602_display_lines("Smart IoT S3", "Loi WiFi!");
    } else {
        lcd1602_display_lines("Smart IoT S3", "He Thong San Sang - Ready!");
    }

    // Synchronize SNTP time
    sntp_sync_init(10000);

    // Start MQTT client with Last Will OFFLINE
    mqtt_app_start();

    // Start Telemetry Task (5 seconds period)
    xTaskCreate(telemetry_task, "telemetry_task", 4096, NULL, 5, NULL);
}
