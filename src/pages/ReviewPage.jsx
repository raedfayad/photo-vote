import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  collection, doc, getDocs, orderBy, query, setDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import Layout from '../components/Layout'

export default function ReviewPage() {
  const navigate = useNavigate()
  const [scenes, setScenes] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const voterName = sessionStorage.getItem('voter_name') || ''
  const votes = (() => {
    try { return JSON.parse(sessionStorage.getItem('pending_votes') || '{}') } catch { return {} }
  })()

  useEffect(() => {
    if (!voterName) { navigate('/login'); return }

    const load = async () => {
      try {
        const q = query(collection(db, 'scenes'), orderBy('createdAt', 'desc'))
        const snap = await getDocs(q)
        const data = await Promise.all(
          snap.docs
            .filter(d => votes[d.id]?.versionId) // only scenes we've voted on
            .map(async d => {
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
        setScenes(data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const voteKey = voterName.trim().toLowerCase()
      await Promise.all(
        Object.entries(votes).map(([sceneId, vote]) =>
          setDoc(doc(db, 'scenes', sceneId, 'votes', voteKey), {
            versionId: vote.versionId,
            voterName: voterName.trim(),
            comment: vote.comment || '',
            timestamp: serverTimestamp(),
          })
        )
      )
      sessionStorage.removeItem('pending_votes')
      navigate('/submitted')
    } catch (err) {
      console.error(err)
      alert('Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <Layout showBack>
        <div className="flex justify-center items-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout showBack>
      <h1 className="text-xl font-bold text-gray-900 mb-1">Review your votes</h1>
      <p className="text-sm text-gray-500 mb-6">
        Check everything looks right, then submit. You can go back and change anything.
      </p>

      <div className="space-y-4 mb-32">
        {scenes.map((scene, idx) => {
          const vote = votes[scene.id]
          const selectedVersion = scene.versions.find(v => v.id === vote?.versionId)
          const versionIdx = scene.versions.findIndex(v => v.id === vote?.versionId)
          const label = selectedVersion?.label || String.fromCharCode(65 + versionIdx)

          return (
            <div key={scene.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex gap-3 p-4">
                {selectedVersion && (
                  <div className="relative flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden">
                    <img
                      src={selectedVersion.url}
                      alt={`Version ${label}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-indigo-500 text-white text-xs font-bold text-center py-0.5">
                      {label}
                    </div>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Scene {idx + 1}</p>
                  <h3 className="font-semibold text-gray-900 leading-tight">{scene.title}</h3>
                  <p className="text-sm text-indigo-600 font-medium mt-0.5">Version {label}</p>
                  {vote?.comment && (
                    <p className="text-sm text-gray-500 mt-1 italic">"{vote.comment}"</p>
                  )}
                </div>
              </div>
              <div className="border-t border-gray-100 px-4 py-2">
                <button
                  onClick={() => navigate('/')}
                  className="text-xs text-indigo-500 hover:text-indigo-700 font-medium"
                >
                  ← Edit this vote
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Sticky submit */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 px-4 pt-3 pb-4 safe-bottom z-10">
        <div className="max-w-3xl mx-auto">
          <p className="text-center text-sm text-gray-500 mb-3">
            Submitting as <span className="font-semibold text-gray-800">{voterName}</span>
          </p>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 active:bg-indigo-800 transition-colors disabled:opacity-50 text-base"
          >
            {submitting ? 'Submitting…' : 'Submit votes'}
          </button>
        </div>
      </div>
    </Layout>
  )
}
