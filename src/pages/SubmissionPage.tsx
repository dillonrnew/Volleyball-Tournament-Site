// src/pages/SubmissionPage.tsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import SubmissionModal from '../components/SubmissionModal';
import '../styles/SubmissionPage.css';

type Team = {
  id: string; // UUID
  tournament_id: string; // UUID
  team_number: number;
  name: string;
};

type SubmissionStatus = 'approved' | 'pending' | 'rejected' | 'exported' | 'none';

type SubmissionDisplayRow = {
  map_number: number;
  status: 'approved' | 'pending' | 'rejected' | 'exported';
};

const SubmissionPage: React.FC = () => {
  const { tournamentId, teamId } = useParams<{ tournamentId: string; teamId: string }>();

  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);

  // map_number -> status
  const [statusByMap, setStatusByMap] = useState<Record<number, SubmissionStatus>>({});

  // Modal state
  const [selectedMap, setSelectedMap] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModalForMap = (mapNumber: number) => {
    setSelectedMap(mapNumber);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedMap(null);
  };

  const fetchTeam = async () => {
    if (!tournamentId || !teamId) {
      setTeam(null);
      return;
    }

    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('id', teamId)
      .single();

    if (error) {
      console.error('[FETCH TEAM] Error fetching team:', error, { tournamentId, teamId });
      setTeam(null);
      return;
    }

    setTeam(data as Team);
  };

  const fetchSubmissionsDisplay = async () => {
    if (!teamId || !tournamentId) return;

    const { data, error } = await supabase
      .from('submissions_display')
      .select('map_number,status')
      .eq('team_id', teamId)
      .eq('tournament_id', tournamentId);

    if (error) {
      console.error('[FETCH STATUSES] Error fetching submissions_display:', error, {
        tournamentId,
        teamId,
      });
      setStatusByMap({});
      return;
    }

    const next: Record<number, SubmissionStatus> = {};
    (data as SubmissionDisplayRow[] | null)?.forEach((row) => {
      next[row.map_number] = row.status;
    });

    setStatusByMap(next);
  };

  // Initial load
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchTeam();
      await fetchSubmissionsDisplay();
      setLoading(false);
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournamentId, teamId]);

  const getStatus = (mapNumber: number): SubmissionStatus => {
    return statusByMap[mapNumber] ?? 'none';
  };

  const getStatusClass = (status: SubmissionStatus) => {
    if (status === 'approved' || status === 'exported') return 'status-approved';
    if (status === 'pending') return 'status-pending';
    if (status === 'rejected') return 'status-rejected';
    return '';
  };

  if (loading) {
    return (
      <div className="teams-grid-container">
        <h1>Loading...</h1>
      </div>
    );
  }

  if (!tournamentId) {
    return (
      <div className="teams-grid-container">
        <h1>Missing Tournament</h1>
        <p>No tournamentId was provided in the route.</p>
      </div>
    );
  }

  if (!teamId) {
    return (
      <div className="teams-grid-container">
        <h1>Missing Team</h1>
        <p>No teamId was provided in the route.</p>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="teams-grid-container">
        <h1>Team Not Found</h1>
        <p>
          Could not find team <code>{teamId}</code> for tournament <code>{tournamentId}</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="teams-grid-container">
      <h1 className="team-name">{team.name}</h1>
      <h2 className="grid-title">Select Map</h2>

      <div className="map-grid">
        {Array.from({ length: 20 }, (_, i) => i + 1).map((mapNumber) => {
          const status = getStatus(mapNumber);
          const statusClass = getStatusClass(status);

          return (
            <button
              key={mapNumber}
              className={`map-button ${statusClass}`}
              onClick={() => openModalForMap(mapNumber)}
            >
              Map {mapNumber}
            </button>
          );
        })}
      </div>

      {/* Modal */}
      {isModalOpen && selectedMap !== null && (
        <SubmissionModal
          teamId={teamId}
          tournamentId={tournamentId}
          mapNumber={selectedMap}
          onClose={async () => {
            closeModal();
            await fetchSubmissionsDisplay();
          }}
        />
      )}
    </div>
  );
};

export default SubmissionPage;
