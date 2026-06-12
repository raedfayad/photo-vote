import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { signInAnonymously, updateProfile } from 'firebase/auth'
import { auth } from '../firebase'
import { useAuth } from '../context/AuthContext'

const VOTER_PASSWORD = import.meta.env.VITE_VOTER_PASSWORD

export default function VoterLogin() {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const user = useAuth()

  useEffect(() => {
    if (user?.isAnonymous && sessionStorage.getItem('voter_name')) navigate('/')
  }, [user])

  const handleLogin = async () => {
    if (!name.trim()) { setError('Please enter your name.'); return }
    setLoading(true)
    setError('')
    try {
      if (user?.isAnonymous) {
        // Already auth'd anonymously (e.g. returning after tab closed) — just restore name
        await updateProfile(user, { displayName: name.trim() })
        sessionStorage.setItem('voter_name', name.trim())
        navigate('/')
        return
      }
      if (password !== VOTER_PASSWORD) {
        setError('Incorrect password. Ask the organiser for access.')
        setPassword('')
        return
      }
      const { user: newUser } = await signInAnonymously(auth)
      await updateProfile(newUser, { displayName: name.trim() })
      sessionStorage.setItem('voter_name', name.trim())
      navigate('/')
    } catch (err) {
      setError('Login failed. Please try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => { if (e.key === 'Enter') handleLogin() }

  const needsPassword = !user?.isAnonymous

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-xs">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">PhotoVote</h1>
          <p className="text-gray-500 text-sm mt-1">Enter your details to start voting</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-3">
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={handleKey}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            autoFocus
          />
          {needsPassword && (
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={handleKey}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          )}
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 active:bg-indigo-800 transition-colors text-base disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Start voting'}
          </button>
        </div>
      </div>
    </div>
  )
}
