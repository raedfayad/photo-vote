import React, { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase'

const AuthContext = createContext(undefined)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined) // undefined = initializing

  useEffect(() => {
    let unsub
    try {
      unsub = onAuthStateChanged(
        auth,
        setUser,
        (err) => {
          // Auth error (e.g. Anonymous provider not enabled) — treat as signed out
          console.error('Firebase Auth error:', err)
          setUser(null)
        }
      )
    } catch (err) {
      console.error('Failed to init Firebase Auth:', err)
      setUser(null)
    }
    // Safety net: if Firebase never calls back within 5 s, unblock the UI
    const timer = setTimeout(
      () => setUser(u => u === undefined ? null : u),
      5000
    )
    return () => { unsub?.(); clearTimeout(timer) }
  }, [])

  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)

