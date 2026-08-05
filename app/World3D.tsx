"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, ThreeElements, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { Environment, Html, Sparkles, useGLTF } from "@react-three/drei";
import * as THREE from "three";

type Point = { x: number; y: number };

type World3DProps = {
  activeNpcIndex: number;
  cityName: string;
  npcNames: string[];
  npcPositions: Point[];
  onMoveTo: (point: Point) => void;
  onSelectNpc: (index: number) => void;
  playerPosition: Point;
  sceneClass: string;
};

const MODEL_ROOT = "/models/kenney-city";

function toWorld(point: Point): [number, number, number] {
  return [(point.x - 50) / 3.1, 0, (point.y - 70) / 2.2];
}

function toScreen(x: number, z: number): Point {
  return {
    x: Math.min(90, Math.max(10, 50 + x * 3.1)),
    y: Math.min(88, Math.max(54, 70 + z * 2.2)),
  };
}

function Model({ url, ...props }: { url: string } & ThreeElements["group"]) {
  const { scene } = useGLTF(url);
  const clone = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, [clone]);

  return <primitive object={clone} {...props} />;
}

function Person({ active = false, color, name, onClick, player = false, position }: {
  active?: boolean;
  color: string;
  name?: string;
  onClick?: () => void;
  player?: boolean;
  position: [number, number, number];
}) {
  const group = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!group.current || player) return;
    group.current.position.y = Math.sin(clock.elapsedTime * 1.7 + position[0]) * .035;
  });

  return (
    <group ref={group} position={position} onClick={(event) => { event.stopPropagation(); onClick?.(); }}>
      <mesh castShadow position={[0, 1.72, 0]}>
        <sphereGeometry args={[.3, 18, 18]} />
        <meshStandardMaterial color={player ? "#f4c89a" : "#d9a779"} roughness={.72} />
      </mesh>
      <mesh castShadow position={[0, 1.08, 0]}>
        <capsuleGeometry args={[.37, .72, 8, 16]} />
        <meshStandardMaterial color={color} roughness={.58} metalness={.04} />
      </mesh>
      <mesh castShadow position={[-.18, .36, 0]} rotation={[0, 0, .02]}>
        <capsuleGeometry args={[.11, .54, 6, 12]} />
        <meshStandardMaterial color="#18201d" roughness={.78} />
      </mesh>
      <mesh castShadow position={[.18, .36, 0]} rotation={[0, 0, -.02]}>
        <capsuleGeometry args={[.11, .54, 6, 12]} />
        <meshStandardMaterial color="#18201d" roughness={.78} />
      </mesh>
      <mesh castShadow position={[-.48, 1.12, 0]} rotation={[0, 0, -.16]}>
        <capsuleGeometry args={[.09, .56, 6, 12]} />
        <meshStandardMaterial color={color} roughness={.6} />
      </mesh>
      <mesh castShadow position={[.48, 1.12, 0]} rotation={[0, 0, .16]}>
        <capsuleGeometry args={[.09, .56, 6, 12]} />
        <meshStandardMaterial color={color} roughness={.6} />
      </mesh>
      {active && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .035, 0]}>
          <ringGeometry args={[.7, .86, 40]} />
          <meshBasicMaterial color="#d8ff5f" transparent opacity={.9} side={THREE.DoubleSide} />
        </mesh>
      )}
      {name && (
        <Html position={[0, 2.32, 0]} center distanceFactor={10} className="world3d-name">
          <span className={active ? "active" : ""}>{active ? "TALK · " : ""}{name}</span>
        </Html>
      )}
    </group>
  );
}

function StreetLamp({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh castShadow position={[0, 1.55, 0]}><cylinderGeometry args={[.055, .08, 3.1, 10]} /><meshStandardMaterial color="#1b211f" metalness={.75} roughness={.3} /></mesh>
      <mesh castShadow position={[0, 3.08, 0]}><boxGeometry args={[.48, .2, .32]} /><meshStandardMaterial color="#222a27" metalness={.7} /></mesh>
      <pointLight position={[0, 2.92, 0]} color="#ffdca0" intensity={5} distance={6} />
    </group>
  );
}

function FollowCamera({ playerPosition }: { playerPosition: Point }) {
  const { camera } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const [x, , z] = toWorld(playerPosition);
    target.set(x, 5.1, z + 7.2);
    camera.position.lerp(target, .085);
    look.set(x, 1.05, z - 2.3);
    camera.lookAt(look);
  });

  return null;
}

function CityScene({ activeNpcIndex, npcNames, npcPositions, onMoveTo, onSelectNpc, playerPosition, sceneClass }: Omit<World3DProps, "cityName">) {
  const playerWorld = toWorld(playerPosition);
  const palette = sceneClass === "desert" ? "#d09a65" : sceneClass === "india" ? "#e46d45" : sceneClass === "east" ? "#e64f58" : "#55a9d8";

  function moveOnGround(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    onMoveTo(toScreen(event.point.x, event.point.z));
  }

  return (
    <>
      <color attach="background" args={["#86abc0"]} />
      <fog attach="fog" args={["#86a2ae", 18, 46]} />
      <ambientLight intensity={1.25} />
      <hemisphereLight args={["#d9efff", "#29372f", 2.1]} />
      <directionalLight castShadow position={[-9, 14, 8]} intensity={3.2} color="#fff1d5" shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <Environment preset="city" environmentIntensity={.45} />
      <Sparkles count={30} scale={[24, 5, 24]} size={1.1} speed={.18} opacity={.18} color="#d8ff5f" />

      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -.03, 0]} onClick={moveOnGround}>
        <planeGeometry args={[34, 42]} />
        <meshStandardMaterial color="#70756e" roughness={.96} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, .005, 0]} onClick={moveOnGround}>
        <planeGeometry args={[8.2, 42]} />
        <meshStandardMaterial color="#292d2d" roughness={.88} />
      </mesh>
      {[-8, -2, 4, 10].map((z) => <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[0, .025, z]}><planeGeometry args={[.15, 2.6]} /><meshBasicMaterial color="#e9dba7" /></mesh>)}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[-5.4, .03, 0]}><planeGeometry args={[2.6, 42]} /><meshStandardMaterial color="#b7b5aa" roughness={1} /></mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[5.4, .03, 0]}><planeGeometry args={[2.6, 42]} /><meshStandardMaterial color="#b7b5aa" roughness={1} /></mesh>

      <Model url={`${MODEL_ROOT}/building-type-a.glb`} position={[-9.1, 0, -7]} rotation={[0, Math.PI / 2, 0]} scale={2.25} />
      <Model url={`${MODEL_ROOT}/building-type-f.glb`} position={[-9.3, 0, 2.5]} rotation={[0, Math.PI / 2, 0]} scale={2.15} />
      <Model url={`${MODEL_ROOT}/building-type-k.glb`} position={[-9.2, 0, 12]} rotation={[0, Math.PI / 2, 0]} scale={2.2} />
      <Model url={`${MODEL_ROOT}/building-type-c.glb`} position={[9.2, 0, -8]} rotation={[0, -Math.PI / 2, 0]} scale={2.25} />
      <Model url={`${MODEL_ROOT}/building-type-t.glb`} position={[9.2, 0, 2]} rotation={[0, -Math.PI / 2, 0]} scale={2.05} />
      <Model url={`${MODEL_ROOT}/building-type-h.glb`} position={[9.2, 0, 11]} rotation={[0, -Math.PI / 2, 0]} scale={2.35} />
      {[-11, -3, 6, 13].map((z, index) => <Model key={`tree-left-${z}`} url={`${MODEL_ROOT}/${index % 2 ? "tree-small" : "tree-large"}.glb`} position={[-5.5, 0, z]} scale={1.7} />)}
      {[-8, 1, 9].map((z, index) => <Model key={`tree-right-${z}`} url={`${MODEL_ROOT}/${index % 2 ? "tree-large" : "tree-small"}.glb`} position={[5.5, 0, z]} scale={1.6} />)}
      <StreetLamp position={[-4.2, 0, -4]} />
      <StreetLamp position={[4.2, 0, 4]} />
      <StreetLamp position={[-4.2, 0, 11]} />

      {npcPositions.map((point, index) => (
        <Person key={npcNames[index]} active={index === activeNpcIndex} color={[palette, "#5f72dc", "#d99b52"][index]} name={npcNames[index]} onClick={() => onSelectNpc(index)} position={toWorld(point)} />
      ))}
      <Person player color="#d8ff5f" position={playerWorld} />
      <FollowCamera playerPosition={playerPosition} />
    </>
  );
}

export default function World3D(props: World3DProps) {
  return (
    <div className="world3d-canvas" aria-label={`Interactive 3D street in ${props.cityName}`}>
      <Canvas shadows camera={{ fov: 52, near: .1, far: 90, position: [0, 5, 12] }} dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: "high-performance" }}>
        <Suspense fallback={null}><CityScene {...props} /></Suspense>
      </Canvas>
      <div className="world3d-loading">Loading city…</div>
    </div>
  );
}

useGLTF.preload(`${MODEL_ROOT}/building-type-a.glb`);
useGLTF.preload(`${MODEL_ROOT}/building-type-f.glb`);
useGLTF.preload(`${MODEL_ROOT}/building-type-t.glb`);
