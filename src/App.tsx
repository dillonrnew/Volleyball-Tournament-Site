import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { supabase, supabaseEnabled } from './supabaseClient'

type Team = {
  id: string
  name: string
}

type PoolKey = 'poolA' | 'poolB'

type Match = {
  id: string
  label: string
  stage: string
  teamAId: string
  teamBId: string
  scoreA: string
  scoreB: string
}

type PoolSet = {
  scoreA: string
  scoreB: string
}

type PoolMatch = {
  id: string
  label: string
  teamAId: string
  teamBId: string
  sets: [PoolSet, PoolSet]
}

type PoolStanding = {
  teamId: string
  name: string
  wins: number
  losses: number
  ties: number
  setsWon: number
  setsLost: number
  pointsFor: number
  pointsAgainst: number
  pointDiff: number
}

type SeededTeam = PoolStanding & {
  seed: number
}

type PersistedState = {
  teams: Record<PoolKey, Team[]>
  lockedPools: Record<PoolKey, boolean>
  poolMatches: Record<PoolKey, PoolMatch[]>
  bracketMatches: Match[]
}

const bracketScoreOptions = ['0', '1', '2'] as const
const scoreSyncDebounceMs = 700
const sharedRefreshIntervalMs = 15000
const tournamentRowId = 'current'

const initialTeams: Record<PoolKey, Team[]> = {
  poolA: [
    { id: 'a1', name: 'Pool A Team 1' },
    { id: 'a2', name: 'Pool A Team 2' },
    { id: 'a3', name: 'Pool A Team 3' },
  ],
  poolB: [
    { id: 'b1', name: 'Pool B Team 1' },
    { id: 'b2', name: 'Pool B Team 2' },
    { id: 'b3', name: 'Pool B Team 3' },
  ],
}

const initialLockedPools: Record<PoolKey, boolean> = {
  poolA: false,
  poolB: false,
}

const initialPoolMatches: Record<PoolKey, PoolMatch[]> = {
  poolA: [
    {
      id: 'pool-a-1',
      label: 'Pool A Match 1',
      teamAId: 'a1',
      teamBId: 'a2',
      sets: [
        { scoreA: '', scoreB: '' },
        { scoreA: '', scoreB: '' },
      ],
    },
    {
      id: 'pool-a-2',
      label: 'Pool A Match 2',
      teamAId: 'a1',
      teamBId: 'a3',
      sets: [
        { scoreA: '', scoreB: '' },
        { scoreA: '', scoreB: '' },
      ],
    },
    {
      id: 'pool-a-3',
      label: 'Pool A Match 3',
      teamAId: 'a2',
      teamBId: 'a3',
      sets: [
        { scoreA: '', scoreB: '' },
        { scoreA: '', scoreB: '' },
      ],
    },
  ],
  poolB: [
    {
      id: 'pool-b-1',
      label: 'Pool B Match 1',
      teamAId: 'b1',
      teamBId: 'b2',
      sets: [
        { scoreA: '', scoreB: '' },
        { scoreA: '', scoreB: '' },
      ],
    },
    {
      id: 'pool-b-2',
      label: 'Pool B Match 2',
      teamAId: 'b1',
      teamBId: 'b3',
      sets: [
        { scoreA: '', scoreB: '' },
        { scoreA: '', scoreB: '' },
      ],
    },
    {
      id: 'pool-b-3',
      label: 'Pool B Match 3',
      teamAId: 'b2',
      teamBId: 'b3',
      sets: [
        { scoreA: '', scoreB: '' },
        { scoreA: '', scoreB: '' },
      ],
    },
  ],
}

const initialBracketMatches: Match[] = [
  {
    id: 'quarter-1',
    label: 'Quarterfinal 1',
    stage: 'Quarterfinal',
    teamAId: 'seed3',
    teamBId: 'seed6',
    scoreA: '0',
    scoreB: '0',
  },
  {
    id: 'quarter-2',
    label: 'Quarterfinal 2',
    stage: 'Quarterfinal',
    teamAId: 'seed4',
    teamBId: 'seed5',
    scoreA: '0',
    scoreB: '0',
  },
  {
    id: 'semifinal-1',
    label: 'Semifinal 1',
    stage: 'Semifinal',
    teamAId: 'seed1',
    teamBId: 'winner-quarter-2',
    scoreA: '0',
    scoreB: '0',
  },
  {
    id: 'semifinal-2',
    label: 'Semifinal 2',
    stage: 'Semifinal',
    teamAId: 'seed2',
    teamBId: 'winner-quarter-1',
    scoreA: '0',
    scoreB: '0',
  },
  {
    id: 'championship',
    label: 'Championship',
    stage: 'Final',
    teamAId: 'winner-semifinal-1',
    teamBId: 'winner-semifinal-2',
    scoreA: '0',
    scoreB: '0',
  },
  {
    id: 'consolation-1',
    label: 'Consolation Semifinal 1',
    stage: 'Consolation',
    teamAId: 'loser-quarter-1',
    teamBId: 'loser-semifinal-1',
    scoreA: '0',
    scoreB: '0',
  },
  {
    id: 'consolation-2',
    label: 'Consolation Semifinal 2',
    stage: 'Consolation',
    teamAId: 'loser-quarter-2',
    teamBId: 'loser-semifinal-2',
    scoreA: '0',
    scoreB: '0',
  },
  {
    id: 'third-place',
    label: 'Third Place',
    stage: 'Placement',
    teamAId: 'winner-consolation-1',
    teamBId: 'winner-consolation-2',
    scoreA: '0',
    scoreB: '0',
  },
]

function parseScore(value: string) {
  if (value.trim() === '') {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function getMatchOutcome(match: Match) {
  const scoreA = parseScore(match.scoreA)
  const scoreB = parseScore(match.scoreB)

  const hasWinner = scoreA === 2 || scoreB === 2

  if (scoreA === null || scoreB === null || scoreA === scoreB || !hasWinner) {
    return null
  }

  return {
    winnerId: scoreA > scoreB ? match.teamAId : match.teamBId,
    loserId: scoreA > scoreB ? match.teamBId : match.teamAId,
  }
}

function compareStandings(a: PoolStanding, b: PoolStanding) {
  if (b.wins !== a.wins) return b.wins - a.wins
  if (b.setsWon !== a.setsWon) return b.setsWon - a.setsWon
  if (a.setsLost !== b.setsLost) return a.setsLost - b.setsLost
  if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff
  if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor
  return a.name.localeCompare(b.name)
}

function isPoolMatchComplete(match: PoolMatch) {
  return match.sets.every((set) => {
    const scoreA = parseScore(set.scoreA)
    const scoreB = parseScore(set.scoreB)
    return scoreA !== null && scoreB !== null && scoreA !== scoreB
  })
}

function normalizePersistedState(parsed: Partial<PersistedState>): PersistedState | null {
  if (!parsed.teams || !parsed.poolMatches || !parsed.bracketMatches) {
    return null
  }

  return {
    teams: parsed.teams as Record<PoolKey, Team[]>,
    lockedPools: (parsed.lockedPools as Record<PoolKey, boolean>) ?? initialLockedPools,
    poolMatches: parsed.poolMatches as Record<PoolKey, PoolMatch[]>,
    bracketMatches: parsed.bracketMatches as Match[],
  }
}

async function readSharedState(): Promise<{
  available: boolean
  state: PersistedState | null
}> {
  if (!supabaseEnabled || !supabase) {
    console.warn('[supabase-sync] Supabase env vars are missing; shared sync disabled.')
    return { available: false, state: null }
  }

  try {
    const { data, error } = await supabase
      .from('tournament_state')
      .select('state')
      .eq('id', tournamentRowId)
      .maybeSingle()

    if (error) {
      console.error('[supabase-sync] Failed to read shared state.', error)
      return { available: false, state: null }
    }

    console.info(
      `[supabase-sync] Read shared state ${data?.state ? 'successfully' : 'with no saved row yet'}.`,
    )

    return {
      available: true,
      state: data?.state ? normalizePersistedState(data.state as Partial<PersistedState>) : null,
    }
  } catch {
    return { available: false, state: null }
  }
}

async function writeSharedState(state: PersistedState) {
  if (!supabaseEnabled || !supabase) {
    throw new Error('Supabase is not configured')
  }

  const { error } = await supabase.from('tournament_state').upsert(
    {
      id: tournamentRowId,
      state,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: 'id',
    },
  )

  if (error) {
    console.error('[supabase-sync] Failed to write shared state.', error)
    throw new Error('Failed to write shared tournament state')
  }

  console.info('[supabase-sync] Wrote tournament update to Supabase.', {
    updatedAt: new Date().toISOString(),
  })
}

function App() {
  const [activePage, setActivePage] = useState<'reporting' | 'bracket'>(getPageFromHash)
  const [teams, setTeams] = useState(initialTeams)
  const [draftTeams, setDraftTeams] = useState(initialTeams)
  const [lockedPools, setLockedPools] = useState(initialLockedPools)
  const [poolMatches, setPoolMatches] = useState(initialPoolMatches)
  const [bracketMatches, setBracketMatches] = useState(initialBracketMatches)
  const [debouncedPoolMatches, setDebouncedPoolMatches] = useState(initialPoolMatches)
  const [debouncedBracketMatches, setDebouncedBracketMatches] = useState(initialBracketMatches)
  const [sharedSyncEnabled, setSharedSyncEnabled] = useState(false)
  const [sharedStateReady, setSharedStateReady] = useState(false)
  const lastSyncedStateRef = useRef<string | null>(null)

  function applyPersistedState(state: PersistedState) {
    setTeams(state.teams)
    setDraftTeams(state.teams)
    setLockedPools(state.lockedPools)
    setPoolMatches(state.poolMatches)
    setBracketMatches(state.bracketMatches)
    setDebouncedPoolMatches(state.poolMatches)
    setDebouncedBracketMatches(state.bracketMatches)
  }

  useEffect(() => {
    function handleHashChange() {
      setActivePage(getPageFromHash())
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedPoolMatches(poolMatches)
    }, scoreSyncDebounceMs)

    return () => window.clearTimeout(timeoutId)
  }, [poolMatches])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedBracketMatches(bracketMatches)
    }, scoreSyncDebounceMs)

    return () => window.clearTimeout(timeoutId)
  }, [bracketMatches])

  useEffect(() => {
    const nextState: PersistedState = {
      teams,
      lockedPools,
      poolMatches: debouncedPoolMatches,
      bracketMatches: debouncedBracketMatches,
    }

    const serializedState = JSON.stringify(nextState)

    if (serializedState === lastSyncedStateRef.current) {
      return
    }

    lastSyncedStateRef.current = serializedState

    if (!sharedStateReady || !sharedSyncEnabled) {
      return
    }

    console.info('[supabase-sync] Local state changed; pushing update to Supabase.')
    void writeSharedState(nextState).catch(() => {
      setSharedSyncEnabled(false)
    })
  }, [
    debouncedBracketMatches,
    debouncedPoolMatches,
    lockedPools,
    sharedStateReady,
    sharedSyncEnabled,
    teams,
  ])

  useEffect(() => {
    let isActive = true

    async function hydrateSharedState() {
      const result = await readSharedState()

      if (!isActive) {
        return
      }

      setSharedSyncEnabled(result.available)
      setSharedStateReady(true)

      console.info(
        `[supabase-sync] Initial sync ${result.available ? 'connected to Supabase' : 'unavailable'}.`,
      )

      if (!result.state) {
        return
      }

      lastSyncedStateRef.current = JSON.stringify(result.state)
      applyPersistedState(result.state)
    }

    void hydrateSharedState()

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    if (!sharedStateReady || !sharedSyncEnabled) {
      return
    }

    const intervalId = window.setInterval(() => {
      void readSharedState().then((result) => {
        if (!result.available) {
          console.warn('[supabase-sync] Polling lost Supabase access; stopping shared sync.')
          setSharedSyncEnabled(false)
          return
        }

        if (!result.state) {
          return
        }

        const serializedState = JSON.stringify(result.state)

        if (serializedState === lastSyncedStateRef.current) {
          return
        }

        console.info('[supabase-sync] Pulled newer tournament state from Supabase.')
        lastSyncedStateRef.current = serializedState
        applyPersistedState(result.state)
      })
    }, sharedRefreshIntervalMs)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [sharedStateReady, sharedSyncEnabled])

  const poolStandings = useMemo(() => {
    const entries = Object.entries(teams) as [PoolKey, Team[]][]

    return entries.reduce<Record<PoolKey, PoolStanding[]>>((acc, [poolKey, poolTeams]) => {
      const totals = new Map(
        poolTeams.map((team) => [
          team.id,
          {
            teamId: team.id,
            name: team.name,
            wins: 0,
            losses: 0,
            ties: 0,
            setsWon: 0,
            setsLost: 0,
            pointsFor: 0,
            pointsAgainst: 0,
            pointDiff: 0,
          },
        ]),
      )

      for (const match of poolMatches[poolKey]) {
        const teamA = totals.get(match.teamAId)
        const teamB = totals.get(match.teamBId)

        if (!teamA || !teamB) {
          continue
        }

        let setsWonA = 0
        let setsWonB = 0
        let completedSets = 0

        for (const set of match.sets) {
          const scoreA = parseScore(set.scoreA)
          const scoreB = parseScore(set.scoreB)

          if (scoreA === null || scoreB === null || scoreA === scoreB) {
            continue
          }

          completedSets += 1
          teamA.pointsFor += scoreA
          teamA.pointsAgainst += scoreB
          teamB.pointsFor += scoreB
          teamB.pointsAgainst += scoreA

          if (scoreA > scoreB) {
            setsWonA += 1
          } else {
            setsWonB += 1
          }
        }

        teamA.setsWon += setsWonA
        teamA.setsLost += setsWonB
        teamB.setsWon += setsWonB
        teamB.setsLost += setsWonA

        if (completedSets === match.sets.length) {
          if (setsWonA > setsWonB) {
            teamA.wins += 1
            teamB.losses += 1
          } else if (setsWonB > setsWonA) {
            teamB.wins += 1
            teamA.losses += 1
          } else {
            teamA.ties += 1
            teamB.ties += 1
          }
        }
      }

      const sorted = Array.from(totals.values())
        .map((standing) => ({
          ...standing,
          pointDiff: standing.pointsFor - standing.pointsAgainst,
        }))
        .sort(compareStandings)

      acc[poolKey] = sorted
      return acc
    }, {} as Record<PoolKey, PoolStanding[]>)
  }, [poolMatches, teams])

  const seeds = useMemo(() => {
    const poolA = poolStandings.poolA
    const poolB = poolStandings.poolB
    const poolAComplete = poolMatches.poolA.every(isPoolMatchComplete)
    const poolBComplete = poolMatches.poolB.every(isPoolMatchComplete)

    const topSeeds: SeededTeam[] = []
    if (poolAComplete && poolA[0]) {
      topSeeds.push({ ...poolA[0], seed: 1 })
    }
    if (poolBComplete && poolB[0]) {
      topSeeds.push({ ...poolB[0], seed: 2 })
    }

    const atLarge =
      poolAComplete && poolBComplete
        ? [poolA[1], poolA[2], poolB[1], poolB[2]]
            .filter((team): team is PoolStanding => Boolean(team))
            .sort(compareStandings)
            .map((team, index) => ({
              ...team,
              seed: index + 3,
            }))
        : []

    return [...topSeeds, ...atLarge]
  }, [poolMatches, poolStandings])

  const teamNameById = useMemo(() => {
    const fromTeams = Object.values(teams).flat().reduce<Record<string, string>>((acc, team) => {
      acc[team.id] = team.name
      return acc
    }, {})

    const fromSeeds = seeds.reduce<Record<string, string>>((acc, team) => {
      acc[`seed${team.seed}`] = team.name
      return acc
    }, {})

    return {
      ...fromTeams,
      ...fromSeeds,
    }
  }, [seeds, teams])

  const bracketContext = useMemo(() => {
    const outcomes = new Map<string, ReturnType<typeof getMatchOutcome>>()
    for (const match of bracketMatches) {
      outcomes.set(match.id, getMatchOutcome(match))
    }

    function resolveTeamId(slotId: string): string | null {
      if (teamNameById[slotId]) {
        return slotId
      }

      if (slotId.startsWith('winner-')) {
        const matchId = slotId.replace('winner-', '')
        const outcome = outcomes.get(matchId)
        if (!outcome) return null
        return resolveTeamId(outcome.winnerId)
      }

      if (slotId.startsWith('loser-')) {
        const matchId = slotId.replace('loser-', '')
        const outcome = outcomes.get(matchId)
        if (!outcome) return null
        return resolveTeamId(outcome.loserId)
      }

      return null
    }

    return {
      resolveSlot(slotId: string) {
        const resolvedId = resolveTeamId(slotId)
        return resolvedId ? teamNameById[resolvedId] ?? 'TBD' : 'TBD'
      },
      winnerFor(matchId: string) {
        const outcome = outcomes.get(matchId)
        if (!outcome) return null
        const resolvedId = resolveTeamId(outcome.winnerId)
        return resolvedId ? teamNameById[resolvedId] ?? null : null
      },
    }
  }, [bracketMatches, teamNameById])

  const placements = useMemo(() => {
    const champion = bracketContext.winnerFor('championship')
    const third = bracketContext.winnerFor('third-place')
    const runnerUpOutcome = getMatchOutcome(
      bracketMatches.find((match) => match.id === 'championship') ?? initialBracketMatches[4],
    )
    const runnerUp = runnerUpOutcome
      ? bracketContext.resolveSlot(runnerUpOutcome.loserId)
      : null

    return { champion, runnerUp, third }
  }, [bracketContext, bracketMatches])

  function updateTeamName(poolKey: PoolKey, teamId: string, name: string) {
    if (lockedPools[poolKey]) {
      return
    }

    setTeams((current) => ({
      ...current,
      [poolKey]: current[poolKey].map((team) =>
        team.id === teamId ? { ...team, name } : team,
      ),
    }))
  }

  function updateDraftTeamName(poolKey: PoolKey, teamId: string, name: string) {
    if (lockedPools[poolKey]) {
      return
    }

    setDraftTeams((current) => ({
      ...current,
      [poolKey]: current[poolKey].map((team) =>
        team.id === teamId ? { ...team, name } : team,
      ),
    }))
  }

  function commitDraftTeamName(poolKey: PoolKey, teamId: string) {
    const savedTeam = teams[poolKey].find((team) => team.id === teamId)
    const draftTeam = draftTeams[poolKey].find((team) => team.id === teamId)

    if (!savedTeam || !draftTeam || savedTeam.name === draftTeam.name) {
      return
    }

    updateTeamName(poolKey, teamId, draftTeam.name)
  }

  function togglePoolLock(poolKey: PoolKey) {
    setLockedPools((current) => ({
      ...current,
      [poolKey]: !current[poolKey],
    }))
  }

  function updatePoolScore(
    poolKey: PoolKey,
    matchId: string,
    setIndex: number,
    side: 'scoreA' | 'scoreB',
    value: string,
  ) {
    setPoolMatches((current) => ({
      ...current,
      [poolKey]: current[poolKey].map((match) =>
        match.id === matchId
          ? {
              ...match,
              sets: match.sets.map((set, index) =>
                index === setIndex ? { ...set, [side]: sanitizeScore(value) } : set,
              ) as [PoolSet, PoolSet],
            }
          : match,
      ),
    }))
  }

  function updateBracketScore(matchId: string, side: 'scoreA' | 'scoreB', value: string) {
    setBracketMatches((current) =>
      current.map((match) =>
        match.id === matchId
          ? {
              ...match,
              [side]: match[side] === value ? '' : value,
            }
          : match,
      ),
    )
  }

  if (!sharedStateReady) {
    return (
      <main className="app-shell loading-shell">
        <section className="loading-card">
          <p className="panel-kicker">Loading</p>
          <h2>Fetching Tournament Data</h2>
          <p className="panel-note">
            Waiting for the latest tournament state from Supabase before opening the board.
          </p>
        </section>
      </main>
    )
  }

  return (
    <main className="app-shell">
      {activePage === 'reporting' ? (
        <section className="page-grid">
          <div className="panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Setup</p>
                <h2>Team Names</h2>
              </div>
              <p className="panel-note">Rename each pool team before entering scores.</p>
            </div>

            <div className="pool-setup-grid">
              {(['poolA', 'poolB'] as PoolKey[]).map((poolKey) => (
                <section className="pool-card" key={poolKey}>
                  <div className="subheader">
                    <h3>{poolKey === 'poolA' ? 'Pool A' : 'Pool B'}</h3>
                    <div className="subheader-actions">
                      <span>3 teams</span>
                      <button
                        type="button"
                        className={`lock-button${lockedPools[poolKey] ? ' locked' : ''}`}
                        onClick={() => togglePoolLock(poolKey)}
                        aria-pressed={lockedPools[poolKey]}
                      >
                        {lockedPools[poolKey] ? 'Unlock Names' : 'Lock Names'}
                      </button>
                    </div>
                  </div>
                  <div className="team-fields">
                    {teams[poolKey].map((team) => (
                      <label className="field" key={team.id}>
                        <span>{team.id.toUpperCase()}</span>
                        <input
                          type="text"
                          value={draftTeams[poolKey].find((draftTeam) => draftTeam.id === team.id)?.name ?? team.name}
                          disabled={lockedPools[poolKey]}
                          onChange={(event) =>
                            updateDraftTeamName(poolKey, team.id, event.target.value)
                          }
                          onBlur={() => commitDraftTeamName(poolKey, team.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.currentTarget.blur()
                            }
                          }}
                        />
                      </label>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Reporting</p>
                <h2>Round Robin Results</h2>
              </div>
              <p className="panel-note">Each pool match is two sets to 25, win by 2.</p>
            </div>

            <div className="pool-report-grid">
              {(['poolA', 'poolB'] as PoolKey[]).map((poolKey) => (
                <section className="pool-card" key={`${poolKey}-matches`}>
                  <div className="subheader">
                    <h3>{poolKey === 'poolA' ? 'Pool A Matches' : 'Pool B Matches'}</h3>
                    <span>Round robin</span>
                  </div>

	                  <div className="match-stack">
	                    {poolMatches[poolKey].map((match) => (
	                      <article className="match-card" key={match.id}>
	                        <div className="match-meta">
	                          <strong>{match.label}</strong>
	                          <span>{describePoolMatch(match, teamNameById)}</span>
	                        </div>
	                        <div className="pool-score-table">
	                          <div
	                            className="pool-score-row pool-score-head"
	                            style={{
	                              gridTemplateColumns: `minmax(150px, 1.6fr) repeat(${match.sets.length}, minmax(88px, 1fr))`,
	                            }}
	                          >
	                            <span>Team</span>
	                            {match.sets.map((_, setIndex) => (
	                              <span key={`${match.id}-heading-${setIndex + 1}`}>Set {setIndex + 1}</span>
	                            ))}
	                          </div>
	                          {[
	                            { teamId: match.teamAId, side: 'scoreA' as const },
	                            { teamId: match.teamBId, side: 'scoreB' as const },
	                          ].map(({ teamId, side }) => (
	                            <div
	                              className="pool-score-row"
	                              key={`${match.id}-${teamId}`}
	                              style={{
	                                gridTemplateColumns: `minmax(150px, 1.6fr) repeat(${match.sets.length}, minmax(88px, 1fr))`,
	                              }}
	                            >
	                              <span className="pool-score-team-name">{teamNameById[teamId]}</span>
	                              {match.sets.map((set, setIndex) => (
	                                <label
	                                  className="pool-score-cell"
	                                  key={`${match.id}-${teamId}-set-${setIndex + 1}`}
	                                >
	                                  <span className="sr-only">
	                                    {teamNameById[teamId]} Set {setIndex + 1} score
	                                  </span>
	                                  <input
	                                    inputMode="numeric"
	                                    pattern="[0-9]*"
	                                    type="text"
	                                    value={set[side]}
	                                    onChange={(event) =>
	                                      updatePoolScore(
	                                        poolKey,
	                                        match.id,
	                                        setIndex,
	                                        side,
	                                        event.target.value,
	                                      )
	                                    }
	                                  />
	                                </label>
	                              ))}
	                            </div>
	                          ))}
	                        </div>
	                      </article>
	                    ))}
	                  </div>
                </section>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">Reporting</p>
                <h2>Bracket Results</h2>
              </div>
              <p className="panel-note">
                Pool winners receive the byes into the semifinals.
              </p>
            </div>

            <div className="bracket-report-grid">
              {bracketMatches.map((match) => (
                <article className="match-card" key={match.id}>
                  <div className="match-meta">
                    <strong>{match.label}</strong>
                    <span>{match.stage}</span>
                  </div>
                  <div className="bracket-report-row">
                    <div className="bracket-report-team">{bracketContext.resolveSlot(match.teamAId)}</div>
                    <div className="bracket-score-picker" aria-label={`${match.label} score picker`}>
                      <div className="bracket-score-options" role="radiogroup" aria-label={`${bracketContext.resolveSlot(match.teamAId)} score`}>
                        {[...bracketScoreOptions].reverse().map((score) => (
                          <button
                            key={`${match.id}-scoreA-${score}`}
                            type="button"
                            className={`bracket-score-button${match.scoreA === score ? ' selected' : ''}`}
                            aria-pressed={match.scoreA === score}
                            onClick={() => updateBracketScore(match.id, 'scoreA', score)}
                          >
                            {score}
                          </button>
                        ))}
                      </div>
                      <div className="bracket-score-divider" aria-hidden="true" />
                      <div className="bracket-score-options" role="radiogroup" aria-label={`${bracketContext.resolveSlot(match.teamBId)} score`}>
                        {bracketScoreOptions.map((score) => (
                          <button
                            key={`${match.id}-scoreB-${score}`}
                            type="button"
                            className={`bracket-score-button${match.scoreB === score ? ' selected' : ''}`}
                            aria-pressed={match.scoreB === score}
                            onClick={() => updateBracketScore(match.id, 'scoreB', score)}
                          >
                            {score}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="bracket-report-team">{bracketContext.resolveSlot(match.teamBId)}</div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <section className="board-shell">
          <div className="board-header">
            <div>
              <p className="panel-kicker">Match Day Board</p>
              <h2>Championship Bracket</h2>
            </div>
            <p className="panel-note">Pool standings, live bracket, and final placements.</p>
          </div>

          <div className="tournament-board">
            <aside className="board-sidebar">
              <section className="board-block">
                <div className="subheader">
                  <h3>Pool Standings</h3>
                  <span>Round Robin</span>
                </div>

                <div className="board-pools">
                  {(['poolA', 'poolB'] as PoolKey[]).map((poolKey) => (
                    <section className="pool-card compact-pool" key={`${poolKey}-table`}>
                      <div className="subheader">
                        <h3>{poolKey === 'poolA' ? 'Pool A' : 'Pool B'}</h3>
                        <span>3 teams</span>
                      </div>
                      <table className="standings-table compact-table">
                        <thead>
                          <tr>
                            <th>Team</th>
                            <th>W-L-T</th>
                            <th>Sets</th>
                            <th>Pts</th>
                          </tr>
                        </thead>
                        <tbody>
                          {poolStandings[poolKey].map((team, index) => (
                            <tr key={team.teamId}>
                              <td>
                                {index === 0 ? <strong>{team.name}</strong> : team.name}
                              </td>
                              <td>
                                {team.wins}-{team.losses}-{team.ties}
                              </td>
                              <td>
                                {team.setsWon}-{team.setsLost}
                              </td>
                              <td>{team.pointsFor}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </section>
                  ))}
                </div>
              </section>

              <section className="board-block">
                <div className="subheader">
                  <h3>Podium Watch</h3>
                  <span>Final Placings</span>
                </div>

                <div className="results-stack">
                  <div>
                    <span>Champion</span>
                    <strong>{placements.champion ?? 'TBD'}</strong>
                  </div>
                  <div>
                    <span>Runner-Up</span>
                    <strong>{placements.runnerUp ?? 'TBD'}</strong>
                  </div>
                  <div>
                    <span>Third</span>
                    <strong>{placements.third ?? 'TBD'}</strong>
                  </div>
                </div>
              </section>
            </aside>

            <section className="board-bracket">
              <BracketGraphic
                bracketMatches={bracketMatches}
                resolveSlot={bracketContext.resolveSlot}
              />
            </section>
          </div>
        </section>
      )}
    </main>
  )
}

function BracketGraphic({
  bracketMatches,
  resolveSlot,
}: {
  bracketMatches: Match[]
  resolveSlot: (slotId: string) => string
}) {
  const quarterfinals = bracketMatches.filter((match) => match.stage === 'Quarterfinal')
  const semifinals = bracketMatches.filter((match) => match.stage === 'Semifinal')
  const finals = bracketMatches.filter((match) => match.stage === 'Final')
  const consolation = bracketMatches.filter((match) => match.stage === 'Consolation')
  const placements = bracketMatches.filter((match) => match.stage === 'Placement')

  return (
    <div className="graphic-board">
      <section className="graphic-section">
        <div className="graphic-section-title">Gold Medal Bracket</div>
        <div className="graphic-bracket winners-layout">
          <div className="graphic-round quarterfinals">
            <div className="graphic-round-title">Quarterfinals</div>
            <div className="graphic-round-matches">
              {quarterfinals.map((match) => (
                <GraphicMatch
                  key={match.id}
                  match={match}
                  resolveSlot={resolveSlot}
                />
              ))}
            </div>
          </div>

          <div className="graphic-round semifinals">
            <div className="graphic-round-title">Semifinals</div>
            <div className="graphic-round-matches">
              {semifinals.map((match) => (
                <GraphicMatch
                  key={match.id}
                  match={match}
                  resolveSlot={resolveSlot}
                />
              ))}
            </div>
          </div>

          <div className="graphic-round finals">
            <div className="graphic-round-title">Championship</div>
            <div className="graphic-round-matches">
              {finals.map((match) => (
                <GraphicMatch
                  key={match.id}
                  match={match}
                  resolveSlot={resolveSlot}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="graphic-section">
        <div className="graphic-section-title">Bronze Medal Bracket</div>
        <div className="graphic-bracket losers-layout">
          <div className="graphic-round consolation">
            <div className="graphic-round-title">Consolation Semifinals</div>
            <div className="graphic-round-matches">
              {consolation.map((match) => (
                <GraphicMatch
                  key={match.id}
                  match={match}
                  resolveSlot={resolveSlot}
                />
              ))}
            </div>
          </div>

          <div className="graphic-round placement">
            <div className="graphic-round-title">Placement Matches</div>
            <div className="graphic-round-matches">
              {placements.map((match) => (
                <GraphicMatch
                  key={match.id}
                  match={match}
                  resolveSlot={resolveSlot}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function GraphicMatch({
  match,
  resolveSlot,
}: {
  match: Match
  resolveSlot: (slotId: string) => string
}) {
  return (
    <article className={`graphic-match match-${match.id}`}>
      <div className="graphic-match-label">{match.label}</div>
      <div className="graphic-team">
        <span>{resolveSlot(match.teamAId)}</span>
        <strong>{match.scoreA || '-'}</strong>
      </div>
      <div className="graphic-team">
        <span>{resolveSlot(match.teamBId)}</span>
        <strong>{match.scoreB || '-'}</strong>
      </div>
    </article>
  )
}

function sanitizeScore(value: string) {
  return value.replace(/[^0-9]/g, '')
}

function describePoolMatch(match: PoolMatch, teamNames: Record<string, string>) {
  return `${teamNames[match.teamAId]} vs ${teamNames[match.teamBId]}`
}

function getPageFromHash() {
  return window.location.hash === '#/reporting' ? 'reporting' : 'bracket'
}

export default App
