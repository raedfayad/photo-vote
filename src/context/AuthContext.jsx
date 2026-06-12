import React, { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase'

const AuthContext = createContext(undefined)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined) // undefined = initializing
  useEffect(() => onAuthStateChanged(auth, setUser), [])
  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
