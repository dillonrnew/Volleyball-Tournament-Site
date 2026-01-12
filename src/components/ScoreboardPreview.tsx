// src/components/ScoreboardPreview.tsx
import React from 'react';

interface ScoreboardPreviewProps {
  imageUrl: string;
}

const ScoreboardPreview: React.FC<ScoreboardPreviewProps> = ({ imageUrl }) => {
  return (
    <div className="scoreboard-preview">
      <img src={`https://cszyqguhwvxnkozuyldj.supabase.co/storage/v1/object/public/scoreboards/${imageUrl}`} alt="Scoreboard Preview" />
    </div>
  );
};

export default ScoreboardPreview;
