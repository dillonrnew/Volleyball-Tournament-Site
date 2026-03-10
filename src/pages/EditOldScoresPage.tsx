import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCcw } from 'lucide-react';
import { supabase } from '../supabaseClient';
import '../styles/EditOldScoresPage.css';

type Tournament = {
  id: string;
  title: string;
};

type Team = {
  id: string;
  team_number: number;
  name: string | null;
  player1_name: string | null;
  player2_name: string | null;
  player3_name: string | null;
};

type Submission = {
  id: string;
  tournament_id: string;
  team_id: string;
  map_number: number;
  player1_kills: number;
  player2_kills: number;
  player3_kills: number;
  placement: number | null;
  scoreboard_image_url: string | null;
  status: string;
};

type EditableSubmissionValues = {
  map_number: string;
  player1_kills: string;
  player2_kills: string;
  player3_kills: string;
  placement: string;
};

const emptyEditableValues: EditableSubmissionValues = {
  map_number: '',
  player1_kills: '',
  player2_kills: '',
  player3_kills: '',
  placement: '',
};

function buildEditableValues(submission: Submission): EditableSubmissionValues {
  return {
    map_number: String(submission.map_number),
    player1_kills: String(submission.player1_kills),
    player2_kills: String(submission.player2_kills),
    player3_kills: String(submission.player3_kills),
    placement: submission.placement === null ? '' : String(submission.placement),
  };
}

function parseWholeNumber(value: string, label: string, min: number) {
  if (value.trim() === '') throw new Error(`${label} is required.`);
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min) {
    throw new Error(`${label} must be a whole number${min > 0 ? ` at least ${min}` : ''}.`);
  }
  return parsed;
}

const EditOldScoresPage: React.FC = () => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [editableValues, setEditableValues] = useState<Record<string, EditableSubmissionValues>>({});
  const [selectedTournamentId, setSelectedTournamentId] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [loadingTournaments, setLoadingTournaments] = useState(true);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [savingSubmissionId, setSavingSubmissionId] = useState<string | null>(null);

  const fetchTournaments = async () => {
    setLoadingTournaments(true);
    setErrorMessage(null);

    const { data, error } = await supabase
      .from('tournaments')
      .select('id,title')
      .order('title', { ascending: true });

    if (error) {
      console.error('Error fetching tournaments:', error);
      setErrorMessage('Failed to load tournaments.');
      setLoadingTournaments(false);
      return;
    }

    setTournaments((data ?? []) as Tournament[]);
    setLoadingTournaments(false);
  };

  const fetchTeams = async (tournamentId: string) => {
    setLoadingTeams(true);
    setErrorMessage(null);

    const { data, error } = await supabase
      .from('teams')
      .select('id,team_number,name,player1_name,player2_name,player3_name')
      .eq('tournament_id', tournamentId)
      .order('team_number', { ascending: true });

    if (error) {
      console.error('Error fetching teams:', error);
      setErrorMessage('Failed to load teams.');
      setTeams([]);
      setLoadingTeams(false);
      return;
    }

    setTeams((data ?? []) as Team[]);
    setLoadingTeams(false);
  };

  const fetchSubmissions = async (tournamentId: string, teamId: string) => {
    setLoadingSubmissions(true);
    setErrorMessage(null);
    setStatusMessage(null);

    const { data, error } = await supabase
      .from('submissions')
      .select(
        'id,tournament_id,team_id,map_number,player1_kills,player2_kills,player3_kills,placement,scoreboard_image_url,status'
      )
      .eq('tournament_id', tournamentId)
      .eq('team_id', teamId)
      .order('map_number', { ascending: true });

    if (error) {
      console.error('Error fetching submissions:', error);
      setErrorMessage('Failed to load reported scores.');
      setSubmissions([]);
      setEditableValues({});
      setLoadingSubmissions(false);
      return;
    }

    const nextSubmissions = (data ?? []) as Submission[];
    setSubmissions(nextSubmissions);
    setEditableValues(() => {
      const next: Record<string, EditableSubmissionValues> = {};
      nextSubmissions.forEach((submission) => {
        next[submission.id] = buildEditableValues(submission);
      });
      return next;
    });
    setLoadingSubmissions(false);
  };

  const refreshCurrentView = async () => {
    setStatusMessage(null);
    await fetchTournaments();

    if (selectedTournamentId) {
      await fetchTeams(selectedTournamentId);
    }

    if (selectedTournamentId && selectedTeamId) {
      await fetchSubmissions(selectedTournamentId, selectedTeamId);
    }
  };

  useEffect(() => {
    fetchTournaments();
  }, []);

  useEffect(() => {
    if (!selectedTournamentId) {
      setTeams([]);
      setSelectedTeamId('');
      setSubmissions([]);
      setEditableValues({});
      return;
    }

    setSelectedTeamId('');
    setSubmissions([]);
    setEditableValues({});
    fetchTeams(selectedTournamentId);
  }, [selectedTournamentId]);

  useEffect(() => {
    if (!selectedTournamentId || !selectedTeamId) {
      setSubmissions([]);
      setEditableValues({});
      return;
    }

    fetchSubmissions(selectedTournamentId, selectedTeamId);
  }, [selectedTournamentId, selectedTeamId]);

  const selectedTeam = teams.find((team) => team.id === selectedTeamId) ?? null;

  const updateEditableValue = (
    submissionId: string,
    field: keyof EditableSubmissionValues,
    value: string
  ) => {
    setEditableValues((current) => ({
      ...current,
      [submissionId]: {
        ...(current[submissionId] ?? emptyEditableValues),
        [field]: value,
      },
    }));
  };

  const saveSubmission = async (submission: Submission) => {
    const draft = editableValues[submission.id] ?? buildEditableValues(submission);
    setSavingSubmissionId(submission.id);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const payload = {
        id: submission.id,
        tournament_id: submission.tournament_id,
        team_id: submission.team_id,
        map_number: parseWholeNumber(draft.map_number, 'Map number', 1),
        player1_kills: parseWholeNumber(draft.player1_kills, 'Player 1 kills', 0),
        player2_kills: parseWholeNumber(draft.player2_kills, 'Player 2 kills', 0),
        player3_kills: parseWholeNumber(draft.player3_kills, 'Player 3 kills', 0),
        placement: parseWholeNumber(draft.placement, 'Placement', 1),
        scoreboard_image_url: submission.scoreboard_image_url,
        status: 'approved',
      };

      const { data, error } = await supabase
        .from('submissions')
        .upsert(payload, { onConflict: 'id' })
        .select(
          'id,tournament_id,team_id,map_number,player1_kills,player2_kills,player3_kills,placement,scoreboard_image_url,status'
        )
        .single();

      if (error) throw error;

      if (data) {
        const updatedSubmission = data as Submission;
        setSubmissions((current) =>
          current
            .map((row) => (row.id === updatedSubmission.id ? updatedSubmission : row))
            .sort((a, b) => a.map_number - b.map_number)
        );
        setEditableValues((current) => ({
          ...current,
          [updatedSubmission.id]: buildEditableValues(updatedSubmission),
        }));
      }

      setStatusMessage('Score reuploaded successfully.');
    } catch (error) {
      console.error('Error saving submission:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to reupload score.');
    } finally {
      setSavingSubmissionId(null);
    }
  };

  return (
    <div className="old-scores-page">
      <div className="old-scores-shell">
        <div className="old-scores-header">
          <div>
            <h1 className="old-scores-title">Edit Old Scores</h1>
            <p className="old-scores-subtitle">
              Select a tournament and team, then correct any previous score submission and reupload it.
            </p>
          </div>

          <div className="old-scores-actions">
            <button className="old-scores-refresh" onClick={refreshCurrentView}>
              <RefreshCcw size={16} />
              Refresh
            </button>
            <Link className="old-scores-back" to="/admin">
              Back To Dashboard
            </Link>
          </div>
        </div>

        <div className="old-scores-filters">
          <label className="old-scores-field">
            <span>Tournament</span>
            <select
              value={selectedTournamentId}
              onChange={(e) => setSelectedTournamentId(e.target.value)}
              disabled={loadingTournaments}
            >
              <option value="">Select tournament</option>
              {tournaments.map((tournament) => (
                <option key={tournament.id} value={tournament.id}>
                  {tournament.title}
                </option>
              ))}
            </select>
          </label>

          <label className="old-scores-field">
            <span>Team</span>
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              disabled={!selectedTournamentId || loadingTeams}
            >
              <option value="">Select team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  Team {team.team_number}
                  {team.name ? ` - ${team.name}` : ''}
                </option>
              ))}
            </select>
          </label>
        </div>

        {errorMessage && <p className="old-scores-error">{errorMessage}</p>}
        {statusMessage && <p className="old-scores-success">{statusMessage}</p>}

        {selectedTeam && (
          <div className="old-scores-team-card">
            <h2>
              Team {selectedTeam.team_number}
              {selectedTeam.name ? ` - ${selectedTeam.name}` : ''}
            </h2>
            <p>
              {selectedTeam.player1_name ?? ''} / {selectedTeam.player2_name ?? ''} /{' '}
              {selectedTeam.player3_name ?? ''}
            </p>
          </div>
        )}

        {loadingSubmissions ? (
          <p className="old-scores-note">Loading reported scores...</p>
        ) : !selectedTournamentId ? (
          <p className="old-scores-note">Choose a tournament to begin.</p>
        ) : !selectedTeamId ? (
          <p className="old-scores-note">Choose a team to view its score history.</p>
        ) : submissions.length === 0 ? (
          <p className="old-scores-note">No reported scores found for that team.</p>
        ) : (
          <div className="old-scores-table-wrap">
            <table className="old-scores-table">
              <thead>
                <tr>
                  <th>Map</th>
                  <th>{selectedTeam?.player1_name ?? 'Player 1'}</th>
                  <th>{selectedTeam?.player2_name ?? 'Player 2'}</th>
                  <th>{selectedTeam?.player3_name ?? 'Player 3'}</th>
                  <th>Placement</th>
                  <th>Status</th>
                  <th>Scoreboard</th>
                  <th>Reupload</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((submission) => (
                  <tr key={submission.id}>
                    <td>
                      <input
                        className="old-score-input"
                        type="number"
                        min={1}
                        value={editableValues[submission.id]?.map_number ?? ''}
                        onChange={(e) =>
                          updateEditableValue(submission.id, 'map_number', e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="old-score-input"
                        type="number"
                        min={0}
                        value={editableValues[submission.id]?.player1_kills ?? ''}
                        onChange={(e) =>
                          updateEditableValue(submission.id, 'player1_kills', e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="old-score-input"
                        type="number"
                        min={0}
                        value={editableValues[submission.id]?.player2_kills ?? ''}
                        onChange={(e) =>
                          updateEditableValue(submission.id, 'player2_kills', e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="old-score-input"
                        type="number"
                        min={0}
                        value={editableValues[submission.id]?.player3_kills ?? ''}
                        onChange={(e) =>
                          updateEditableValue(submission.id, 'player3_kills', e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="old-score-input old-score-placement"
                        type="number"
                        min={1}
                        value={editableValues[submission.id]?.placement ?? ''}
                        onChange={(e) =>
                          updateEditableValue(submission.id, 'placement', e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <span className={`old-score-status old-score-status-${submission.status}`}>
                        {submission.status}
                      </span>
                    </td>
                    <td>
                      {submission.scoreboard_image_url ? (
                        <a
                          className="old-score-link"
                          href={submission.scoreboard_image_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View
                        </a>
                      ) : (
                        <span className="old-score-muted">None</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="old-score-save"
                        disabled={savingSubmissionId === submission.id}
                        onClick={() => saveSubmission(submission)}
                      >
                        {savingSubmissionId === submission.id ? 'Saving...' : 'Reupload'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default EditOldScoresPage;
