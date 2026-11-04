'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function SignInPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        email: formData.email,
        password: formData.password,
        redirect: false
      })

      if (result?.error) {
        setError('Credenciales inválidas')
      } else {
        // Check if super admin or business admin
        if (formData.email.includes('super@')) {
          router.push('/super-admin')
        } else {
          router.push('/admin')
        }
      }
    } catch (err) {
      setError('Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-2 pb-4">
          <CardTitle
            className="text-center text-2xl sm:text-3xl font-bold"
            style={{ color: '#102A43' }}
          >
            IntusPath Loyalty
          </CardTitle>
          <p
            className="text-center text-sm"
            style={{ color: '#64748B' }}
          >
            Inicia sesión en tu cuenta
          </p>
        </CardHeader>

        <CardContent className="pt-2">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: '#334155' }}
              >
                Email
              </label>
              <input
                type="email"
                required
                placeholder="correo@ejemplo.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-base"
                style={{ color: '#0F172A' }}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: '#334155' }}
              >
                Contraseña
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-base"
                style={{ color: '#0F172A' }}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-300 text-red-800 px-4 py-3 rounded-lg text-sm font-medium">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              size="lg"
            >
              {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </Button>
          </form>

        </CardContent>
      </Card>

      {/* Force light mode for login page - prevent dark mode text issues */}
      <style jsx global>{`
        body {
          color: #0F172A !important;
        }
        input::placeholder {
          color: #64748B;
          opacity: 1;
        }
        input::-webkit-input-placeholder {
          color: #64748B;
          opacity: 1;
        }
        input::-moz-placeholder {
          color: #64748B;
          opacity: 1;
        }
      `}</style>
    </div>
  )
}
