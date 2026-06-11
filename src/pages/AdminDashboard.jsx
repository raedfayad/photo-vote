import React, { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  collection, getDocs, addDoc, deleteDoc, doc,
  serverTimestamp, orderBy, query, updateDoc, writeBatch,
} from 'firebase/firestore'
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from '../firebase'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [scenes, setScenes] = useState([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [uploading, setUploading] = useState({}) // sceneId -> { current, total }
  const [expandedScene, setExpandedScene] = useState(null)

  useEffect(() => {
    fetchScenes()
  }, [])

  const fetchScenes = useCallback(async () => {
    setLoading(true)
    try {
      const q = query(collection(db, 'scenes'), orderBy('createdAt', 'desc'))
      const snap = await getDocs(q)
      const data = await Promise.all(
        snap.docs.map(async d => {
          const vSnap = await getDocs(collection(db, 'scenes', d.id, 'versions'))
          const votSnap = await getDocs(collection(db, 'scenes', d.id, 'votes'))
          return {
            id: d.id,
            ...d.data(),
            versionCount: vSnap.size,
            voteCount: votSnap.size,
            versions: vSnap.docs
              .map(v => ({ id: v.id, ...v.data() }))
              .sort((a, b) => (a.uploadedAt?.seconds || 0) - (b.uploadedAt?.seconds || 0)),
          }
        })
      )
      setScenes(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  const createScene = async () => {
    if (!newTitle.trim()) return
    setCreating(true)
    try {
      await addDoc(collection(db, 'scenes'), {
        title: newTitle.trim(),
        createdAt: serverTimestamp(),
        coverUrl: '',
        versionCount: 0,
        published: false,
      })
      setNewTitle('')
      await fetchScenes()
    } finally {
      setCreating(false)
    }
  }

  const handlePhotoUpload = async (sceneId, files) => {
    const fileArr = Array.from(files)
    const scene = scenes.find(s => s.id === sceneId)
    const existingCount = scene?.versionCount || 0

    setUploading(prev => ({ ...prev, [sceneId]: { current: 0, total: fileArr.length } }))

    try {
      for (let i = 0; i < fileArr.length; i++) {
        const file = fileArr[i]
        const ext = file.name.split('.').pop().toLowerCase()
        const label = String.fromCharCode(65 + existingCount + i)
        const storagePath = `scenes/${sceneId}/${Date.now()}_${label}.${ext}`
        const storageRef = ref(storage, storagePath)

        const url = await new Promise((resolve, reject) => {
          const task = uploadBytesResumable(storageRef, file)
          task.on('state_changed', null, reject, async () => {
            resolve(await getDownloadURL(task.snapshot.ref))
          })
        })

        await addDoc(collection(db, 'scenes', sceneId, 'versions'), {
          url,
          label,
          storagePath,
          uploadedAt: serverTimestamp(),
        })

        const updates = { versionCount: existingCount + i + 1 }
        if (existingCount + i === 0) updates.coverUrl = url
        await updateDoc(doc(db, 'scenes', sceneId), updates)

        setUploading(prev => ({
          ...prev,
          [sceneId]: { current: i + 1, total: fileArr.length },
        }))
      }
      await fetchScenes()
    } catch (err) {
      console.error(err)
      alert(`Upload failed: ${err.message}`)
    } finally {
      setUploading(prev => { const n = { ...prev }; delete n[sceneId]; return n })
    }
  }

  const togglePublish = async (scene) => {
    await updateDoc(doc(db, 'scenes', scene.id), { published: !scene.published })
    await fetchScenes()
  }

  const deleteVersion = async (scene, version) => {
    if (!confirm(`Delete Version ${version.label}?`)) return
    try {
      if (version.storagePath) {
        await deleteObject(ref(storage, version.storagePath)).catch(() => {})
      }
      await deleteDoc(doc(db, 'scenes', scene.id, 'versions', version.id))
      const remaining = scene.versions.filter(v => v.id !== version.id)
      await updateDoc(doc(db, 'scenes', scene.id), {
        versionCount: remaining.length,
        coverUrl: remaining[0]?.url || '',
      })
      await fetchScenes()
    } catch (err) {
      alert('Delete failed: ' + err.message)
    }
  }

  const deleteScene = async (scene) => {
    if (!confirm(`Delete "${scene.title}" and all its photos and votes?`)) return
    try {
      const batch = writeBatch(db)
      for (const v of scene.versions) {
        if (v.storagePath) await deleteObject(ref(storage, v.storagePath)).catch(() => {})
        batch.delete(doc(db, 'scenes', scene.id, 'versions', v.id))
      }
      const votesSnap = await getDocs(collection(db, 'scenes', scene.id, 'votes'))
      votesSnap.docs.forEach(d => batch.delete(d.ref))
      batch.delete(doc(db, 'scenes', scene.id))
      await batch.commit()
      await fetchScenes()
    } catch (err) {
      alert('Delete failed: ' + err.message)
    }
  }

  const copyLink = (sceneId) => {
    const base = window.location.href.split('#')[0]
    navigator.clipboard.writeText(`${base}#/vote/${sceneId}`)
      .then(() => alert('Voting link copied!'))
  }

  const logout = () => {
    sessionStorage.removeItem('admin_auth')
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gray-900 text-white sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div>
            <span className="font-bold">Admin</span>
            <span className="text-gray-400 text-xs ml-2">PhotoVote</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/" className="text-gray-400 hover:text-white text-sm">View site</Link>
            <button onClick={logout} className="text-gray-400 hover:text-white text-sm">Logout</button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* New scene */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
          <h2 className="font-semibold text-sm mb-2">New Scene</h2>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Scene name (e.g. Sunset at the Beach)"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createScene()}
              className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={createScene}
              disabled={creating || !newTitle.trim()}
              className="bg-indigo-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-indigo-700 disabled:opacity-50"
            >
              {creating ? '…' : 'Create'}
            </button>
          </div>
        </section>

        {/* Scene list */}
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-indigo-600" />
          </div>
        ) : scenes.length === 0 ? (
          <p className="text-center text-gray-400 py-10">No scenes yet. Create one above.</p>
        ) : (
          <div className="space-y-4">
            {scenes.map(scene => (
              <div key={scene.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {scene.coverUrl && (
                      <img
                        src={scene.coverUrl}
                        alt={scene.title}
                        className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{scene.title}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {scene.versionCount} photo{scene.versionCount !== 1 ? 's' : ''} · {scene.voteCount} vote{scene.voteCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => togglePublish(scene)}
                      className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                        scene.published
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {scene.published ? 'Live' : 'Draft'}
                    </button>
                  </div>

                  {/* Upload progress */}
                  {uploading[scene.id] && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>Uploading…</span>
                        <span>{uploading[scene.id].current}/{uploading[scene.id].total}</span>
                      </div>
                      <div className="bg-gray-100 rounded-full h-1.5">
                        <div
                          className="bg-indigo-500 h-1.5 rounded-full transition-all"
                          style={{ width: `${(uploading[scene.id].current / uploading[scene.id].total) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        className="sr-only"
                        onChange={e => handlePhotoUpload(scene.id, e.target.files)}
                        disabled={!!uploading[scene.id]}
                      />
                      <span className="inline-flex items-center gap-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-xl cursor-pointer transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add photos
                      </span>
                    </label>

                    <Link
                      to={`/admin/results/${scene.id}`}
                      className="inline-flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-700 text-xs font-medium px-3 py-1.5 rounded-xl transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      Results
                    </Link>

                    {scene.published && (
                      <button
                        onClick={() => copyLink(scene.id)}
                        className="inline-flex items-center gap-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 text-xs font-medium px-3 py-1.5 rounded-xl transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy link
                      </button>
                    )}

                    <button
                      onClick={() => setExpandedScene(expandedScene === scene.id ? null : scene.id)}
                      className="inline-flex items-center gap-1 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 text-xs font-medium px-3 py-1.5 rounded-xl transition-colors ml-auto"
                    >
                      {expandedScene === scene.id ? 'Hide' : 'Manage photos'}
                    </button>
                  </div>
                </div>

                {/* Photo grid */}
                {expandedScene === scene.id && (
                  <div className="border-t border-gray-100 p-4 bg-gray-50">
                    {scene.versions.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4">
                        No photos yet. Use "Add photos" above.
                      </p>
                    ) : (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {scene.versions.map((v, idx) => (
                          <div key={v.id} className="relative group rounded-xl overflow-hidden bg-gray-200">
                            <div className="aspect-square">
                              <img
                                src={v.url}
                                alt={`Version ${v.label}`}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs font-bold text-center py-0.5">
                              {v.label || String.fromCharCode(65 + idx)}
                            </div>
                            <button
                              onClick={() => deleteVersion(scene, v)}
                              className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                            >
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="border-t border-gray-100 px-4 py-2">
                  <button
                    onClick={() => deleteScene(scene)}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors"
                  >
                    Delete scene
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
