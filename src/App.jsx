import React from 'react'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Home from './pages/Home'
import ReviewPage from './pages/ReviewPage'
import SubmittedPage from './pages/SubmittedPage'
import VoterLogin from './pages/VoterLogin'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import AdminResults from './pages/AdminResults'

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
    </div>
  )
}

function VoterRoute({ children }) {
  const user = useAuth()
  if (user === undefined) return <Spinner />
  if (!user?.isAnonymous || !sessionStorage.getItem('voter_name')) {
    return <Navigate to="/login" replace />
  }
  return children
}

function AdminRoute({ children }) {
  const user = useAuth()
  if (user === undefined) return <Spinner />
  if (!user || user.isAnonymous) return <Navigate to="/admin" replace />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<VoterLogin />} />
          <Route path="/" element={<VoterRoute><Home /></VoterRoute>} />
          <Route path="/review" element={<VoterRoute><ReviewPage /></VoterRoute>} />
          <Route path="/submitted" element={<VoterRoute><SubmittedPage /></VoterRoute>} />
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="/admin/results/:sceneId" element={<AdminRoute><AdminResults /></AdminRoute>} />
          {/* Legacy per-scene links redirect to the unified voting flow */}
          <Route path="/vote/:sceneId" element={<VoterRoute><Navigate to="/" replace /></VoterRoute>} />
        </Routes>
      </Router>
    </AuthProvider>
  )
}
