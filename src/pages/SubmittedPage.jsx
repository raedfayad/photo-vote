import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function SubmittedPage() {
  const navigate = useNavigate()
  const voterName = sessionStorage.getItem('voter_name') || ''

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center max-w-xs">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Votes submitted!</h1>
        <p className="text-gray-500 text-sm">
          Thanks {voterName}! Your votes have been recorded.
        </p>
        <button
          onClick={() => navigate('/')}
          className="mt-8 text-sm text-indigo-600 font-medium hover:underline"
        >
          Change my votes
        </button>
      </div>
    </div>
  )
}
