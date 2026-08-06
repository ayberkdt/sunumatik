'use client';

import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Spacecraft } from './Spacecraft';
import type { OrbitPathData } from './types';

type Telemetry = { index: number; burning: boolean };

type OrbitPathProps = {
  data: OrbitPathData;
  speed: number;
  paused: boolean;
  active: boolean;
  reducedMotion: boolean;
  exportProgress?: number;
  restartToken: number;
  showPrediction: boolean;
  showTrail: boolean;
  color: string;
  glowColor: string;
  onTelemetry?: (telemetry: Telemetry) => void;
};

const TRAIL_LENGTH = 150;
const TRAIL_SEGMENTS = 15;
const FUTURE_SEGMENTS = 15;

function segmented(points: THREE.Vector3[], count: number) {
  if (points.length < 2) return [];
  return Array.from({ length: count }, (_, index) => {
    const size = points.length / count;
    const start = Math.floor(index * size);
    const end = Math.min(points.length, Math.floor((index + 1) * size) + 1);
    return points.slice(start, end);
  }).filter(segment => segment.length > 1);
}

function isBurnIndex(index: number) {
  return (index >= 270 && index <= 300)
    || (index >= 570 && index <= 600)
    || (index >= 870 && index <= 900)
    || index >= 1170
    || index < 5;
}

export default function OrbitPath({
  data,
  speed,
  paused,
  active,
  reducedMotion,
  exportProgress,
  restartToken,
  showPrediction,
  showTrail,
  color,
  glowColor,
  onTelemetry,
}: OrbitPathProps) {
  const satelliteRef = useRef<THREE.Group>(null);
  const thrusterRef = useRef<THREE.Mesh>(null);
  const thrusterCoreRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const progress = useRef(150);
  const burnTime = useRef(0);
  const lastIndex = useRef(-1);
  const [trailSegments, setTrailSegments] = useState<THREE.Vector3[][]>([]);
  const [futureSegments, setFutureSegments] = useState<THREE.Vector3[][]>([]);

  const points = useMemo(
    () => (data.path || []).map(point => new THREE.Vector3(point[0], point[1], point[2])),
    [data.path],
  );

  useEffect(() => {
    progress.current = 150;
    lastIndex.current = -1;
  }, [restartToken]);

  useFrame((_, delta) => {
    if (!satelliteRef.current || points.length < 2) return;
    if (typeof exportProgress === 'number') progress.current = THREE.MathUtils.clamp(exportProgress, 0, 1) * points.length;
    else if (reducedMotion) progress.current = .18 * points.length;
    else if (!paused && active) progress.current = (progress.current + delta * speed * 2.5) % points.length;

    const index = Math.floor(progress.current) % points.length;
    const nextIndex = (index + 1) % points.length;
    const lerp = progress.current - Math.floor(progress.current);
    const current = points[index];
    const next = points[nextIndex];
    satelliteRef.current.position.lerpVectors(current, next, lerp);

    const velocity = new THREE.Vector3().subVectors(next, current).normalize();
    const attitude = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), velocity);
    const retrograde = (index >= 820 && index <= 930) || index >= 1120 || index <= 30;
    if (retrograde) attitude.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0)));
    if (typeof exportProgress === 'number' || reducedMotion) satelliteRef.current.quaternion.copy(attitude);
    else satelliteRef.current.quaternion.slerp(attitude, 1 - Math.exp(-delta * .9));

    const burning = isBurnIndex(index);
    if (thrusterRef.current && thrusterCoreRef.current && lightRef.current) {
      if (burning) {
        burnTime.current = typeof exportProgress === 'number' ? index * .031 : burnTime.current + delta;
        const time = burnTime.current;
        const flicker1 = .85 + .15 * Math.sin(time * 23.7);
        const flicker2 = .9 + .1 * Math.sin(time * 41.3 + 1.2);
        const flicker3 = .95 + .05 * Math.sin(time * 17.1 + 2.4);
        const flicker = flicker1 * flicker2 * flicker3;
        const length = flicker * (.9 + .1 * Math.sin(time * 8.3));
        const width = 1 + .08 * Math.sin(time * 31);
        thrusterRef.current.scale.set(width, width, length);
        thrusterCoreRef.current.scale.set(width * .5, width * .5, length * 1.1);
        const outer = thrusterRef.current.material as THREE.MeshStandardMaterial;
        outer.emissiveIntensity = 1.2 + .8 * flicker;
        outer.opacity = .55 + .15 * flicker;
        const core = thrusterCoreRef.current.material as THREE.MeshStandardMaterial;
        core.emissiveIntensity = 2.5 + 1.5 * flicker;
        core.opacity = .7 + .2 * flicker1;
        lightRef.current.intensity = .8 + .6 * flicker;
        lightRef.current.color.setHSL(.08 + .02 * flicker2, 1, .6);
      } else {
        burnTime.current = 0;
        const zero = new THREE.Vector3(.001, .001, .001);
        thrusterRef.current.scale.lerp(zero, .24);
        thrusterCoreRef.current.scale.lerp(zero, .24);
        lightRef.current.intensity = THREE.MathUtils.lerp(lightRef.current.intensity, 0, .24);
      }
    }

    if (index === lastIndex.current) return;
    lastIndex.current = index;
    onTelemetry?.({ index, burning });

    const trail = Array.from({ length: TRAIL_LENGTH }, (_, offset) => {
      const pointIndex = (index - TRAIL_LENGTH + offset + points.length) % points.length;
      return points[pointIndex];
    });
    setTrailSegments(segmented(trail, TRAIL_SEGMENTS));

    const future = data.future_paths?.[String(index)] || [];
    setFutureSegments(segmented(
      future.map(point => new THREE.Vector3(point[0], point[1], point[2])),
      FUTURE_SEGMENTS,
    ));
  });

  if (points.length < 2) return null;
  return <group>
    <Line points={points} color={glowColor} lineWidth={.8} transparent opacity={.12} depthWrite={false} />

    {showPrediction && futureSegments.map((segment, index) => {
      const remaining = 1 - index / Math.max(1, futureSegments.length - 1);
      return <Line
        key={`future-${index}`}
        points={segment}
        color={glowColor}
        lineWidth={1.1}
        transparent
        opacity={Math.max(.025, remaining ** 1.5 * .46)}
        depthWrite={false}
      />;
    })}

    {showTrail && trailSegments.map((segment, index) => {
      const ratio = index / Math.max(1, trailSegments.length - 1);
      return <group key={`trail-${index}`}>
        <Line points={segment} color={color} lineWidth={2.7} transparent opacity={ratio ** 1.5 * .92} depthWrite={false} />
        <Line points={segment} color="#ffffff" lineWidth={1} transparent opacity={ratio ** 2} depthWrite={false} />
      </group>;
    })}

    <Spacecraft
      ref={satelliteRef}
      thrusterRef={thrusterRef}
      thrusterCoreRef={thrusterCoreRef}
      lightRef={lightRef}
    />
  </group>;
}
