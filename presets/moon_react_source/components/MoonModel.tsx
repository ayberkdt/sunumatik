'use client';

import { Sphere, useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { TextureMode } from './types';

type MoonModelProps = {
  assetBaseUrl: string;
  textureMode: TextureMode;
  displacementScale: number;
  paused: boolean;
  active: boolean;
  exportMode: boolean;
  reducedMotion: boolean;
  cinematic: boolean;
};

export default function MoonModel({
  assetBaseUrl,
  textureMode,
  displacementScale,
  paused,
  active,
  exportMode,
  reducedMotion,
  cinematic,
}: MoonModelProps) {
  const moonRef = useRef<THREE.Mesh>(null);
  const rotation = useRef(.34);
  const [gravityMap, aestheticMap, displacementMap] = useTexture([
    `${assetBaseUrl}/textures/gravity_moon_real.webp`,
    `${assetBaseUrl}/textures/aesthetic_moon_real.webp`,
    `${assetBaseUrl}/textures/moon_disp_real.webp`,
  ]);

  useEffect(() => {
    gravityMap.colorSpace = THREE.SRGBColorSpace;
    aestheticMap.colorSpace = THREE.SRGBColorSpace;
    gravityMap.anisotropy = 8;
    aestheticMap.anisotropy = 8;
    displacementMap.anisotropy = 4;
  }, [aestheticMap, displacementMap, gravityMap]);

  useFrame((_, delta) => {
    if (!moonRef.current) return;
    if (exportMode || reducedMotion) rotation.current = .34;
    else if (!paused && active) rotation.current += delta * .05;
    moonRef.current.rotation.set(.1, rotation.current, 0);
  });

  const currentMap = textureMode === 'aesthetic' ? aestheticMap : gravityMap;
  return <group>
    {cinematic && <Sphere args={[1.065, 96, 64]}>
      <meshBasicMaterial
        color={textureMode === 'aesthetic' ? '#a0c0d0' : '#00e5ff'}
        transparent
        opacity={.055}
        side={THREE.BackSide}
        depthWrite={false}
      />
    </Sphere>}
    <Sphere ref={moonRef} args={[1, 192, 128]}>
      <meshStandardMaterial
        map={currentMap}
        displacementMap={displacementMap}
        displacementScale={displacementScale}
        roughness={textureMode === 'aesthetic' ? .72 : .9}
        metalness={.08}
      />
    </Sphere>
  </group>;
}
