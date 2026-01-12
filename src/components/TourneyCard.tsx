// src/components/TourneyCard.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/TeamCard.css';

interface TourneyCardProps {
  tourney: {
    id: string;
    title: string;
    google_sheet_link: string;
  };
}

const TourneyCard: React.FC<TourneyCardProps> = ({ tourney }) => {
  return (
    <div className="team-card">
      <Link to={`/tourney/${tourney.id}`}>
        <div className="team-card-content">
          <h2>{tourney.title}</h2>
        </div>
      </Link>
    </div>
  );
};

export default TourneyCard;
