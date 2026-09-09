"use client";

import { useState, useMemo } from "react";

type Fight = { id: number; name: string; difficulty: number; kill: boolean };
type Player = { id: number; name: string };
type ArcaneMageState = {
  clearcastingStacks: number;
  hasPrismaticBolt: boolean;
  hasOverpoweredMissile: boolean;
  arcaneCharges: number;
  arcaneSalvo: number;
  inArcaneSoul: boolean;
  midCastArcaneBlastWithNewCC: boolean;
  previousCast: string | null;
};
type AnalysisResult = {
  timestamp: number;
  actualCast: string;
  icon: string | null;
  recommendedCast: string | null;
  reason: string;
  correct: boolean | null;
  graded: boolean;
  state: ArcaneMageState;
};
type AnalysisResponse = {
  totalCasts: number;
  gradedCasts: number;
  correctCasts: number;
  accuracy: number | null;
  results: AnalysisResult[];
};

type ListFilter = "all" | "mistakes";

const ROTATION_ORDER = [
  "Arcane Barrage",
  "Arcane Missiles",
  "Prismatic Bolt",
  "Arcane Blast",
  "Arcane Orb",
];

export default function Home() {
  const [reportInput, setReportInput] = useState("");
  const [reportCode, setReportCode] = useState<string | null>(null);
  const [fights, setFights] = useState<Fight[]>([]);
  const [selectedFight, setSelectedFight] = useState<number | null>(null);
  const [fightPickerOpen, setFightPickerOpen] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [listFilter, setListFilter] = useState<ListFilter>("all");

  function extractCode(input: string): string {
    const match = input.match(/reports\/([a-zA-Z0-9]+)/);
    return match ? match[1] : input.trim();
  }

  function extractFightId(input: string): number | null {
    const match = input.match(/[?&]fight=(\d+)/);
    return match ? Number(match[1]) : null;
  }

  async function loadReport() {
    setLoading(true);
    const code = extractCode(reportInput);
    const fightIdFromUrl = extractFightId(reportInput);
    setReportCode(code);

    const res = await fetch(`/api/report/${code}`);
    const data = await res.json();
    setFights(data.fights ?? []);
    setPlayers([]);
    setSelectedPlayer(null);
    setAnalysis(null);
    setSelectedIndex(null);
    setListFilter("all");

    if (fightIdFromUrl) {
      setSelectedFight(fightIdFromUrl);
      setFightPickerOpen(false);
      const playersRes = await fetch(`/api/report/${code}/players?fightID=${fightIdFromUrl}`);
      const playersData = await playersRes.json();
      setPlayers(playersData.players ?? []);
    } else {
      setSelectedFight(null);
      setFightPickerOpen(true);
    }

    setLoading(false);
  }

  async function loadPlayers(fightID: number) {
    setLoading(true);
    setSelectedFight(fightID);
    setFightPickerOpen(false);
    const res = await fetch(`/api/report/${reportCode}/players?fightID=${fightID}`);
    const data = await res.json();
    setPlayers(data.players ?? []);
    setSelectedPlayer(null);
    setAnalysis(null);
    setSelectedIndex(null);
    setListFilter("all");
    setLoading(false);
  }

  async function runAnalysis(sourceID: number) {
    setLoading(true);
    setSelectedPlayer(sourceID);
    setSelectedIndex(null);
    setListFilter("all");
    const res = await fetch(
      `/api/analyze/${reportCode}?fightID=${selectedFight}&sourceID=${sourceID}`
    );
    const data = await res.json();
    setAnalysis(data);
    setLoading(false);
  }

  function formatTime(ts: number, fightStartTs: number) {
    const totalSeconds = Math.floor((ts - fightStartTs) / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  }

  const accuracyPct =
    analysis?.accuracy != null ? Math.round(analysis.accuracy * 100) : null;
  const fightStartTs = analysis?.results?.[0]?.timestamp ?? 0;
  const fightEndTs = analysis?.results?.[analysis.results.length - 1]?.timestamp ?? 1;
  const fightDuration = Math.max(1, fightEndTs - fightStartTs);

  const accuracyColor =
    accuracyPct === null
      ? "text-gray-400"
      : accuracyPct >= 80
      ? "text-emerald-400"
      : accuracyPct >= 60
      ? "text-amber-400"
      : "text-red-400";

  const currentFight = fights.find((f) => f.id === selectedFight) ?? null;
  const selected = selectedIndex !== null ? analysis?.results[selectedIndex] : null;

  const timelineWidth = analysis ? Math.max(1200, analysis.results.length * 8) : 1200;

  const visibleResults =
    analysis?.results
      .map((r, i) => ({ ...r, _i: i }))
      .filter((r) => (listFilter === "mistakes" ? r.graded && !r.correct : true)) ?? [];

  // Group casts into per-ability lanes for the swim-lane timeline
  const lanes = useMemo(() => {
    if (!analysis) return [];
    const byName = new Map<string, { icon: string | null; casts: (AnalysisResult & { _i: number })[] }>();

    analysis.results.forEach((r, i) => {
      if (!byName.has(r.actualCast)) {
        byName.set(r.actualCast, { icon: r.icon, casts: [] });
      }
      byName.get(r.actualCast)!.casts.push({ ...r, _i: i });
    });

    const entries = Array.from(byName.entries());
    entries.sort((a, b) => {
      const ai = ROTATION_ORDER.indexOf(a[0]);
      const bi = ROTATION_ORDER.indexOf(b[0]);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return b[1].casts.length - a[1].casts.length;
    });

    return entries;
  }, [analysis]);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <header className="mb-10">
          <h1 className="text-2xl font-semibold tracking-tight">WCL Rotation Analyzer</h1>
          <p className="text-neutral-500 text-sm mt-1">
            Paste a WarcraftLogs report to check your rotation against the priority list.
          </p>
        </header>

        <div className="flex gap-2 mb-10">
          <input
            className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-2.5 text-sm placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            placeholder="https://www.warcraftlogs.com/reports/..."
            value={reportInput}
            onChange={(e) => setReportInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadReport()}
          />
          <button
            onClick={loadReport}
            className="bg-sky-500 hover:bg-sky-400 transition-colors text-neutral-950 font-medium text-sm px-5 py-2.5 rounded-lg"
          >
            Load
          </button>
        </div>

        {fights.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xs uppercase tracking-wider text-neutral-500 font-medium mb-3">
              Fight
            </h2>

            {!fightPickerOpen && currentFight ? (
              <button
                onClick={() => setFightPickerOpen(true)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-neutral-800 bg-neutral-900 hover:border-neutral-700 transition-colors text-sm"
              >
                <span className="flex items-center gap-2">
                  <span>{currentFight.kill ? "✅" : "💀"}</span>
                  <span className="font-medium text-neutral-200">{currentFight.name}</span>
                  <span className="text-neutral-600 text-xs">#{currentFight.id}</span>
                </span>
                <span className="text-neutral-500 text-xs">Change ▾</span>
              </button>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
                {fights.map((f) => {
                  const isSelected = selectedFight === f.id;
                  return (
                    <button
                      key={f.id}
                      onClick={() => loadPlayers(f.id)}
                      className={`text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                        isSelected
                          ? "border-sky-500 bg-sky-500/10 text-sky-300"
                          : "border-neutral-800 bg-neutral-900 hover:border-neutral-700 text-neutral-300"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate">{f.name}</span>
                        <span className="ml-2">{f.kill ? "✅" : "💀"}</span>
                      </div>
                      <div className="text-neutral-600 text-xs mt-0.5">Fight #{f.id}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {players.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xs uppercase tracking-wider text-neutral-500 font-medium mb-3">
              Select a player
            </h2>
            <div className="flex flex-wrap gap-2">
              {players.map((p) => {
                const isSelected = selectedPlayer === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => runAnalysis(p.id)}
                    className={`px-4 py-2 rounded-full border text-sm font-medium transition-colors ${
                      isSelected
                        ? "border-sky-500 bg-sky-500/10 text-sky-300"
                        : "border-neutral-800 bg-neutral-900 hover:border-neutral-700 text-neutral-300"
                    }`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {loading && (
          <div className="text-neutral-500 text-sm animate-pulse">Loading…</div>
        )}

        {analysis && !loading && (
          <section>
            <div className="grid grid-cols-4 gap-3 mb-8">
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                <div className={`text-3xl font-bold ${accuracyColor}`}>
                  {accuracyPct !== null ? `${accuracyPct}%` : "—"}
                </div>
                <div className="text-neutral-500 text-xs mt-1">Accuracy</div>
              </div>
              <button
                onClick={() => setListFilter("all")}
                className={`text-left bg-neutral-900 border rounded-xl p-4 transition-colors ${
                  listFilter === "all" ? "border-sky-500" : "border-neutral-800 hover:border-neutral-700"
                }`}
              >
                <div className="text-3xl font-bold text-neutral-200">{analysis.gradedCasts}</div>
                <div className="text-neutral-500 text-xs mt-1">Graded Casts</div>
              </button>
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                <div className="text-3xl font-bold text-emerald-400">{analysis.correctCasts}</div>
                <div className="text-neutral-500 text-xs mt-1">Correct</div>
              </div>
              <button
                onClick={() => setListFilter("mistakes")}
                className={`text-left bg-neutral-900 border rounded-xl p-4 transition-colors ${
                  listFilter === "mistakes" ? "border-red-500" : "border-neutral-800 hover:border-neutral-700"
                }`}
              >
                <div className="text-3xl font-bold text-red-400">
                  {analysis.gradedCasts - analysis.correctCasts}
                </div>
                <div className="text-neutral-500 text-xs mt-1">Mistakes</div>
              </button>
            </div>

            {/* SWIM-LANE TIMELINE */}
            <h2 className="text-xs uppercase tracking-wider text-neutral-500 font-medium mb-3">
              Timeline
            </h2>
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 mb-3 overflow-x-auto">
              <div style={{ minWidth: timelineWidth }}>
                {lanes.map(([name, lane]) => (
                  <div key={name} className="flex items-center h-9 border-b border-neutral-800/60 last:border-b-0">
                    <div className="w-40 flex-shrink-0 flex items-center gap-2 pr-3 sticky left-0 bg-neutral-900">
                      {lane.icon && (
                        <img
                          src={lane.icon}
                          alt={name}
                          className="w-5 h-5 rounded-sm border border-neutral-700"
                        />
                      )}
                      <span className="text-xs text-neutral-400 truncate">{name}</span>
                    </div>
                    <div className="relative flex-1 h-full">
                      {lane.casts.map((c) => {
                        const pct = ((c.timestamp - fightStartTs) / fightDuration) * 100;
                        const isCorrect = c.graded && c.correct;
                        const isWrong = c.graded && !c.correct;
                        const isSelected = selectedIndex === c._i;

                        let ring = "border-neutral-700";
                        if (isCorrect) ring = "border-emerald-500";
                        if (isWrong) ring = "border-red-500";

                        return (
                          <button
                            key={c._i}
                            onClick={() => setSelectedIndex(c._i)}
                            title={`${formatTime(c.timestamp, fightStartTs)} — ${c.actualCast}`}
                            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-sm border-2 ${ring} ${
                              isSelected ? "ring-2 ring-white scale-150 z-10" : "hover:scale-125"
                            } transition-transform`}
                            style={{
                              left: `${pct}%`,
                              backgroundImage: c.icon ? `url(${c.icon})` : undefined,
                              backgroundSize: "cover",
                              backgroundColor: c.icon ? undefined : "#333",
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-neutral-600 text-xs mt-3">
                <span>0:00</span>
                <span>{formatTime(fightEndTs, fightStartTs)}</span>
              </div>
            </div>
            <p className="text-neutral-600 text-xs mb-8">
              Green border = correct, red border = mistake, gray = not graded. Click an icon for details.
            </p>

            {/* SELECTED CAST DETAIL PANEL */}
            {selected && (
              <div className="bg-neutral-900 border border-sky-500/40 rounded-xl p-4 mb-8 text-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-neutral-100 flex items-center gap-2">
                    {selected.icon && (
                      <img src={selected.icon} alt="" className="w-6 h-6 rounded-sm border border-neutral-700" />
                    )}
                    {formatTime(selected.timestamp, fightStartTs)} — {selected.actualCast}
                  </div>
                  <button
                    onClick={() => setSelectedIndex(null)}
                    className="text-neutral-500 hover:text-neutral-300 text-xs"
                  >
                    ✕ close
                  </button>
                </div>
                <div className="text-neutral-400 mb-3">{selected.reason}</div>
                {selected.graded && !selected.correct && selected.recommendedCast && (
                  <div className="text-red-400 mb-3">
                    Expected: <span className="font-medium">{selected.recommendedCast}</span>
                  </div>
                )}
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 text-xs">
                  <StatePill label="Clearcasting" value={selected.state.clearcastingStacks} />
                  <StatePill label="Arcane Salvo" value={selected.state.arcaneSalvo} />
                  <StatePill label="Arcane Charges" value={selected.state.arcaneCharges} />
                  <StatePill label="Prismatic Bolt" value={selected.state.hasPrismaticBolt} />
                  <StatePill label="Overpowered Missile" value={selected.state.hasOverpoweredMissile} />
                  <StatePill label="Arcane Soul" value={selected.state.inArcaneSoul} />
                  <StatePill label="Previous Cast" value={selected.state.previousCast ?? "—"} />
                </div>
              </div>
            )}

            {/* CAST LIST */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs uppercase tracking-wider text-neutral-500 font-medium">
                Cast-by-cast breakdown
              </h2>
              <div className="flex gap-1">
                <button
                  onClick={() => setListFilter("all")}
                  className={`text-xs px-2.5 py-1 rounded-md ${
                    listFilter === "all"
                      ? "bg-sky-500/10 text-sky-300 border border-sky-500/40"
                      : "text-neutral-500 border border-transparent hover:text-neutral-300"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setListFilter("mistakes")}
                  className={`text-xs px-2.5 py-1 rounded-md ${
                    listFilter === "mistakes"
                      ? "bg-red-500/10 text-red-300 border border-red-500/40"
                      : "text-neutral-500 border border-transparent hover:text-neutral-300"
                  }`}
                >
                  Mistakes only
                </button>
              </div>
            </div>
            <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1">
              {visibleResults.map((r) => {
                const isCorrect = r.graded && r.correct;
                const isWrong = r.graded && !r.correct;
                const isSelected = selectedIndex === r._i;

                return (
                  <button
                    key={r._i}
                    onClick={() => setSelectedIndex(r._i)}
                    className={`w-full text-left px-4 py-2.5 rounded-lg border-l-2 text-sm transition-colors flex items-start gap-2 ${
                      isSelected ? "ring-1 ring-sky-500" : ""
                    } ${
                      isCorrect
                        ? "bg-emerald-500/5 border-emerald-500"
                        : isWrong
                        ? "bg-red-500/5 border-red-500"
                        : "bg-neutral-900/50 border-neutral-800"
                    }`}
                  >
                    {r.icon && (
                      <img src={r.icon} alt="" className="w-5 h-5 rounded-sm border border-neutral-700 mt-0.5" />
                    )}
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-neutral-500 text-xs font-mono">
                          {formatTime(r.timestamp, fightStartTs)}
                        </span>
                        <span className="font-medium text-neutral-200">{r.actualCast}</span>
                        {isWrong && r.recommendedCast && (
                          <span className="text-red-400 text-xs">
                            expected {r.recommendedCast}
                          </span>
                        )}
                      </div>
                      <div className="text-neutral-600 text-xs mt-0.5">{r.reason}</div>
                    </div>
                  </button>
                );
              })}
              {visibleResults.length === 0 && (
                <div className="text-neutral-600 text-sm py-6 text-center">No results to show.</div>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function StatePill({ label, value }: { label: string; value: string | number | boolean }) {
  const display = typeof value === "boolean" ? (value ? "Yes" : "No") : value;
  return (
    <div className="bg-neutral-800/60 rounded-lg px-2.5 py-1.5">
      <div className="text-neutral-500">{label}</div>
      <div className="text-neutral-200 font-medium">{display}</div>
    </div>
  );
}