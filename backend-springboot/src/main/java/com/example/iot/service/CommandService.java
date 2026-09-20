package com.example.iot.service;

import com.example.iot.config.MqttGateway;
import com.example.iot.dto.CommandAckPayload;
import com.example.iot.entity.Command;
import com.example.iot.entity.Device;
import com.example.iot.repository.CommandRepository;
import com.example.iot.repository.DeviceRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.ZonedDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class CommandService {

    private final CommandRepository commandRepository;
    private final DeviceRepository deviceRepository;
    private final MqttGateway mqttGateway;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public Command sendCommand(String deviceId, String action) {
        return sendCommand(deviceId, action, null, null);
    }

    public Command sendCommand(String deviceId, String action, String line1, String line2) {
        Device device = deviceRepository.findByDeviceId(deviceId)
                .orElseThrow(() -> new RuntimeException("Device not found"));

        if (!"LED_ON".equals(action) && !"LED_OFF".equals(action) 
                && !"BUZZER_ON".equals(action) && !"BUZZER_OFF".equals(action)
                && !"DISPLAY_TEXT".equals(action)) {
            throw new IllegalArgumentException("Invalid action: " + action);
        }

        // Optimistically update device LED state in DB so subsequent status queries immediately reflect it
        if ("LED_ON".equals(action)) {
            device.setLedState(true);
            device.setUpdatedAt(ZonedDateTime.now());
            deviceRepository.save(device);
        } else if ("LED_OFF".equals(action)) {
            device.setLedState(false);
            device.setUpdatedAt(ZonedDateTime.now());
            deviceRepository.save(device);
        }

        Command command = new Command();
        command.setId(UUID.randomUUID());
        command.setDeviceId(deviceId);
        command.setAction(action);
        command.setStatus("SENT");
        command.setCreatedAt(ZonedDateTime.now());
        command.setSentAt(ZonedDateTime.now());
        
        String username = SecurityContextHolder.getContext().getAuthentication() != null 
                ? SecurityContextHolder.getContext().getAuthentication().getName() : "system";
        command.setCreatedBy(username);

        try {
            Map<String, Object> payloadMap = new HashMap<>();
            payloadMap.put("commandId", command.getId().toString());
            payloadMap.put("action", action);
            payloadMap.put("timestamp", ZonedDateTime.now().toString());
            if ("DISPLAY_TEXT".equals(action)) {
                payloadMap.put("line1", line1 != null ? line1 : "");
                payloadMap.put("line2", line2 != null ? line2 : "");
            }
            String payloadJson = objectMapper.writeValueAsString(payloadMap);
            command.setPayload(payloadJson);
            
            // Save and flush before sending over MQTT
            commandRepository.saveAndFlush(command);

            String topic = "device/" + deviceId + "/command";
            mqttGateway.sendToMqtt(topic, 1, payloadJson);
            
            log.info("Sent command {} ({}) to device {}", command.getId(), action, deviceId);
            return command;
            
        } catch (JsonProcessingException e) {
            log.error("Failed to serialize command payload", e);
            throw new RuntimeException("Failed to serialize command payload");
        } catch (Exception e) {
            command.setStatus("FAILED");
            commandRepository.save(command);
            log.error("Failed to send command via MQTT", e);
            throw new RuntimeException("Failed to send command via MQTT");
        }
    }

    @Transactional
    public void processAck(CommandAckPayload ack) {
        if (ack.getCommandId() == null) return;
        
        Optional<Command> cmdOpt = commandRepository.findById(ack.getCommandId());
        if (cmdOpt.isEmpty()) {
            try {
                Thread.sleep(150);
            } catch (InterruptedException ignored) {}
            cmdOpt = commandRepository.findById(ack.getCommandId());
        }

        if (cmdOpt.isPresent()) {
            Command command = cmdOpt.get();
            command.setStatus("ACKNOWLEDGED");
            command.setAcknowledgedAt(ack.getTimestamp() != null ? ack.getTimestamp() : ZonedDateTime.now());
            commandRepository.save(command);
            
            // update device led state if applicable
            if (ack.getLed() != null) {
                deviceRepository.findByDeviceId(ack.getDeviceId()).ifPresent(device -> {
                    device.setLedState(ack.getLed());
                    device.setUpdatedAt(ZonedDateTime.now());
                    deviceRepository.save(device);
                });
            }
            log.info("Command {} acknowledged", ack.getCommandId());
        } else {
            log.warn("Received ACK for unknown command ID: {}", ack.getCommandId());
        }
    }

    public Page<Command> getCommandHistory(String deviceId, Pageable pageable) {
        return commandRepository.findByDeviceIdOrderByCreatedAtDesc(deviceId, pageable);
    }
}
