'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  LUNAR_RADIUS_KM,
  formatPeriod,
  makeOrbitPoints,
  orbitPeriodSeconds,
  positionAtMeanAnomaly,
} from './lunar-orbit-model.mjs';
import './lunar-orbit-react.css';

export type LunarOrbitPresetProps = {
  meanAltitudeKm?: number;
  eccentricity?: number;
  inclinationDeg?: number;
  ascendingNodeDeg?: number;
  timeScale?: number;
  paused?: boolean;
  active?: boolean;
  exportProgress?: number;
  className?: string;
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

function makeProceduralMoonTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 384;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#aaa394';
  context.fillRect(0, 0, canvas.width, canvas.height);
  let seed = 173740;
  const random = () => {
    seed = Math.imul(seed ^ seed >>> 15, 1 | seed) + 0x6d2b79f5 | 0;
    return ((seed ^ seed >>> 14) >>> 0) / 4294967296;
  };
  for (let index = 0; index < 180; index += 1) {
    const x = random() * canvas.width;
    const y = random() * canvas.height;
    const radius = 2 + random() * 25;
    const gradient = context.createRadialGradient(x - radius * .25, y - radius * .25, 0, x, y, radius);
    gradient.addColorStop(0, 'rgba(236,230,208,.20)');
    gradient.addColorStop(.4, 'rgba(54,51,49,.23)');
    gradient.addColorStop(1, 'rgba(54,51,49,0)');
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

type SceneProps = Required<Pick<LunarOrbitPresetProps, 'meanAltitudeKm' | 'eccentricity' | 'inclinationDeg' | 'ascendingNodeDeg' | 'timeScale' | 'paused' | 'active'>> & {
  exportProgress?: number;
  reduced: boolean;
};

function LunarScene(props: SceneProps) {
  const spacecraft = useRef<THREE.Group>(null);
  const progress = useRef(props.exportProgress ?? .18);
  const texture = useMemo(makeProceduralMoonTexture, []);
  const config = useMemo(() => ({
    meanAltitudeKm: props.meanAltitudeKm,
    eccentricity: props.eccentricity,
    inclinationDeg: props.inclinationDeg,
    ascendingNodeDeg: props.ascendingNodeDeg,
  }), [props.meanAltitudeKm, props.eccentricity, props.inclinationDeg, props.ascendingNodeDeg]);
  const period = orbitPeriodSeconds(props.meanAltitudeKm);
  const points = useMemo(() => makeOrbitPoints(config, 320).map(point => [
    point.x / LUNAR_RADIUS_KM,
    point.z / LUNAR_RADIUS_KM,
    point.y / LUNAR_RADIUS_KM,
  ] as [number, number, number]), [config]);

  useEffect(() => () => texture.dispose(), [texture]);
  useFrame((_, delta) => {
    if (typeof props.exportProgress === 'number') progress.current = THREE.MathUtils.clamp(props.exportProgress, 0, 1);
    else if (!props.paused && props.active && !props.reduced) progress.current = (progress.current + delta * props.timeScale / period) % 1;
    const point = positionAtMeanAnomaly({ ...config, meanAnomaly: progress.current * Math.PI * 2 });
    spacecraft.current?.position.set(point.x / LUNAR_RADIUS_KM, point.z / LUNAR_RADIUS_KM, point.y / LUNAR_RADIUS_KM);
  });

  return <>
    <ambientLight intensity={1.15} />
    <directionalLight position={[-4, 5, 6]} intensity={2.6} color="#fff5d2" />
    <directionalLight position={[4, -2, -4]} intensity={.35} color="#bcd3e7" />
    <mesh rotation={[0, -.35, 0]}>
      <sphereGeometry args={[1, 128, 64]} />
      <meshStandardMaterial map={texture} color="#c8c0ad" roughness={.92} metalness={0} />
    </mesh>
    <Line points={points} color="#f54f1f" lineWidth={2.5} transparent opacity={.92} />
    <group ref={spacecraft}>
      <mesh rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[.045, .14, 3]} />
        <meshStandardMaterial color="#f54f1f" roughness={.65} />
      </mesh>
    </group>
    <OrbitControls enablePan={false} minDistance={2.6} maxDistance={8} makeDefault />
  </>;
}

export default function LunarOrbitPreset({
  meanAltitudeKm = 100,
  eccentricity = .05,
  inclinationDeg = 90,
  ascendingNodeDeg = -18,
  timeScale = 540,
  paused = false,
  active = true,
  exportProgress,
  className = '',
}: LunarOrbitPresetProps) {
  const reduced = useReducedMotion();
  const period = orbitPeriodSeconds(meanAltitudeKm);
  return <figure className={`lunar-orbit-react ${className}`} aria-label="Interactive analytic lunar orbit">
    <Canvas dpr={[1, 1.5]} camera={{ position: [0, .35, 4.8], fov: 42 }} gl={{ antialias: true, powerPreference: 'high-performance' }}>
      <color attach="background" args={['#f3eec8']} />
      <LunarScene
        meanAltitudeKm={meanAltitudeKm}
        eccentricity={Math.min(.7, Math.max(0, eccentricity))}
        inclinationDeg={inclinationDeg}
        ascendingNodeDeg={ascendingNodeDeg}
        timeScale={timeScale}
        paused={paused}
        active={active}
        exportProgress={exportProgress}
        reduced={reduced}
      />
    </Canvas>
    <figcaption>
      <strong>Analytic two-body model</strong>
      <span>{meanAltitudeKm} km mean altitude · e {eccentricity.toFixed(2)} · i {inclinationDeg}° · period {formatPeriod(period)}</span>
      <small>Excludes mascons, third-body perturbations, maneuvers, and terrain collision.</small>
    </figcaption>
  </figure>;
}
