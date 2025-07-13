import React, { useEffect, useState } from "react";
import * as Tone from "tone";
import { SoundTouch, SimpleFilter, getWebAudioNode, WebAudioBufferSource } from "soundtouchjs";

type TrackName = "bass" | "drums" | "other" | "vocals";

type TrackState = {
  buffer: AudioBuffer | null;
  processedBuffer: AudioBuffer | null;
  muted: boolean;
};

const BASE_BPM = 95; // replace with the original tempo of your track

const INITIAL_TRACKS: Record<TrackName, TrackState> = {
  bass: { buffer: null, processedBuffer: null, muted: false },
  drums: { buffer: null, processedBuffer: null, muted: false },
  other: { buffer: null, processedBuffer: null, muted: false },
  vocals: { buffer: null, processedBuffer: null, muted: false },
};

const App: React.FC = () => {
  const [audioCtx] = useState(new AudioContext());
  const [tracks, setTracks] = useState(INITIAL_TRACKS);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(BASE_BPM);
  const [pitchSemitones, setPitchSemitones] = useState(0);

  const [sources, setSources] = useState<AudioBufferSourceNode[]>([]);

  // Load all audio buffers on mount
  useEffect(() => {
    const loadBuffers = async () => {
      setIsLoading(true);
      const newTracks = { ...INITIAL_TRACKS };

      for (const track of Object.keys(newTracks) as TrackName[]) {
        const response = await fetch(`/stems/this_love/${track}.wav`);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

        newTracks[track].buffer = audioBuffer;
        newTracks[track].processedBuffer = audioBuffer; // Initially same as original
      }

      setTracks(newTracks);
      setIsLoading(false);
    };

    loadBuffers();
  }, [audioCtx]);

  const processAllTracks = async () => {
    setIsProcessing(true);
    const newTracks = { ...tracks };

    for (const track of Object.keys(newTracks) as TrackName[]) {
      const originalBuffer = newTracks[track].buffer;
      if (!originalBuffer) continue;

      const soundTouch = new SoundTouch(originalBuffer.sampleRate);

      const tempoRatio = bpm / BASE_BPM;
      soundTouch.tempo = tempoRatio;

      const pitchRatio = Math.pow(2, pitchSemitones / 12);
      soundTouch.pitch = pitchRatio;

      const filter = new SimpleFilter(new WebAudioBufferSource(originalBuffer), soundTouch);

      // Create offline context to render processed buffer
      const offlineCtx = new OfflineAudioContext(
        originalBuffer.numberOfChannels,
        originalBuffer.length,
        originalBuffer.sampleRate
      );

      const node = getWebAudioNode(offlineCtx, filter);
      node.connect(offlineCtx.destination);

      const renderedBuffer = await offlineCtx.startRendering();
      newTracks[track].processedBuffer = renderedBuffer;
    }

    setTracks(newTracks);
    setIsProcessing(false);
  };

  const handlePlay = async () => {
    if (isPlaying) return;

    await Tone.start(); // Unlock audio on user gesture

    const newSources: AudioBufferSourceNode[] = [];
    const now = audioCtx.currentTime;

    for (const track of Object.keys(tracks) as TrackName[]) {
      const trackData = tracks[track];
      if (!trackData.processedBuffer) continue;

      const source = audioCtx.createBufferSource();
      source.buffer = trackData.processedBuffer;
      source.connect(trackData.muted ? audioCtx.createGain() : audioCtx.destination);
      source.start(now);
      newSources.push(source);
    }

    setSources(newSources);
    setIsPlaying(true);
  };

  const handleStop = () => {
    sources.forEach((source) => {
      source.stop();
    });
    setSources([]);
    setIsPlaying(false);
  };

  const toggleMute = (track: TrackName) => {
    setTracks((prev) => ({
      ...prev,
      [track]: {
        ...prev[track],
        muted: !prev[track].muted,
      },
    }));
  };

  return (
    <div>
      <h1>Multi-Track Player with Tempo & Pitch</h1>

      {isLoading ? (
        <p>Loading tracks...</p>
      ) : isProcessing ? (
        <p>Processing tempo/pitch...</p>
      ) : (
        <>
          <div>
            <label>Tempo (BPM): </label>
            <input
              type="range"
              min={BASE_BPM - 50}
              max={BASE_BPM + 50}
              step={1}
              value={bpm}
              onChange={(e) => setBpm(parseInt(e.target.value))}
            />
            <span>{bpm} BPM</span>
          </div>

          <div>
            <label>Pitch (semitones): </label>
            <input
              type="range"
              min={-12}
              max={12}
              step={1}
              value={pitchSemitones}
              onChange={(e) => setPitchSemitones(parseInt(e.target.value))}
            />
            <span>{pitchSemitones >= 0 ? `+${pitchSemitones}` : pitchSemitones} semitones</span>
          </div>

          <button onClick={processAllTracks}>Apply Tempo/Pitch</button>

          {!isPlaying ? (
            <button onClick={handlePlay} disabled={isProcessing}>
              Play All
            </button>
          ) : (
            <button onClick={handleStop}>Stop All</button>
          )}

          <h2>Tracks</h2>
          {(Object.keys(tracks) as TrackName[]).map((trackName) => {
            const track = tracks[trackName as TrackName];
            return (
              <div key={trackName}>
                <span style={{ opacity: track.muted ? 0.5 : 1 }}>{trackName}</span>
                <button onClick={() => toggleMute(trackName as TrackName)}>{track.muted ? "Unmute" : "Mute"}</button>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
};

export default App;
