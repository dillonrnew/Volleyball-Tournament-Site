// src/components/TeamsGrid.tsx
import { useState, useEffect } from 'react';
import TeamCard from './TeamCard';
import { supabase } from '../supabaseClient';
import '../styles/TournamentTeamsPage.css';

type Team = {
  id: string;
  tournament_id: string;
  team_number: number;
  name: string | null;
  player1_name: string;
  player2_name: string;
  player3_name: string;
  player4_name: string;
  created_at: string;
};

type TeamsGridProps = {
  tournamentId: string;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const TeamsGrid: React.FC<TeamsGridProps> = ({ tournamentId }) => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const hasValidTournamentId = Boolean(tournamentId) && UUID_REGEX.test(tournamentId);

  useEffect(() => {
    if (!hasValidTournamentId) {
      return;
    }

    let isMounted = true;

    const fetchTeams = async () => {
      setLoading(true);
      setErrorMsg(null);

      try {
        const { data, error } = await supabase
          .from('teams')
          .select('*')
          .eq('tournament_id', tournamentId)
          .order('team_number', { ascending: true });

        if (!isMounted) return;

        if (error) {
          setTeams([]);
          setErrorMsg(error.message);
          setLoading(false);
          return;
        }

        setTeams((data ?? []) as Team[]);
        setLoading(false);
      } catch {
        if (!isMounted) return;
        setTeams([]);
        setErrorMsg('Unexpected error fetching teams.');
        setLoading(false);
      }
    };

    fetchTeams();

    return () => {
      isMounted = false;
    };
  }, [hasValidTournamentId, tournamentId]);

  return (
    <div className="teams-grid-container">
      <h1 className="grid-title">Select Your Team</h1>

      {!hasValidTournamentId ? (
        <p>Invalid tournament id.</p>
      ) : loading ? (
        <p>Loading teams...</p>
      ) : errorMsg ? (
        <p>{errorMsg}</p>
      ) : teams.length === 0 ? (
        <p>No teams registered yet.</p>
      ) : (
        <div className="teams-grid">
          {teams.map((team) => (
            <TeamCard key={team.id} team={team} />
          ))}
        </div>
      )}
    </div>
  );
};

export default TeamsGrid;
