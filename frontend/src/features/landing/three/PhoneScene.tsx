import { useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { RoundedBox, Float } from "@react-three/drei";
import * as THREE from "three";

function Phone() {
  return (
    <Float speed={2} rotationIntensity={0.12} floatIntensity={0.35}>
      <group>
        <RoundedBox args={[1.6, 3, 0.15]} radius={0.15} smoothness={4}>
          <meshStandardMaterial color="#e2e8f0" roughness={0.2} metalness={0.3} />
        </RoundedBox>
        <RoundedBox args={[1.4, 2.7, 0.01]} radius={0.1} smoothness={4} position={[0, 0, 0.08]}>
          <meshStandardMaterial color="#f8fafc" roughness={0.9} />
        </RoundedBox>
        {[0.8, 0.4, 0, -0.4, -0.8].map((y, i) => (
          <mesh key={i} position={[0, y, 0.09]}>
            <planeGeometry args={[1.1, 0.12]} />
            <meshBasicMaterial color={i % 2 === 0 ? "#2563eb" : "#7c3aed"} transparent opacity={0.12} />
          </mesh>
        ))}
        <mesh position={[0, 1.25, 0.09]}>
          <planeGeometry args={[0.5, 0.06]} />
          <meshBasicMaterial color="#e2e8f0" />
        </mesh>
      </group>
    </Float>
  );
}

function VoiceBubble() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.scale.setScalar(1 + Math.sin(clock.getElapsedTime() * 3) * 0.06);
  });
  return (
    <mesh ref={ref} position={[1.3, -0.8, 0.2]}>
      <sphereGeometry args={[0.2, 16, 16]} />
      <meshStandardMaterial color="#2563eb" transparent opacity={0.25} />
    </mesh>
  );
}

function PhoneParallax({ children }: { children: React.ReactNode }) {
  const groupRef = useRef<THREE.Group>(null);
  const { pointer } = useThree();
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, pointer.x * 0.12, 0.05);
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, -pointer.y * 0.06, 0.05);
    }
  });
  return <group ref={groupRef}>{children}</group>;
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[5, 8, 5]} intensity={0.5} />
      <pointLight position={[-3, 2, 4]} intensity={0.2} color="#93c5fd" />
      <PhoneParallax><Phone /><VoiceBubble /></PhoneParallax>
    </>
  );
}

export function PhoneScene() {
  return (
    <div className="w-full h-[350px] md:h-[400px]">
      <Canvas camera={{ position: [0, 0, 5], fov: 40 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }} style={{ background: "transparent" }}>
        <Scene />
      </Canvas>
    </div>
  );
}
