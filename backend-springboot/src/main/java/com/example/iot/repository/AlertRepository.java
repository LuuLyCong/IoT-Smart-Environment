package com.example.iot.repository;

import com.example.iot.entity.Alert;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AlertRepository extends JpaRepository<Alert, UUID> {
    Page<Alert> findByDeviceIdOrderByCreatedAtDesc(String deviceId, Pageable pageable);

    List<Alert> findTop10ByDeviceIdOrderByCreatedAtDesc(String deviceId);
}
