import React, { useState } from 'react'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { useThemeMode } from '../contexts/ThemeContext'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { login } = useAuth()
  const { mode, toggleTheme } = useThemeMode()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      setError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu')
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await api.post('/auth/login', { username, password })
      login(res.data.accessToken, res.data.role)
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          'Đăng nhập thất bại. Vui lòng kiểm tra lại tài khoản.'
      )
    } finally {
      setLoading(false)
    }
  }

  const fillCredentials = (u: string, p: string) => {
    setUsername(u)
    setPassword(p)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        position: 'relative',
      }}
    >
      {/* Theme Toggle Button */}
      <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 50 }}>
        <button
          className="icon-btn"
          id="themeBtn"
          aria-label="Đổi giao diện sáng/tối"
          onClick={toggleTheme}
          title={`Chuyển sang chế độ ${mode === 'dark' ? 'Sáng' : 'Tối'}`}
        >
          <svg className="i">
            <use href={mode === 'dark' ? '#i-moon' : '#i-sun'} />
          </svg>
        </button>
      </div>

      {/* Glass Card Sheet */}
      <div
        className="glass sheet"
        style={{
          width: 'min(440px, 100%)',
          padding: '34px 28px',
          borderRadius: '24px',
        }}
      >
        {/* Brand Header */}
        <div className="brand" style={{ justifyContent: 'center', marginBottom: '12px' }}>
          <div className="logo">
            <svg className="i">
              <use href="#i-chip" />
            </svg>
          </div>
          <b>IoT Smart Environment</b>
          <em>Pro</em>
        </div>

        <p
          style={{
            textAlign: 'center',
            color: 'var(--tx3)',
            fontSize: '12px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: '22px',
            fontWeight: 600,
          }}
        >
          HỆ THỐNG GIÁM SÁT &amp; ĐIỀU KHIỂN
        </p>

        {/* Error Alert */}
        {error && (
          <div className="banner" role="alert" style={{ marginBottom: '18px' }}>
            <svg className="i">
              <use href="#i-alert" />
            </svg>
            <div>
              <b>Lỗi xác thực</b>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin}>
          <div className="field">
            <label htmlFor="login-username">
              TÊN ĐĂNG NHẬP / USERNAME
            </label>
            <input
              className="inp"
              id="login-username"
              type="text"
              placeholder="Nhập tên đăng nhập..."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="field" style={{ marginTop: '14px' }}>
            <label htmlFor="login-password">
              MẬT KHẨU / PASSWORD
            </label>
            <input
              className="inp"
              id="login-password"
              type="password"
              placeholder="Nhập mật khẩu..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <button
            className="btn-g full"
            type="submit"
            style={{ marginTop: '24px' }}
            disabled={loading}
          >
            <svg className="i">
              <use href="#i-send" />
            </svg>
            {loading ? 'Đang xác thực...' : 'AUTHENTICATE • ĐĂNG NHẬP'}
          </button>
        </form>

        {/* Quick Credentials */}
        <div
          className="quick"
          style={{
            marginTop: '26px',
            paddingTop: '18px',
            borderTop: '1px solid var(--line)',
          }}
        >
          <small>Tài khoản mẫu (Click để điền nhanh):</small>
          <button
            type="button"
            className="q"
            onClick={() => fillCredentials('admin', 'Admin@123')}
          >
            Admin (Toàn quyền)
          </button>
          <button
            type="button"
            className="q p"
            onClick={() => fillCredentials('operator', 'Operator@123')}
          >
            Operator (Vận hành)
          </button>
          <button
            type="button"
            className="q"
            onClick={() => fillCredentials('viewer', 'Viewer@123')}
          >
            Viewer (Chỉ xem)
          </button>
        </div>
      </div>
    </div>
  )
}
