// src/components/AdminDashboard.tsx
import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { RefreshCcw } from 'lucide-react';
import '../styles/AdminDashboard.css';

type TeamJoinRow = {
  player1_name: string | null;
  player2_name: string | null;
  player3_name: string | null;
};

type TeamJoinShape = TeamJoinRow[] | TeamJoinRow | null;

type SubmissionRow = {
  id: string;
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

const POLL_INTERVAL_MS = 10_000;

function pickTeam(team: TeamJoinShape): TeamJoinRow | null {
  if (!team) return null;
  return Array.isArray(team) ? (team[0] ?? null) : team;
}

function normalizeStatus(s: string): Submission['status'] {
  if (s === 'approved' || s === 'rejected' || s === 'pending' || s === 'exported') return s;
  return 'pending';
}

const AdminDashboard: React.FC = () => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSubmissions = async () => {
    const query = supabase
      .from('submissions')
      .select(
        `
        id,
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
      return;
    }

    const normalized: Submission[] = (data ?? []).map((r) => {
      const t0 = pickTeam(r.team);

      return {
        id: r.id,
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
    setLoading(false);
  };

  // ✅ Set explicit status and remove from the list immediately
  const setStatus = async (submissionId: string, newStatus: 'approved' | 'rejected') => {
    // optimistic remove (because this view shows only pending)
    const prev = submissions;
    setSubmissions((cur) => cur.filter((s) => s.id !== submissionId));

    const { error } = await supabase
      .from('submissions')
      .update({ status: newStatus })
      .eq('id', submissionId);

    if (error) {
      console.error('Error updating status:', error);
      // revert if it failed
      setSubmissions(prev);
      return;
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
                  <td className="table-cell cell-center">{s.map_number}</td>

                  <td className="table-cell">
                    <div className="players-cell">
                      <div className="player-line">
                        <span className="player-name">{s.teams?.player1_name ?? ''}</span>
                        <span className="player-kills">{s.player1_kills}</span>
                      </div>
                      <div className="player-line">
                        <span className="player-name">{s.teams?.player2_name ?? ''}</span>
                        <span className="player-kills">{s.player2_kills}</span>
                      </div>
                      <div className="player-line">
                        <span className="player-name">{s.teams?.player3_name ?? ''}</span>
                        <span className="player-kills">{s.player3_kills}</span>
                      </div>
                    </div>
                  </td>

                  <td className="table-cell cell-center">{s.placement ?? ''}</td>

                  <td className="table-cell cell-center">
                    <div className="action-buttons">
                      <button
                        className="approve-btn"
                        onClick={() => setStatus(s.id, 'approved')}
                      >
                        Approve
                      </button>
                      <button
                        className="deny-btn"
                        onClick={() => setStatus(s.id, 'rejected')}
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
                    No pending submissions 🎉
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
