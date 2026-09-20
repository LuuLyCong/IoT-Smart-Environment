import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useThemeMode } from '../contexts/ThemeContext'

export default function Layout() {
  const [isSlim, setIsSlim] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const { role, logout } = useAuth()
  const { mode, toggleTheme } = useThemeMode()
  const navigate = useNavigate()
  const location = useLocation()

  const currentPath = location.pathname

  const handleNav = (path: string) => {
    navigate(path)
    setIsOpen(false)
  }

  return (
    <div>
      {/* Header */}
      <header className="top">
        <button
          className="menu-btn"
          id="menuBtn"
          aria-label="Mở menu"
          onClick={() => setIsOpen(!isOpen)}
        >
          <svg className="i">
            <use href="#i-menu" />
          </svg>
        </button>

        <div className="brand" style={{ cursor: 'pointer' }} onClick={() => handleNav('/')}>
          <div className="logo">
            <svg className="i">
              <use href="#i-chip" />
            </svg>
          </div>
          <b>IoT Smart Environment</b>
          <em>Pro</em>
        </div>

        <div className="spacer" />

        <span className="pill role">Role: {role || 'ADMIN'}</span>

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

        <button className="ghost" id="logoutBtn" onClick={logout}>
          <svg className="i">
            <use href="#i-out" />
          </svg>
          Đăng xuất
        </button>
      </header>

      {/* Shell with Sidebar and Main Content */}
      <div className={`shell ${isSlim ? 'slim' : ''} ${isOpen ? 'open' : ''}`} id="shell">
        <aside className="side">
          <button
            className="nav"
            aria-current={currentPath === '/' ? 'page' : undefined}
            onClick={() => handleNav('/')}
          >
            <svg className="i">
              <use href="#i-dash" />
            </svg>
            <span>Dashboard</span>
          </button>

          <button
            className="nav"
            aria-current={currentPath === '/logs' ? 'page' : undefined}
            onClick={() => handleNav('/logs')}
          >
            <svg className="i">
              <use href="#i-hist" />
            </svg>
            <span>History Logs</span>
          </button>

          <div className="grow" />

          <button
            className="side-foot"
            id="collapse"
            onClick={() => setIsSlim(!isSlim)}
            title={isSlim ? 'Mở rộng menu' : 'Thu gọn menu'}
          >
            <svg className="i">
              <use href="#i-panel" />
            </svg>
            <span>{isSlim ? 'Mở rộng' : 'Thu gọn menu'}</span>
          </button>
        </aside>

        {/* Backdrop for mobile navigation */}
        <div className="scrim" id="scrim" onClick={() => setIsOpen(false)} />

        <main className="main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
