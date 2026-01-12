import React, { useEffect, useMemo, useRef, useState } from "react";

type Vec2 = { x: number; y: number };

type LeaderboardEntry = {
  name: string;
  score: number;
};

type BoardCard = {
  id: string;
  title: string;
  x: number;
  y: number;
  entries: LeaderboardEntry[];
};

export default function WhiteboardPan() {
  // ---------- Layout constants ----------
  const HEADER_H = 72;

  // ✅ Bracket structure per side: 8 → 4 → 2 → 1
  const COUNTS_PER_SIDE = useMemo(() => [8, 4, 2, 1], []);

  // Leaderboard sizing
  const CARD_W = 420;
  const CARD_EST_H = 720; // 16 rows

  // Spacing controls
  const TOP_Y = 180;
  const GAP_Y = 750; // vertical distance between outer-most (8) boards
  const COL_GAP_X = 720; // horizontal distance between columns (8 -> 4 -> 2 -> 1)

  // Board size
  const SIDE_MARGIN_X = 220;

  const BOARD_W = useMemo(() => {
    // left span: margin + (numCols-1)*colGap + cardWidth
    const numCols = COUNTS_PER_SIDE.length; // 4 columns
    const leftSpan = SIDE_MARGIN_X + (numCols - 1) * COL_GAP_X + CARD_W;
    const rightSpan = leftSpan;
    const centerGap = 520; // empty space in the middle
    return leftSpan + rightSpan + centerGap;
  }, [COUNTS_PER_SIDE.length, CARD_W, COL_GAP_X]);

  const BOARD_H = useMemo(() => {
    // tallest column is 8 boards
    const outerCount = 8;
    const bottomPadding = 360;
    return TOP_Y + (outerCount - 1) * GAP_Y + CARD_EST_H + bottomPadding;
  }, [TOP_Y, GAP_Y]);

  const BOARD = useMemo(() => ({ w: BOARD_W, h: BOARD_H }), [BOARD_W, BOARD_H]);

  // ---------- Viewport sizing ----------
  const [viewport, setViewport] = useState({
    w: window.innerWidth,
    h: window.innerHeight - HEADER_H,
  });

  useEffect(() => {
    const onResize = () =>
      setViewport({ w: window.innerWidth, h: window.innerHeight - HEADER_H });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ---------- Camera + Zoom ----------
  const [cam, setCam] = useState<Vec2>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);

  const clamp = (n: number, min: number, max: number) =>
    Math.max(min, Math.min(max, n));

  /**
   * Auto-centering:
   * - If scaled board is smaller than viewport, cam locks to centered value.
   * - Otherwise cam is clamped between [viewport - scaled, 0].
   */
  const getCamBounds = (z: number) => {
    const scaledW = BOARD.w * z;
    const scaledH = BOARD.h * z;

    const xFits = scaledW <= viewport.w;
    const yFits = scaledH <= viewport.h;

    const centerX = (viewport.w - scaledW) / 2;
    const centerY = (viewport.h - scaledH) / 2;

    const minX = xFits ? centerX : viewport.w - scaledW;
    const maxX = xFits ? centerX : 0;

    const minY = yFits ? centerY : viewport.h - scaledH;
    const maxY = yFits ? centerY : 0;

    return { minX, maxX, minY, maxY, scaledW, scaledH, xFits, yFits };
  };

  const clampCam = (next: Vec2, z = zoom): Vec2 => {
    const { minX, maxX, minY, maxY } = getCamBounds(z);
    return { x: clamp(next.x, minX, maxX), y: clamp(next.y, minY, maxY) };
  };

  // Clamp camera when viewport changes
  useEffect(() => {
    setCam((c) => clampCam(c, zoom));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewport.w, viewport.h]);

  // ---------- Drag handling ----------
  const draggingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const startPointerRef = useRef<Vec2>({ x: 0, y: 0 });
  const startCamRef = useRef<Vec2>({ x: 0, y: 0 });

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    draggingRef.current = true;
    pointerIdRef.current = e.pointerId;
    startPointerRef.current = { x: e.clientX, y: e.clientY };
    startCamRef.current = cam;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    if (pointerIdRef.current !== e.pointerId) return;

    const dx = e.clientX - startPointerRef.current.x;
    const dy = e.clientY - startPointerRef.current.y;

    setCam(
      clampCam({
        x: startCamRef.current.x + dx,
        y: startCamRef.current.y + dy,
      })
    );
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current === e.pointerId) {
      draggingRef.current = false;
      pointerIdRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  // ---------- Zoom buttons (+ / -) ----------
  const MIN_ZOOM = 0.45;
  const MAX_ZOOM = 2.25;

  const zoomBy = (delta: number) => {
    const centerScreen = { x: viewport.w / 2, y: viewport.h / 2 };
    const z1 = zoom;
    const z2 = clamp(z1 + delta, MIN_ZOOM, MAX_ZOOM);

    const worldUnderCenter = {
      x: (centerScreen.x - cam.x) / z1,
      y: (centerScreen.y - cam.y) / z1,
    };

    const nextCam = clampCam(
      {
        x: centerScreen.x - worldUnderCenter.x * z2,
        y: centerScreen.y - worldUnderCenter.y * z2,
      },
      z2
    );

    setZoom(z2);
    setCam(nextCam);
  };

  // ---------- Stylish scrollbar values ----------
  const bounds = getCamBounds(zoom);

  const hRange = bounds.maxX - bounds.minX;
  const hProgress = hRange > 0 ? clamp((bounds.maxX - cam.x) / hRange, 0, 1) : 0;

  const vRange = bounds.maxY - bounds.minY;
  const vProgress = vRange > 0 ? clamp((bounds.maxY - cam.y) / vRange, 0, 1) : 0;

  const hThumbFrac = bounds.scaledW > 0 ? clamp(viewport.w / bounds.scaledW, 0, 1) : 1;
  const vThumbFrac = bounds.scaledH > 0 ? clamp(viewport.h / bounds.scaledH, 0, 1) : 1;

  // ---------- Data ----------
  const makeEntries = (seed: number): LeaderboardEntry[] => {
    const baseNames = [
      "Alpha","Bravo","Charlie","Delta","Echo","Foxtrot","Golf","Hotel",
      "India","Juliet","Kilo","Lima","Mike","November","Oscar","Papa",
    ];
    return baseNames.slice(0, 16).map((n, i) => ({
      name: `${n} ${seed}`,
      score: 200 - i * 7 - (seed % 9),
    }));
  };

  /**
   * ✅ Positions for 8 → 4 → 2 → 1
   *
   * For each column:
   * - count = 8, 4, 2, 1
   * - step = GAP_Y * (8 / count)   (distance between boards in that column)
   * - offset = step/2 - GAP_Y/2    (puts them centered "between" prior column boards)
   *
   * Examples:
   * - count 8: step=1G, offset=0
   * - count 4: step=2G, offset=0.5G
   * - count 2: step=4G, offset=1.5G
   * - count 1: step=8G, offset=3.5G
   */
  const boards: BoardCard[] = useMemo(() => {
    const cards: BoardCard[] = [];
    let lobbyNum = 1;

    const leftX = (col: number) => SIDE_MARGIN_X + col * COL_GAP_X;
    const rightX = (col: number) =>
      BOARD.w - SIDE_MARGIN_X - CARD_W - col * COL_GAP_X;

    for (let col = 0; col < COUNTS_PER_SIDE.length; col++) {
      const count = COUNTS_PER_SIDE[col];
      const step = GAP_Y * (8 / count);
      const offset = step / 2 - GAP_Y / 2;

      // LEFT side column
      for (let i = 0; i < count; i++) {
        cards.push({
          id: `L-${col}-${i}`,
          title: `Lobby ${lobbyNum++}`,
          x: leftX(col),
          y: TOP_Y + offset + i * step,
          entries: makeEntries(lobbyNum),
        });
      }

      // RIGHT side column (mirrored)
      for (let i = 0; i < count; i++) {
        cards.push({
          id: `R-${col}-${i}`,
          title: `Lobby ${lobbyNum++}`,
          x: rightX(col),
          y: TOP_Y + offset + i * step,
          entries: makeEntries(lobbyNum),
        });
      }
    }

    return cards;
  }, [BOARD.w, CARD_W, COL_GAP_X, COUNTS_PER_SIDE, GAP_Y, TOP_Y]);

  return (
    <div style={{ width: "100vw", height: "100vh", overflow: "hidden", background: "#05060a" }}>
      {/* Header */}
      <div
        style={{
          height: HEADER_H,
          position: "relative",
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          background: "#0b0d14",
          borderBottom: "1px solid #171a25",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            fontWeight: 950,
            fontSize: 34,
            letterSpacing: 0.8,
            whiteSpace: "nowrap",
            color: "#ff4fd8",
          }}
        >
          PullzeCheck Qualifers
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              color: "#b8bdd0",
              fontWeight: 900,
              fontSize: 12,
              fontVariantNumeric: "tabular-nums",
              minWidth: 54,
              textAlign: "right",
            }}
          >
            {Math.round(zoom * 100)}%
          </div>

          <ZoomButton label="−" onClick={() => zoomBy(-0.1)} />
          <ZoomButton label="+" onClick={() => zoomBy(0.1)} />
        </div>
      </div>

      {/* Viewport */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{
          width: "100%",
          height: `calc(100vh - ${HEADER_H}px)`,
          overflow: "hidden",
          position: "relative",
          userSelect: "none",
          cursor: draggingRef.current ? "grabbing" : "grab",
          background: "#060711",
          touchAction: "none",
        }}
      >
        {/* Board */}
        <div
          style={{
            width: BOARD.w,
            height: BOARD.h,
            position: "absolute",
            left: 0,
            top: 0,
            background: "#0a0c14",
            boxShadow: "0 20px 70px rgba(0,0,0,0.65)",
            transform: `translate(${cam.x}px, ${cam.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            willChange: "transform",
            borderRadius: 18,
            border: "1px solid #14182a",
          }}
        >
          {/* Subtle grid */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,0.045) 1px, transparent 1px)," +
                "linear-gradient(to bottom, rgba(255,255,255,0.045) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
              borderRadius: 18,
            }}
          />

          {/* All lobby boards */}
          {boards.map((b) => (
            <Leaderboard key={b.id} x={b.x} y={b.y} title={b.title} entries={b.entries} />
          ))}
        </div>

        {/* Stylish scrollbars (visual only) */}
        <StylishScrollbarVertical visible={!bounds.yFits} progress={vProgress} thumbFrac={vThumbFrac} />
        <StylishScrollbarHorizontal visible={!bounds.xFits} progress={hProgress} thumbFrac={hThumbFrac} />
      </div>
    </div>
  );
}

/* ---------------- UI Pieces ---------------- */

function ZoomButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 38,
        height: 38,
        borderRadius: 12,
        border: "1px solid #242941",
        background: "#111427",
        color: "white",
        fontSize: 18,
        fontWeight: 950,
        cursor: "pointer",
        lineHeight: "38px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
}

function StylishScrollbarVertical({
  visible,
  progress,
  thumbFrac,
}: {
  visible: boolean;
  progress: number;
  thumbFrac: number;
}) {
  if (!visible) return null;

  const trackPad = 10;
  const trackW = 10;
  const trackTop = 12;
  const trackBottom = 12;
  const minThumbPx = 42;

  return (
    <div
      style={{
        position: "absolute",
        right: trackPad,
        top: trackTop,
        bottom: trackBottom,
        width: trackW,
        borderRadius: 999,
        background: "rgba(255,255,255,0.07)",
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
        pointerEvents: "none",
      }}
    >
      <ScrollbarThumb orientation="vertical" progress={progress} thumbFrac={thumbFrac} minThumbPx={minThumbPx} />
    </div>
  );
}

function StylishScrollbarHorizontal({
  visible,
  progress,
  thumbFrac,
}: {
  visible: boolean;
  progress: number;
  thumbFrac: number;
}) {
  if (!visible) return null;

  const trackPad = 10;
  const trackH = 10;
  const trackLeft = 12;
  const trackRight = 12;
  const minThumbPx = 70;

  return (
    <div
      style={{
        position: "absolute",
        left: trackLeft,
        right: trackRight,
        bottom: trackPad,
        height: trackH,
        borderRadius: 999,
        background: "rgba(255,255,255,0.07)",
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 6px 18px rgba(0,0,0,0.35)",
        pointerEvents: "none",
      }}
    >
      <ScrollbarThumb orientation="horizontal" progress={progress} thumbFrac={thumbFrac} minThumbPx={minThumbPx} />
    </div>
  );
}

function ScrollbarThumb({
  orientation,
  progress,
  thumbFrac,
  minThumbPx,
}: {
  orientation: "vertical" | "horizontal";
  progress: number;
  thumbFrac: number;
  minThumbPx: number;
}) {
  const clampedFrac = Math.max(thumbFrac, 0.08);

  if (orientation === "vertical") {
    const thumbHeightPercent = clampedFrac * 100;
    const travelPercent = 100 - thumbHeightPercent;
    const topPercent = travelPercent * progress;

    return (
      <div
        style={{
          position: "absolute",
          left: 1,
          right: 1,
          top: `${topPercent}%`,
          height: `${thumbHeightPercent}%`,
          minHeight: minThumbPx,
          borderRadius: 999,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.75), rgba(255,255,255,0.35))",
          boxShadow: "0 8px 22px rgba(0,0,0,0.45)",
          border: "1px solid rgba(255,255,255,0.18)",
          opacity: 0.95,
        }}
      />
    );
  }

  const thumbWidthPercent = clampedFrac * 100;
  const travelPercent = 100 - thumbWidthPercent;
  const leftPercent = travelPercent * progress;

  return (
    <div
      style={{
        position: "absolute",
        top: 1,
        bottom: 1,
        left: `${leftPercent}%`,
        width: `${thumbWidthPercent}%`,
        minWidth: minThumbPx,
        borderRadius: 999,
        background:
          "linear-gradient(90deg, rgba(255,255,255,0.75), rgba(255,255,255,0.35))",
        boxShadow: "0 8px 22px rgba(0,0,0,0.45)",
        border: "1px solid rgba(255,255,255,0.18)",
        opacity: 0.95,
      }}
    />
  );
}

/* ---------------- Leaderboard ---------------- */

function Leaderboard({
  x,
  y,
  title,
  entries,
}: {
  x: number;
  y: number;
  title: string;
  entries: LeaderboardEntry[];
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 420,
        borderRadius: 16,
        background: "#ffffff",
        color: "#0b0b0b",
        boxShadow: "0 18px 55px rgba(0,0,0,0.55)",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
        overflow: "hidden",
        border: "1px solid rgba(0,0,0,0.08)",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          fontWeight: 950,
          fontSize: 16,
          background: "#f3f4f6",
          letterSpacing: 0.4,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <span>{title}</span>
        <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 900 }}>
          Name / Score
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 110px",
          padding: "10px 16px",
          fontWeight: 900,
          fontSize: 12,
          color: "#6b7280",
          borderBottom: "1px solid #e5e7eb",
          background: "#fafafa",
        }}
      >
        <div>Name</div>
        <div style={{ textAlign: "right" }}>Score</div>
      </div>

      {entries.slice(0, 16).map((e, i) => (
        <React.Fragment key={i}>
          {i === 8 && <div style={{ height: 2, background: "#e11d48", margin: "4px 0" }} />}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 110px",
              padding: "9px 16px",
              fontSize: 13,
              background: i % 2 === 0 ? "#ffffff" : "#f8fafc",
              borderBottom: "1px solid rgba(0,0,0,0.05)",
            }}
          >
            <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              <span style={{ color: "#9ca3af", marginRight: 8, fontWeight: 950 }}>
                {i + 1}.
              </span>
              {e.name}
            </div>
            <div style={{ textAlign: "right", fontWeight: 950, fontVariantNumeric: "tabular-nums" }}>
              {e.score}
            </div>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}
