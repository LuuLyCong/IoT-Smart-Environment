import { useEffect, useState } from 'react'
import api from '../services/api'
import { format } from 'date-fns'

interface Telemetry {
  id: string
  temperature: number
  humidity: number
  illuminance: number | null
  soilMoisture: number | null
  recordedAt: string
}

interface Command {
  id: string
  deviceId: string
  action: string
  status: string
  createdBy: string
  createdAt: string
  sentAt?: string
  acknowledgedAt?: string
}

interface AlertLog {
  id: string
  deviceId: string
  type: string
  message: string
  val: number
  threshold: number
  createdAt: string
}

export default function Logs() {
  const [tab, setTab] = useState<'tele' | 'cmd' | 'alert'>('tele')
  const [page, setPage] = useState(0)
  const [rpp, setRpp] = useState(10)

  // Data states
  const [telemetryLogs, setTelemetryLogs] = useState<Telemetry[]>([])
  const [telemetryTotal, setTelemetryTotal] = useState(0)

  const [commandLogs, setCommandLogs] = useState<Command[]>([])
  const [commandTotal, setCommandTotal] = useState(0)

  const [alertLogs, setAlertLogs] = useState<AlertLog[]>([])
  const [alertTotal, setAlertTotal] = useState(0)

  // Thresholds for highlight
  const savedThresholds = (() => {
    try {
      const s = localStorage.getItem('iot_thresholds')
      return s ? JSON.parse(s) : { temp: 35, soil: 30 }
    } catch {
      return { temp: 35, soil: 30 }
    }
  })()

  const fetchTelemetry = async () => {
    try {
      const res = await api.get(`/devices/esp32-001/telemetry?page=${page}&size=${rpp}`)
      if (res.data) {
        setTelemetryLogs(res.data.content || [])
        setTelemetryTotal(res.data.totalElements || 0)
      }
    } catch (err) {
      console.error('Error fetching telemetry:', err)
    }
  }

  const fetchCommands = async () => {
    try {
      const res = await api.get(`/devices/esp32-001/commands?page=${page}&size=${rpp}`)
      if (res.data) {
        setCommandLogs(res.data.content || [])
        setCommandTotal(res.data.totalElements || 0)
      }
    } catch (err) {
      console.error('Error fetching commands:', err)
    }
  }

  const fetchAlerts = async () => {
    try {
      const res = await api.get(`/devices/esp32-001/alerts?page=${page}&size=${rpp}`)
      if (res.data) {
        setAlertLogs(res.data.content || [])
        setAlertTotal(res.data.totalElements || 0)
      }
    } catch (err) {
      console.error('Error fetching alerts:', err)
    }
  }

  useEffect(() => {
    if (tab === 'tele') fetchTelemetry()
    if (tab === 'cmd') fetchCommands()
    if (tab === 'alert') fetchAlerts()
  }, [tab, page, rpp])

  const total = tab === 'tele' ? telemetryTotal : tab === 'cmd' ? commandTotal : alertTotal
  const maxPages = Math.max(1, Math.ceil(total / rpp))

  const handleTabChange = (newTab: 'tele' | 'cmd' | 'alert') => {
    setTab(newTab)
    setPage(0)
  }

  const formatDt = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'yyyy-MM-dd HH:mm:ss')
    } catch {
      return dateStr
    }
  }

  return (
    <section className="page" id="page-logs">
      <div className="head">
        <h1>History Logs</h1>
      </div>

      {/* Tabs */}
      <div className="glass tabs" role="tablist" id="tabs">
        <button
          role="tab"
          className={tab === 'tele' ? 'active' : ''}
          aria-selected={tab === 'tele'}
          onClick={() => handleTabChange('tele')}
        >
          Telemetry data
        </button>
        <button
          role="tab"
          className={tab === 'cmd' ? 'active' : ''}
          aria-selected={tab === 'cmd'}
          onClick={() => handleTabChange('cmd')}
        >
          Command &amp; ACK history
        </button>
        <button
          role="tab"
          className={tab === 'alert' ? 'active' : ''}
          aria-selected={tab === 'alert'}
          onClick={() => handleTabChange('alert')}
        >
          High-temp alerts
        </button>
      </div>

      {/* Table Container */}
      <div className="glass">
        <div className="tbl-wrap">
          <table>
            <thead id="thead">
              {tab === 'tele' && (
                <tr>
                  <th>Time</th>
                  <th>Temperature (°C)</th>
                  <th>Humidity (%)</th>
                  <th>Light (lux)</th>
                  <th>Soil moisture (%)</th>
                </tr>
              )}
              {tab === 'cmd' && (
                <tr>
                  <th>Time</th>
                  <th>Device</th>
                  <th>Command</th>
                  <th>Latency</th>
                  <th>Status</th>
                </tr>
              )}
              {tab === 'alert' && (
                <tr>
                  <th>Time</th>
                  <th>Temperature (°C)</th>
                  <th>Threshold (°C)</th>
                  <th>Level</th>
                </tr>
              )}
            </thead>
            <tbody id="tbody">
              {tab === 'tele' &&
                telemetryLogs.map((row) => (
                  <tr key={row.id}>
                    <td className="t">{formatDt(row.recordedAt)}</td>
                    <td>
                      {row.temperature > savedThresholds.temp ? (
                        <span className="tag pk">{row.temperature.toFixed(1)}</span>
                      ) : (
                        row.temperature.toFixed(1)
                      )}
                    </td>
                    <td>{row.humidity.toFixed(1)}</td>
                    <td>
                      {row.illuminance == null ? (
                        <span className="muted">--</span>
                      ) : (
                        row.illuminance
                      )}
                    </td>
                    <td>
                      {row.soilMoisture != null && row.soilMoisture < savedThresholds.soil ? (
                        <span className="tag pk">{row.soilMoisture}</span>
                      ) : row.soilMoisture != null ? (
                        row.soilMoisture
                      ) : (
                        <span className="muted">--</span>
                      )}
                    </td>
                  </tr>
                ))}

              {tab === 'cmd' &&
                commandLogs.map((row) => {
                  const ms = row.sentAt && row.acknowledgedAt
                    ? Math.max(20, new Date(row.acknowledgedAt).getTime() - new Date(row.sentAt).getTime())
                    : 65
                  const isAck = row.status === 'ACKNOWLEDGED' || row.status === 'SUCCESS' || row.status === 'ACK'
                  return (
                    <tr key={row.id}>
                      <td className="t">{formatDt(row.createdAt)}</td>
                      <td>{row.deviceId || 'esp32-001'}</td>
                      <td>
                        <span className="tag bl">{row.action}</span>
                      </td>
                      <td>{ms} ms</td>
                      <td>
                        <span className={`tag ${isAck ? 'mn' : 'pk'}`}>
                          {isAck ? 'ACK' : row.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}

              {tab === 'alert' &&
                alertLogs.map((row) => (
                  <tr key={row.id}>
                    <td className="t">{formatDt(row.createdAt)}</td>
                    <td>
                      <span className="tag pk">{row.val != null ? row.val.toFixed(1) : '--'}</span>
                    </td>
                    <td>{row.threshold != null ? `${row.threshold}°C` : '35.0°C'}</td>
                    <td>
                      <span className="tag pk">{row.type || 'Nghiêm trọng'}</span>
                    </td>
                  </tr>
                ))}

              {((tab === 'tele' && telemetryLogs.length === 0) ||
                (tab === 'cmd' && commandLogs.length === 0) ||
                (tab === 'alert' && alertLogs.length === 0)) && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '30px' }} className="muted">
                    Chưa có bản ghi nào trong mục này.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pager */}
        <div className="pager">
          <label>
            Số dòng mỗi trang{' '}
            <select
              id="rpp"
              value={rpp}
              onChange={(e) => {
                setRpp(Number(e.target.value))
                setPage(0)
              }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </label>

          <span id="pinfo">
            {total === 0
              ? '0–0 of 0'
              : `${page * rpp + 1}–${Math.min(total, (page + 1) * rpp)} of ${total.toLocaleString('en-US')}`}
          </span>

          <button
            className="nb"
            id="prev"
            aria-label="Trang trước"
            disabled={page === 0}
            onClick={() => setPage(Math.max(0, page - 1))}
          >
            <svg className="i">
              <use href="#i-left" />
            </svg>
          </button>

          <button
            className="nb"
            id="next"
            aria-label="Trang sau"
            disabled={page >= maxPages - 1}
            onClick={() => setPage(page + 1)}
          >
            <svg className="i">
              <use href="#i-right" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  )
}
