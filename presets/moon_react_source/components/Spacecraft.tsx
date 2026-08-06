import { Box, Cone, Cylinder, Sphere } from '@react-three/drei';
import React, { forwardRef } from 'react';
import * as THREE from 'three';

export type SpacecraftRefs = {
  thrusterRef: React.RefObject<THREE.Mesh | null>;
  thrusterCoreRef: React.RefObject<THREE.Mesh | null>;
  lightRef: React.RefObject<THREE.PointLight | null>;
};

export const Spacecraft = forwardRef<THREE.Group, SpacecraftRefs>(function Spacecraft(
  { thrusterRef, thrusterCoreRef, lightRef },
  ref,
) {
  return <group ref={ref}>
    <group scale={3.4}>
      <Box args={[.025, .025, .06]}>
        <meshStandardMaterial color="#eeeeee" metalness={.6} roughness={.2} />
      </Box>
      <Cylinder args={[.013, .013, .04, 6]} rotation={[Math.PI / 2, 0, Math.PI / 6]}>
        <meshStandardMaterial color="#111111" metalness={.5} roughness={.8} />
      </Cylinder>
      <Cylinder args={[.008, .008, .015, 16]} position={[0, 0, .03]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color="#333333" metalness={.8} roughness={.2} />
      </Cylinder>
      <Cylinder args={[.004, .004, .01, 16]} position={[0, 0, .04]}>
        <meshStandardMaterial color="#1a1a1a" metalness={.9} roughness={.1} />
      </Cylinder>
      <Cylinder args={[.002, .002, .08, 8]}>
        <meshStandardMaterial color="#555555" metalness={.8} roughness={.4} />
      </Cylinder>
      <Box args={[.025, .07, .001]} position={[0, .05, 0]} rotation={[0, Math.PI / 2, 0]}>
        <meshStandardMaterial color="#0a192f" emissive="#001122" metalness={.9} roughness={.1} />
      </Box>
      <Box args={[.025, .07, .001]} position={[0, -.05, 0]} rotation={[0, Math.PI / 2, 0]}>
        <meshStandardMaterial color="#0a192f" emissive="#001122" metalness={.9} roughness={.1} />
      </Box>
      <group position={[.015, 0, .01]} rotation={[0, -Math.PI / 6, -Math.PI / 2]}>
        <Cylinder args={[.001, .001, .01, 8]} position={[0, .005, 0]}>
          <meshStandardMaterial color="#888888" metalness={.7} />
        </Cylinder>
        <Sphere args={[.015, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} position={[0, .01, 0]} rotation={[Math.PI, 0, 0]}>
          <meshStandardMaterial color="#ffffff" metalness={.5} roughness={.3} side={THREE.DoubleSide} />
        </Sphere>
        <Cylinder args={[.0005, .0005, .01, 8]} position={[0, .015, 0]}>
          <meshStandardMaterial color="#555555" metalness={.9} />
        </Cylinder>
      </group>
      <Cone args={[.008, .015, 16]} position={[0, 0, -.033]} rotation={[Math.PI / 2, 0, 0]}>
        <meshStandardMaterial color="#222222" metalness={.9} roughness={.5} />
      </Cone>
      <Cylinder ref={thrusterRef} args={[.022, .001, .14, 16]} position={[0, 0, -.09]} rotation={[Math.PI / 2, 0, 0]} scale={.001}>
        <meshStandardMaterial color="#ff8800" emissive="#ff5500" emissiveIntensity={1.5} toneMapped={false} transparent opacity={.6} />
      </Cylinder>
      <Cylinder ref={thrusterCoreRef} args={[.009, .0005, .14, 8]} position={[0, 0, -.09]} rotation={[Math.PI / 2, 0, 0]} scale={.001}>
        <meshStandardMaterial color="#ffffff" emissive="#ffeeaa" emissiveIntensity={3} toneMapped={false} transparent opacity={.85} />
      </Cylinder>
      <pointLight ref={lightRef} position={[0, 0, -.05]} color="#ffaa00" intensity={0} distance={2.5} />
    </group>
  </group>;
});
