'use client';

import { Canvas } from '@react-three/fiber';
import { useProgress } from '@react-three/drei';
import { CSSProperties, KeyboardEvent, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import LunarisScene from './LunarisScene';
import type { LunarisVisualStyle, OrbitDataset, TextureMode } from './types';
import './moon_react_source.css';

export type LunarisInteractivePresetProps = {
  assetBaseUrl?: string;
  orbitData?: OrbitDataset;
  dataKey?: string;
  visualStyle?: LunarisVisualStyle;
  accent?: string;
  initialTextureMode?: TextureMode;
  initialRelief?: number;
  initialSpeed?: number;
  initialPaused?: boolean;
  active?: boolean;
  exportMode?: boolean;
  exportProgress?: number;
  showControls?: boolean;
  className?: string;
  title?: string;
};

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

export default function LunarisInteractivePreset({
  assetBaseUrl = '/lunaris',
  orbitData,
  dataKey = 'path1',
  visualStyle = 'cinematic',
  accent = '#00e5ff',
  initialTextureMode = 'aesthetic',
  initialRelief = .03,
  initialSpeed = 3.5,
  initialPaused = false,
  active = true,
  exportMode,
  exportProgress = .18,
  showControls = true,
  className = '',
  title = 'Lunaris interactive lunar flight',
}: LunarisInteractivePresetProps) {
  const rootRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();
  const { progress: textureProgress } = useProgress();
  const [loadedData, setLoadedData] = useState<OrbitDataset | null>(orbitData ?? null);
  const [loadError, setLoadError] = useState('');
  const [textureMode, setTextureMode] = useState<TextureMode>(initialTextureMode);
  const [relief, setRelief] = useState(initialRelief);
  const [speed, setSpeed] = useState(initialSpeed);
  const [paused, setPaused] = useState(initialPaused);
  const [autoRotate, setAutoRotate] = useState(true);
  const [showPrediction, setShowPrediction] = useState(true);
  const [showTrail, setShowTrail] = useState(true);
  const [showStars, setShowStars] = useState(true);
  const [showBloom, setShowBloom] = useState(true);
  const [restartToken, setRestartToken] = useState(0);
  const [cameraResetToken, setCameraResetToken] = useState(0);
  const [telemetry, setTelemetry] = useState({ index: 150, burning: false });
  const [domExportMode, setDomExportMode] = useState(false);

  useEffect(() => {
    const queryExport = new URLSearchParams(location.search).get('export') === '1';
    setDomExportMode(queryExport || document.documentElement.dataset.export === 'true');
  }, []);

  useEffect(() => {
    if (orbitData) { setLoadedData(orbitData); return; }
    const controller = new AbortController();
    setLoadError('');
    fetch(`${assetBaseUrl}/orbit-data.json`, { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error(`Orbit data returned ${response.status}`);
        return response.json() as Promise<OrbitDataset>;
      })
      .then(setLoadedData)
      .catch(error => { if (error.name !== 'AbortError') setLoadError(error.message); });
    return () => controller.abort();
  }, [assetBaseUrl, orbitData]);

  const finalExportMode = exportMode ?? domExportMode;
  const finalPaused = paused || reducedMotion || finalExportMode || !active;
  const pathData = loadedData?.[dataKey];
  const cinematic = visualStyle === 'cinematic';
  const ready = Boolean(pathData) && textureProgress >= 100;
  const style = { '--lunaris-accent': accent } as CSSProperties;

  const togglePause = () => setPaused(value => !value);
  const restart = () => { setRestartToken(value => value + 1); setPaused(false); };
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement) return;
    if (event.code === 'Space') { event.preventDefault(); togglePause(); }
    if (event.key.toLowerCase() === 'r') restart();
    if (event.key === 'Escape') setPaused(true);
  };
  const requestFullscreen = () => rootRef.current?.requestFullscreen?.();

  return <figure
    ref={rootRef}
    className={`lunaris-preset ${className}`}
    data-style={visualStyle}
    data-export={finalExportMode ? 'true' : 'false'}
    style={style}
    tabIndex={0}
    onKeyDown={onKeyDown}
    aria-label={title}
  >
    <div className="lunaris-preset__canvas" aria-hidden="true">
      {pathData && <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 5], fov: 45 }}
        frameloop={finalPaused ? 'demand' : 'always'}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
        }}
      >
        <color attach="background" args={[cinematic ? '#05050a' : '#f3eec8']} />
        <LunarisScene
          data={pathData}
          assetBaseUrl={assetBaseUrl}
          textureMode={textureMode}
          displacementScale={relief}
          speed={speed}
          paused={finalPaused}
          active={active}
          reducedMotion={reducedMotion}
          exportMode={finalExportMode}
          exportProgress={finalExportMode || reducedMotion ? exportProgress : undefined}
          restartToken={restartToken}
          cameraResetToken={cameraResetToken}
          autoRotate={autoRotate}
          showPrediction={showPrediction}
          showTrail={showTrail}
          showStars={showStars}
          showBloom={showBloom}
          cinematic={cinematic}
          accent={accent}
          onTelemetry={setTelemetry}
        />
      </Canvas>}
    </div>

    <header className="lunaris-preset__heading">
      <span>LUNARIS · INTERACTIVE PRESET</span>
      <h1>{title}</h1>
    </header>

    {!ready && !loadError && <div className="lunaris-preset__loading" role="status">
      Loading lunar assets · {Math.round(textureProgress)}%
    </div>}
    {loadError && <div className="lunaris-preset__loading lunaris-preset__loading--error" role="alert">
      Orbit data could not load: {loadError}
    </div>}

    {showControls && !finalExportMode && <div className="lunaris-preset__controls" data-export-hide>
      <section className="lunaris-preset__panel lunaris-preset__panel--left" aria-label="Surface controls">
        <span className="lunaris-preset__panel-title">Surface model</span>
        <div className="lunaris-preset__segmented">
          <button type="button" className={textureMode === 'aesthetic' ? 'is-active' : ''} onClick={() => setTextureMode('aesthetic')}>Aesthetic</button>
          <button type="button" className={textureMode === 'gravity' ? 'is-active' : ''} onClick={() => setTextureMode('gravity')}>Gravity</button>
        </div>
        <label className="lunaris-preset__range">
          <span>Surface relief <output>{relief.toFixed(3)}</output></span>
          <input aria-label="Surface relief" type="range" min="0" max="0.08" step="0.002" value={relief} onChange={event => setRelief(Number(event.target.value))} />
        </label>
        {relief > .05 && <p className="lunaris-preset__warning">Relief above 0.05 is a cinematic exaggeration.</p>}
      </section>

      <section className="lunaris-preset__panel lunaris-preset__panel--right" aria-label="Motion controls">
        <span className="lunaris-preset__panel-title">Flight controls</span>
        <div className="lunaris-preset__button-row">
          <button type="button" onClick={togglePause} aria-pressed={paused || reducedMotion} disabled={reducedMotion}>
            {reducedMotion ? 'Motion off' : paused ? 'Play' : 'Pause'}
          </button>
          <button type="button" onClick={restart}>Restart</button>
          <button type="button" onClick={() => setCameraResetToken(value => value + 1)}>Reset view</button>
        </div>
        <label className="lunaris-preset__range">
          <span>Playback speed <output>{speed.toFixed(1)}×</output></span>
          <input aria-label="Playback speed" type="range" min=".25" max="6" step=".25" value={speed} onChange={event => setSpeed(Number(event.target.value))} />
        </label>
        <div className="lunaris-preset__toggles">
          <label><input type="checkbox" checked={autoRotate} onChange={event => setAutoRotate(event.target.checked)} /> Auto camera</label>
          <label><input type="checkbox" checked={showPrediction} onChange={event => setShowPrediction(event.target.checked)} /> Prediction</label>
          <label><input type="checkbox" checked={showTrail} onChange={event => setShowTrail(event.target.checked)} /> Trail</label>
          <label><input type="checkbox" checked={showStars} onChange={event => setShowStars(event.target.checked)} /> Stars</label>
          <label><input type="checkbox" checked={showBloom} onChange={event => setShowBloom(event.target.checked)} /> Bloom</label>
        </div>
        <button type="button" className="lunaris-preset__fullscreen" onClick={requestFullscreen}>Fullscreen</button>
      </section>
    </div>}

    <figcaption className="lunaris-preset__truth">
      <strong>Illustrative trajectory playback</strong>
      <span>Sample {telemetry.index + 1}/{pathData?.path.length ?? 0} · {telemetry.burning ? 'illustrative burn active' : 'coast phase'}</span>
      <small>Imported from the local Lunaris visual prototype. Not a mission ephemeris or high-fidelity propagator.</small>
    </figcaption>

    <p className="lunaris-preset__help" data-export-hide>Drag to orbit · wheel to zoom · Space play/pause · R restart · Esc pause</p>
  </figure>;
}
