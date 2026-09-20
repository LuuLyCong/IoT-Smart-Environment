import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService extends ChangeNotifier {
  // Default to emulator 10.0.2.2, can be configured to host LAN IP for physical device
  String _baseUrl = 'http://10.0.2.2:8080/api/v1';
  String? _token;
  String? _role;

  String get baseUrl => _baseUrl;
  bool get isAuthenticated => _token != null;
  String? get role => _role;

  ApiService() {
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('token');
    _role = prefs.getString('role');
    _baseUrl = prefs.getString('baseUrl') ?? 'http://10.0.2.2:8080/api/v1';
    notifyListeners();
  }

  Future<void> setBaseUrl(String url) async {
    _baseUrl = url.trim();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('baseUrl', _baseUrl);
    notifyListeners();
  }

  Future<bool> login(String username, String password) async {
    try {
      final response = await http.post(
        Uri.parse('$_baseUrl/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'username': username, 'password': password}),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        _token = data['accessToken'];
        _role = data['role'];
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('token', _token!);
        await prefs.setString('role', _role!);
        notifyListeners();
        return true;
      }
    } catch (e) {
      debugPrint('Login error: $e');
    }
    return false;
  }

  void logout() async {
    _token = null;
    _role = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
    await prefs.remove('role');
    notifyListeners();
  }

  Future<Map<String, dynamic>?> getDevice(String deviceId) async {
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/devices/$deviceId'),
        headers: {'Authorization': 'Bearer $_token'},
      );
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
    } catch (e) {
      debugPrint('getDevice error: $e');
    }
    return null;
  }

  Future<Map<String, dynamic>?> getLatestTelemetry(String deviceId) async {
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/devices/$deviceId/telemetry/latest'),
        headers: {'Authorization': 'Bearer $_token'},
      );
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
    } catch (e) {
      debugPrint('getLatestTelemetry error: $e');
    }
    return null;
  }

  Future<Map<String, dynamic>?> getLatestCommand(String deviceId) async {
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/devices/$deviceId/commands?size=1'),
        headers: {'Authorization': 'Bearer $_token'},
      );
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['content'] != null && (data['content'] as List).isNotEmpty) {
          return data['content'][0];
        }
      }
    } catch (e) {
      debugPrint('getLatestCommand error: $e');
    }
    return null;
  }

  Future<bool> sendCommand(String deviceId, String action) async {
    try {
      final response = await http.post(
        Uri.parse('$_baseUrl/devices/$deviceId/commands'),
        headers: {
          'Authorization': 'Bearer $_token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({'action': action}),
      );
      return response.statusCode == 200;
    } catch (e) {
      debugPrint('sendCommand error: $e');
    }
    return false;
  }
}
