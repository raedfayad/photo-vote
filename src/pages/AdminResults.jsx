import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from '../firebase'
import Layout from '../components/Layout'

export default function AdminResults() {
  const { sceneId } = useParams()
  const navigate = useNavigate()
  const [scene, setScene] = useState(null)
  const [versions, setVersions] = useState([])
  const [votes, setVotes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const sceneDoc = await getDoc(doc(db, 'scenes', sceneId))
        if (!sceneDoc.exists()) { navigate('/admin/dashboard'); return }
        setScene({ id: sceneDoc.id, ...sceneDoc.data() })

        const vSnap = await getDocs(
          query(collection(db, 'scenes', sceneId, 'versions'), orderBy('uploadedAt', 'asc'))
        )
        setVersions(vSnap.docs.map(d => ({ id: d.id, ...d.data() })))

        const votSnap = await getDocs(
          query(collection(db, 'scenes', sceneId, 'votes'), orderBy('timestamp', 'asc'))
        )
        setVotes(votSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [sceneId])

  // Normalise: support old single-versionId format
  const normVote = (vote) => ({
    ...vote,
    versionIds: vote.versionIds || (vote.versionId ? [vote.versionId] : []),
    likedNone: vote.likedNone || false,
  })

  const normVotes = votes.map(normVote)
  const totalVoters = normVotes.length
  const noneCount = normVotes.filter(v => v.likedNone).length

  // Per-version: how many voters picked it (a voter can pick multiple)
  const versionStats = versions.map(v => ({
    ...v,
    voters: normVotes.filter(vote => vote.versionIds.includes(v.id)),
  }))

  const maxPicks = Math.max(...versionStats.map(v => v.voters.length), noneCount, 1)

  const topPickCount = Math.max(...versionStats.map(v => v.voters.length), 0)
  const winners = topPickCount > 0 ? versionStats.filter(v => v.voters.length === topPickCount) : []
  const isTie = winners.length > 1
  const isWinner = (v) => winners.some(w => w.id === v.id)

  return (
    <Layout showBack title={scene?.title}>
      <div className="flex items-baseline justify-between mb-5">
        <h1 className="text-xl font-bold truncate mr-2">{scene?.title}</h1>
        <span className="text-sm text-gray-400 flex-shrink-0">{totalVoters} voter{totalVoters !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : (
        <>
          {winners.length > 0 && (
            <div className={`border rounded-2xl p-4 mb-5 flex items-center gap-3 ${isTie ? 'bg-sky-50 border-sky-200' : 'bg-amber-50 border-amber-200'}`}>
              <span className="text-3xl">{isTie ? '🤝' : '🏆'}</span>
              <div>
                <p className={`font-semibold ${isTie ? 'text-sky-900' : 'text-amber-900'}`}>
                  {isTie
                    ? `Tie — Version${winners.length > 2 ? 's' : ''} ${winners.map(w => w.label).join(' & ')} are tied`
                    : `Version ${winners[0].label} is most popular`}
                </p>
                <p className={`text-sm ${isTie ? 'text-sky-700' : 'text-amber-700'}`}>
                  {topPickCount} of {totalVoters} voter{totalVoters !== 1 ? 's' : ''} picked {isTie ? 'each' : 'it'}
                </p>
              </div>
            </div>
          )}

          {/* Per-version bars */}
          <div className="space-y-3 mb-4">
            {versionStats.map((v, idx) => {
              const label = v.label || String.fromCharCode(65 + idx)
              const pct = Math.round((v.voters.length / maxPicks) * 100)
              return (
                <div key={v.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="flex gap-3 p-3">
                    <img src={v.url} alt={label} className="w-20 h-20 rounded-xl object-cover flex-shrink-0" loading="lazy" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-sm">Version {label}</span>
                        {isWinner(v) && totalVoters > 0 && <span className="text-xs">{isTie ? '🤝' : '🏆'}</span>}
                      </div>
                      <p className="text-gray-400 text-xs mb-2">{v.voters.length} voter{v.voters.length !== 1 ? 's' : ''}</p>
                      <div className="bg-gray-100 rounded-full h-2 mb-1">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${isWinner(v) ? (isTie ? 'bg-sky-400' : 'bg-amber-400') : 'bg-indigo-400'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  {v.voters.length > 0 && (
                    <div className="border-t border-gray-100 bg-gray-50 px-3 py-2 space-y-1.5">
                      <p className="text-xs text-gray-400 font-medium">Picked by:</p>
                      {v.voters.map(vote => (
                        <div key={vote.id} className="flex items-start justify-between gap-2">
                          <span className="bg-white border border-gray-200 text-gray-700 text-xs rounded-full px-2.5 py-0.5 flex-shrink-0">
                            {vote.voterName}
                          </span>
                          {vote.comment && (
                            <p className="text-xs text-gray-500 italic text-right">"{vote.comment}"</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}

            {/* None row */}
            {noneCount > 0 && (
              <div className="bg-white rounded-2xl border border-rose-100 shadow-sm overflow-hidden">
                <div className="flex gap-3 p-3 items-center">
                  <div className="w-20 h-20 rounded-xl bg-rose-50 flex items-center justify-center flex-shrink-0 text-2xl">✕</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-rose-700 mb-0.5">None of these</p>
                    <p className="text-gray-400 text-xs mb-2">{noneCount} voter{noneCount !== 1 ? 's' : ''}</p>
                    <div className="bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-rose-300 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.round((noneCount / maxPicks) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
                <div className="border-t border-rose-50 bg-rose-50/50 px-3 py-2 flex flex-wrap gap-1.5">
                  {normVotes.filter(v => v.likedNone).map(vote => (
                    <div key={vote.id} className="flex items-center gap-1.5">
                      <span className="bg-white border border-rose-200 text-rose-700 text-xs rounded-full px-2.5 py-0.5">
                        {vote.voterName}
                      </span>
                      {vote.comment && (
                        <span className="text-xs text-gray-500 italic">"{vote.comment}"</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Full vote log */}
          {normVotes.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <h2 className="font-semibold text-sm mb-3">All responses</h2>
              <div className="divide-y divide-gray-50">
                {normVotes.map(vote => {
                  const picked = versions.filter(v => vote.versionIds.includes(v.id))
                  return (
                    <div key={vote.id} className="py-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium text-gray-800">{vote.voterName}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                          vote.likedNone
                            ? 'bg-rose-50 text-rose-600'
                            : 'bg-indigo-50 text-indigo-600'
                        }`}>
                          {vote.likedNone
                            ? 'None'
                            : picked.map(v => `Version ${v.label}`).join(', ')}
                        </span>
                      </div>
                      {vote.comment && (
                        <p className="text-xs text-gray-500 mt-0.5 italic">"{vote.comment}"</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {normVotes.length === 0 && (
            <div className="text-center py-12 text-gray-400">No votes yet for this scene.</div>
          )}
        </>
      )}
    </Layout>
  )
}
