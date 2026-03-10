// src/components/AdminDashboard.tsx
import { useEffect, useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import '../styles/AdminDashboard.css';

type TeamJoinRow = {
  player1_name: string | null;
  player2_name: string | null;
  player3_name: string | null;
};

type TeamJoinShape = TeamJoinRow[] | TeamJoinRow | null;

type SubmissionRow = {
  id: string;
  tournament_id: string;
  team_id: number;
  map_number: number;
  player1_kills: number;
  player2_kills: number;
  player3_kills: number;
  placement: number | null;
  scoreboard_image_url: string | null;
  status: string;
  team: TeamJoinShape;
};

type Submission = {
  id: string;
  tournament_id: string;
  team_id: number;
  map_number: number;
  player1_kills: number;
  player2_kills: number;
  player3_kills: number;
  placement: number | null;
  scoreboard_image_url: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'exported';
  teams?: {
    player1_name: string;
    player2_name: string;
    player3_name: string;
  };
};

type EditableSubmissionValues = {
  map_number: string;
  player1_kills: string;
  player2_kills: string;
  player3_kills: string;
  placement: string;
};

const POLL_INTERVAL_MS = 10_000;

function pickTeam(team: TeamJoinShape): TeamJoinRow | null {
  if (!team) return null;
  return Array.isArray(team) ? (team[0] ?? null) : team;
}

function normalizeStatus(s: string): Submission['status'] {
  if (s === 'approved' || s === 'rejected' || s === 'pending' || s === 'exported') return s;
  return 'pending';
}

function buildEditableValues(submission: Submission): EditableSubmissionValues {
  return {
    map_number: String(submission.map_number),
    player1_kills: String(submission.player1_kills),
    player2_kills: String(submission.player2_kills),
    player3_kills: String(submission.player3_kills),
    placement: submission.placement === null ? '' : String(submission.placement),
  };
}

const emptyEditableValues: EditableSubmissionValues = {
  map_number: '',
  player1_kills: '',
  player2_kills: '',
  player3_kills: '',
  placement: '',
};

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [editableValues, setEditableValues] = useState<Record<string, EditableSubmissionValues>>({});
  const [loading, setLoading] = useState(true);
  const [savingSubmissionId, setSavingSubmissionId] = useState<string | null>(null);

  const fetchSubmissions = async () => {
    const query = supabase
      .from('submissions')
      .select(
        `
        id,
        tournament_id,
        team_id,
        map_number,
        player1_kills,
        player2_kills,
        player3_kills,
        placement,
        scoreboard_image_url,
        status,
        team:teams!submissions_team_id_fkey (
          player1_name,
          player2_name,
          player3_name
        )
      `
      )
      .eq('status', 'pending')
      .order('id', { ascending: false })
      .returns<SubmissionRow[]>();

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching submissions:', error);
      setLoading(false);
      return;
    }

    const normalized: Submission[] = (data ?? []).map((r) => {
      const t0 = pickTeam(r.team);

      return {
        id: r.id,
        tournament_id: r.tournament_id,
        team_id: r.team_id,
        map_number: r.map_number,
        player1_kills: r.player1_kills,
        player2_kills: r.player2_kills,
        player3_kills: r.player3_kills,
        placement: r.placement,
        scoreboard_image_url: r.scoreboard_image_url,
        status: normalizeStatus(r.status),
        teams: t0
          ? {
              player1_name: t0.player1_name ?? '',
              player2_name: t0.player2_name ?? '',
              player3_name: t0.player3_name ?? '',
            }
          : undefined,
      };
    });

    setSubmissions(normalized);
    setEditableValues((current) => {
      const next: Record<string, EditableSubmissionValues> = {};
      normalized.forEach((submission) => {
        next[submission.id] = current[submission.id] ?? buildEditableValues(submission);
      });
      return next;
    });
    setLoading(false);
  };

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

  const parseNonNegativeInteger = (value: string, fieldLabel: string) => {
    if (value.trim() === '') throw new Error(`${fieldLabel} is required.`);
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new Error(`${fieldLabel} must be a whole number.`);
    }
    return parsed;
  };

  const parsePlacement = (value: string) => {
    if (value.trim() === '') throw new Error('Placement is required.');
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new Error('Placement must be at least 1.');
    }
    return parsed;
  };

  const setStatus = async (submission: Submission, newStatus: 'approved' | 'rejected') => {
    const prevSubmissions = submissions;
    const prevEditableValues = editableValues;
    const draft = editableValues[submission.id] ?? buildEditableValues(submission);

    setSubmissions((current) => current.filter((s) => s.id !== submission.id));
    setEditableValues((current) => {
      const next = { ...current };
      delete next[submission.id];
      return next;
    });
    setSavingSubmissionId(submission.id);

    try {
      if (newStatus === 'approved') {
        const payload = {
          id: submission.id,
          tournament_id: submission.tournament_id,
          team_id: submission.team_id,
          map_number: parsePlacement(draft.map_number),
          player1_kills: parseNonNegativeInteger(draft.player1_kills, 'Player 1 kills'),
          player2_kills: parseNonNegativeInteger(draft.player2_kills, 'Player 2 kills'),
          player3_kills: parseNonNegativeInteger(draft.player3_kills, 'Player 3 kills'),
          placement: parsePlacement(draft.placement),
          scoreboard_image_url: submission.scoreboard_image_url,
          status: 'approved' as const,
        };

        const { error } = await supabase.from('submissions').upsert(payload, { onConflict: 'id' });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('submissions')
          .update({ status: newStatus })
          .eq('id', submission.id);

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error updating submission:', error);
      setSubmissions(prevSubmissions);
      setEditableValues(prevEditableValues);
      const message = error instanceof Error ? error.message : 'Failed to update submission.';
      window.alert(message);
    } finally {
      setSavingSubmissionId(null);
    }
  };

  useEffect(() => {
    fetchSubmissions();
    const intervalId = window.setInterval(fetchSubmissions, POLL_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, []);

  if (loading) return <p className="loading-text">Loading submissions...</p>;

  return (
    <div className="dashboard-container">
      <div className="dashboard-content">
        <div className="header">
          <h1 className="title">Admin Dashboard</h1>

          <div className="button-group">
            <button
              className="secondary-button"
              onClick={() => navigate('/admin/edit-old-scores')}
            >
              Edit Old Scores
            </button>
            <button className="refresh-button" onClick={fetchSubmissions}>
              <RefreshCcw size={18} />
              Refresh
            </button>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="submission-table">
            <colgroup>
              <col className="col-map" />
              <col className="col-kills" />
              <col className="col-placement" />
              <col className="col-toggle" />
              <col className="col-scoreboard" />
            </colgroup>

            <thead>
              <tr className="table-header-row">
                <th className="table-header">Map #</th>
                <th className="table-header">Kills</th>
                <th className="table-header">Placement</th>
                <th className="table-header">Actions</th>
                <th className="table-header">Scoreboard</th>
              </tr>
            </thead>

            <tbody>
              {submissions.map((s) => (
                <tr key={s.id} className="table-row">
                  <td className="table-cell cell-center">
                    <input
                      className="score-input map-input"
                      type="number"
                      min={1}
                      value={editableValues[s.id]?.map_number ?? ''}
                      onChange={(e) => updateEditableValue(s.id, 'map_number', e.target.value)}
                    />
                  </td>

                  <td className="table-cell">
                    <div className="players-cell">
                      <div className="player-line">
                        <span className="player-name">{s.teams?.player1_name ?? ''}</span>
                        <input
                          className="score-input"
                          type="number"
                          min={0}
                          value={editableValues[s.id]?.player1_kills ?? ''}
                          onChange={(e) => updateEditableValue(s.id, 'player1_kills', e.target.value)}
                        />
                      </div>
                      <div className="player-line">
                        <span className="player-name">{s.teams?.player2_name ?? ''}</span>
                        <input
                          className="score-input"
                          type="number"
                          min={0}
                          value={editableValues[s.id]?.player2_kills ?? ''}
                          onChange={(e) => updateEditableValue(s.id, 'player2_kills', e.target.value)}
                        />
                      </div>
                      <div className="player-line">
                        <span className="player-name">{s.teams?.player3_name ?? ''}</span>
                        <input
                          className="score-input"
                          type="number"
                          min={0}
                          value={editableValues[s.id]?.player3_kills ?? ''}
                          onChange={(e) => updateEditableValue(s.id, 'player3_kills', e.target.value)}
                        />
                      </div>
                    </div>
                  </td>

                  <td className="table-cell cell-center">
                    <input
                      className="score-input placement-input"
                      type="number"
                      min={1}
                      value={editableValues[s.id]?.placement ?? ''}
                      onChange={(e) => updateEditableValue(s.id, 'placement', e.target.value)}
                    />
                  </td>

                  <td className="table-cell cell-center">
                    <div className="action-buttons">
                      <button
                        className="approve-btn"
                        disabled={savingSubmissionId === s.id}
                        onClick={() => setStatus(s, 'approved')}
                      >
                        {savingSubmissionId === s.id ? 'Saving...' : 'Approve'}
                      </button>
                      <button
                        className="deny-btn"
                        disabled={savingSubmissionId === s.id}
                        onClick={() => setStatus(s, 'rejected')}
                      >
                        Deny
                      </button>
                    </div>
                  </td>

                  <td className="table-cell cell-center">
                    {s.scoreboard_image_url && (
                      <a
                        className="scoreboard-link"
                        href={s.scoreboard_image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <img
                          className="scoreboard-thumb"
                          src={s.scoreboard_image_url}
                          alt="Scoreboard"
                        />
                      </a>
                    )}
                  </td>
                </tr>
              ))}

              {submissions.length === 0 && (
                <tr>
                  <td className="table-cell cell-center" colSpan={5}>
                    No pending submissions
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
