import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'

export default function AdminNav() {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  const isSummary = pathname === '/admin/summary'
  const isScenes  = pathname === '/admin/dashboard' || pathname.startsWith('/admin/results/')

  const tab = (active, to, label) => (
    <Link
      to={to}
      className={`text-sm transition-colors px-1 pb-0.5 ${
        active
          ? 'text-white font-semibold border-b-2 border-indigo-400'
          : 'text-gray-400 hover:text-white'
      }`}
    >
      {label}
    </Link>
  )

  return (
    <header className="bg-gray-900 text-white sticky top-0 z-20">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <span className="font-bold text-white text-sm hidden sm:block">Admin</span>
          {tab(isSummary, '/admin/summary', 'Summary')}
          {tab(isScenes,  '/admin/dashboard', 'Scenes')}
        </div>
        <div className="flex items-center gap-4">
          <Link to="/" className="text-gray-400 hover:text-white text-sm">View site</Link>
          <button
            onClick={async () => { await signOut(auth); navigate('/admin') }}
            className="text-gray-400 hover:text-white text-sm"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  )
}
