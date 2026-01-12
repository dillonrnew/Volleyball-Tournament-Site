// src/components/SubmissionModal.tsx
import React, { useEffect, useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { supabase } from "../supabaseClient";
import "../styles/SubmissionModal.css";

type SubmissionModalProps = {
  teamId: string; // UUID
  tournamentId: string; // UUID (maps to tournament_id)
  mapNumber: number; // fixed map for this modal instance
  onClose: () => void;
};

type Team = {
  id: string; // UUID
  name: string;
  player1_name: string;
  player2_name: string;
  player3_name: string;
};

const SCOREBOARD_PUBLIC_BASE =
  "https://cszyqguhwvxnkozuyldj.supabase.co/storage/v1/object/public/scoreboards/";

const SubmissionModal: React.FC<SubmissionModalProps> = ({
  teamId,
  tournamentId,
  mapNumber,
  onClose,
}) => {
  const [team, setTeam] = useState<Team | null>(null);

  const [placement, setPlacement] = useState<number>(1);
  const [playerKills, setPlayerKills] = useState<string[]>(["", "", ""]);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [imagePreview, setImagePreview] = useState<string>("");
  const pasteRef = useRef<HTMLTextAreaElement>(null);

  // Fetch team details
  useEffect(() => {
    const fetchTeam = async () => {
      if (!teamId) return;

      const { data, error } = await supabase
        .from("teams")
        .select("id,name,player1_name,player2_name,player3_name")
        .eq("id", teamId)
        .single();

      if (error) {
        console.error("[FETCH TEAM]", error, { teamId });
        setTeam(null);
        return;
      }

      setTeam(data as Team);
    };

    fetchTeam();
  }, [teamId]);

  // Avoid object URL leaks
  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const setPreviewFromFile = (file: File) => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(URL.createObjectURL(file));
  };

  // ---------- IMAGE HANDLING ----------

  const compress = async (file: File) => {
    try {
      const opts = {
        maxSizeMB: 0.8,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: "image/jpeg",
        initialQuality: 0.85,
      } as const;

      const compressed = await imageCompression(file, opts);

      return new File([compressed], `map_${mapNumber}.jpg`, {
        type: "image/jpeg",
      });
    } catch (e) {
      console.error("[COMPRESS ERROR]", e);
      throw e;
    }
  };

  const uploadScoreboard = async (file: File) => {
    const safeName = `map_${mapNumber}_${Date.now()}.jpg`;
    const path = `${tournamentId}/${teamId}/${safeName}`;

    const { error } = await supabase.storage
      .from("scoreboards")
      .upload(path, file, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (error) {
      console.error("[UPLOAD ERROR]", error, { path });
      throw error;
    }

    return path; // relative path inside bucket
  };

  // ---------- SUBMIT ----------

  const submit = async () => {
    setSubmitting(true);
    setErr(null);

    try {
      if (!imageFile) throw new Error("Please upload a scoreboard image.");

      const k1 = Number(playerKills[0] || 0);
      const k2 = Number(playerKills[1] || 0);
      const k3 = Number(playerKills[2] || 0);

      const compressed = await compress(imageFile);
      const storagePath = await uploadScoreboard(compressed);

      // ✅ Build full public URL
      const publicUrl = SCOREBOARD_PUBLIC_BASE + storagePath;

      const payload = {
        tournament_id: tournamentId,
        team_id: teamId,
        map_number: mapNumber,
        placement,
        player1_kills: k1,
        player2_kills: k2,
        player3_kills: k3,
        scoreboard_image_url: publicUrl, // FULL URL STORED
        status: "pending",
      };

      const { error } = await supabase.from("submissions").insert(payload);

      if (error) {
        console.error("[DB INSERT ERROR]", error, payload);
        throw error;
      }

      alert("Submitted! Waiting for admin approval.");

      setImageFile(null);
      setPlayerKills(["", "", ""]);
      setPlacement(1);

      if (imagePreview) URL.revokeObjectURL(imagePreview);
      setImagePreview("");

      onClose();
    } catch (e: any) {
      console.error("[SUBMIT FAILED]", e);
      setErr(e?.message ?? "Failed to submit.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!team) return <div className="modal-overlay">Loading...</div>;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="modal-close" onClick={onClose}>
          ✕
        </button>

        <h3 className="modal-subtitle">Submit Score for Map {mapNumber}</h3>

        {err && <div style={{ color: "#ffb4b4" }}>{err}</div>}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label>Placement</label>
          <input
            type="number"
            min={1}
            value={placement}
            onChange={(e) => setPlacement(Number(e.target.value))}
            required
          />

          <div className="kills-section">
            {[team.player1_name, team.player2_name, team.player3_name].map(
              (p, idx) => (
                <div key={idx} className="kills-input-group">
                  <label>{p} Kills</label>
                  <input
                    type="number"
                    min={0}
                    value={playerKills[idx]}
                    onChange={(e) =>
                      setPlayerKills((prev) => {
                        const copy = [...prev];
                        copy[idx] = e.target.value;
                        return copy;
                      })
                    }
                    required
                  />
                </div>
              )
            )}
          </div>

          <label>Scoreboard Image</label>
          <input
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const compressed = await compress(file);
              setImageFile(compressed);
              setPreviewFromFile(compressed);
              e.target.value = "";
            }}
          />

          <textarea
            ref={pasteRef}
            placeholder="Paste screenshot here"
            onPaste={async (e) => {
              for (const item of e.clipboardData.items) {
                if (item.type.startsWith("image/")) {
                  const file = item.getAsFile();
                  if (!file) return;
                  e.preventDefault();
                  const compressed = await compress(file);
                  setImageFile(compressed);
                  setPreviewFromFile(compressed);
                }
              }
            }}
          />

          {imagePreview && (
            <div className="preview-container">
              <img src={imagePreview} alt="Scoreboard preview" />
            </div>
          )}

          <button type="submit" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Score"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SubmissionModal;
