import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/api_service.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Map<String, dynamic>? _device;
  Map<String, dynamic>? _telemetry;
  Map<String, dynamic>? _latestCommand;
  Timer? _timer;
  bool _commandInProgress = false;

  @override
  void initState() {
    super.initState();
    _fetchData();
    _timer = Timer.periodic(const Duration(seconds: 5), (_) => _fetchData());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _fetchData() async {
    final api = context.read<ApiService>();
    final device = await api.getDevice('esp32-001');
    final telemetry = await api.getLatestTelemetry('esp32-001');
    final cmd = await api.getLatestCommand('esp32-001');
    if (mounted) {
      setState(() {
        _device = device;
        _telemetry = telemetry;
        _latestCommand = cmd;
      });
    }
  }

  void _sendCommand(String action) async {
    if (_device == null) return;
    setState(() => _commandInProgress = true);
    final api = context.read<ApiService>();
    final success = await api.sendCommand('esp32-001', action);
    setState(() => _commandInProgress = false);

    if (!success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Không thể thực thi lệnh (Kiểm tra quyền tài khoản hoặc Broker)!',
          ),
          backgroundColor: Colors.red,
        ),
      );
    }
    _fetchData();
  }

  @override
  Widget build(BuildContext context) {
    final api = context.watch<ApiService>();
    final temp = _telemetry?['temperature'];
    final isHighTemp = temp != null && (temp is num) && temp > 35.0;

    return Scaffold(
      appBar: AppBar(
        title: Text('ESP32 Dashboard (${api.role})'),
        backgroundColor: Colors.blueAccent,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Làm mới',
            onPressed: _fetchData,
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Đăng xuất',
            onPressed: () => api.logout(),
          ),
        ],
      ),
      body: _device == null
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _fetchData,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // High Temperature Warning Banner (> 35°C)
                    if (isHighTemp)
                      Container(
                        width: double.infinity,
                        margin: const EdgeInsets.only(bottom: 16.0),
                        padding: const EdgeInsets.all(12.0),
                        decoration: BoxDecoration(
                          color: Colors.red.shade100,
                          borderRadius: BorderRadius.circular(8.0),
                          border: Border.all(color: Colors.red, width: 1.5),
                        ),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.warning,
                              color: Colors.red,
                              size: 28,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                'CẢNH BÁO: Nhiệt độ hiện tại $temp°C vượt ngưỡng an toàn (35°C)!',
                                style: const TextStyle(
                                  color: Colors.red,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 13,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),

                    // Device Header Card
                    Card(
                      elevation: 3,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  _device!['deviceId'] ?? 'esp32-001',
                                  style: const TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                Chip(
                                  label: Text(
                                    _device!['status'] ?? 'UNKNOWN',
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  backgroundColor:
                                      _device!['status'] == 'ONLINE'
                                          ? Colors.green
                                          : Colors.red,
                                ),
                              ],
                            ),
                            Text(
                              _device!['name'] ?? '',
                              style: const TextStyle(
                                color: Colors.grey,
                                fontSize: 13,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'LED State: ${_device!['ledState'] == true ? "ON (BẬT)" : "OFF (TẮT)"}',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                color: _device!['ledState'] == true
                                    ? Colors.orange
                                    : Colors.grey,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Metrics Grid
                    const Text(
                      'Dữ Liệu Môi Trường',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    GridView.count(
                      crossAxisCount: 2,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      crossAxisSpacing: 12,
                      mainAxisSpacing: 12,
                      childAspectRatio: 1.4,
                      children: [
                        _buildMetricCard(
                          'Nhiệt độ',
                          temp != null ? '$temp °C' : '--',
                          Icons.thermostat,
                          isHighTemp ? Colors.red : Colors.deepOrange,
                        ),
                        _buildMetricCard(
                          'Độ ẩm',
                          _telemetry?['humidity'] != null
                              ? '${_telemetry!['humidity']} %'
                              : '--',
                          Icons.water_drop,
                          Colors.blue,
                        ),
                        _buildMetricCard(
                          'Ánh sáng',
                          _telemetry?['illuminance'] != null
                              ? '${_telemetry!['illuminance']} lux'
                              : '--',
                          Icons.wb_sunny,
                          Colors.amber,
                        ),
                        _buildMetricCard(
                          'Độ ẩm đất',
                          _telemetry?['soilMoisture'] != null
                              ? '${_telemetry!['soilMoisture']} %'
                              : '--',
                          Icons.grass,
                          Colors.green,
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),

                    // Actuator Controls
                    const Text(
                      'Điều Khiển LED',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    if (api.role != 'VIEWER')
                      Row(
                        children: [
                          Expanded(
                            child: ElevatedButton.icon(
                              onPressed: _commandInProgress
                                  ? null
                                  : () => _sendCommand('LED_ON'),
                              icon: const Icon(Icons.power_settings_new),
                              label: const Text('LED ON'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.green,
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(
                                  vertical: 12,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: ElevatedButton.icon(
                              onPressed: _commandInProgress
                                  ? null
                                  : () => _sendCommand('LED_OFF'),
                              icon: const Icon(Icons.power_off),
                              label: const Text('LED OFF'),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.red,
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(
                                  vertical: 12,
                                ),
                              ),
                            ),
                          ),
                        ],
                      )
                    else
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.grey.shade200,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Text(
                          'Tài khoản VIEWER chỉ có quyền xem, không được điều khiển LED.',
                          style: TextStyle(color: Colors.black54),
                        ),
                      ),
                    const SizedBox(height: 20),

                    // Latest Command Status Card
                    const Text(
                      'Trạng Thái Lệnh Gần Nhất',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Card(
                      elevation: 2,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(12.0),
                        child: _latestCommand == null
                            ? const Text(
                                'Chưa có lệnh nào được gửi',
                                style: TextStyle(color: Colors.grey),
                              )
                            : Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment:
                                        MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        'Hành động: ${_latestCommand!['action']}',
                                        style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                      Chip(
                                        label: Text(
                                          _latestCommand!['status'] ?? '',
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 11,
                                          ),
                                        ),
                                        backgroundColor:
                                            _latestCommand!['status'] ==
                                                    'ACKNOWLEDGED'
                                                ? Colors.green
                                                : Colors.orange,
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    'Command ID: ${_latestCommand!['id']}',
                                    style: const TextStyle(
                                      fontSize: 11,
                                      color: Colors.grey,
                                    ),
                                  ),
                                  if (_latestCommand!['acknowledgedAt'] != null)
                                    Text(
                                      'ACK Time: ${_latestCommand!['acknowledgedAt']}',
                                      style: const TextStyle(
                                        fontSize: 11,
                                        color: Colors.green,
                                      ),
                                    ),
                                ],
                              ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildMetricCard(
    String title,
    String value,
    IconData icon,
    Color color,
  ) {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      child: Padding(
        padding: const EdgeInsets.all(12.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Row(
              children: [
                Icon(icon, color: color, size: 22),
                const SizedBox(width: 6),
                Text(
                  title,
                  style: const TextStyle(fontSize: 12, color: Colors.grey),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              value,
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
