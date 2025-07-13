import React, { useEffect, useState } from "react";
import * as Tone from "tone";
import "./App.css"; // for CSS styles below

type TrackName = "bass" | "drums" | "other" | "vocals";

function App() {
  const [players, setPlayers] = useState<Tone.Players | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [muteStates, setMuteStates] = useState<Record<TrackName, boolean>>({
    bass: false,
    drums: false,
    other: false,
    vocals: false,
  });

  // Initialize Tone.Players on mount
  useEffect(() => {
    const playerMap: Record<TrackName, string> = {
      bass: "/stems/this_love/bass.wav",
      drums: "/stems/this_love/drums.wav",
      other: "/stems/this_love/other.wav",
      vocals: "/stems/this_love/vocals.wav",
    };

    const loadedPlayers = new Tone.Players(playerMap, () => {
      console.log("All tracks loaded!");
    }).toDestination();

    setPlayers(loadedPlayers);
  }, []);

  const handlePlay = async () => {
    if (!players) return;

    await Tone.start(); // Required on user gesture to unlock audio

    players.stopAll(); // Ensure no overlaps

    players.player("bass").start(0);
    players.player("drums").start(0);
    players.player("other").start(0);
    players.player("vocals").start(0);

    setIsPlaying(true);
  };

  const handleStop = () => {
    if (!players) return;

    players.stopAll();
    setIsPlaying(false);
  };

  const toggleMute = (track: TrackName) => {
    if (!players) return;

    const newMuteState = !muteStates[track];
    players.player(track).mute = newMuteState;

    setMuteStates((prev) => ({
      ...prev,
      [track]: newMuteState,
    }));
  };

  return (
    <div>
      <h1>Multi-Track Stem Player</h1>

      {!isPlaying ? (
        <button onClick={handlePlay}>Play All</button>
      ) : (
        <button onClick={handleStop}>Stop All</button>
      )}

      <div>
        <h2>Tracks</h2>
        {(["bass", "drums", "other", "vocals"] as TrackName[]).map((track) => (
          <div key={track} className="track-container">
            <span className={muteStates[track] ? "muted" : ""}>{track}</span>
            <button onClick={() => toggleMute(track)}>
              {muteStates[track] ? "Unmute" : "Mute"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
