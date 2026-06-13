import React, { useEffect, useState, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs, orderBy, query, doc, deleteDoc, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import Lightbox from '../components/Lightbox'
import AdminNav from '../components/AdminNav'

const pct = (ratio) => Math.round(ratio * 100)

function scoreRating(score) {
  if (score >= 0.75) return { label: 'Excellent', color: 'text-green-700 bg-green-50 border-green-200' }
  if (score >= 0.55) return { label: 'Good',      color: 'text-teal-700  bg-teal-50  border-teal-200'  }
  if (score >= 0.35) return { label: 'Average',   color: 'text-amber-700 bg-amber-50 border-amber-200' }
  if (score >= 0.15) return { label: 'Low',       color: 'text-orange-700 bg-orange-50 border-orange-200' }
  return               { label: 'Poor',       color: 'text-red-700   bg-red-50   border-red-200'   }
}

export default function AdminSummary() {
  const [sceneStats, setSceneStats] = useState([])
  const [voters, setVoters] = useState([]) // [{ uid, name, sceneIds[] }]
  const [loading, setLoading] = useState(true)
  const [activeIdx, setActiveIdx] = useState(0)
  const [deletingVoter, setDeletingVoter] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [expandedVoter, setExpandedVoter] = useState(null)
  const [lightbox, setLightbox] = useState(null) // { versions, initialIndex, selectedIds, likedNone }
  const carouselRef = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await getDocs(query(collection(db, 'scenes'), orderBy('createdAt', 'desc')))
      const raw = await Promise.all(
        snap.docs.map(async d => {
          const vSnap = await getDocs(
            query(collection(db, 'scenes', d.id, 'versions'), orderBy('uploadedAt', 'asc'))
          )
          const votSnap = await getDocs(
            query(collection(db, 'scenes', d.id, 'votes'), orderBy('timestamp', 'asc'))
          )
          const versions = vSnap.docs.map(v => ({ id: v.id, ...v.data() }))
          const votes = votSnap.docs.map(v => ({
            id: v.id,
            ...v.data(),
            versionIds: v.data().versionIds || (v.data().versionId ? [v.data().versionId] : []),
            likedNone: v.data().likedNone || false,
          }))
          return { id: d.id, ...d.data(), versions, votes }
        })
      )

      // Collect unique voters across all scenes
      const voterMap = new Map() // uid -> { name, sceneIds }
      raw.forEach(scene => {
        scene.votes.forEach(vote => {
          if (!voterMap.has(vote.id)) {
            voterMap.set(vote.id, { uid: vote.id, name: vote.voterName || vote.id, sceneIds: [] })
          }
          voterMap.get(vote.id).sceneIds.push(scene.id)
        })
      })
      setVoters([...voterMap.values()].sort((a, b) => b.sceneIds.length - a.sceneIds.length))

      const totalVoters = voterMap.size

      // Compute per-scene stats
      const stats = raw.map(scene => {
        const { votes, versions } = scene
        const voteCount = votes.length
        const noneCount = votes.filter(v => v.likedNone).length
        const pickerCount = voteCount - noneCount

        const versionCounts = versions.map(v => ({
          ...v,
          picks: votes.filter(vote => vote.versionIds.includes(v.id)).length,
        }))
        // Include none when determining the overall top count
        const topPicks = Math.max(...versionCounts.map(v => v.picks), noneCount, 0)
        const topVersions = topPicks > 0 ? versionCounts.filter(v => v.picks === topPicks) : []
        const noneIsTop = noneCount > 0 && noneCount === topPicks
        const tiedCount = topVersions.length + (noneIsTop ? 1 : 0)
        const isTie = tiedCount > 1
        const topVersion = topVersions[0] || null

        const participation = totalVoters > 0 ? voteCount / totalVoters : 0
        const decisiveness = pickerCount > 0 ? topPicks / pickerCount : 0
        const score = participation * 0.5 + decisiveness * 0.5

        const comments = votes
          .filter(v => v.comment?.trim())
          .map(v => ({ name: v.voterName, text: v.comment.trim() }))

        return {
          ...scene,
          totalVoters,
          voteCount,
          noneCount,
          pickerCount,
          versionCounts,
          topVersions,
          topVersion,
          topPicks,
          noneIsTop,
          isTie,
          participation,
          decisiveness,
          score,
          comments,
        }
      })
      setSceneStats(stats)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleDeleteVoter = async (voter) => {
    setDeleting(voter.uid)
    try {
      const batch = writeBatch(db)
      voter.sceneIds.forEach(sceneId => {
        batch.delete(doc(db, 'scenes', sceneId, 'votes', voter.uid))
      })
      await batch.commit()
      setDeletingVoter(null)
      await load()
    } catch (err) {
      console.error(err)
      alert('Delete failed: ' + err.message)
    } finally {
      setDeleting(null)
    }
  }

  const handleScroll = () => {
    if (!carouselRef.current) return
    const { scrollLeft, offsetWidth } = carouselRef.current
    if (offsetWidth > 0) setActiveIdx(Math.round(scrollLeft / offsetWidth))
  }

  const scrollTo = (i) => {
    if (!carouselRef.current) return
    carouselRef.current.scrollTo({ left: i * carouselRef.current.offsetWidth, behavior: 'smooth' })
  }

  const totalVoters = sceneStats[0]?.totalVoters ?? 0
  const activeScenes = sceneStats.filter(s => s.voteCount > 0).length
  const avgParticipation = sceneStats.length > 0
    ? pct(sceneStats.reduce((a, s) => a + s.participation, 0) / sceneStats.length)
    : 0

  const ranked = [...sceneStats].sort((a, b) => b.score - a.score)

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : (
          <>
            {/* Overall stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: totalVoters, label: 'Total voters' },
                { value: activeScenes, label: `Scene${activeScenes !== 1 ? 's' : ''} with votes` },
                { value: `${avgParticipation}%`, label: 'Avg participation' },
              ].map(({ value, label }) => (
                <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900">{value}</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-tight">{label}</p>
                </div>
              ))}
            </div>

            {/* Carousel */}
            {sceneStats.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-semibold text-gray-900">Scene highlights</h2>
                  <span className="text-xs text-gray-400">{activeIdx + 1} / {sceneStats.length}</span>
                </div>

                <div
                  ref={carouselRef}
                  onScroll={handleScroll}
                  className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar gap-0"
                >
                  {sceneStats.map((scene, idx) => {
                    const rating = scoreRating(scene.score)
                    const maxBar = Math.max(...scene.versionCounts.map(v => v.picks), scene.noneCount, 1)
                    return (
                      <div
                        key={scene.id}
                        className="flex-shrink-0 w-full snap-start bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mr-4"
                        style={{ minWidth: 'calc(100% - 0px)' }}
                      >
                        {/* Card header */}
                        <div className="px-4 pt-4 pb-3 flex items-start justify-between">
                          <div>
                            <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Scene {idx + 1}</span>
                            <h3 className="font-semibold text-gray-900 leading-tight">{scene.title}</h3>
                          </div>
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${rating.color}`}>
                            {rating.label}
                          </span>
                        </div>

                        {/* Winner photo */}
                        {scene.topPicks > 0 ? (() => {
                          // Build the tile grid: tied versions + none placeholder if noneIsTop
                          const tileVersions = scene.topVersions.slice(0, scene.noneIsTop ? 2 : 3)
                          const showNoneTile = scene.noneIsTop
                          const totalTiles = tileVersions.length + (showNoneTile ? 1 : 0)
                          const allTopLabels = [
                            ...scene.topVersions.map(v => `Ver. ${v.label}`),
                            ...(scene.noneIsTop ? ['None'] : []),
                          ]
                          return (
                            <div className="relative">
                              {scene.isTie || scene.noneIsTop && scene.topVersions.length === 0 ? (
                                <div className="grid gap-0.5" style={{ gridTemplateColumns: `repeat(${Math.min(totalTiles, 3)}, 1fr)` }}>
                                  {tileVersions.map(v => (
                                    <img key={v.id} src={v.url} alt={v.label} className="w-full aspect-video object-cover" />
                                  ))}
                                  {showNoneTile && (
                                    <div className="aspect-video bg-rose-50 flex items-center justify-center text-2xl">✕</div>
                                  )}
                                </div>
                              ) : (
                                <img
                                  src={scene.topVersion.url}
                                  alt={scene.topVersion.label}
                                  className="w-full aspect-video object-cover"
                                />
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                              <div className="absolute bottom-3 left-4 right-4">
                                <p className="text-white font-semibold text-sm drop-shadow">
                                  {scene.isTie
                                    ? `🤝 Tie — ${allTopLabels.join(' & ')} (${scene.topPicks} each)`
                                    : scene.noneIsTop
                                    ? `✕ "None" wins — ${scene.topPicks} voter${scene.topPicks !== 1 ? 's' : ''}`
                                    : `🏆 Version ${scene.topVersion.label} — ${scene.topPicks} vote${scene.topPicks !== 1 ? 's' : ''} (${pct(scene.decisiveness)}% of pickers)`}
                                </p>
                              </div>
                            </div>
                          )
                        })() : (
                          <div className="w-full aspect-video bg-gray-100 flex items-center justify-center">
                            <p className="text-gray-400 text-sm">No votes yet</p>
                          </div>
                        )}

                        {/* Vote bars */}
                        <div className="px-4 pt-3 pb-2 space-y-2">
                          {scene.versionCounts.map((v, i) => {
                            const label = v.label || String.fromCharCode(65 + i)
                            const isTop = scene.topVersions.some(t => t.id === v.id)
                            return (
                              <div key={v.id} className="flex items-center gap-2.5">
                                <img src={v.url} alt={label} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex justify-between text-xs mb-1">
                                    <span className={`font-semibold ${isTop ? 'text-indigo-700' : 'text-gray-600'}`}>
                                      {isTop && (scene.isTie ? '🤝 ' : '🏆 ')}Ver. {label}
                                    </span>
                                    <span className="text-gray-400">{v.picks}</span>
                                  </div>
                                  <div className="bg-gray-100 rounded-full h-1.5">
                                    <div
                                      className={`h-1.5 rounded-full transition-all duration-500 ${isTop ? (scene.isTie ? 'bg-sky-400' : 'bg-indigo-500') : 'bg-gray-300'}`}
                                      style={{ width: `${Math.round((v.picks / maxBar) * 100)}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                          {scene.noneCount > 0 && (
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center flex-shrink-0 text-sm">✕</div>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between text-xs mb-1">
                                  <span className="font-semibold text-rose-600">None</span>
                                  <span className="text-gray-400">{scene.noneCount}</span>
                                </div>
                                <div className="bg-gray-100 rounded-full h-1.5">
                                  <div
                                    className="h-1.5 rounded-full bg-rose-300 transition-all duration-500"
                                    style={{ width: `${Math.round((scene.noneCount / maxBar) * 100)}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Comments */}
                        {scene.comments.length > 0 && (
                          <div className="px-4 pb-3 pt-1">
                            <p className="text-xs font-medium text-gray-400 mb-2">
                              {scene.comments.length} comment{scene.comments.length !== 1 ? 's' : ''}
                            </p>
                            <div className="space-y-1.5 max-h-28 overflow-y-auto no-scrollbar">
                              {scene.comments.map((c, i) => (
                                <div key={i} className="flex items-start gap-2">
                                  <span className="text-xs font-medium text-gray-600 flex-shrink-0 bg-gray-100 rounded-full px-2 py-0.5 whitespace-nowrap">
                                    {c.name}
                                  </span>
                                  <p className="text-xs text-gray-500 italic">"{c.text}"</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="border-t border-gray-100 px-4 py-2.5 flex items-center justify-between">
                          <span className="text-xs text-gray-400">
                            {scene.voteCount} / {scene.totalVoters} voters ({pct(scene.participation)}%)
                          </span>
                          <Link
                            to={`/admin/results/${scene.id}`}
                            className="text-xs text-indigo-500 font-medium hover:text-indigo-700"
                          >
                            Full results →
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Carousel dots */}
                {sceneStats.length > 1 && (
                  <div className="flex justify-center gap-1.5 mt-3">
                    {sceneStats.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => scrollTo(i)}
                        className={`rounded-full transition-all duration-200 ${
                          i === activeIdx ? 'w-4 h-2 bg-indigo-500' : 'w-2 h-2 bg-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Performance rankings */}
            {ranked.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 pt-4 pb-2 border-b border-gray-50">
                  <h2 className="font-semibold text-gray-900">Scene rankings</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Participation × decisiveness</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {ranked.map((scene, i) => {
                    const rating = scoreRating(scene.score)
                    return (
                      <Link
                        key={scene.id}
                        to={`/admin/results/${scene.id}`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
                      >
                        <span className="w-5 text-xs font-bold text-gray-400 text-right flex-shrink-0">{i + 1}</span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {scene.topVersion?.url ? (
                            <img src={scene.topVersion.url} className="w-10 h-10 rounded-lg object-cover" alt="" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-gray-100" />
                          )}
                          {scene.topPicks > 0 && (
                            <div className="text-center leading-tight">
                              <p className="text-xs font-bold text-gray-700">
                                {scene.noneIsTop ? '✕' : `V${scene.topVersion?.label || '?'}`}
                              </p>
                              <p className="text-xs text-gray-400">{scene.topPicks}v</p>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{scene.title}</p>
                          <p className="text-xs text-gray-400">
                            {pct(scene.participation)}% participation
                            {scene.topPicks > 0 && (scene.isTie
                              ? ` · tied (${pct(scene.decisiveness)}% each)`
                              : scene.noneIsTop
                              ? ` · "none" wins`
                              : ` · ${pct(scene.decisiveness)}% decisive`)}
                          </p>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${rating.color}`}>
                          {rating.label}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {/* All comments feed */}
            {(() => {
              const allComments = sceneStats.flatMap(scene =>
                scene.comments.map(c => ({ ...c, sceneTitle: scene.title }))
              )
              if (allComments.length === 0) return null
              return (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-4 pt-4 pb-2 border-b border-gray-50">
                    <h2 className="font-semibold text-gray-900">All comments</h2>
                    <p className="text-xs text-gray-400 mt-0.5">{allComments.length} comment{allComments.length !== 1 ? 's' : ''} across all scenes</p>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {allComments.map((c, i) => (
                      <div key={i} className="px-4 py-3">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-semibold text-gray-700 bg-gray-100 rounded-full px-2 py-0.5">{c.name}</span>
                          <span className="text-xs text-gray-400 truncate">{c.sceneTitle}</span>
                        </div>
                        <p className="text-sm text-gray-600 italic">"{c.text}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            {/* Voter management */}
            {voters.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 pt-4 pb-2 border-b border-gray-50">
                  <h2 className="font-semibold text-gray-900">Voters</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Tap a voter to see their responses</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {voters.map(voter => {
                    const isExpanded = expandedVoter === voter.uid

                    // Collect this voter's responses across all scenes
                    const responses = voter.sceneIds.map(sceneId => {
                      const scene = sceneStats.find(s => s.id === sceneId)
                      if (!scene) return null
                      const vote = scene.votes.find(v => v.id === voter.uid)
                      if (!vote) return null
                      const pickedVersions = scene.versions.filter(v =>
                        (vote.versionIds || []).includes(v.id)
                      )
                      return { scene, vote, pickedVersions }
                    }).filter(Boolean)

                    return (
                      <div key={voter.uid}>
                        {/* Voter row */}
                        <div className="px-4 py-3">
                          {deletingVoter === voter.uid ? (
                            <div className="flex items-center gap-3">
                              <p className="flex-1 text-sm text-gray-700">
                                Delete all {voter.sceneIds.length} response{voter.sceneIds.length !== 1 ? 's' : ''} from{' '}
                                <strong>{voter.name}</strong>?
                              </p>
                              <button
                                onClick={() => handleDeleteVoter(voter)}
                                disabled={deleting === voter.uid}
                                className="text-xs bg-red-500 hover:bg-red-600 text-white font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50"
                              >
                                {deleting === voter.uid ? 'Deleting…' : 'Delete'}
                              </button>
                              <button
                                onClick={() => setDeletingVoter(null)}
                                disabled={deleting === voter.uid}
                                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold px-3 py-1.5 rounded-lg"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => setExpandedVoter(isExpanded ? null : voter.uid)}
                                className="flex-1 flex items-center gap-3 text-left min-w-0"
                              >
                                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                  <span className="text-xs font-bold text-indigo-600">
                                    {voter.name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900">{voter.name}</p>
                                  <p className="text-xs text-gray-400">
                                    {voter.sceneIds.length} of {sceneStats.length} scene{sceneStats.length !== 1 ? 's' : ''} answered
                                  </p>
                                </div>
                                <svg
                                  className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                              <button
                                onClick={() => setDeletingVoter(voter.uid)}
                                className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors flex items-center gap-1 flex-shrink-0"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Remove
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Expanded responses */}
                        {isExpanded && (
                          <div className="border-t border-gray-50 bg-gray-50/60 px-4 py-3 space-y-3">
                            {responses.map(({ scene, vote, pickedVersions }, rIdx) => (
                              <div key={scene.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                                <div className="px-3 py-2 flex items-center justify-between border-b border-gray-50">
                                  <p className="text-xs font-semibold text-gray-700 truncate">{scene.title}</p>
                                  <span className="text-xs text-gray-400 flex-shrink-0 ml-2">Scene {sceneStats.indexOf(scene) + 1}</span>
                                </div>
                                <div className="px-3 py-2.5">
                                  {vote.likedNone ? (
                                    <button
                                      onClick={() => setLightbox({
                                        versions: scene.versions,
                                        initialIndex: 0,
                                        selectedIds: [],
                                        likedNone: true,
                                      })}
                                      className="flex items-center gap-2 hover:opacity-75 transition-opacity"
                                    >
                                      <span className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-sm flex-shrink-0">✕</span>
                                      <span className="text-xs font-medium text-rose-600">Didn't like any — tap to view</span>
                                    </button>
                                  ) : pickedVersions.length > 0 ? (
                                    <div className="flex gap-2 flex-wrap">
                                      {pickedVersions.map((v, i) => {
                                        const label = v.label || String.fromCharCode(65 + scene.versions.indexOf(v))
                                        return (
                                          <button
                                            key={v.id}
                                            onClick={() => setLightbox({
                                              versions: pickedVersions,
                                              initialIndex: i,
                                              selectedIds: vote.versionIds || [],
                                              likedNone: false,
                                            })}
                                            className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-1 hover:bg-indigo-100 transition-colors"
                                          >
                                            <img src={v.url} alt={label} className="w-8 h-8 rounded object-cover flex-shrink-0" />
                                            <span className="text-xs font-semibold text-indigo-700">Ver. {label}</span>
                                          </button>
                                        )
                                      })}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-gray-400 italic">No selection recorded</p>
                                  )}
                                  {vote.comment?.trim() && (
                                    <div className="mt-2 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-2">
                                      <p className="text-xs text-gray-400 font-medium mb-0.5">Comment</p>
                                      <p className="text-xs text-gray-600 italic">"{vote.comment.trim()}"</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {lightbox && (
        <Lightbox
          versions={lightbox.versions}
          initialIndex={lightbox.initialIndex}
          selectedIds={lightbox.selectedIds}
          likedNone={lightbox.likedNone}
          onToggleVersion={() => {}}
          onToggleNone={() => {}}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  )
}
