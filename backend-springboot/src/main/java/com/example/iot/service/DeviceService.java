package com.example.iot.service;

import com.example.iot.dto.StatusPayload;
import com.example.iot.entity.Device;
import com.example.iot.repository.DeviceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class DeviceService {

    private final DeviceRepository deviceRepository;

    @Transactional
    public void processStatus(StatusPayload payload) {
        if (payload.getDeviceId() == null) return;
        
        Optional<Device> deviceOpt = deviceRepository.findByDeviceId(payload.getDeviceId());
        if (deviceOpt.isPresent()) {
            Device device = deviceOpt.get();
            device.setStatus(payload.getStatus());
            device.setLastSeenAt(payload.getTimestamp() != null ? payload.getTimestamp() : ZonedDateTime.now());
            device.setUpdatedAt(ZonedDateTime.now());
            deviceRepository.save(device);
            log.info("Device {} status updated to {}", device.getDeviceId(), device.getStatus());
        } else {
            // Auto register device if needed, or just log
            log.warn("Status received for unknown device: {}", payload.getDeviceId());
            Device device = new Device();
            device.setId(UUID.randomUUID());
            device.setDeviceId(payload.getDeviceId());
            device.setName("Auto-registered " + payload.getDeviceId());
            device.setType("UNKNOWN");
            device.setStatus(payload.getStatus());
            device.setLedState(false);
            device.setLastSeenAt(payload.getTimestamp() != null ? payload.getTimestamp() : ZonedDateTime.now());
            device.setCreatedAt(ZonedDateTime.now());
            device.setUpdatedAt(ZonedDateTime.now());
            deviceRepository.save(device);
        }
    }

    /**
     * Heartbeat watchdog: If an ONLINE device has not sent telemetry / data for > 10 seconds,
     * immediately mark it as OFFLINE.
     */
    @org.springframework.scheduling.annotation.Scheduled(fixedRate = 3000)
    @Transactional
    public void checkDeviceInactivity() {
        ZonedDateTime cutoff = ZonedDateTime.now().minusSeconds(10);
        List<Device> devices = deviceRepository.findAll();
        for (Device device : devices) {
            if ("ONLINE".equals(device.getStatus())) {
                if (device.getLastSeenAt() == null || device.getLastSeenAt().isBefore(cutoff)) {
                    device.setStatus("OFFLINE");
                    device.setUpdatedAt(ZonedDateTime.now());
                    deviceRepository.save(device);
                    log.info("Watchdog: Device {} set to OFFLINE due to inactivity (last seen: {})",
                            device.getDeviceId(), device.getLastSeenAt());
                }
            }
        }
    }

    @Transactional
    public List<Device> getAllDevices() {
        List<Device> devices = deviceRepository.findAll();
        ZonedDateTime cutoff = ZonedDateTime.now().minusSeconds(10);
        for (Device device : devices) {
            if ("ONLINE".equals(device.getStatus()) && (device.getLastSeenAt() == null || device.getLastSeenAt().isBefore(cutoff))) {
                device.setStatus("OFFLINE");
                device.setUpdatedAt(ZonedDateTime.now());
                deviceRepository.save(device);
            }
        }
        return devices;
    }

    @Transactional
    public Device getDeviceByDeviceId(String deviceId) {
        Device device = deviceRepository.findByDeviceId(deviceId)
                .orElseThrow(() -> new RuntimeException("Device not found"));
        ZonedDateTime cutoff = ZonedDateTime.now().minusSeconds(10);
        if ("ONLINE".equals(device.getStatus()) && (device.getLastSeenAt() == null || device.getLastSeenAt().isBefore(cutoff))) {
            device.setStatus("OFFLINE");
            device.setUpdatedAt(ZonedDateTime.now());
            device = deviceRepository.save(device);
        }
        return device;
    }
}
