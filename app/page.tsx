"use client";

import { useState } from "react";

type Fight = { id: number; name: string; difficulty: number; kill: boolean };
type Player = { id: number; name: string };

export default function Home() {
  const [reportInput, setReportInput] = useState("");
  const [reportCode, setReportCode] = useState<string | null>(null);
  const [fights, setFights] = useState<Fight[]>([]);
  const [selectedFight, setSelectedFight] = useState<number | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

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
    setEvents([]);

    if (fightIdFromUrl) {
      setSelectedFight(fightIdFromUrl);
      const playersRes = await fetch(`/api/report/${code}/players?fightID=${fightIdFromUrl}`);
      const playersData = await playersRes.json();
      setPlayers(playersData.players ?? []);
    } else {
      setSelectedFight(null);
    }

    setLoading(false);
  }

  async function loadPlayers(fightID: number) {
    setLoading(true);
    setSelectedFight(fightID);
    const res = await fetch(`/api/report/${reportCode}/players?fightID=${fightID}`);
    const data = await res.json();
    setPlayers(data.players ?? []);
    setSelectedPlayer(null);
    setEvents([]);
    setLoading(false);
  }

  async function loadEvents(sourceID: number) {
    setLoading(true);
    setSelectedPlayer(sourceID);
    const res = await fetch(
      `/api/events/${reportCode}?fightID=${selectedFight}&sourceID=${sourceID}`
    );
    const data = await res.json();
    setEvents(data.events ?? []);
    setLoading(false);
  }

  return (
    <main style={{ padding: 32, maxWidth: 800, margin: "0 auto" }}>
      <h1>WCL Rotation Analyzer</h1>

      <div style={{ marginBottom: 24 }}>
        <input
          style={{ width: "70%", padding: 8 }}
          placeholder="Paste WarcraftLogs report link or code"
          value={reportInput}
          onChange={(e) => setReportInput(e.target.value)}
        />
        <button onClick={loadReport} style={{ padding: 8, marginLeft: 8 }}>
          Load Report
        </button>
      </div>

      {fights.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2>Pick a fight</h2>
          <ul>
            {fights.map((f) => (
              <li key={f.id}>
                <button onClick={() => loadPlayers(f.id)}>
                  {f.name} {f.kill ? "(Kill)" : "(Wipe)"} — Fight {f.id}
                  {selectedFight === f.id ? " ✅" : ""}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {players.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2>Pick a player</h2>
          <ul>
            {players.map((p) => (
              <li key={p.id}>
                <button onClick={() => loadEvents(p.id)}>{p.name}</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading && <p>Loading...</p>}

      {events.length > 0 && (
        <div>
          <h2>Events ({events.length})</h2>
          <div style={{ maxHeight: 500, overflowY: "auto", fontFamily: "monospace", fontSize: 12 }}>
            {events.map((e, i) => (
              <div key={i}>
                [{e.timestamp}] {e.type} — {e.abilityName ?? e.abilityGameID}
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}