package com.example.iot.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Column;
import lombok.Data;
import java.time.ZonedDateTime;
import java.util.UUID;

@Data
@Entity
@Table(name = "alerts")
public class Alert {
    @Id
    private UUID id;

    @Column(name = "device_id", nullable = false)
    private String deviceId;

    private String type; // e.g., HIGH_TEMPERATURE

    private String message;

    @Column(name = "val")
    private Double val;

    private Double threshold;

    @Column(name = "created_at")
    private ZonedDateTime createdAt;
}
