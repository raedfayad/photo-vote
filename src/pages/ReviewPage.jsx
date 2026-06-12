import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, doc, getDocs, orderBy, query, setDoc, serverTimestamp } from 'firebase/firestore'
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
        const snap = await getDocs(collection(db, 'scenes'))
        const data = await Promise.all(
          snap.docs
            .filter(d => votes[d.id])
            .map(async d => {
              const vSnap = await getDocs(
                query(collection(db, 'scenes', d.id, 'versions'), orderBy('uploadedAt', 'asc'))
              )
              return { id: d.id, ...d.data(), versions: vSnap.docs.map(v => ({ id: v.id, ...v.data() })) }
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
            versionIds: vote.versionIds || [],
            likedNone: vote.likedNone || false,
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
      <p className="text-sm text-gray-500 mb-6">Check everything and then submit. You can go back to change anything.</p>

      <div className="space-y-4 mb-32">
        {scenes.map((scene, idx) => {
          const vote = votes[scene.id] || {}
          const selectedVersions = scene.versions.filter(v => (vote.versionIds || []).includes(v.id))

          return (
            <div key={scene.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5">Scene {idx + 1}</p>
                <h3 className="font-semibold text-gray-900 mb-3">{scene.title}</h3>

                {vote.likedNone ? (
                  <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5">
                    <span className="text-rose-500">✕</span>
                    <span className="text-sm font-medium text-rose-700">I don't like any of these</span>
                  </div>
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    {selectedVersions.map((v, vIdx) => {
                      const label = v.label || String.fromCharCode(65 + scene.versions.indexOf(v))
                      return (
                        <div key={v.id} className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-2 py-1.5">
                          <img src={v.url} alt={label} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                          <span className="text-sm font-semibold text-indigo-700">Version {label}</span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {vote.comment && (
                  <p className="text-sm text-gray-500 italic mt-2">"{vote.comment}"</p>
                )}
              </div>
              <div className="border-t border-gray-100 px-4 py-2">
                <button onClick={() => navigate('/')} className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">
                  ← Edit this answer
                </button>
              </div>
            </div>
          )
        })}
      </div>

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
