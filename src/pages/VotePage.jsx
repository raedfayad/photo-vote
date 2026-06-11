import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  collection, doc, getDoc, getDocs,
  addDoc, serverTimestamp, orderBy, query,
} from 'firebase/firestore'
import { db } from '../firebase'
import Layout from '../components/Layout'

export default function VotePage() {
  const { sceneId } = useParams()
  const navigate = useNavigate()
  const [scene, setScene] = useState(null)
  const [versions, setVersions] = useState([])
  const [selected, setSelected] = useState(null)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [lightbox, setLightbox] = useState(null)
  const nameRef = useRef(null)

  const storageKey = `voted_${sceneId}`

  useEffect(() => {
    if (localStorage.getItem(storageKey)) setSubmitted(true)

    const load = async () => {
      try {
        const sceneDoc = await getDoc(doc(db, 'scenes', sceneId))
        if (!sceneDoc.exists()) { navigate('/'); return }
        setScene({ id: sceneDoc.id, ...sceneDoc.data() })

        const q = query(
          collection(db, 'scenes', sceneId, 'versions'),
          orderBy('uploadedAt', 'asc')
        )
        const snap = await getDocs(q)
        setVersions(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [sceneId])

  const handleSelect = (id) => {
    setSelected(id)
    setError('')
    setTimeout(() => nameRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100)
  }

  const handleSubmit = async () => {
    if (!selected) { setError('Please select a version first.'); return }
    if (!name.trim()) { setError('Please enter your name.'); nameRef.current?.focus(); return }
    setError('')
    setSubmitting(true)
    try {
      await addDoc(collection(db, 'scenes', sceneId, 'votes'), {
        versionId: selected,
        voterName: name.trim(),
        timestamp: serverTimestamp(),
      })
      localStorage.setItem(storageKey, '1')
      setSubmitted(true)
    } catch (err) {
      console.error(err)
      setError('Something went wrong. Please try again.')
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

  if (submitted) {
    return (
      <Layout showBack title={scene?.title}>
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-9 h-9 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2">Thanks for voting!</h2>
          <p className="text-gray-500 text-sm">Your vote for <strong>{scene?.title}</strong> has been recorded.</p>
          <button
            onClick={() => navigate('/')}
            className="mt-8 text-indigo-600 font-medium hover:underline"
          >
            See other scenes
          </button>
        </div>
      </Layout>
    )
  }

  return (
    <Layout showBack title={scene?.title}>
      <h1 className="text-xl font-bold text-gray-900 mb-1">{scene?.title}</h1>
      <p className="text-sm text-gray-500 mb-5">
        Tap a photo to select your favourite. Long-press to view full size.
      </p>

      {versions.length === 0 ? (
        <div className="text-center py-16 text-gray-400">No photos added yet.</div>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-32">
          {versions.map((v, idx) => {
            const label = v.label || String.fromCharCode(65 + idx)
            const isSelected = selected === v.id
            return (
              <button
                key={v.id}
                onClick={() => handleSelect(v.id)}
                onContextMenu={e => { e.preventDefault(); setLightbox(v.url) }}
                className={`relative rounded-xl overflow-hidden border-4 transition-all duration-150 focus:outline-none touch-manipulation ${
                  isSelected
                    ? 'border-indigo-500 shadow-lg ring-2 ring-indigo-200'
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
                  <div className="absolute top-2 right-2 w-7 h-7 bg-indigo-500 rounded-full flex items-center justify-center shadow-md">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Sticky submit bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 px-4 pt-3 pb-4 safe-bottom z-10">
        <div className="max-w-3xl mx-auto">
          <input
            ref={nameRef}
            type="text"
            placeholder="Your name"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base mb-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={submitting || versions.length === 0}
            className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 active:bg-indigo-800 transition-colors disabled:opacity-50 text-base"
          >
            {submitting ? 'Submitting…' : 'Submit Vote'}
          </button>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black z-50 flex items-center justify-center"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="Full size" className="max-w-full max-h-full object-contain" />
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white"
            onClick={() => setLightbox(null)}
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </Layout>
  )
}
