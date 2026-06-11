import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import Layout from '../components/Layout'

export default function Home() {
  const [scenes, setScenes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchScenes = async () => {
      try {
        const q = query(
          collection(db, 'scenes'),
          where('published', '==', true),
          orderBy('createdAt', 'desc')
        )
        const snap = await getDocs(q)
        setScenes(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchScenes()
  }, [])

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Pick your favourite</h1>
      <p className="text-gray-500 text-sm mb-6">Choose a scene and vote for the best version.</p>

      {scenes.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="font-medium">No scenes yet</p>
          <p className="text-sm mt-1">Check back soon!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {scenes.map(scene => (
            <Link key={scene.id} to={`/vote/${scene.id}`} className="group block">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden active:scale-[0.98] transition-transform">
                <div className="relative aspect-[4/3] bg-gray-100">
                  {scene.coverUrl ? (
                    <img
                      src={scene.coverUrl}
                      alt={scene.title}
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  <div className="absolute top-2 right-2 bg-black/50 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                    {scene.versionCount || 0} versions
                  </div>
                </div>
                <div className="px-4 py-3 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900 truncate">{scene.title}</h2>
                  <span className="text-indigo-600 text-sm font-medium ml-2 flex-shrink-0">Vote →</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Layout>
  )
}
