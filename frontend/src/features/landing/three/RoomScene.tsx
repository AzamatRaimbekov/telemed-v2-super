import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";

function Room() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
        <planeGeometry args={[5, 4]} />
        <meshStandardMaterial color="#f1f5f9" />
      </mesh>
      <mesh position={[0, 0.5, -2]}>
        <planeGeometry args={[5, 3]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>
      <mesh position={[-2.5, 0.5, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[4, 3]} />
        <meshStandardMaterial color="#e2e8f0" transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

function Bed() {
  return (
    <group position={[-0.5, -0.5, -0.5]}>
      <mesh>
        <boxGeometry args={[1.8, 0.3, 0.9]} />
        <meshStandardMaterial color="#cbd5e1" />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[1.7, 0.1, 0.8]} />
        <meshStandardMaterial color="#f1f5f9" />
      </mesh>
      <mesh position={[-0.65, 0.3, 0]}>
        <boxGeometry args={[0.3, 0.08, 0.5]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>
    </group>
  );
}

function Sensor({ position, color }: { position: [number, number, number]; color: string }) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (meshRef.current) meshRef.current.scale.setScalar(1 + Math.sin(clock.getElapsedTime() * 2 + position[0]) * 0.1);
  });
  return (
    <Float speed={1.5} rotationIntensity={0} floatIntensity={0.1}>
      <group position={position}>
        <mesh ref={meshRef}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
        </mesh>
      </group>
    </Float>
  );
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[5, 8, 5]} intensity={0.5} />
      <group rotation={[0.3, -0.4, 0]}>
        <Room /><Bed />
        <Sensor position={[1.5, 0.5, -1.5]} color="#10b981" />
        <Sensor position={[-2, 0.5, 0.5]} color="#2563eb" />
        <Sensor position={[1, 0.8, 0.5]} color="#7c3aed" />
        <Sensor position={[-0.5, 1.2, -1.8]} color="#d97706" />
      </group>
    </>
  );
}

export function RoomScene() {
  return (
    <div className="w-full h-[300px] md:h-[380px]">
      <Canvas camera={{ position: [0, 2, 5], fov: 40 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }} style={{ background: "transparent" }}>
        <Scene />
      </Canvas>
    </div>
  );
}
