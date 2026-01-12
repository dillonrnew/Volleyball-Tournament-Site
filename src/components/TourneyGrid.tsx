// src/components/TeamsGrid.tsx
import { useState, useEffect } from 'react';
import TourneyCard from './TourneyCard';
import { supabase } from '../supabaseClient';
import '../styles/TournamentTeamsPage.css';

// Exact match to your current teams table
type tourney = {
  id: string;
  title: string;
  google_sheet_link: string;
};

const TourneyGrid: React.FC = () => {
  const [tourney, setTourney] = useState<tourney[]>([]);

    useEffect(() => {
    const fetchTourney = async () => {
      const { data, error } = await supabase
        .from('tournaments')
        .select('*')
        .order('title', { ascending: true });
      if (error) throw error;

      setTourney(data ?? []);
    };


    fetchTourney();
    }, []);

  return (
    <div className="teams-grid-container">
      <h1 className="grid-title">Select Your Tourney</h1>

      {tourney.length === 0 ? (
        <p>No Active Tourneys.</p>
      ) : (
        <div className="teams-grid">
          {tourney.map((tourney) => (
            <TourneyCard key={tourney.id} tourney={tourney} />
          ))}
        </div>
      )}
    </div>
  );
};

export default TourneyGrid;