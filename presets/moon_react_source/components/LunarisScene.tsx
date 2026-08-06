'use client';

import { OrbitControls, Stars } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import { Suspense, useEffect, useRef } from 'react';
import * as THREE from 'three';
import MoonModel from './MoonModel';
import OrbitPath from './OrbitPath';
import type { OrbitPathData, TextureMode } from './types';

type LunarisSceneProps = {
  data: OrbitPathData;
  assetBaseUrl: string;
  textureMode: TextureMode;
  displacementScale: number;
  speed: number;
  paused: boolean;
  active: boolean;
  reducedMotion: boolean;
  exportMode: boolean;
  exportProgress?: number;
  restartToken: number;
  cameraResetToken: number;
  autoRotate: boolean;
  showPrediction: boolean;
  showTrail: boolean;
  showStars: boolean;
  showBloom: boolean;
  cinematic: boolean;
  accent: string;
  onTelemetry: (telemetry: { index: number; burning: boolean }) => void;
};

function CameraRig({ autoRotate, paused, cameraResetToken }: Pick<LunarisSceneProps, 'autoRotate' | 'paused' | 'cameraResetToken'>) {
  const controls = useRef<any>(null);
  const { camera, invalidate } = useThree();
  useEffect(() => {
    camera.position.set(0, 0, 5);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 0, 0);
    controls.current?.target.set(0, 0, 0);
    controls.current?.update();
    invalidate();
  }, [camera, cameraResetToken, invalidate]);
  return <OrbitControls
    ref={controls}
    enablePan={false}
    enableZoom
    minDistance={2.35}
    maxDistance={8}
    autoRotate={autoRotate && !paused}
    autoRotateSpeed={.5}
    makeDefault
  />;
}

export default function LunarisScene(props: LunarisSceneProps) {
  return <>
    <ambientLight intensity={props.cinematic ? .36 : .75} />
    <directionalLight position={[5, 3, 5]} intensity={props.cinematic ? 2 : 2.4} color="#ffffff" />
    <pointLight position={[-5, -5, -5]} intensity={.55} color={props.cinematic ? '#445588' : '#bcd3e7'} />

    {props.showStars && !props.exportMode && <Stars
      radius={100}
      depth={50}
      count={props.reducedMotion ? 1700 : 4200}
      factor={4}
      saturation={0}
      fade={!props.reducedMotion}
      speed={props.reducedMotion ? 0 : .45}
    />}

    <Suspense fallback={null}>
      <MoonModel
        assetBaseUrl={props.assetBaseUrl}
        textureMode={props.textureMode}
        displacementScale={props.displacementScale}
        paused={props.paused}
        active={props.active}
        exportMode={props.exportMode}
        reducedMotion={props.reducedMotion}
        cinematic={props.cinematic}
      />
      <OrbitPath
        data={props.data}
        speed={props.speed}
        paused={props.paused}
        active={props.active}
        reducedMotion={props.reducedMotion}
        exportProgress={props.exportProgress}
        restartToken={props.restartToken}
        showPrediction={props.showPrediction}
        showTrail={props.showTrail}
        color={props.accent}
        glowColor={props.cinematic ? '#00aeef' : '#5a2132'}
        onTelemetry={props.onTelemetry}
      />
    </Suspense>

    {props.showBloom && props.cinematic && <EffectComposer multisampling={0}>
      <Bloom luminanceThreshold={1.35} mipmapBlur intensity={1.45} />
    </EffectComposer>}

    <CameraRig autoRotate={props.autoRotate} paused={props.paused} cameraResetToken={props.cameraResetToken} />
  </>;
}
