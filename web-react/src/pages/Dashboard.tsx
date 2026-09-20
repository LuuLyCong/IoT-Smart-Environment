import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'

interface Device {
  id: string
  deviceId: string
  name: string
  status: 'ONLINE' | 'OFFLINE'
  ledState: boolean
  lastSeenAt?: string
}

interface Telemetry {
  id: string
  temperature: number
  humidity: number
  illuminance: number | null
  soilMoisture: number | null
  recordedAt: string
}

interface ThresholdConfig {
  temp: number
  soil: number
  hum: number
}

const DEFAULT_THRESHOLDS: ThresholdConfig = {
  temp: 33.0,
  soil: 30.0,
  hum: 30.0,
}

const METRICS_META = [
  { k: 'temp', label: 'Nhiệt độ', unit: '°C', icon: 'thermo', c: 'pink', dec: 1 },
  { k: 'hum', label: 'Độ ẩm không khí', unit: 'Không khí (%)', unitShort: '%', icon: 'drop', c: 'blue', dec: 1 },
  { k: 'light', label: 'Ánh sáng', unit: 'lux', unitShort: 'lux', icon: 'sun', c: 'violet', dec: 0 },
  { k: 'soil', label: 'Độ ẩm đất', unit: 'Đất (%)', unitShort: '%', icon: 'sprout', c: 'mint', dec: 1 },
]

const SERIES_META = [
  { k: 'temp', name: 'Nhiệt độ', unit: '°C', c: '--pink', ax: 'L', dec: 1 },
  { k: 'hum', name: 'Độ ẩm KK', unit: '%', c: '--blue', ax: 'L', dec: 1 },
  { k: 'soil', name: 'Độ ẩm đất', unit: '%', c: '--mint', ax: 'L', dec: 1 },
  { k: 'light', name: 'Ánh sáng', unit: 'lux', c: '--violet', ax: 'R', dec: 0 },
]

interface ToastItem {
  id: number
  msg: string
}

export default function Dashboard() {
  const { role } = useAuth()

  // Real backend device and history
  const [device, setDevice] = useState<Device | null>(null)
  const [latestTelemetry, setLatestTelemetry] = useState<Telemetry | null>(null)
  const [history, setHistory] = useState<Telemetry[]>([])
  const [ledState, setLedState] = useState<boolean>(false)
  const [buzzerState, setBuzzerState] = useState<boolean>(false)
  const lastCommandTimeRef = useRef<number>(0)

  // Thresholds
  const [thresholds, setThresholds] = useState<ThresholdConfig>(() => {
    const saved = localStorage.getItem('iot_thresholds')
    if (saved) {
      try { return JSON.parse(saved) } catch (e) { /* ignore */ }
    }
    return DEFAULT_THRESHOLDS
  })
  const [tempInput, setTempInput] = useState(thresholds.temp)
  const [soilInput, setSoilInput] = useState(thresholds.soil)
  const [humInput, setHumInput] = useState(thresholds.hum)
  const [modalOpen, setModalOpen] = useState(false)
  const [dismissedBanner, setDismissedBanner] = useState('')

  // LCD form & marquee state
  const [in1, setIn1] = useState('MCKONG')
  const [in2, setIn2] = useState('nè')
  const [lcdOffset, setLcdOffset] = useState([0, 0])
  const [lcdSending, setLcdSending] = useState(false)

  // Chart state
  const [chartMode, setChartMode] = useState<'live' | 'hour' | 'day'>('live')
  const [vis, setVis] = useState<Set<string>>(new Set(['temp', 'hum', 'soil', 'light']))
  const [hoverIdx, setHoverIdx] = useState<number>(-1)
  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const chartWrapRef = useRef<HTMLDivElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)

  // Toasts
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const addToast = (msg: string) => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, msg }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 2600)
  }

  // Polling backend data - directly bound to backend API endpoints
  const fetchData = async () => {
    try {
      const [devRes, latestRes, histRes, cmdRes] = await Promise.all([
        api.get('/devices/esp32-001').catch(() => null),
        api.get('/devices/esp32-001/telemetry/latest').catch(() => null),
        api.get('/devices/esp32-001/telemetry?size=60').catch(() => null),
        api.get('/devices/esp32-001/commands?size=1').catch(() => null),
      ])

      if (devRes?.data) {
        setDevice(devRes.data)
        // Sync ledState from backend only if not within 3.5s of manual button toggle
        if (Date.now() - lastCommandTimeRef.current > 3500) {
          setLedState(Boolean(devRes.data.ledState))
        }
      }

      if (latestRes?.data) {
        setLatestTelemetry(latestRes.data)
      }

      if (histRes?.data && histRes.data.content) {
        // histRes.data.content is sorted DESC by recordedAt
        // Reversing makes it chronological (oldest to newest)
        const reversed = [...histRes.data.content].reverse()
        setHistory(reversed)
        if (!latestRes?.data && reversed.length > 0) {
          setLatestTelemetry(reversed[reversed.length - 1])
        }
      }

      if (cmdRes?.data && cmdRes.data.content && cmdRes.data.content.length > 0) {
        const latest = cmdRes.data.content[0]
        if (Date.now() - lastCommandTimeRef.current > 3500) {
          if (latest.action === 'BUZZER_ON') setBuzzerState(true)
          if (latest.action === 'BUZZER_OFF') setBuzzerState(false)
        }
      }
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err)
      if (err.response && err.response.status === 401) {
        localStorage.clear()
        window.location.href = '/login'
      }
    }
  }

  useEffect(() => {
    fetchData()
    const timer = setInterval(fetchData, 3000)
    return () => clearInterval(timer)
  }, [])

  // Device connection status: strictly ONLINE if device.status === 'ONLINE' AND lastSeenAt within last 12s
  const isDeviceOnline = useMemo(() => {
    if (!device || device.status !== 'ONLINE') return false
    if (device.lastSeenAt) {
      const lastSeenMs = new Date(device.lastSeenAt).getTime()
      if (Date.now() - lastSeenMs > 12000) return false
    }
    return true
  }, [device])

  // LCD marquee ticker
  useEffect(() => {
    const ticker = setInterval(() => {
      setLcdOffset(([o1, o2]) => [o1 + 1, o2 + 1])
    }, 420)
    return () => clearInterval(ticker)
  }, [])

  // Command sending: Instant optimistic response, zero lag, smooth CSS transition
  const sendCommand = async (action: 'LED_ON' | 'LED_OFF' | 'BUZZER_ON' | 'BUZZER_OFF') => {
    if (!device) return
    lastCommandTimeRef.current = Date.now()

    // 1. Instant local toggle for buttery-smooth switch animation
    if (action === 'LED_ON') {
      setLedState(true)
    } else if (action === 'LED_OFF') {
      setLedState(false)
    } else if (action === 'BUZZER_ON') {
      setBuzzerState(true)
    } else if (action === 'BUZZER_OFF') {
      setBuzzerState(false)
    }

    try {
      await api.post(`/devices/${device.deviceId}/commands`, { action })
      if (action === 'LED_ON') {
        addToast('Đã bật đèn LED')
      } else if (action === 'LED_OFF') {
        addToast('Đã tắt đèn LED')
      } else if (action === 'BUZZER_ON') {
        addToast('Đã bật còi báo động')
      } else if (action === 'BUZZER_OFF') {
        addToast('Đã tắt còi báo động')
      }
    } catch (err: any) {
      // Revert in case of failure
      if (action === 'LED_ON') setLedState(false)
      if (action === 'LED_OFF') setLedState(true)
      if (action === 'BUZZER_ON') setBuzzerState(false)
      if (action === 'BUZZER_OFF') setBuzzerState(true)

      if (err.response?.status === 403) {
        addToast('Từ chối: Quyền Viewer không được điều khiển!')
      } else {
        addToast('Không thể gửi lệnh điều khiển.')
      }
    }
  }

  // LCD send command
  const sendLcdCommand = async () => {
    if (!device) return
    setLcdSending(true)
    try {
      await api.post(`/devices/${device.deviceId}/commands`, {
        action: 'DISPLAY_TEXT',
        line1: in1,
        line2: in2,
      })
      addToast('Đã gửi nội dung lên LCD')
    } catch (err: any) {
      if (err.response?.status === 403) {
        addToast('Từ chối: Quyền Viewer không thể sửa LCD!')
      } else {
        addToast('Không thể gửi lệnh lên LCD.')
      }
    } finally {
      setLcdSending(false)
    }
  }

  // Current metric values - pure real backend values, keeping null as null (NO fake 420 fallback!)
  const currentValues: Record<string, number | null> = useMemo(() => {
    const latest = latestTelemetry || (history.length > 0 ? history[history.length - 1] : null)
    return {
      temp: latest?.temperature ?? null,
      hum: latest?.humidity ?? null,
      light: latest?.illuminance ?? null,
      soil: latest?.soilMoisture ?? null,
    }
  }, [latestTelemetry, history])

  // Sparkline data generation from real history
  const getSparklinePath = useCallback(
    (key: string) => {
      const vals = history
        .map((h) => {
          if (key === 'temp') return h.temperature
          if (key === 'hum') return h.humidity
          if (key === 'light') return h.illuminance
          if (key === 'soil') return h.soilMoisture
          return null
        })
        .filter((v): v is number => v != null && !isNaN(v))
        .slice(-16)

      if (vals.length < 2) {
        return 'M0,17 L110,17'
      }

      const mn = Math.min(...vals)
      const mx = Math.max(...vals)
      const sp = mx - mn || 1
      const pts = vals.map((v, i) => [
        (i * 110) / (vals.length - 1),
        30 - ((v - mn) / sp) * 26,
      ])

      let d = `M${pts[0][0]},${pts[0][1]}`
      for (let i = 1; i < pts.length; i++) {
        const mx2 = (pts[i - 1][0] + pts[i][0]) / 2
        d += ` Q${pts[i - 1][0]},${pts[i - 1][1]} ${mx2},${(pts[i - 1][1] + pts[i][1]) / 2}`
      }
      d += ` L${pts[pts.length - 1][0]},${pts[pts.length - 1][1]}`
      return d
    },
    [history]
  )

  // Metric trends
  const getTrend = (key: string, dec: number) => {
    const cur = currentValues[key]
    if (cur == null) {
      return { text: 'Không có dữ liệu', cls: '', icon: undefined }
    }

    const validHistory = history
      .map((h) => {
        if (key === 'temp') return h.temperature
        if (key === 'hum') return h.humidity
        if (key === 'light') return h.illuminance
        if (key === 'soil') return h.soilMoisture
        return null
      })
      .filter((v): v is number => v != null && !isNaN(v))

    if (validHistory.length < 2) return { text: 'Ổn định', cls: '', icon: undefined }
    const diff = validHistory[validHistory.length - 1] - validHistory[validHistory.length - 2]
    if (Math.abs(diff) < 0.05) return { text: 'Ổn định', cls: '', icon: undefined }
    return {
      text: `${Math.abs(diff).toFixed(dec)}`,
      cls: diff > 0 ? 'up' : 'down',
      icon: diff > 0 ? '#i-up' : '#i-dn',
    }
  }

  // Active Alert Flags
  const flags = useMemo(() => {
    return {
      temp: currentValues.temp != null && currentValues.temp > thresholds.temp ? 'Cao' : '',
      soil: currentValues.soil != null && currentValues.soil < thresholds.soil ? 'Thấp' : '',
      hum: currentValues.hum != null && currentValues.hum < thresholds.hum ? 'Thấp' : '',
      light: '',
    }
  }, [currentValues, thresholds])

  // Banner Alerts List
  const bannerAlerts = useMemo(() => {
    const list = []
    if (currentValues.soil != null && currentValues.soil < thresholds.soil) {
      list.push({
        id: 'soil',
        t: 'Cảnh báo độ ẩm đất thấp (đất khô)',
        d: `Độ ẩm đất hiện tại ${currentValues.soil.toFixed(1)}%, thấp hơn ngưỡng tối thiểu (${thresholds.soil}%). Vui lòng tưới cây.`,
      })
    }
    if (currentValues.temp != null && currentValues.temp > thresholds.temp) {
      list.push({
        id: 'temp',
        t: 'Cảnh báo nhiệt độ cao',
        d: `Nhiệt độ hiện tại ${currentValues.temp.toFixed(1)}°C, cao hơn ngưỡng tối đa (${thresholds.temp}°C).`,
      })
    }
    if (currentValues.hum != null && currentValues.hum < thresholds.hum) {
      list.push({
        id: 'hum',
        t: 'Cảnh báo độ ẩm không khí thấp',
        d: `Độ ẩm không khí hiện tại ${currentValues.hum.toFixed(1)}%, thấp hơn ngưỡng tối thiểu (${thresholds.hum}%).`,
      })
    }
    return list
  }, [currentValues, thresholds])

  const bannerSig = bannerAlerts.map((a) => a.id).join('|')
  const showBanner = bannerAlerts.length > 0 && bannerSig !== dismissedBanner

  // Chart Rows & Labels calculation from actual backend history
  const chartData = useMemo(() => {
    if (history.length >= 1) {
      const count = chartMode === 'live' ? 20 : chartMode === 'hour' ? 12 : 24
      const slice = history.slice(-count)
      return {
        rows: slice.map((h) => ({
          temp: h.temperature,
          hum: h.humidity,
          soil: h.soilMoisture,
          light: h.illuminance,
        })),
        labels: slice.map((h) => {
          try {
            const d = new Date(h.recordedAt)
            return chartMode === 'day'
              ? `${String(d.getHours()).padStart(2, '0')}:00`
              : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
          } catch {
            return ''
          }
        }),
      }
    }
    return { rows: [], labels: [] }
  }, [chartMode, history])

  // Canvas Chart Renderer
  const drawChart = useCallback(() => {
    const cv = chartCanvasRef.current
    if (!cv) return
    const rect = cv.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    cv.width = rect.width * dpr
    cv.height = rect.height * dpr
    const g = cv.getContext('2d')
    if (!g) return
    g.setTransform(dpr, 0, 0, dpr, 0, 0)

    const W = rect.width
    const H = rect.height
    const P = { l: 40, r: 50, t: 10, b: 28 }
    const iw = W - P.l - P.r
    const ih = H - P.t - P.b
    const n = chartData.rows.length

    const style = getComputedStyle(document.documentElement)
    const gridColor = style.getPropertyValue('--grid').trim() || 'rgba(160,190,255,0.14)'
    const txColor = style.getPropertyValue('--tx3').trim() || '#6B7699'
    const blueColor = style.getPropertyValue('--blue').trim() || '#6FE7FF'
    const cardSolid = style.getPropertyValue('--card-solid').trim() || '#151B3D'

    g.font = '11px "Be Vietnam Pro", sans-serif'

    // Gridlines & Y-axes ticks
    for (let i = 0; i <= 4; i++) {
      const y = P.t + ih - (ih * i) / 4
      g.strokeStyle = gridColor
      g.setLineDash([2, 5])
      g.beginPath()
      g.moveTo(P.l, y)
      g.lineTo(W - P.r, y)
      g.stroke()
      g.setLineDash([])

      g.fillStyle = txColor
      g.textAlign = 'right'
      g.fillText(String(i * 25), P.l - 8, y + 4)
      g.textAlign = 'left'
      g.fillText(String(i * 250), W - P.r + 8, y + 4)
    }

    if (n < 2) return

    // X-axis timestamps
    const X = (i: number) => P.l + (iw * i) / (n - 1)
    const step = Math.ceil(n / 8)
    g.textAlign = 'center'
    g.fillStyle = txColor
    chartData.labels.forEach((l, i) => {
      if (i % step === 0 || i === n - 1) {
        const px = Math.min(W - P.r - 18, Math.max(P.l + 18, X(i)))
        g.fillText(l, px, H - 8)
      }
    })

    // Series Lines & Area gradients (only plotting non-null values!)
    SERIES_META.forEach((s) => {
      if (!vis.has(s.k)) return
      const col = style.getPropertyValue(s.c).trim() || '#6FE7FF'
      const max = s.ax === 'L' ? 100 : 1000

      const validPoints: Array<{ x: number; y: number; val: number; idx: number }> = []
      chartData.rows.forEach((row: any, i) => {
        const val = row[s.k]
        if (val != null && !isNaN(val)) {
          const x = X(i)
          const y = P.t + ih - Math.min(1, Math.max(0, val / max)) * ih
          validPoints.push({ x, y, val, idx: i })
        }
      })

      if (validPoints.length < 2) return

      // Fill gradient
      g.save()
      g.beginPath()
      g.moveTo(validPoints[0].x, validPoints[0].y)
      for (let i = 1; i < validPoints.length; i++) {
        const prev = validPoints[i - 1]
        const curr = validPoints[i]
        const mx = (prev.x + curr.x) / 2
        g.quadraticCurveTo(prev.x, prev.y, mx, (prev.y + curr.y) / 2)
      }
      g.lineTo(validPoints[validPoints.length - 1].x, validPoints[validPoints.length - 1].y)
      g.lineTo(validPoints[validPoints.length - 1].x, P.t + ih)
      g.lineTo(validPoints[0].x, P.t + ih)
      g.closePath()
      const gr = g.createLinearGradient(0, P.t, 0, P.t + ih)
      gr.addColorStop(0, col + '33')
      gr.addColorStop(1, col + '00')
      g.fillStyle = gr
      g.fill()
      g.restore()

      // Stroke Line with glow
      g.beginPath()
      g.moveTo(validPoints[0].x, validPoints[0].y)
      for (let i = 1; i < validPoints.length; i++) {
        const prev = validPoints[i - 1]
        const curr = validPoints[i]
        const mx = (prev.x + curr.x) / 2
        g.quadraticCurveTo(prev.x, prev.y, mx, (prev.y + curr.y) / 2)
      }
      g.lineTo(validPoints[validPoints.length - 1].x, validPoints[validPoints.length - 1].y)
      g.strokeStyle = col
      g.lineWidth = 2.2
      g.lineJoin = 'round'
      g.shadowColor = col
      g.shadowBlur = 10
      g.stroke()
      g.shadowBlur = 0

      // Hover circle
      const hoverPt = validPoints.find((p) => p.idx === hoverIdx)
      if (hoverPt) {
        g.beginPath()
        g.arc(hoverPt.x, hoverPt.y, 4.5, 0, 2 * Math.PI)
        g.fillStyle = cardSolid
        g.fill()
        g.strokeStyle = col
        g.lineWidth = 2
        g.stroke()
      }
    })

    // Hover vertical crosshair
    if (hoverIdx >= 0 && hoverIdx < n) {
      g.strokeStyle = blueColor
      g.globalAlpha = 0.4
      g.setLineDash([3, 4])
      g.beginPath()
      g.moveTo(X(hoverIdx), P.t)
      g.lineTo(X(hoverIdx), P.t + ih)
      g.stroke()
      g.setLineDash([])
      g.globalAlpha = 1
    }
  }, [chartData, vis, hoverIdx])

  useEffect(() => {
    drawChart()
  }, [drawChart])

  useEffect(() => {
    if (!chartWrapRef.current) return
    const ro = new ResizeObserver(() => {
      drawChart()
    })
    ro.observe(chartWrapRef.current)
    return () => ro.disconnect()
  }, [drawChart])

  // Mouse hover on Canvas
  const handleChartMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const cv = chartCanvasRef.current
    if (!cv) return
    const rc = cv.getBoundingClientRect()
    const x = e.clientX - rc.left
    const P = { l: 40, r: 50, t: 10, b: 28 }
    const iw = rc.width - P.l - P.r
    const n = chartData.rows.length
    if (n < 2) return

    const i = Math.round(((x - P.l) / iw) * (n - 1))
    if (i < 0 || i >= n) {
      setHoverIdx(-1)
      if (tooltipRef.current) tooltipRef.current.classList.remove('on')
      return
    }

    setHoverIdx(i)
    const tip = tooltipRef.current
    if (!tip) return

    const row: any = chartData.rows[i]
    tip.innerHTML =
      `<div class="t">${chartData.labels[i]}</div>` +
      SERIES_META.filter((s) => vis.has(s.k))
        .map((s) => {
          const val = row[s.k]
          const formatted = val != null && !isNaN(val) ? `${val.toFixed(s.dec)} ${s.unit}` : '--'
          return `<div class="r"><span><i style="background:var(${s.c})"></i>${s.name}</span><b>${formatted}</b></div>`
        })
        .join('')

    const px = P.l + (iw * i) / (n - 1)
    tip.style.left = `${px > rc.width * 0.6 ? px - tip.offsetWidth - 14 : px + 14}px`
    tip.style.top = '16px'
    tip.classList.add('on')
  }

  const handleChartMouseLeave = () => {
    setHoverIdx(-1)
    if (tooltipRef.current) tooltipRef.current.classList.remove('on')
  }

  // LCD render characters with marquee offset
  const getLcdString = (text: string, offset: number) => {
    if (text.length > 16) {
      const loop = text + '    '
      const o = offset % loop.length
      return (loop + loop).substr(o, 16)
    }
    return text.padEnd(16, ' ')
  }

  const lcdRow1 = getLcdString(in1, lcdOffset[0])
  const lcdRow2 = getLcdString(in2, lcdOffset[1])

  // Presets with safe null checking
  const applyPreset = (index: number) => {
    const tStr = currentValues.temp != null ? `${currentValues.temp.toFixed(1)}C` : '--C'
    const hStr = currentValues.hum != null ? `${currentValues.hum.toFixed(0)}%` : '--%'
    const soilStr = currentValues.soil != null ? `${currentValues.soil.toFixed(0)}%` : '--%'
    const lightStr = currentValues.light != null ? `${currentValues.light.toFixed(0)}lx` : '--lx'

    const PRESETS = [
      ['Chao mung den he thong IoT Pro', 'Giam sat moi truong...'],
      ['Xin chao!', 'MCKONG'],
      [`T:${tStr} H:${hStr}`, `Dat:${soilStr} ${lightStr}`],
      ['CANH BAO: DAT KHO, HAY TUOI CAY!', 'Do am dat thap'],
      ['', ''],
    ]
    const p = PRESETS[index]
    setIn1(p[0])
    setIn2(p[1])
  }

  // Save thresholds
  const handleSaveThresholds = async () => {
    const updated = {
      temp: tempInput,
      soil: soilInput,
      hum: humInput,
    }
    setThresholds(updated)
    localStorage.setItem('iot_thresholds', JSON.stringify(updated))
    try {
      await api.post('/settings/thresholds', updated)
    } catch (e) {
      console.error('Failed to sync thresholds to backend', e)
    }
    setModalOpen(false)
    setDismissedBanner('')
    addToast('Đã lưu ngưỡng cảnh báo')
  }

  return (
    <div className="page" id="page-dash">
      {/* Header */}
      <div className="head rise" style={{ ['--d' as any]: 0 }}>
        <h1>Smart Environment Dashboard</h1>
        <div className="spacer" />
        <button className="btn-o" id="cfgBtn" onClick={() => setModalOpen(true)}>
          <svg className="i">
            <use href="#i-sliders" />
          </svg>
          Cấu hình ngưỡng cảnh báo
        </button>
      </div>

      {/* Warning Banner */}
      {showBanner && (
        <div className="banner rise" id="banner" style={{ ['--d' as any]: 1 }} role="alert">
          <svg className="i">
            <use href="#i-alert" />
          </svg>
          <div>
            <b id="bTitle">{bannerAlerts.map((a) => a.t).join(' / ')}</b>
            <p id="bText">{bannerAlerts.map((a) => a.d).join(' ')}</p>
          </div>
          <button
            className="x"
            id="bClose"
            aria-label="Đóng cảnh báo"
            onClick={() => setDismissedBanner(bannerSig)}
          >
            <svg className="i">
              <use href="#i-x" />
            </svg>
          </button>
        </div>
      )}

      {/* 4 Metric Cards */}
      <div className="metrics" id="metrics">
        {METRICS_META.map((m, i) => {
          const val = currentValues[m.k]
          const trend = getTrend(m.k, m.dec)
          const isAlert = Boolean(flags[m.k as keyof typeof flags])
          const flagText = flags[m.k as keyof typeof flags] || 'Cần chú ý'

          return (
            <article
              key={m.k}
              className={`glass m c-${m.c} rise ${isAlert ? 'alert' : ''}`}
              style={{ ['--d' as any]: i + 2 }}
              id={`m-${m.k}`}
            >
              <span className="flag" id={`f-${m.k}`}>
                {flagText}
              </span>
              <div className="m-top">
                <div className="m-ico">
                  <svg className="i">
                    <use href={`#i-${m.icon}`} />
                  </svg>
                </div>
                <div>
                  <div className="m-lab">{m.label}</div>
                  <div className="m-val" id={`v-${m.k}`}>
                    {val != null ? (
                      <>
                        {val.toFixed(m.dec)}
                        <small>{m.unitShort || m.unit}</small>
                      </>
                    ) : (
                      <span style={{ color: 'var(--tx3)', fontSize: '26px', letterSpacing: '0px' }}>
                        --
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="m-foot">
                <span className={`trend ${trend.cls}`} id={`tr-${m.k}`}>
                  {trend.icon && (
                    <svg className="i">
                      <use href={trend.icon} />
                    </svg>
                  )}
                  {trend.text}
                </span>
                <svg className="spark" id={`sp-${m.k}`} viewBox="0 0 110 34" preserveAspectRatio="none">
                  <path className="ln" d={getSparklinePath(m.k)} />
                </svg>
              </div>
            </article>
          )
        })}
      </div>

      {/* Content Grid: Chart & Device Control */}
      <div className="cols">
        {/* Left Card: Chart */}
        <div className="glass card rise" style={{ ['--d' as any]: 6 }}>
          <div className="card-h">
            <div>
              <h2>Dữ liệu thời gian thực</h2>
              <p id="chartSub">
                {chartData.rows.length > 0
                  ? `${chartData.rows.length} mẫu quan trắc gần nhất`
                  : 'Đang đợi dữ liệu từ thiết bị...'}
              </p>
            </div>
            <div className="seg" id="seg" role="group" aria-label="Khoảng thời gian">
              <button
                className={chartMode === 'live' ? 'active' : ''}
                aria-pressed={chartMode === 'live'}
                onClick={() => setChartMode('live')}
              >
                Thời gian thực
              </button>
              <button
                className={chartMode === 'hour' ? 'active' : ''}
                aria-pressed={chartMode === 'hour'}
                onClick={() => setChartMode('hour')}
              >
                Theo giờ
              </button>
              <button
                className={chartMode === 'day' ? 'active' : ''}
                aria-pressed={chartMode === 'day'}
                onClick={() => setChartMode('day')}
              >
                Theo ngày
              </button>
            </div>
          </div>

          {/* Stats Summary */}
          <div className="stats" id="stats">
            {SERIES_META.map((s) => {
              const vals: number[] = chartData.rows
                .map((r: any) => r[s.k])
                .filter((v: any): v is number => v != null && !isNaN(v))
              const hasData = vals.length > 0
              const avg = hasData ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
              const mn = hasData ? Math.min(...vals) : 0
              const mx = hasData ? Math.max(...vals) : 0
              return (
                <div key={s.k} className="stat" style={{ ['--c' as any]: `var(${s.c})` }}>
                  <b>
                    <i />
                    {s.name}
                  </b>
                  <span>
                    {hasData ? (
                      `TB ${avg.toFixed(s.dec)} · Thấp ${mn.toFixed(s.dec)} · Cao ${mx.toFixed(s.dec)}`
                    ) : (
                      'Không có dữ liệu (--)'
                    )}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Canvas Chart */}
          <div className="chart-wrap" id="cw" ref={chartWrapRef}>
            <canvas
              id="chart"
              role="img"
              aria-label="Biểu đồ nhiệt độ, độ ẩm, độ ẩm đất và ánh sáng"
              ref={chartCanvasRef}
              onMouseMove={handleChartMouseMove}
              onMouseLeave={handleChartMouseLeave}
            />
            <div className="tip" id="tip" ref={tooltipRef} />
          </div>

          {/* Chart Legend Filter Chips */}
          <div className="legend" id="legend">
            {SERIES_META.map((s) => {
              const active = vis.has(s.k)
              return (
                <button
                  key={s.k}
                  className={`chip-l ${!active ? 'disabled' : ''}`}
                  data-k={s.k}
                  aria-pressed={active}
                  style={{ ['--c' as any]: `var(${s.c})` }}
                  onClick={() => {
                    const next = new Set(vis)
                    if (next.has(s.k)) next.delete(s.k)
                    else next.add(s.k)
                    setVis(next)
                  }}
                >
                  <i />
                  {s.name} ({s.unit})
                </button>
              )
            })}
          </div>
        </div>

        {/* Right Card: Device Control & Status */}
        <div className="glass card dev rise" style={{ ['--d' as any]: 7 }}>
          <h2>Device Control &amp; Status</h2>
          <div className="kv">
            <div>
              <small>Device ID</small>
              <code>{device?.deviceId || 'esp32-001'}</code>
            </div>
            <div style={{ textAlign: 'right' }}>
              <small>Connection Status</small>
              <span className={`online ${!isDeviceOnline ? 'offline' : ''}`}>
                <i />
                {isDeviceOnline ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>
          </div>

          {/* LED Switch Block */}
          <div className="blk">
            <div className="row" style={{ ['--tone' as any]: 'var(--blue)' }}>
              <div className="ic">
                <svg className="i">
                  <use href="#i-bulb" />
                </svg>
              </div>
              <div className="tt">
                <b>Đèn LED (GPIO 2)</b>
                <span id="ledSt" className={ledState ? 'on' : ''}>
                  {ledState ? 'Đang bật' : 'Đang tắt'}
                </span>
              </div>
              <button
                className={`sw ${ledState ? 'on' : ''}`}
                id="ledSw"
                role="switch"
                aria-checked={ledState}
                aria-label="Bật tắt đèn LED"
                disabled={role === 'VIEWER'}
                onClick={() => sendCommand(ledState ? 'LED_OFF' : 'LED_ON')}
              />
            </div>
          </div>

          {/* Buzzer Switch Block */}
          <div className="blk">
            <div className="row" style={{ ['--tone' as any]: 'var(--pink)' }}>
              <div className="ic">
                <svg className="i">
                  <use href="#i-bell" />
                </svg>
              </div>
              <div className="tt">
                <b>Còi báo động (Buzzer)</b>
                <span id="bzSt" className={buzzerState ? 'on' : ''}>
                  {buzzerState ? 'Đang hú còi' : 'Đang tắt'}
                </span>
              </div>
              <button
                className={`sw ${buzzerState ? 'on' : ''}`}
                id="bzSw"
                data-tone="pink"
                role="switch"
                aria-checked={buzzerState}
                aria-label="Bật tắt còi báo động"
                disabled={role === 'VIEWER'}
                onClick={() => sendCommand(buzzerState ? 'BUZZER_OFF' : 'BUZZER_ON')}
              />
            </div>
            <p className="note">
              <svg className="i">
                <use href="#i-alert" />
              </svg>
              Còi tự động hú khi giá trị vượt ngưỡng cảnh báo.
            </p>
          </div>

          {/* LCD Block */}
          <div className="blk">
            <div className="row" style={{ ['--tone' as any]: 'var(--mint)' }}>
              <div className="ic">
                <svg className="i">
                  <use href="#i-monitor" />
                </svg>
              </div>
              <div className="tt">
                <b>Màn hình LCD 1602 (I2C)</b>
                <span>16 x 2 ký tự</span>
              </div>
            </div>

            {/* LCD Screen Mockup */}
            <div className="lcd" id="lcd" aria-label="Màn hình LCD mô phỏng">
              <div className="lcd-row" id="lcd1">
                {Array.from({ length: 16 }).map((_, j) => (
                  <span key={j}>{lcdRow1[j] === ' ' ? '\u00A0' : lcdRow1[j] || '\u00A0'}</span>
                ))}
              </div>
              <div className="lcd-row" id="lcd2">
                {Array.from({ length: 16 }).map((_, j) => (
                  <span key={j}>{lcdRow2[j] === ' ' ? '\u00A0' : lcdRow2[j] || '\u00A0'}</span>
                ))}
              </div>
            </div>

            <div className="field">
              <label htmlFor="in1">
                Dòng 1 (tối đa 60 ký tự, chữ dài sẽ tự chạy)
                <em id="c1">{in1.length}/60</em>
              </label>
              <input
                className="inp"
                id="in1"
                maxLength={60}
                value={in1}
                onChange={(e) => setIn1(e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="in2">
                Dòng 2<em id="c2">{in2.length}/60</em>
              </label>
              <input
                className="inp"
                id="in2"
                maxLength={60}
                value={in2}
                onChange={(e) => setIn2(e.target.value)}
              />
            </div>

            {/* Quick Presets */}
            <div className="quick">
              <small>Mẫu hiển thị nhanh</small>
              <button className="q" onClick={() => applyPreset(0)}>Chạy chữ mẫu</button>
              <button className="q" onClick={() => applyPreset(1)}>Xin chào</button>
              <button className="q" onClick={() => applyPreset(2)}>Nhiệt độ/Ẩm</button>
              <button className="q p" onClick={() => applyPreset(3)}>Cảnh báo dài</button>
              <button className="q" onClick={() => applyPreset(4)}>Xóa màn</button>
            </div>

            <button
              className="btn-g full"
              id="lcdSend"
              disabled={role === 'VIEWER' || lcdSending}
              onClick={sendLcdCommand}
            >
              <svg className="i">
                <use href="#i-send" />
              </svg>
              {lcdSending ? 'Đang gửi...' : 'Gửi lên LCD'}
            </button>
          </div>
        </div>
      </div>

      {/* Threshold Modal */}
      {modalOpen && (
        <div className="modal" id="modal" onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false) }}>
          <div className="glass sheet" role="dialog" aria-modal="true" aria-labelledby="mt">
            <h2 id="mt">Cấu hình ngưỡng cảnh báo</h2>
            <p>Hệ thống sẽ báo động khi giá trị vượt các ngưỡng dưới đây.</p>

            <label className="rng">
              <div className="lh">
                <span>Nhiệt độ cao nhất</span>
                <output id="o-temp">{tempInput}°C</output>
              </div>
              <input
                type="range"
                id="r-temp"
                min="20"
                max="50"
                step="0.5"
                value={tempInput}
                onChange={(e) => setTempInput(parseFloat(e.target.value))}
              />
            </label>

            <label className="rng">
              <div className="lh">
                <span>Độ ẩm đất thấp nhất</span>
                <output id="o-soil">{soilInput}%</output>
              </div>
              <input
                type="range"
                id="r-soil"
                min="0"
                max="60"
                step="1"
                value={soilInput}
                onChange={(e) => setSoilInput(parseFloat(e.target.value))}
              />
            </label>

            <label className="rng">
              <div className="lh">
                <span>Độ ẩm không khí thấp nhất</span>
                <output id="o-hum">{humInput}%</output>
              </div>
              <input
                type="range"
                id="r-hum"
                min="0"
                max="60"
                step="1"
                value={humInput}
                onChange={(e) => setHumInput(parseFloat(e.target.value))}
              />
            </label>

            <div className="acts">
              <button className="btn-o" id="mCancel" onClick={() => setModalOpen(false)}>
                Hủy
              </button>
              <button className="btn-g" id="mSave" onClick={handleSaveThresholds}>
                Lưu ngưỡng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="toasts" id="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            <svg className="i">
              <use href="#i-check" />
            </svg>
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  )
}
