package com.example.iot.service;

import com.example.iot.dto.TelemetryPayload;
import com.example.iot.entity.Device;
import com.example.iot.entity.Telemetry;
import com.example.iot.repository.DeviceRepository;
import com.example.iot.repository.TelemetryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZonedDateTime;
import java.util.Optional;
import java.util.UUID;

import com.example.iot.entity.Alert;
import com.example.iot.repository.AlertRepository;

@Slf4j
@Service
@RequiredArgsConstructor
public class TelemetryService {

    private final TelemetryRepository telemetryRepository;
    private final DeviceRepository deviceRepository;
    private final AlertRepository alertRepository;

    @Transactional
    public void processTelemetry(TelemetryPayload payload) {
        if (payload.getDeviceId() == null)
            return;

        Optional<Device> deviceOpt = deviceRepository.findByDeviceId(payload.getDeviceId());
        if (deviceOpt.isPresent()) {
            Device device = deviceOpt.get();
            device.setLastSeenAt(ZonedDateTime.now());
            if (payload.getLed() != null) {
                device.setLedState(payload.getLed());
            }
            if (!"ONLINE".equals(device.getStatus())) {
                device.setStatus("ONLINE");
                log.info("Device {} status updated to ONLINE via telemetry", device.getDeviceId());
            }
            device.setUpdatedAt(ZonedDateTime.now());
            deviceRepository.save(device);

            Telemetry telemetry = new Telemetry();
            telemetry.setId(UUID.randomUUID());
            telemetry.setDeviceId(payload.getDeviceId());
            Double temp = payload.getTemperature() != null 
                    ? Math.round(payload.getTemperature() * 10.0) / 10.0 : null;
            Double hum = payload.getHumidity() != null 
                    ? Math.round(payload.getHumidity() * 10.0) / 10.0 : null;
            telemetry.setTemperature(temp);
            telemetry.setHumidity(hum);
            telemetry.setIlluminance(payload.getIlluminance());
            telemetry.setSoilMoisture(payload.getSoilMoisture());
            telemetry.setLedState(payload.getLed());
            telemetry.setRecordedAt(payload.getTimestamp() != null ? payload.getTimestamp() : ZonedDateTime.now());
            telemetry.setReceivedAt(ZonedDateTime.now());

            telemetryRepository.save(telemetry);
            log.info("Saved telemetry for device: {}", payload.getDeviceId());

            // Check high temperature alert (> 35°C)
            if (temp != null && temp > 35.0) {
                log.warn("HIGH_TEMPERATURE ALERT for device {}: {}°C (> 35.0°C)", payload.getDeviceId(), temp);
                Alert alert = new Alert();
                alert.setId(UUID.randomUUID());
                alert.setDeviceId(payload.getDeviceId());
                alert.setType("HIGH_TEMPERATURE");
                alert.setMessage(
                        String.format("Temperature %.1f°C exceeded safety threshold 35.0°C", temp));
                alert.setVal(temp);
                alert.setThreshold(35.0);
                alert.setCreatedAt(ZonedDateTime.now());
                alertRepository.save(alert);
            }
        } else {
            log.warn("Telemetry received for unknown device: {}", payload.getDeviceId());
        }
    }

    public Telemetry getLatestTelemetry(String deviceId) {
        return telemetryRepository.findFirstByDeviceIdOrderByRecordedAtDesc(deviceId)
                .orElse(null);
    }

    public Page<Telemetry> getTelemetryHistory(String deviceId, ZonedDateTime from, ZonedDateTime to,
            Pageable pageable) {
        if (from != null && to != null) {
            return telemetryRepository.findByDeviceIdAndRecordedAtBetweenOrderByRecordedAtDesc(deviceId, from, to,
                    pageable);
        }
        return telemetryRepository.findByDeviceIdOrderByRecordedAtDesc(deviceId, pageable);
    }

    public Page<Alert> getAlerts(String deviceId, Pageable pageable) {
        return alertRepository.findByDeviceIdOrderByCreatedAtDesc(deviceId, pageable);
    }

    public java.util.List<Alert> getRecentAlerts(String deviceId) {
        return alertRepository.findTop10ByDeviceIdOrderByCreatedAtDesc(deviceId);
    }
}
