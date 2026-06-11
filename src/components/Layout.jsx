import React from 'react'
import { Link, useNavigate } from 'react-router-dom'

export default function Layout({ children, title, showBack = false }) {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          {showBack && (
            <button
              onClick={() => navigate(-1)}
              className="p-1 -ml-1 text-gray-500 hover:text-gray-800 touch-manipulation"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div className="flex-1 min-w-0">
            <Link to="/" className="font-bold text-indigo-600 text-base">
              PhotoVote
            </Link>
            {title && (
              <p className="text-xs text-gray-500 truncate leading-none mt-0.5">{title}</p>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
