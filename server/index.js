const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')

const app = express()
app.use(cors())

const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
})

// Track which room each socket is in
const socketRooms = {}

io.on('connection', (socket) => {
  console.log('Someone connected:', socket.id)

  socket.on('join-room', (roomId) => {
    socket.join(roomId)
    socketRooms[socket.id] = roomId
    console.log(`Socket ${socket.id} joined room ${roomId}`)
    socket.to(roomId).emit('user-joined', socket.id)
  })

  socket.on('offer', (data) => {
    socket.to(data.roomId).emit('offer', {
      offer: data.offer,
      from: socket.id
    })
  })

  socket.on('answer', (data) => {
    socket.to(data.roomId).emit('answer', {
      answer: data.answer,
      from: socket.id
    })
  })

  socket.on('ice-candidate', (data) => {
    socket.to(data.roomId).emit('ice-candidate', {
      candidate: data.candidate,
      from: socket.id
    })
  })

  socket.on('file-accepted', (data) => {
    socket.to(data.roomId).emit('file-accepted')
  })

  // When someone disconnects, tell the other person in their room
  socket.on('disconnect', () => {
    console.log('Someone disconnected:', socket.id)
    const roomId = socketRooms[socket.id]
    if (roomId) {
      socket.to(roomId).emit('peer-disconnected')
      delete socketRooms[socket.id]
    }
  })
})

server.listen(3001, () => {
  console.log('Signaling server running on http://localhost:3001')
})