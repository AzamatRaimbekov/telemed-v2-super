import { useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, Sphere, MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";

const ORBIT_RADIUS = 2.8;

function CentralSphere() {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (meshRef.current) meshRef.current.rotation.y = clock.getElapsedTime() * 0.15;
  });
  return (
    <Sphere ref={meshRef} args={[0.8, 32, 32]}>
      <MeshDistortMaterial color="#93c5fd" transparent opacity={0.3} wireframe distort={0.2} speed={1.5} />
    </Sphere>
  );
}

function GlowSphere() {
  return (
    <Sphere args={[1.0, 16, 16]}>
      <meshBasicMaterial color="#dbeafe" transparent opacity={0.15} />
    </Sphere>
  );
}

function OrbitingModule({ index, total }: { index: number; total: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const angle = (index / total) * Math.PI * 2;
  const color = useMemo(() => {
    const colors = ["#2563eb", "#7c3aed", "#0891b2", "#10b981", "#2563eb", "#7c3aed", "#0891b2", "#10b981"];
    return colors[index % colors.length];
  }, [index]);
  useFrame(({ clock }) => {
    if (groupRef.current) {
      const t = clock.getElapsedTime() * 0.5 + angle;
      groupRef.current.position.x = Math.cos(t) * ORBIT_RADIUS;
      groupRef.current.position.z = Math.sin(t) * ORBIT_RADIUS;
      groupRef.current.position.y = Math.sin(t * 0.5 + index) * 0.3;
    }
  });
  return (
    <group ref={groupRef}>
      <Float speed={2} rotationIntensity={0.2} floatIntensity={0.3}>
        <mesh>
          <boxGeometry args={[0.4, 0.4, 0.4]} />
          <meshStandardMaterial color={color} transparent opacity={0.85} roughness={0.3} metalness={0.1} />
        </mesh>
      </Float>
    </group>
  );
}

function OrbitRing() {
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * ORBIT_RADIUS, 0, Math.sin(a) * ORBIT_RADIUS));
    }
    return pts;
  }, []);
  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);
  return (
    <line>
      <primitive object={geometry} attach="geometry" />
      <lineBasicMaterial color="#93c5fd" transparent opacity={0.2} />
    </line>
  );
}

function MouseParallax({ children }: { children: React.ReactNode }) {
  const groupRef = useRef<THREE.Group>(null);
  const { pointer } = useThree();
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, pointer.x * 0.15, 0.05);
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, -pointer.y * 0.08, 0.05);
    }
  });
  return <group ref={groupRef}>{children}</group>;
}

function Scene() {
  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 8, 5]} intensity={0.6} color="#ffffff" />
      <pointLight position={[-3, 3, 5]} intensity={0.3} color="#93c5fd" />
      <MouseParallax>
        <CentralSphere />
        <GlowSphere />
        <OrbitRing />
        {Array.from({ length: 8 }).map((_, i) => (
          <OrbitingModule key={i} index={i} total={8} />
        ))}
      </MouseParallax>
    </>
  );
}

export function OrbitScene() {
  return (
    <div className="w-full h-[350px] md:h-[450px]">
      <Canvas camera={{ position: [0, 2, 6], fov: 45 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: true }} style={{ background: "transparent" }}>
        <Scene />
      </Canvas>
    </div>
  );
}
