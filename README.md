# P2P File Sender

A lightweight, decentralized file sharing web application that transfers files directly between browsers using WebRTC — no file ever touches the server.

## Live Demo

Frontend: https://p2p-file-sender.vercel.app

## How It Works

Traditional file sharing services upload your file to a central server, which then sends it to the recipient. P2P File Sender works differently — files travel directly from one browser to another. The server is only involved in the initial handshake to help the two browsers find each other, after which it steps out completely.

```
Sender Browser  →  Signaling Server  →  Receiver Browser
                   (handshake only)
                   
File transfer:
Sender Browser  ────────── directly ──────────→  Receiver Browser
```

## Features

- Drag and drop file upload with a clean room code system
- Direct peer-to-peer transfer using WebRTC — server never sees the file
- SHA-256 cryptographic verification to ensure zero data corruption
- Real-time progress bar and transfer speed indicator
- Accept / reject flow on the receiver side
- Graceful disconnect handling with user notifications
- Works across different networks and devices

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React.js, Vite, React Router |
| Backend | Node.js, Express.js, Socket.io |
| P2P Connection | Browser WebRTC API |
| NAT Traversal | STUN (Google), TURN (Metered) |
| File Verification | Web Crypto API (SHA-256) |
| Deployment | Vercel (frontend), Render (backend) |

## Getting Started

### Prerequisites

- Node.js v18 or above
- npm

### Installation

1. Clone the repository

```bash
git clone https://github.com/Ronak-F7/P2P-File-Sender.git
cd P2P-File-Sender
```

2. Install server dependencies

```bash
cd server
npm install
```

3. Install client dependencies

```bash
cd ../client
npm install
```

### Running Locally

Start the signaling server:

```bash
cd server
node index.js
```

Start the React client (in a new terminal):

```bash
cd client
npm run dev
```

Open `http://localhost:5173` in your browser.

## Usage

1. Open the app and click **Send File**
2. Drop a file into the upload zone (max 50MB)
3. Share the 6-character room code with the recipient
4. Recipient opens the app, clicks **Receive File**, and enters the code
5. Recipient clicks **Accept & Download**
6. File transfers directly and downloads automatically once complete

## Project Structure

```
P2P File Sender/
├── server/
│   ├── index.js          # Signaling server (Socket.io)
│   └── package.json
│
└── client/
    ├── src/
    │   ├── App.jsx        # Routing
    │   ├── Landing.jsx    # Home page
    │   ├── Sender.jsx     # Sender logic and UI
    │   └── Receiver.jsx   # Receiver logic and UI
    ├── vercel.json        # Vercel routing config
    └── package.json
```
