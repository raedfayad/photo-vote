import React from 'react'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import VotePage from './pages/VotePage'
import VoterLogin from './pages/VoterLogin'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import AdminResults from './pages/AdminResults'

function VoterRoute({ children }) {
  return sessionStorage.getItem('voter_auth') === '1'
    ? children
    : <Navigate to="/login" replace />
}

function AdminRoute({ children }) {
  return sessionStorage.getItem('admin_auth') === '1'
    ? children
    : <Navigate to="/admin" replace />
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<VoterLogin />} />
        <Route path="/" element={<VoterRoute><Home /></VoterRoute>} />
        <Route path="/vote/:sceneId" element={<VoterRoute><VotePage /></VoterRoute>} />
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/admin/results/:sceneId" element={<AdminRoute><AdminResults /></AdminRoute>} />
      </Routes>
    </Router>
  )
}
