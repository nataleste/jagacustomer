import { Routes, Route, Navigate } from 'react-router-dom'
import Onboarding from './screens/Onboarding'
import Home from './screens/Home'
import AddJAGA from './screens/AddJAGA'
import LiveTranscript from './screens/LiveTranscript'
import Chat from './screens/Chat'
import Investigation from './screens/Investigation'
import Verdict from './screens/Verdict'
import Report from './screens/Report'
import PlayMoment from './screens/PlayMoment'
import Sealing from './screens/Sealing'
import ReportFiled from './screens/ReportFiled'
import Guardian from './screens/Guardian'
import Settings from './screens/Settings'

// One connected app. One route = one screen. Routes per routing-spec.md.
export default function App() {
  return (
    <div className="flex min-h-full items-center justify-center p-10">
      <Routes>
        <Route path="/" element={<Onboarding />} />
        <Route path="/home" element={<Home />} />
        <Route path="/add-jaga" element={<AddJAGA />} />
        <Route path="/transcript" element={<LiveTranscript />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/investigation" element={<Investigation />} />
        <Route path="/verdict" element={<Navigate to="/verdict/scam" replace />} />
        <Route path="/verdict/:variant" element={<Verdict />} />
        <Route path="/report" element={<Report />} />
        <Route path="/report/moment" element={<PlayMoment />} />
        <Route path="/report/sealing" element={<Sealing />} />
        <Route path="/report/filed" element={<ReportFiled />} />
        <Route path="/guardian" element={<Guardian />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
