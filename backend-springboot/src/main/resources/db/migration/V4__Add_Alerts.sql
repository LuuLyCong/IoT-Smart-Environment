CREATE TABLE alerts (
    id UUID PRIMARY KEY,
    device_id VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    message VARCHAR(255) NOT NULL,
    val DOUBLE PRECISION,
    threshold DOUBLE PRECISION,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_alerts_device FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
);

CREATE INDEX idx_alerts_device_created ON alerts(device_id, created_at);

