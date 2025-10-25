import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import apiService from '../services/api'
import './Dashboard.css'

const Dashboard = ({ user, onLogout }) => {
  const navigate = useNavigate()
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [isUploading, setIsUploading] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [chatMessages, setChatMessages] = useState([])
  const [currentMessage, setCurrentMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [activeTab, setActiveTab] = useState('chat') // 'chat' veya 'voice'
  
  // Voice states
  const [isRecording, setIsRecording] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const [voiceMessages, setVoiceMessages] = useState([])
  
  const fileInputRef = useRef(null)
  const chatMessagesEndRef = useRef(null)
  const recognitionRef = useRef(null)
  const synthRef = useRef(null)

  // Component mount olduğunda kullanıcının dosyalarını yükle
  useEffect(() => {
    loadUserFiles()
    initializeSpeechRecognition()
    initializeSpeechSynthesis()
  }, [])

  // Chat mesajları değiştiğinde en alta scroll
  useEffect(() => {
    scrollToBottom()
  }, [chatMessages])

  // Speech Recognition'ı başlat
  const initializeSpeechRecognition = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      const recognition = new SpeechRecognition()
      
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'tr-TR' // Türkçe
      
      recognition.onstart = () => {
        setIsListening(true)
        console.log('Ses dinleme başladı')
      }
      
      recognition.onresult = (event) => {
        let interimTranscript = ''
        let finalTranscript = ''
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' '
          } else {
            interimTranscript += transcript
          }
        }
        
        if (finalTranscript) {
          setVoiceTranscript(finalTranscript.trim())
        } else {
          setVoiceTranscript(interimTranscript)
        }
      }
      
      recognition.onerror = (event) => {
        console.error('Ses tanıma hatası:', event.error)
        setIsListening(false)
        setIsRecording(false)
      }
      
      recognition.onend = () => {
        setIsListening(false)
        console.log('Ses dinleme durdu')
      }
      
      recognitionRef.current = recognition
    } else {
      console.warn('Tarayıcınız ses tanımayı desteklemiyor')
    }
  }

  // Speech Synthesis'i başlat
  const initializeSpeechSynthesis = () => {
    if ('speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis
    } else {
      console.warn('Tarayıcınız konuşma sentezini desteklemiyor')
    }
  }

  const scrollToBottom = () => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadUserFiles = async () => {
    try {
      setIsLoading(true)
      const files = await apiService.getUserFiles()
      // Backend'den gelen dosyaları frontend formatına çevir
      const formattedFiles = files.map(file => ({
        id: file.id,
        name: file.filename,
        size: file.file_size,
        type: file.file_type,
        uploadedAt: new Date(file.uploaded_at).toLocaleString('tr-TR'),
        backendId: file.id
      }))
      setUploadedFiles(formattedFiles)
    } catch (error) {
      console.error('Dosyalar yüklenirken hata:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files)
    
    // Dosya tiplerini kontrol et
    const validFiles = files.filter(file => {
      const extension = file.name.split('.').pop().toLowerCase()
      const isValidImage = ['png', 'jpg', 'jpeg'].includes(extension)
      const isValidAudio = file.type.startsWith('audio/')
      return isValidImage || isValidAudio
    })

    if (validFiles.length === 0) {
      alert('Lütfen sadece ses dosyaları (.mp3, .wav, vb.) veya resim dosyaları (.png, .jpg, .jpeg) yükleyin.')
      return
    }

    setIsUploading(true)

    // Her dosyayı backend'e yükle
    for (const file of validFiles) {
      try {
        const response = await apiService.uploadFile(file)
        
        // Başarılı yükleme - listeye ekle
        const newFile = {
          id: response.id,
          name: response.filename,
          size: response.file_size,
          type: response.file_type,
          uploadedAt: new Date(response.uploaded_at).toLocaleString('tr-TR'),
          backendId: response.id
        }

        setUploadedFiles(prev => [...prev, newFile])
        
      } catch (error) {
        console.error('Dosya yüklenirken hata:', error)
        alert(`"${file.name}" dosyası yüklenirken hata oluştu: ${error.message}`)
      }
    }

    setIsUploading(false)
    
    // Input'u temizle
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleDeleteFile = async (fileId) => {
    if (!confirm('Bu dosyayı silmek istediğinizden emin misiniz?')) {
      return
    }

    try {
      await apiService.deleteFile(fileId)
      // Listeden kaldır
      setUploadedFiles(prev => prev.filter(file => file.id !== fileId))
    } catch (error) {
      console.error('Dosya silinirken hata:', error)
      alert(`Dosya silinirken hata oluştu: ${error.message}`)
    }
  }

  // Voice: Kayıt başlat
  const startVoiceRecording = () => {
    if (recognitionRef.current && !isRecording) {
      setIsRecording(true)
      setVoiceTranscript('')
      recognitionRef.current.start()
    }
  }

  // Voice: Kayıt durdur ve mesaj gönder
  const stopVoiceRecording = async () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop()
      setIsRecording(false)
      
      // Transcript varsa mesaj olarak gönder
      if (voiceTranscript.trim()) {
        await sendVoiceMessage(voiceTranscript.trim())
        setVoiceTranscript('')
      }
    }
  }

  // Voice mesajını backend'e gönder ve yanıtı sesli oku
  const sendVoiceMessage = async (message) => {
    if (!message.trim()) return

    const userMessage = {
      id: Date.now(),
      type: 'user',
      text: message,
      timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    }
    setVoiceMessages(prev => [...prev, userMessage])

    try {
      const response = await apiService.sendMessage(message)
      
      const botMessage = {
        id: Date.now() + 1,
        type: 'bot',
        text: response.bot_response,
        timestamp: new Date(response.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
      }
      setVoiceMessages(prev => [...prev, botMessage])
      
      // Bot cevabını sesli oku
      speakText(response.bot_response)
      
    } catch (error) {
      console.error('Mesaj gönderilirken hata:', error)
      const errorMessage = {
        id: Date.now() + 1,
        type: 'bot',
        text: `Üzgünüm, bir hata oluştu: ${error.message}`,
        timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
      }
      setVoiceMessages(prev => [...prev, errorMessage])
    }
  }

  // Text-to-Speech: Metni sesli oku
  const speakText = (text) => {
    if (synthRef.current) {
      // Önceki konuşmayı durdur
      synthRef.current.cancel()
      
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'tr-TR'
      utterance.rate = 1.0
      utterance.pitch = 1.0
      utterance.volume = 1.0
      
      utterance.onend = () => {
        console.log('Konuşma tamamlandı')
      }
      
      utterance.onerror = (event) => {
        console.error('TTS hatası:', event.error)
      }
      
      synthRef.current.speak(utterance)
    }
  }

  const handleSendMessage = async (e) => {
    e.preventDefault()
    
    if (!currentMessage.trim() || isSending) {
      return
    }

    const messageText = currentMessage.trim()
    setCurrentMessage('')
    setIsSending(true)

    // Kullanıcı mesajını ekle
    const userMessage = {
      id: Date.now(),
      type: 'user',
      text: messageText,
      timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    }
    setChatMessages(prev => [...prev, userMessage])

    try {
      // Backend'e gönder
      const response = await apiService.sendMessage(messageText)
      
      // Bot cevabını ekle
      const botMessage = {
        id: Date.now() + 1,
        type: 'bot',
        text: response.bot_response,
        timestamp: new Date(response.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
      }
      setChatMessages(prev => [...prev, botMessage])
      
    } catch (error) {
      console.error('Mesaj gönderilirken hata:', error)
      // Hata mesajı ekle
      const errorMessage = {
        id: Date.now() + 1,
        type: 'bot',
        text: `Üzgünüm, bir hata oluştu: ${error.message}`,
        timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
      }
      setChatMessages(prev => [...prev, errorMessage])
    } finally {
      setIsSending(false)
    }
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const getFileIcon = (fileName) => {
    const extension = fileName.split('.').pop().toLowerCase()
    
    if (['png', 'jpg', 'jpeg'].includes(extension)) {
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
      )
    } else {
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 18V5l12-2v13"/>
          <circle cx="6" cy="18" r="3"/>
          <circle cx="18" cy="16" r="3"/>
        </svg>
      )
    }
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div className="header-left">
          <div className="logo">
            <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="24" r="20" fill="#4F46E5"/>
              <path d="M24 16L28 24L24 32L20 24L24 16Z" fill="white"/>
            </svg>
          </div>
          <div className="user-info">
            <span className="welcome-text">Hoş Geldiniz</span>
            <span className="user-name">{user?.full_name || user?.email}</span>
          </div>
        </div>
        <button className="logout-button" onClick={() => { onLogout(); navigate('/login'); }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Çıkış
        </button>
      </div>

      <div className="dashboard-content">
        <div className="sidebar">
          <div className="sidebar-header">
            <h3>Yüklenen Dosyalar</h3>
            <div className="header-actions">
              <span className="file-count">{uploadedFiles.length}</span>
              <button 
                className="upload-button" 
                onClick={handleUploadClick} 
                title="Dosya Yükle"
                disabled={isUploading}
              >
                {isUploading ? (
                  <span className="loading-spinner-small"></span>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
          
          <div className="file-list">
            {isLoading ? (
              <div className="empty-state">
                <span className="loading-spinner-large"></span>
                <p>Dosyalar yükleniyor...</p>
              </div>
            ) : uploadedFiles.length === 0 ? (
              <div className="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                  <polyline points="13 2 13 9 20 9"/>
                </svg>
                <p>Henüz dosya yüklenmedi</p>
                <span>+ butonuna tıklayarak dosya yükleyin</span>
              </div>
            ) : (
              uploadedFiles.map(file => (
                <div key={file.id} className="file-item">
                  <div className="file-icon">
                    {getFileIcon(file.name)}
                  </div>
                  <div className="file-details">
                    <div className="file-name" title={file.name}>{file.name}</div>
                    <div className="file-meta">
                      <span>{formatFileSize(file.size)}</span>
                      <span className="file-date">{file.uploadedAt}</span>
                    </div>
                  </div>
                  <button 
                    className="delete-button"
                    onClick={() => handleDeleteFile(file.id)}
                    title="Sil"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      <line x1="10" y1="11" x2="10" y2="17"/>
                      <line x1="14" y1="11" x2="14" y2="17"/>
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="main-content">
          <div className="unified-container">
            {/* Tab Header */}
            <div className="tab-header">
              <button 
                className={`tab-button ${activeTab === 'chat' ? 'active' : ''}`}
                onClick={() => setActiveTab('chat')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                CHAT
              </button>
              <button 
                className={`tab-button ${activeTab === 'voice' ? 'active' : ''}`}
                onClick={() => setActiveTab('voice')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/>
                  <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
                VOICE
              </button>
            </div>

            {/* Chat Panel */}
            {activeTab === 'chat' && (
              <div className="tab-content">
                <div className="chat-area">
                  <div className="chat-messages">
                    {chatMessages.length === 0 ? (
                      <div className="empty-chat">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                        </svg>
                        <p>Sohbete başlamak için bir mesaj yazın</p>
                      </div>
                    ) : (
                      <>
                        {chatMessages.map(msg => (
                          <div key={msg.id} className={`chat-message ${msg.type}`}>
                            <div className="message-content">
                              <p>{msg.text}</p>
                              <span className="message-time">{msg.timestamp}</span>
                            </div>
                          </div>
                        ))}
                        <div ref={chatMessagesEndRef} />
                      </>
                    )}
                  </div>
                  
                  <form className="chat-input-container" onSubmit={handleSendMessage}>
                    <input 
                      type="text" 
                      className="chat-input" 
                      placeholder="Mesajınızı yazın..."
                      value={currentMessage}
                      onChange={(e) => setCurrentMessage(e.target.value)}
                      disabled={isSending}
                    />
                    <button 
                      type="submit" 
                      className="send-button"
                      disabled={!currentMessage.trim() || isSending}
                    >
                      {isSending ? (
                        <span className="loading-spinner-small"></span>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="22" y1="2" x2="11" y2="13"/>
                          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                        </svg>
                      )}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* Voice Panel */}
            {activeTab === 'voice' && (
              <div className="tab-content">
                <div className="voice-area-centered">
                  {/* Voice Controls */}
                  <div className="voice-controls-centered">
                    {/* Transcript Display - Sadece kayıt yaparken göster */}
                    {isRecording && voiceTranscript && (
                      <div className="voice-transcript">
                        <p>{voiceTranscript}</p>
                      </div>
                    )}

                    {/* Recording Status */}
                    <div className="voice-status">
                      {isRecording ? (
                        <span className="status-recording">
                          <span className="recording-dot"></span>
                          {isListening ? 'Dinleniyor...' : 'Kayıt başlatılıyor...'}
                        </span>
                      ) : (
                        <span className="status-idle">Mikrofon butonuna basarak konuşmaya başlayın</span>
                      )}
                    </div>

                    {/* Microphone Button */}
                    <div className="voice-button-container">
                      <button
                        className={`voice-button ${isRecording ? 'recording' : ''}`}
                        onMouseDown={startVoiceRecording}
                        onMouseUp={stopVoiceRecording}
                        onTouchStart={startVoiceRecording}
                        onTouchEnd={stopVoiceRecording}
                        title="Basılı tutarak konuşun"
                      >
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                          <line x1="12" y1="19" x2="12" y2="23"/>
                          <line x1="8" y1="23" x2="16" y2="23"/>
                        </svg>
                        {isRecording && (
                          <span className="recording-pulse"></span>
                        )}
                      </button>
                      <p className="voice-hint">Basılı tut</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upload Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="audio/*,.png,.jpg,.jpeg"
        multiple
        style={{ display: 'none' }}
      />
    </div>
  )
}

export default Dashboard
