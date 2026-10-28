'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface AdminHeaderProps {
  businessName?: string
  title?: string
  showNavigation?: boolean
  backLink?: string
  user: {
    name?: string | null
    email?: string | null
  }
}

export function AdminHeader({ businessName, title, showNavigation = false, backLink, user }: AdminHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [menuOpen])

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/signout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      router.push('/auth/signin')
      router.refresh()
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  // Get user initials
  const getUserInitial = () => {
    if (user.name) {
      return user.name.charAt(0).toUpperCase()
    }
    if (user.email) {
      return user.email.charAt(0).toUpperCase()
    }
    return 'U'
  }

  // Get display name
  const getDisplayName = () => {
    return user.name || user.email?.split('@')[0] || 'Usuario'
  }

  return (
    <div className="bg-white border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Left: Title/Business */}
          <div className="flex-shrink-0">
            {backLink && (
              <Link href={backLink} className="text-blue-600 hover:underline text-sm mb-2 inline-block">
                ← Volver
              </Link>
            )}
            {businessName && <h1 className="text-2xl font-bold">{businessName}</h1>}
            {title && !businessName && <h1 className="text-2xl font-bold">{title}</h1>}
            {businessName && title && (
              <p className="text-sm text-gray-600">{title}</p>
            )}
          </div>

          {/* Center: Navigation (only on desktop if showNavigation) */}
          {showNavigation && (
            <div className="hidden md:flex gap-2">
              <Link
                href="/admin/billing"
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
              >
                Facturación
              </Link>
              <Link
                href="/admin/scanner"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Escáner
              </Link>
              <Link
                href="/admin/program"
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
              >
                Programa
              </Link>
            </div>
          )}

          {/* Right: User Menu */}
          <div className="relative flex-shrink-0" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-sm">
                {getUserInitial()}
              </div>
              {/* Name (hidden on mobile) */}
              <span className="hidden sm:block text-sm font-medium text-gray-700">
                {getDisplayName()}
              </span>
              {/* Dropdown icon */}
              <svg
                className={`w-4 h-4 text-gray-500 transition-transform ${menuOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                {/* User Info */}
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-medium text-gray-900">{user.name || 'Usuario'}</p>
                  {user.email && (
                    <p className="text-xs text-gray-500 mt-1">{user.email}</p>
                  )}
                </div>

                {/* Menu Items */}
                <Link
                  href="/admin/settings"
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  ⚙️ Configuración
                </Link>

                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  🚪 Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Navigation (if showNavigation) */}
        {showNavigation && (
          <div className="flex md:hidden gap-2 mt-4">
            <Link
              href="/admin/billing"
              className="flex-1 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-xs font-medium text-center"
            >
              Facturación
            </Link>
            <Link
              href="/admin/scanner"
              className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-medium text-center"
            >
              Escáner
            </Link>
            <Link
              href="/admin/program"
              className="flex-1 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-xs font-medium text-center"
            >
              Programa
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
