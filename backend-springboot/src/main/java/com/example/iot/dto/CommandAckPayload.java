package com.example.iot.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import java.time.ZonedDateTime;
import java.util.UUID;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class CommandAckPayload {
    private UUID commandId;
    private String deviceId;
    private String action;
    private String status;
    private Boolean led;
    private Boolean buzzer;
    private ZonedDateTime timestamp;
}
