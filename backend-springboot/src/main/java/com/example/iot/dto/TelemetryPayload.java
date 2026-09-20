package com.example.iot.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import java.time.ZonedDateTime;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class TelemetryPayload {
    private String deviceId;
    private Double temperature;
    private Double humidity;
    private Double illuminance;
    private Double soilMoisture;
    private Boolean led;
    private Boolean buzzer;
    private ZonedDateTime timestamp;
}
