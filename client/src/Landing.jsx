import { useNavigate } from 'react-router-dom'
import { useState } from 'react'

function Landing() {
  const navigate = useNavigate()
  const [roomInput, setRoomInput] = useState('')
  const [showReceive, setShowReceive] = useState(false)
  const [error, setError] = useState('')

  const generateRoomId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let id = ''
    for (let i = 0; i < 6; i++) {
      id += chars[Math.floor(Math.random() * chars.length)]
    }
    return id
  }

  const handleSend = () => {
    const id = generateRoomId()
    navigate(`/send/${id}`)
  }

  const handleReceive = () => {
    setShowReceive(true)
    setError('')
  }

  const handleJoin = () => {
    const code = roomInput.trim().toUpperCase()
    if (code.length !== 6) {
      setError('Room code must be 6 characters')
      return
    }
    navigate(`/receive/${code}`)
  }

  return (
    <>
      <div className="grid-bg"></div>
      <div className="glow-pink"></div>
      <div className="glow-yellow"></div>

      <div className="landing-page">

        <div className="landing-header">
          <div style={{
            background: 'rgba(255,215,0,0.06)',
            border: '1px solid rgba(255,215,0,0.2)',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            fontSize: '11px',
            color: '#ffd700',
            textAlign: 'center',
            letterSpacing: '0.5px'
          }}>
            ⚠ First visit? Wait ~60 seconds for the server to wake up.
          </div>
          <div className="logo">P2P <span>SHARE</span></div>
          <div className="tagline">Direct · Encrypted · Zero Server</div>
        </div>

        <div className="landing-center">

          {!showReceive ? (
            <>
              <div className="landing-title">Transfer files directly</div>
              <div className="landing-sub">
                No servers. No uploads. Pure peer-to-peer.
              </div>

              <div className="landing-buttons">
                <button className="btn-send" onClick={handleSend}>
                  <span className="btn-icon">📤</span>
                  <span className="btn-label">Send File</span>
                  <span className="btn-hint">Generate a room code</span>
                </button>

                <button className="btn-receive" onClick={handleReceive}>
                  <span className="btn-icon">📥</span>
                  <span className="btn-label">Receive File</span>
                  <span className="btn-hint">Enter a room code</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="landing-title">Enter Room Code</div>
              <div className="landing-sub">
                Ask the sender for their 6-character room code
              </div>

              <div className="room-input-wrap">
                <input
                  className="room-input"
                  type="text"
                  maxLength={6}
                  placeholder="X4K9P2"
                  value={roomInput}
                  onChange={(e) => {
                    setRoomInput(e.target.value.toUpperCase())
                    setError('')
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                  autoFocus
                />
              </div>

              {error && <div className="room-error">{error}</div>}

              <div className="landing-buttons">
                <button className="btn-send" onClick={handleJoin}>
                  <span className="btn-icon">🔗</span>
                  <span className="btn-label">Join Room</span>
                  <span className="btn-hint">Connect to sender</span>
                </button>
                <button className="btn-back" onClick={() => {
                  setShowReceive(false)
                  setRoomInput('')
                  setError('')
                }}>
                  <span className="btn-icon">←</span>
                  <span className="btn-label">Back</span>
                  <span className="btn-hint">Go back</span>
                </button>
              </div>
            </>
          )}
        </div>

        <div className="landing-footer">
          <span>WebRTC · SHA-256 Verified · End-to-End</span>
        </div>

      </div>
    </>
  )
}

export default Landing