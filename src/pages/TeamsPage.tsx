// src/pages/TeamsPage.tsx
import { useParams } from 'react-router-dom';
import TeamsGrid from '../components/TeamsGrid';

const TeamsPage: React.FC = () => {
  const { tournamentId } = useParams<{ tournamentId: string }>();

  if (!tournamentId) {
    return <p>Invalid tournament.</p>;
  }

  return <TeamsGrid tournamentId={tournamentId} />;
};

export default TeamsPage;
