'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface SuperAdminHeaderProps {
  user: {
    name?: string | null
    email?: string | null
  }
}

export function SuperAdminHeader({ user }: SuperAdminHeaderProps) {
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
    return 'S'
  }

  // Get display name
  const getDisplayName = () => {
    return user.name || user.email?.split('@')[0] || 'Super Admin'
  }

  return (
    <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Super Admin Dashboard</h1>
            <p className="text-purple-100 mt-1">IntusPath Loyalty Platform</p>
          </div>

          {/* User Menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full bg-white text-purple-600 flex items-center justify-center font-semibold text-sm">
                {getUserInitial()}
              </div>
              {/* Name (hidden on mobile) */}
              <span className="hidden sm:block text-sm font-medium">
                {getDisplayName()}
              </span>
              {/* Dropdown icon */}
              <svg
                className={`w-4 h-4 transition-transform ${menuOpen ? 'rotate-180' : ''}`}
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
                  <p className="text-sm font-medium text-gray-900">{user.name || 'Super Admin'}</p>
                  {user.email && (
                    <p className="text-xs text-gray-500 mt-1">{user.email}</p>
                  )}
                  <span className="inline-block mt-2 px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded">
                    SUPER_ADMIN
                  </span>
                </div>

                {/* Menu Items */}
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
      </div>
    </div>
  )
}
