import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { io } from 'socket.io-client'

function Receiver() {
    const { roomId } = useParams()
    const socketRef = useRef(null)
    const peerRef = useRef(null)
    const [status, setStatus] = useState('Waiting for sender...')
    const [fileMeta, setFileMeta] = useState(null)
    const [accepted, setAccepted] = useState(false)
    const [progress, setProgress] = useState(0)
    const [speed, setSpeed] = useState(0)
    const [disconnected, setDisconnected] = useState(false)
    const [verified, setVerified] = useState(null)  // null | true | false
    const receivedChunks = useRef([])
    const fileMetaRef = useRef(null)
    const iceCandidateQueue = useRef([])
    const receivedSize = useRef(0)
    const lastReceivedSize = useRef(0)
    const speedInterval = useRef(null)

    useEffect(() => {
        socketRef.current = io('https://p2p-file-sender-server.onrender.com')
        socketRef.current.emit('join-room', roomId)

        socketRef.current.on('offer', (data) => {
            setStatus('Sender found! Connecting...')
            answerOffer(data.offer)
        })

        socketRef.current.on('ice-candidate', (data) => {
            if (!data.candidate) return
            if (peerRef.current && peerRef.current.remoteDescription) {
                peerRef.current.addIceCandidate(data.candidate)
            } else {
                iceCandidateQueue.current.push(data.candidate)
            }
        })

        // Sender disconnected
        socketRef.current.on('peer-disconnected', () => {
            setDisconnected(true)
            setStatus('Sender disconnected.')
            clearInterval(speedInterval.current)
        })

        return () => {
            socketRef.current.disconnect()
            if (peerRef.current) peerRef.current.close()
            if (speedInterval.current) clearInterval(speedInterval.current)
        }
    }, [roomId])

    const answerOffer = async (offer) => {
        const config = {
            iceServers: [
                {
                    urls: "stun:stun.relay.metered.ca:80",
                },
                {
                    urls: "turn:global.relay.metered.ca:80",
                    username: "238e35fe53d9cf4ec25a12bf",
                    credential: "pANa+d3KHum+MX1/",
                },
                {
                    urls: "turn:global.relay.metered.ca:80?transport=tcp",
                    username: "238e35fe53d9cf4ec25a12bf",
                    credential: "pANa+d3KHum+MX1/",
                },
                {
                    urls: "turn:global.relay.metered.ca:443",
                    username: "238e35fe53d9cf4ec25a12bf",
                    credential: "pANa+d3KHum+MX1/",
                },
                {
                    urls: "turns:global.relay.metered.ca:443?transport=tcp",
                    username: "238e35fe53d9cf4ec25a12bf",
                    credential: "pANa+d3KHum+MX1/",
                },
            ]
        }

        peerRef.current = new RTCPeerConnection(config)

        peerRef.current.onicecandidate = (e) => {
            if (e.candidate) {
                socketRef.current.emit('ice-candidate', { roomId, candidate: e.candidate })
            }
        }

        peerRef.current.onconnectionstatechange = () => {
            console.log('Receiver connection state:', peerRef.current.connectionState)
            if (peerRef.current.connectionState === 'disconnected' ||
                peerRef.current.connectionState === 'failed') {
                setDisconnected(true)
                setStatus('Connection lost.')
                clearInterval(speedInterval.current)
            }
        }

        peerRef.current.ondatachannel = (e) => {
            const dataChannel = e.channel
            dataChannel.binaryType = 'arraybuffer'
            dataChannel.onopen = () => {
                console.log('Receiver data channel open!')
                setStatus('Connected! Waiting for file info...')
            }
            dataChannel.onmessage = (event) => handleIncomingData(event.data)
        }

        await peerRef.current.setRemoteDescription(offer)

        for (const candidate of iceCandidateQueue.current) {
            await peerRef.current.addIceCandidate(candidate)
        }
        iceCandidateQueue.current = []

        const answer = await peerRef.current.createAnswer()
        await peerRef.current.setLocalDescription(answer)
        socketRef.current.emit('answer', { roomId, answer })
    }

    const handleIncomingData = (data) => {
        if (typeof data === 'string') {
            const message = JSON.parse(data)

            if (message.type === 'file-meta') {
                fileMetaRef.current = {
                    name: message.name,
                    size: message.size,
                    hash: message.hash    // store sender's hash
                }
                setFileMeta({ name: message.name, size: message.size })
                receivedSize.current = 0
                setStatus('Incoming file — accept to download')
            }

            if (message.type === 'file-end') {
                clearInterval(speedInterval.current)
                setSpeed(0)
                setProgress(100)
                setStatus('Verifying file integrity...')
                assembleAndDownload()
            }

        } else {
            receivedChunks.current.push(data)
            receivedSize.current += data.byteLength
            const percent = Math.round(
                (receivedSize.current / fileMetaRef.current.size) * 100
            )
            setProgress(percent)
        }
    }

    const handleAccept = () => {
        setAccepted(true)
        setStatus('Receiving file...')
        socketRef.current.emit('file-accepted', { roomId })

        speedInterval.current = setInterval(() => {
            const bytesPerSecond = receivedSize.current - lastReceivedSize.current
            setSpeed(bytesPerSecond)
            lastReceivedSize.current = receivedSize.current
        }, 1000)
    }

    // Compute SHA-256 of received file and compare with sender's hash
    const verifyFile = async (blob) => {
        const buffer = await blob.arrayBuffer()
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        const receivedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
        console.log('Sender hash:  ', fileMetaRef.current.hash)
        console.log('Received hash:', receivedHash)
        return receivedHash === fileMetaRef.current.hash
    }

    const assembleAndDownload = async () => {
        const blob = new Blob(receivedChunks.current)

        // Verify integrity
        const isValid = await verifyFile(blob)
        setVerified(isValid)

        if (isValid) {
            setStatus('File verified ✓ Downloading...')
        } else {
            setStatus('⚠ File verification failed! Data may be corrupted.')
            return   // don't download corrupted file
        }

        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = fileMetaRef.current.name
        a.click()
        URL.revokeObjectURL(url)
        setStatus('File downloaded successfully! ✓')
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
                    <div className="wake-banner full">
                        First visit? Wait ~60 seconds for the server to wake up.
                    </div>
                    <div>
                        <div className="logo">P2P <span>SHARE</span></div>
                        <div className="tagline">Direct · Encrypted · Zero Server</div>
                    </div>
                    {fileMeta && !disconnected && (
                        <div className="connection-badge">● Connected</div>
                    )}
                </div>

                <div className="drop-zone">
                    <div className="corner tl"></div>
                    <div className="corner tr"></div>
                    <div className="corner bl"></div>
                    <div className="corner br"></div>
                    <div className="drop-icon">{fileMeta ? '▾▾' : '◆'}</div>
                    <div className="drop-title">{fileMeta ? fileMeta.name : 'Waiting for Sender...'}</div>
                    <div className="drop-sub">{fileMeta ? formatSize(fileMeta.size) : roomId}</div>
                </div>

                <div className="bottom-row">

                    {fileMeta && !accepted && (
                        <>
                            <div className="info-card">
                                <div className="card-label">File Name</div>
                                <div className="card-value">{fileMeta.name}</div>
                                <div className="card-sub">{fileMeta.name.split('.').pop().toUpperCase()} File</div>
                            </div>
                            <div className="info-card">
                                <div className="card-label">File Size</div>
                                <div className="card-value">{formatSize(fileMeta.size)}</div>
                                <div className="card-sub">Incoming transfer</div>
                            </div>
                            <button className="btn-generate full" onClick={handleAccept}>
                                Accept & Download
                            </button>
                        </>
                    )}

                    {accepted && (
                        <div className="progress-wrap full">
                            <div className="progress-row">
                                <span className="progress-label">Receiving</span>
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
                            <span className="error-text">⚠ Sender disconnected</span>
                        </div>
                    )}

                    <div className="status-bar full">
                        <div className="dot"></div>
                        <span className="status-text">{status}</span>
                    </div>

                </div>

            </div>
        </>
    )
}

export default Receiver