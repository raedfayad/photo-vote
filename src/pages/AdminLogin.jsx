import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD

export default function AdminLogin() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    if (sessionStorage.getItem('admin_auth') === '1') navigate('/admin/dashboard')
  }, [])

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem('admin_auth', '1')
      navigate('/admin/dashboard')
    } else {
      setError('Incorrect password.')
      setPassword('')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-xs">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center mb-5 mx-auto">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-center mb-5">Admin Login</h1>
          <input
            type="password"
            placeholder="Admin password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 mb-3 text-base focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            autoFocus
          />
          {error && <p className="text-red-500 text-sm mb-3 text-center">{error}</p>}
          <button
            onClick={handleLogin}
            className="w-full bg-gray-900 text-white font-semibold py-3 rounded-xl hover:bg-gray-700 transition-colors"
          >
            Login
          </button>
          <button
            onClick={() => navigate('/')}
            className="w-full mt-3 text-sm text-gray-400 hover:text-gray-600"
          >
            Back to voting
          </button>
        </div>
      </div>
    </div>
  )
}
