import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing from './Landing'
import Sender from './Sender'
import Receiver from './Receiver'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/send/:roomId" element={<Sender />} />
        <Route path="/receive/:roomId" element={<Receiver />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App