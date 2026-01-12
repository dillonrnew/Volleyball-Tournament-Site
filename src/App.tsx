// src/App.tsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import TourneysPage from './pages/TourneysPage';
import TeamsPage from './pages/TeamsPage';
import SubmissionPage from './pages/SubmissionPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import BracketPage from './pages/TestPage';
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<TourneysPage />} />

        <Route
          path="/tourney/:tournamentId"
          element={<TeamsPage />}
        />

        <Route
          path="/submit/:tournamentId/:teamId"
          element={<SubmissionPage />}
        />

        <Route
          path="/admin"
          element={<AdminDashboardPage />}
        />
        <Route
          path="/bracket"
          element={<BracketPage />}
        />
        /*
        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
        
      </Routes>
    </Router>
  );
}

export default App;
