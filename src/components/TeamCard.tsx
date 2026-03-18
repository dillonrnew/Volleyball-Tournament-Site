import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/TeamCard.css';

interface TeamCardProps {
  team: {
    id: string;
    tournament_id: string;
    team_number: number;
    player1_name: string;
    player2_name: string;
    player3_name: string;
    player4_name: string;
  };
}

const TeamCard: React.FC<TeamCardProps> = ({ team }) => {
  return (
    <div className="team-card">
      <Link
        to={`/submit/${team.tournament_id}/${team.id}`}
        className="team-card-link"
        aria-label={`Submit for Team ${team.team_number}`}
      >
        <div className="team-card-content">
          <div className="team-players">
            <div>{team.player1_name}</div>
            <div>{team.player2_name}</div>
            <div>{team.player3_name}</div>
            <div>{team.player4_name}</div>
          </div>
        </div>
      </Link>
    </div>
  );
};

export default TeamCard;
