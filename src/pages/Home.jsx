import React from 'react'
import Layout from '../components/Layout'

export default function Home() {
  return (
    <Layout>
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-5">
          <svg className="w-8 h-8 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Waiting for your link</h1>
        <p className="text-gray-500 text-sm max-w-xs">
          Ask the organiser to share a voting link with you. Each scene has its own link.
        </p>
      </div>
    </Layout>
  )
}
