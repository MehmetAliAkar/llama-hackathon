import React, { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginScreen from './components/LoginScreen'
import RegisterScreen from './components/RegisterScreen'
import Dashboard from './components/Dashboard'
import './App.css'

function App() {
  const [currentUser, setCurrentUser] = useState(null)

  const handleLoginSuccess = (user) => {
    // Login başarılı, dashboard'a geç
    setCurrentUser(user)
  }

  const handleLogout = () => {
    // Çıkış yap
    setCurrentUser(null)
  }

  return (
    <BrowserRouter>
      <div className="App">
        <Routes>
          <Route 
            path="/login" 
            element={
              currentUser ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <LoginScreen onLoginSuccess={handleLoginSuccess} />
              )
            } 
          />
          <Route 
            path="/register" 
            element={
              currentUser ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <RegisterScreen />
              )
            } 
          />
          <Route 
            path="/dashboard" 
            element={
              currentUser ? (
                <Dashboard user={currentUser} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
