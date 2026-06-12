import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, getDocs, orderBy, query, doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import Layout from '../components/Layout'
import Lightbox from '../components/Lightbox'

const CACHE_KEY = 'scenes_cache'
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const LOAD_TIMEOUT = 12000

function loadCached() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { ts, data } = JSON.parse(raw)
    if (Date.now() - ts > CACHE_TTL) return null
    return data
  } catch { return null }
}

function saveCache(data) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }))
  } catch {}
}

export default function Home() {
  const navigate = useNavigate()
  const [scenes, setScenes] = useState([])
  const [loading, setLoading] = useState(true)
  const [timedOut, setTimedOut] = useState(false)
  const [votes, setVotes] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('pending_votes') || '{}') } catch { return {} }
  })
  const [lightbox, setLightbox] = useState(null) // { url, label }
  const sceneRefs = useRef({})
  const voterName = sessionStorage.getItem('voter_name') || ''

  useEffect(() => {
    sessionStorage.setItem('pending_votes', JSON.stringify(votes))
  }, [votes])

  const prefillVotes = useCallback(async (scenesData) => {
    const voteKey = voterName.trim().toLowerCase()
    if (!voteKey) return
    const prefill = {}
    await Promise.all(
      scenesData.map(async scene => {
        try {
          const voteDoc = await getDoc(doc(db, 'scenes', scene.id, 'votes', voteKey))
          if (voteDoc.exists()) {
            prefill[scene.id] = {
              versionId: voteDoc.data().versionId,
              comment: voteDoc.data().comment || '',
            }
          }
        } catch {}
      })
    )
    setVotes(prev => ({ ...prefill, ...prev }))
  }, [voterName])

  const loadScenes = useCallback(async (skipCache = false) => {
    setLoading(true)
    setTimedOut(false)

    if (!skipCache) {
      const cached = loadCached()
      if (cached) {
        setScenes(cached)
        setLoading(false)
        prefillVotes(cached)
        return
      }
    }

    const timer = setTimeout(() => setTimedOut(true), LOAD_TIMEOUT)

    try {
      const snap = await getDocs(collection(db, 'scenes'))
      const published = snap.docs
        .filter(d => d.data().published === true)
        .sort((a, b) => (b.data().createdAt?.seconds || 0) - (a.data().createdAt?.seconds || 0))

      const scenesData = await Promise.all(
        published.map(async d => {
          const vSnap = await getDocs(
            query(collection(db, 'scenes', d.id, 'versions'), orderBy('uploadedAt', 'asc'))
          )
          return {
            id: d.id,
            ...d.data(),
            versions: vSnap.docs.map(v => ({ id: v.id, ...v.data() })),
          }
        })
      )

      clearTimeout(timer)
      saveCache(scenesData)
      setScenes(scenesData)
      prefillVotes(scenesData)
    } catch (err) {
      clearTimeout(timer)
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [prefillVotes])

  useEffect(() => { loadScenes() }, [loadScenes])

  const setVersion = (sceneId, versionId) =>
    setVotes(prev => ({ ...prev, [sceneId]: { ...prev[sceneId], versionId } }))

  const setComment = (sceneId, comment) =>
    setVotes(prev => ({ ...prev, [sceneId]: { ...prev[sceneId], comment } }))

  const votedCount = scenes.filter(s => votes[s.id]?.versionId).length
  const allVoted = scenes.length > 0 && votedCount === scenes.length

  const handleReview = () => {
    if (!allVoted) {
      const first = scenes.find(s => !votes[s.id]?.versionId)
      if (first && sceneRefs.current[first.id]) {
        sceneRefs.current[first.id].scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
      return
    }
    navigate('/review')
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          {timedOut && (
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-3">Taking longer than usual…</p>
              <button
                onClick={() => loadScenes(true)}
                className="text-sm text-indigo-600 font-medium hover:underline"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </Layout>
    )
  }

  if (scenes.length === 0) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-5">
            <svg className="w-8 h-8 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Nothing to vote on yet</h1>
          <p className="text-gray-500 text-sm mb-4">Check back soon!</p>
          <button onClick={() => loadScenes(true)} className="text-sm text-indigo-600 font-medium hover:underline">
            Refresh
          </button>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Hi {voterName} 👋</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Vote on all {scenes.length} scene{scenes.length !== 1 ? 's' : ''} to continue.
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
          <span>{votedCount} of {scenes.length} scenes voted</span>
          {allVoted && <span className="text-green-600 font-medium">All done!</span>}
        </div>
        <div className="bg-gray-200 rounded-full h-1.5">
          <div
            className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${(votedCount / scenes.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Scenes */}
      <div className="space-y-8 mb-32">
        {scenes.map((scene, sceneIdx) => {
          const selection = votes[scene.id]
          const voted = !!selection?.versionId

          return (
            <div
              key={scene.id}
              ref={el => { sceneRefs.current[scene.id] = el }}
              className={`bg-white rounded-2xl border-2 overflow-hidden shadow-sm transition-colors ${
                voted ? 'border-indigo-200' : 'border-gray-100'
              }`}
            >
              {/* Scene header */}
              <div className="px-4 pt-4 pb-3 flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                    Scene {sceneIdx + 1}
                  </span>
                  <h2 className="font-semibold text-gray-900 leading-tight">{scene.title}</h2>
                </div>
                {voted ? (
                  <span className="w-7 h-7 bg-indigo-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                ) : (
                  <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
                    Required
                  </span>
                )}
              </div>

              {/* Photo grid */}
              <div className="px-3 pb-3">
                <div className="grid grid-cols-2 gap-2">
                  {scene.versions.map((v, idx) => {
                    const label = v.label || String.fromCharCode(65 + idx)
                    const isSelected = selection?.versionId === v.id
                    return (
                      <div key={v.id} className="relative">
                        {/* Vote select button */}
                        <button
                          onClick={() => setVersion(scene.id, v.id)}
                          className={`relative w-full rounded-xl overflow-hidden border-4 transition-all duration-150 focus:outline-none touch-manipulation ${
                            isSelected
                              ? 'border-indigo-500 shadow-md ring-2 ring-indigo-100'
                              : 'border-transparent shadow-sm active:scale-95'
                          }`}
                        >
                          <div className="aspect-[4/3] bg-gray-100">
                            <img
                              src={v.url}
                              alt={`Version ${label}`}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                          <div className={`absolute bottom-0 left-0 right-0 py-1.5 text-xs font-bold text-center ${
                            isSelected ? 'bg-indigo-500 text-white' : 'bg-black/40 text-white'
                          }`}>
                            {label}
                          </div>
                          {isSelected && (
                            <div className="absolute top-2 right-2 w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center shadow">
                              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </button>

                        {/* Expand button — top-left, always visible */}
                        <button
                          onClick={() => setLightbox({ url: v.url, label })}
                          className="absolute top-2 left-2 w-7 h-7 bg-black/40 hover:bg-black/65 rounded-lg flex items-center justify-center transition-colors touch-manipulation z-10"
                          title="View full size"
                        >
                          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                          </svg>
                        </button>
                      </div>
                    )
                  })}
                </div>

                {/* Comment field */}
                <textarea
                  placeholder="Add a comment… (optional)"
                  value={selection?.comment || ''}
                  onChange={e => setComment(scene.id, e.target.value)}
                  rows={2}
                  className="mt-3 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent resize-none bg-gray-50"
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Sticky submit bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 px-4 pt-3 pb-4 safe-bottom z-10">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={handleReview}
            className={`w-full font-semibold py-3 rounded-xl transition-colors text-base ${
              allVoted
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800'
                : 'bg-gray-200 text-gray-500'
            }`}
          >
            {allVoted
              ? 'Review & Submit →'
              : `Vote on all scenes to continue (${votedCount}/${scenes.length})`}
          </button>
        </div>
      </div>

      {/* Lightbox with pinch-to-zoom */}
      {lightbox && (
        <Lightbox
          url={lightbox.url}
          label={lightbox.label}
          onClose={() => setLightbox(null)}
        />
      )}
    </Layout>
  )
}
