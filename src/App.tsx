import React, { useEffect, useState } from "react";
import * as Tone from "tone";
import { SoundTouch, SimpleFilter, getWebAudioNode, WebAudioBufferSource } from "soundtouchjs";

type Song = {
  title: string;
  artist: string;
  key: string;
  tempo: number;
};

type TrackName = "bass" | "drums" | "other" | "vocals";

type TrackState = {
  buffer: AudioBuffer | null;
  processedBuffer: AudioBuffer | null;
  muted: boolean;
};

const BASE_BPM = 100;

const INITIAL_TRACKS: Record<TrackName, TrackState> = {
  bass: { buffer: null, processedBuffer: null, muted: false },
  drums: { buffer: null, processedBuffer: null, muted: false },
  other: { buffer: null, processedBuffer: null, muted: false },
  vocals: { buffer: null, processedBuffer: null, muted: false },
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const App: React.FC = () => {
  const [library, setLibrary] = useState<Song[]>([]);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [audioCtx] = useState(new AudioContext());
  const [tracks, setTracks] = useState(INITIAL_TRACKS);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [baseBpm, setBaseBpm] = useState(BASE_BPM);
  const [bpm, setBpm] = useState<number>(BASE_BPM);
  const [pitchSemitones, setPitchSemitones] = useState(0);
  const [sources, setSources] = useState<AudioBufferSourceNode[]>([]);
  const [lastProcessedBpm, setLastProcessedBpm] = useState<number | null>(null);
  const [lastProcessedPitch, setLastProcessedPitch] = useState<number>(0);

  useEffect(() => {
    const loadLibrary = async () => {
      const response = await fetch("/library.json");
      const data = await response.json();
      setLibrary(data.songs);
    };
    loadLibrary();
  }, []);

  useEffect(() => {
    if (selectedSong) {
      setBpm(selectedSong.tempo);
    }
  }, [selectedSong]);

  useEffect(() => {
    if (selectedSong) {
      setBpm(selectedSong.tempo);
      setBaseBpm(selectedSong.tempo);
    }
  }, [selectedSong]);

  const loadBuffers = async (song: Song) => {
    setIsLoading(true);
    const newTracks = { ...INITIAL_TRACKS };

    const artistEncoded = encodeURIComponent(song.artist);
    const titleEncoded = encodeURIComponent(song.title);

    for (const track of Object.keys(newTracks) as TrackName[]) {
      const response = await fetch(`/stems/${artistEncoded}/${titleEncoded}/${track}.mp3`);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      newTracks[track].buffer = audioBuffer;
      newTracks[track].processedBuffer = audioBuffer; // Initially same as original
    }

    setTracks(newTracks);
    setLastProcessedBpm(song.tempo);
    setLastProcessedPitch(0);
    setIsLoading(false);

    // 🔧 WORKAROUND: auto-play after loading
    setTimeout(() => {
      handlePlay();
    }, 0);
  };

  const processAllTracks = async () => {
    setIsProcessing(true);
    const newTracks = { ...tracks };

    for (const track of Object.keys(newTracks) as TrackName[]) {
      const originalBuffer = newTracks[track].buffer;
      if (!originalBuffer) continue;

      const soundTouch = new SoundTouch(originalBuffer.sampleRate);

      const tempoRatio = bpm / baseBpm;
      soundTouch.tempo = tempoRatio;

      const pitchRatio = Math.pow(2, pitchSemitones / 12);
      soundTouch.pitch = pitchRatio;

      const filter = new SimpleFilter(new WebAudioBufferSource(originalBuffer), soundTouch);

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
    setLastProcessedBpm(bpm);
    setLastProcessedPitch(pitchSemitones);
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

  const handlePlayClick = async () => {
    // Stop if already playing
    if (isPlaying) {
      handleStop();
      return;
    }

    // Determine if processing is required
    const needsProcessing =
      lastProcessedBpm === null || bpm !== lastProcessedBpm || pitchSemitones !== lastProcessedPitch;

    if (needsProcessing) {
      await processAllTracks();
    }

    handlePlay();
  };

  const handleStop = () => {
    sources.forEach((source) => {
      source.stop();
    });
    setSources([]);
    setIsPlaying(false);
  };

  const toggleMute = (track: TrackName) => {
    if (isPlaying) {
      handleStop();
    }

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
      <nav className="navbar navbar-dark bg-dark">
        <div className="container">
          <a className="navbar-brand" href="/">
            rehearse
          </a>
        </div>
      </nav>
      <main className="container px-4 py-5">
        <form>
          <div className="mb-3">
            <label className="form-label">Song</label>
            <select
              className="form-control"
              value={selectedSong ? `${selectedSong.artist}-${selectedSong.title}` : ""}
              onChange={(e) => {
                const [artist, title] = e.target.value.split("-");
                const song = library.find((s) => s.artist === artist && s.title === title);
                if (song) {
                  setSelectedSong(song);
                  loadBuffers(song);
                }
              }}
              disabled={isProcessing || isLoading}
            >
              <option>-- Select a song --</option>
              {library.map((song) => (
                <option key={`${song.artist}-${song.title}`} value={`${song.artist}-${song.title}`}>
                  {song.title} by {song.artist}
                </option>
              ))}
            </select>
          </div>

          {selectedSong === null ? (
            <p>Please select a song to begin.</p>
          ) : isLoading ? (
            <p>Loading tracks...</p>
          ) : (
            <>
              <div className="mb-3">
                <label className="form-label">Tempo</label>
                <input
                  className="form-range"
                  type="range"
                  min={baseBpm - 50}
                  max={baseBpm + 50}
                  step={1}
                  value={bpm}
                  onChange={(e) => {
                    if (isPlaying) handleStop();
                    setBpm(parseInt(e.target.value));
                  }}
                  disabled={isProcessing || isLoading}
                />
                <div className="form-text">{bpm} BPM</div>
              </div>
              <div className="mb-3">
                <label className="form-label">Pitch</label>
                <input
                  className="form-range"
                  type="range"
                  min={-12}
                  max={12}
                  step={1}
                  value={pitchSemitones}
                  onChange={(e) => {
                    if (isPlaying) handleStop();
                    setPitchSemitones(parseInt(e.target.value));
                  }}
                  disabled={isProcessing || isLoading}
                />
                <div className="form-text">{pitchSemitones >= 0 ? `+${pitchSemitones}` : pitchSemitones} semitones</div>
              </div>

              <fieldset className="mb-3">
                <legend className="col-form-label pt-0">Tracks</legend>
                {(Object.keys(tracks) as TrackName[]).map((trackName) => {
                  const track = tracks[trackName];
                  return (
                    <div className="form-check form-switch" key={trackName}>
                      <input
                        className="form-check-input"
                        type="checkbox"
                        role="switch"
                        id={`switch-${trackName}`}
                        checked={!track.muted}
                        onChange={() => toggleMute(trackName)}
                        disabled={isProcessing || isLoading}
                      />
                      <label
                        className="form-check-label"
                        htmlFor={`switch-${trackName}`}
                        style={{ opacity: track.muted ? 0.5 : 1 }}
                      >
                        {capitalize(trackName)}
                      </label>
                    </div>
                  );
                })}
              </fieldset>

              <div className="mb-3">
                <button
                  type="button"
                  className={`btn ${isProcessing ? "btn-warning" : isPlaying ? "btn-danger" : "btn-success"}`}
                  onClick={handlePlayClick}
                  disabled={isProcessing || isLoading}
                >
                  {isProcessing ? (
                    <>
                      <i className="bi bi-arrow-repeat spinner-border spinner-border-sm me-2"></i>
                      Processing...
                    </>
                  ) : isPlaying ? (
                    <>
                      <i className="bi bi-stop-fill me-2"></i> Stop
                    </>
                  ) : (
                    <>
                      <i className="bi bi-play-fill me-2"></i> Play
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </form>
      </main>
    </div>
  );
};

export default App;
