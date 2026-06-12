import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { io } from 'socket.io-client'

function Sender() {
  const { roomId } = useParams()        // GET roomId from URL
  const [file, setFile] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [transferStatus, setTransferStatus] = useState('')
  const [receiverConnected, setReceiverConnected] = useState(false)
  const [transferStarted, setTransferStarted] = useState(false)
  const [progress, setProgress] = useState(0)
  const [speed, setSpeed] = useState(0)
  const [disconnected, setDisconnected] = useState(false)
  const [copied, setCopied] = useState(false)
  const socketRef = useRef(null)
  const peerRef = useRef(null)
  const fileRef = useRef(null)
  const dataChannelRef = useRef(null)

  useEffect(() => {
    if (!roomId) return

    socketRef.current = io('http://localhost:3001')
    socketRef.current.emit('join-room', roomId)

    socketRef.current.on('user-joined', () => {
      setReceiverConnected(true)
      setDisconnected(false)
      setTransferStatus('Receiver connected! Establishing connection...')
      startWebRTC()
    })

    socketRef.current.on('answer', (data) => {
      peerRef.current.setRemoteDescription(data.answer)
    })

    socketRef.current.on('ice-candidate', (data) => {
      if (!data.candidate) return
      if (peerRef.current && peerRef.current.remoteDescription) {
        peerRef.current.addIceCandidate(data.candidate)
      }
    })

    socketRef.current.on('file-accepted', () => {
      setTransferStarted(true)
      setTransferStatus('Sending file...')
      sendFile(dataChannelRef.current)
    })

    // Receiver disconnected
    socketRef.current.on('peer-disconnected', () => {
      setDisconnected(true)
      setTransferStatus('Receiver disconnected.')
      setReceiverConnected(false)
    })

    return () => {
      socketRef.current.disconnect()
      if (peerRef.current) peerRef.current.close()
    }
  }, [roomId])

  // Compute SHA-256 hash of the file
  const computeHash = async (file) => {
    const buffer = await file.arrayBuffer()
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  const startWebRTC = async () => {
    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443?transport=tcp',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        }
      ]
    }

    peerRef.current = new RTCPeerConnection(config)

    peerRef.current.onicecandidate = (e) => {
      if (e.candidate) {
        socketRef.current.emit('ice-candidate', { roomId, candidate: e.candidate })
      }
    }

    peerRef.current.onconnectionstatechange = () => {
      console.log('Sender connection state:', peerRef.current.connectionState)
      if (peerRef.current.connectionState === 'disconnected' ||
        peerRef.current.connectionState === 'failed') {
        setDisconnected(true)
        setTransferStatus('Connection lost.')
      }
    }

    const dataChannel = peerRef.current.createDataChannel('fileTransfer')
    dataChannel.binaryType = 'arraybuffer'
    dataChannelRef.current = dataChannel

    dataChannel.onopen = async () => {
      console.log('Data channel opened!')
      setTransferStatus('Connected! Computing file hash...')

      // Compute hash before sending
      const hash = await computeHash(fileRef.current)
      console.log('File hash:', hash)

      setTransferStatus('Connected! Waiting for receiver to accept...')
      dataChannel.send(JSON.stringify({
        type: 'file-meta',
        name: fileRef.current.name,
        size: fileRef.current.size,
        hash: hash        // send hash along with metadata
      }))
    }

    dataChannel.onerror = (err) => {
      console.error('Data channel error:', err)
      setTransferStatus('Connection error. Please try again.')
    }

    const offer = await peerRef.current.createOffer()
    await peerRef.current.setLocalDescription(offer)
    socketRef.current.emit('offer', { roomId, offer })
  }

  const sendFile = (dataChannel) => {
    const currentFile = fileRef.current
    const chunkSize = 16 * 1024
    const maxBufferSize = 256 * 1024
    let offset = 0
    let lastOffset = 0

    const speedInterval = setInterval(() => {
      const bytesPerSecond = offset - lastOffset
      setSpeed(bytesPerSecond)
      lastOffset = offset
    }, 1000)

    const reader = new FileReader()

    const readNextChunk = () => {
      if (dataChannel.bufferedAmount > maxBufferSize) {
        setTimeout(readNextChunk, 50)
        return
      }

      if (offset >= currentFile.size) {
        clearInterval(speedInterval)
        setSpeed(0)
        setProgress(100)
        dataChannel.send(JSON.stringify({ type: 'file-end' }))
        setTransferStatus('File sent successfully! ✓')
        return
      }

      const slice = currentFile.slice(offset, offset + chunkSize)
      reader.readAsArrayBuffer(slice)
    }

    reader.onload = (e) => {
      dataChannel.send(e.target.result)
      offset += e.target.result.byteLength
      const percent = Math.round((offset / currentFile.size) * 100)
      setProgress(percent)
      readNextChunk()
    }

    readNextChunk()
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      setFile(droppedFile)
      fileRef.current = droppedFile
    }
  }

  const handleFileInput = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile) {
      setFile(selectedFile)
      fileRef.current = selectedFile
    }
  }

  const formatSize = (bytes) => {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <>
      <div className="grid-bg"></div>
      <div className="glow-pink"></div>
      <div className="glow-yellow"></div>

      <div className="page">

        <div className="header">
          <div>
            <div className="logo">P2P <span>SHARE</span></div>
            <div className="tagline">Direct · Encrypted · Zero Server</div>
          </div>
          {receiverConnected && (
            <div className="connection-badge">● Connected</div>
          )}
        </div>

        <div
          className={`drop-zone ${isDragging ? 'active' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !file && document.getElementById('fileInput').click()}
        >
          <div className="corner tl"></div>
          <div className="corner tr"></div>
          <div className="corner bl"></div>
          <div className="corner br"></div>
          <div className="drop-icon">{file ? '📄' : '📂'}</div>
          <div className="drop-title">{file ? 'File Ready' : 'Drop File Here'}</div>
          <div className="drop-sub">{file ? file.name : 'or click to browse · max 50mb'}</div>
        </div>

        <input
          id="fileInput"
          type="file"
          style={{ display: 'none' }}
          onChange={handleFileInput}
        />

        <div className="bottom-row">

          {file && (
            <>
              <div className="info-card">
                <div className="card-label">File Name</div>
                <div className="card-value">{file.name}</div>
                <div className="card-sub">{file.name.split('.').pop().toUpperCase()} File</div>
              </div>
              <div className="info-card">
                <div className="card-label">File Size</div>
                <div className="card-value">{formatSize(file.size)}</div>
                <div className="card-sub">Within 50MB limit</div>
              </div>
            </>
          )}

          {file && !roomId && (
            <button className="btn-generate full" onClick={handleGenerateLink}>
              Generate Share Link
            </button>
          )}

          {transferStarted && (
            <div className="progress-wrap full">
              <div className="progress-row">
                <span className="progress-label">Transfer Progress</span>
                <span className="progress-value">
                  {progress}%{speed > 0 ? ` · ${(speed / (1024 * 1024)).toFixed(1)} MB/s` : ''}
                </span>
              </div>
              <div className="bar-bg">
                <div className="bar-fill" style={{ width: `${progress}%` }}></div>
              </div>
            </div>
          )}

          {disconnected && (
            <div className="error-bar full">
              <span className="error-text">⚠ Receiver disconnected</span>
            </div>
          )}

          {roomId && (
            <div className="status-bar full">
              <div className="dot"></div>
              <span className="status-text">
                {transferStatus || 'Waiting for receiver to connect...'}
              </span>
            </div>
          )}

          <div className="room-code-box full">
            <div className="room-code-label">Room Code</div>
            <div className="room-code-value">{roomId}</div>
            <button className="copy-btn" onClick={() => {
              navigator.clipboard.writeText(roomId)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

        </div>

      </div>
    </>
  )
}

export default Sender