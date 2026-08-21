"use client";

import { Suspense, type ComponentRef, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, ThreeElements, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { Environment, Html, OrbitControls, Sparkles, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import SadakStreetBuilding from "./SadakStreetBuilding";

type Point = { x: number; y: number };
type CameraDirection = { x: number; z: number };

type World3DProps = {
  activeNpcIndex: number;
  cityId: string;
  cityName: string;
  npcNames: string[];
  npcPositions: Point[];
  onCameraDirectionChange: (direction: CameraDirection) => void;
  onMoveTo: (point: Point) => void;
  onSelectNpc: (index: number) => void;
  playerPosition: Point;
  sceneClass: string;
  latitude: number;
  longitude: number;
  waypointLabel: string;
};

type MapPoint = { x: number; z: number };
type Neighborhood = {
  roads: Array<{ id: number; kind?: string; points: MapPoint[] }>;
  buildings: Array<{ id: number; height: number; heightMeters?: number; year?: number | null; bin?: string; points: MapPoint[] }>;
  osm?: string;
  detailLevel?: string;
};

const MODEL_ROOT = "/models/kenney-city";
const CHARACTER_ROOT = "/models/quaternius";
const CAR_ROOT = "/models/kenney-cars";
const PLAYER_MODEL_FORWARD_OFFSET = Math.PI;

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

function Person({ active = false, model, name, onClick, player = false, position, waypointLabel }: {
  active?: boolean;
  model: string;
  name?: string;
  onClick?: () => void;
  player?: boolean;
  position: [number, number, number];
  waypointLabel?: string;
}) {
  const group = useRef<THREE.Group>(null);
  const source = useGLTF(`${CHARACTER_ROOT}/${model}`);
  const character = useMemo(() => cloneSkeleton(source.scene) as THREE.Group, [source.scene]);
  const mixer = useMemo(() => new THREE.AnimationMixer(character), [character]);
  const destination = useMemo(() => new THREE.Vector3(...position), [position]);
  const [initialPosition] = useState(() => new THREE.Vector3(...position));
  const activeAction = useRef<THREE.AnimationAction | null>(null);
  const activeClipName = useRef("");
  const targetHeading = useRef(0);
  const idleClip = useMemo(() => source.animations.find((animation) => /idle/i.test(animation.name)) ?? source.animations[0], [source.animations]);
  const walkClip = useMemo(() => source.animations.find((animation) => /walk|run/i.test(animation.name)) ?? idleClip, [source.animations, idleClip]);

  useEffect(() => {
    character.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    const action = idleClip ? mixer.clipAction(idleClip) : null;
    action?.reset().fadeIn(.2).play();
    activeAction.current = action;
    activeClipName.current = idleClip?.name ?? "";
    return () => { action?.fadeOut(.15); mixer.stopAllAction(); activeAction.current = null; };
  }, [character, idleClip, mixer]);

  useFrame((_, delta) => {
    mixer.update(delta);
    if (!group.current) return;
    const distance = group.current.position.distanceTo(destination);
    const desiredClip = player && distance > .035 ? walkClip : idleClip;
    if (desiredClip && desiredClip.name !== activeClipName.current) {
      const next = mixer.clipAction(desiredClip);
      activeAction.current?.fadeOut(.18);
      next.reset().fadeIn(.18).play();
      activeAction.current = next;
      activeClipName.current = desiredClip.name;
    }
    if (player && distance > .025) {
      const dx = destination.x - group.current.position.x;
      const dz = destination.z - group.current.position.z;
      // Quaternius characters are mounted facing the opposite of the group's
      // +Z axis, so include the model-space half turn when aiming the player.
      targetHeading.current = Math.atan2(dx, dz) + PLAYER_MODEL_FORWARD_OFFSET;
    }
    if (player) {
      const headingDelta = Math.atan2(
        Math.sin(targetHeading.current - group.current.rotation.y),
        Math.cos(targetHeading.current - group.current.rotation.y),
      );
      group.current.rotation.y += headingDelta * (1 - Math.exp(-18 * delta));
    }
    group.current.position.lerp(destination, player ? .16 : .08);
  });

  return (
    <group ref={group} position={initialPosition} onClick={(event) => { event.stopPropagation(); onClick?.(); }}>
      <primitive object={character} scale={.92} rotation={[0, Math.PI, 0]} />
      {active && (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .035, 0]}>
            <ringGeometry args={[.7, .86, 40]} />
            <meshBasicMaterial color="#d8ff5f" transparent opacity={.9} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 2.7, 0]}>
            <cylinderGeometry args={[.08, .7, 5.4, 24, 1, true]} />
            <meshBasicMaterial color="#d8ff5f" transparent opacity={.08} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        </>
      )}
      {name && (
        <Html position={[0, 2.58, 0]} center distanceFactor={10} className="world3d-name">
          <span className={active ? "active" : ""}>{active ? `${waypointLabel ? `${waypointLabel.toUpperCase()} · ` : "TALK · "}` : ""}{name}</span>
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

type VehicleKind = "delivery" | "police" | "sedan" | "suv" | "taxi";

function VehicleModel({ kind, position, rotation = 0, scale = .72 }: { kind: VehicleKind; position: [number, number, number]; rotation?: number; scale?: number }) {
  return <Model url={`${CAR_ROOT}/${kind}.glb`} position={position} rotation={[0, rotation, 0]} scale={scale} />;
}

function Taxi({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return <VehicleModel kind="taxi" position={position} rotation={rotation} scale={.74} />;
}

function CityVehicles({ cityName }: { cityName: string }) {
  if (cityName === "New York") return null;
  const first: VehicleKind = cityName === "Paris" || cityName === "Madrid" ? "sedan" : cityName === "Mumbai" || cityName === "Delhi" ? "delivery" : "suv";
  const second: VehicleKind = cityName === "Mumbai" ? "taxi" : cityName === "Paris" ? "suv" : "sedan";
  return <group>
    <VehicleModel kind={first} position={[-1.25, .03, -12.5]} rotation={.04} />
    <VehicleModel kind={second} position={[1.25, .03, 11.5]} rotation={Math.PI + .04} scale={.69} />
  </group>;
}

function TrafficSignal({ position }: { position: [number, number, number] }) {
  return <group position={position}>
    <mesh castShadow position={[0, 1.65, 0]}><cylinderGeometry args={[.045, .065, 3.3, 10]} /><meshStandardMaterial color="#252a28" metalness={.65} /></mesh>
    <mesh castShadow position={[0, 3.18, 0]}><boxGeometry args={[.3, .78, .3]} /><meshStandardMaterial color="#e2b520" roughness={.58} /></mesh>
    {[.25, 0, -.25].map((y, index) => <mesh key={y} position={[0, 3.18 + y, -.16]}><circleGeometry args={[.085, 16]} /><meshBasicMaterial color={["#e7463f", "#e5b638", "#42d477"][index]} /></mesh>)}
  </group>;
}

function NewYorkStreetLife() {
  return <group>
    <Taxi position={[-1.2, .08, -7.8]} rotation={.08} />
    <Taxi position={[1.3, .08, 7.4]} rotation={Math.PI + .08} />
    <Taxi position={[-1.15, .08, 13]} rotation={.08} />
    <VehicleModel kind="police" position={[1.3, .03, -16.5]} rotation={Math.PI + .04} scale={.7} />
    <TrafficSignal position={[-6.15, 0, -2.8]} />
    <TrafficSignal position={[6.15, 0, 5.5]} />
    {[-2.4, -1.2, 0, 1.2, 2.4].map((x) => <mesh key={`crosswalk-${x}`} position={[x, .025, 1.4]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[.64, 4.9]} /><meshBasicMaterial color="#e7e4da" transparent opacity={.82} /></mesh>)}
    <group position={[5.55, 0, -8.7]}>
      <mesh castShadow position={[0, .72, 0]}><boxGeometry args={[1.35, 1.1, .75]} /><meshStandardMaterial color="#2f81ce" /></mesh>
      <mesh position={[0, 1.42, 0]}><boxGeometry args={[1.55, .25, .9]} /><meshStandardMaterial color="#f1c52a" /></mesh>
      <Html position={[0, 1.42, .48]} center distanceFactor={9} className="street-prop-label"><span>HOT DOGS</span></Html>
    </group>
    <group position={[-5.9, 0, 8.2]}>
      <mesh castShadow position={[0, .2, 0]}><cylinderGeometry args={[.34, .38, .4, 14]} /><meshStandardMaterial color="#3a4143" metalness={.65} /></mesh>
      <Sparkles count={14} scale={[1.4, 3.2, 1.4]} size={2} speed={.55} opacity={.3} color="#d9f2ee" />
    </group>
    {[-10.5, -3.3, 4.5, 11.8].map((z, index) => <group key={z} position={[index % 2 ? 6.15 : -6.15, 0, z]}>
      <mesh castShadow position={[0, .32, 0]}><cylinderGeometry args={[.1, .14, .64, 10]} /><meshStandardMaterial color="#b83227" roughness={.72} /></mesh>
      <mesh position={[0, .68, 0]}><sphereGeometry args={[.15, 12, 8]} /><meshStandardMaterial color="#bd3a2c" /></mesh>
    </group>)}
    <group position={[0, 0, -27]}>
      <mesh castShadow position={[-3.6, 3.2, 0]}><boxGeometry args={[3.2, 5.8, .45]} /><meshStandardMaterial color="#24282b" metalness={.25} /></mesh>
      <mesh position={[-3.35, 4.1, -.25]}><planeGeometry args={[2.45, 2.1]} /><meshStandardMaterial color="#ed375e" emissive="#d51646" emissiveIntensity={1.7} /></mesh>
      <mesh castShadow position={[3.65, 3.5, .1]}><boxGeometry args={[3.5, 6.5, .5]} /><meshStandardMaterial color="#272b2e" metalness={.25} /></mesh>
      <mesh position={[3.4, 4.35, -.18]}><planeGeometry args={[2.7, 2.35]} /><meshStandardMaterial color="#3cc5e8" emissive="#1678d4" emissiveIntensity={1.8} /></mesh>
      <Html position={[0, 7.15, 0]} center distanceFactor={13} className="landmark-label"><span>Times Square · Broadway</span></Html>
    </group>
  </group>;
}

function CafeTable({ position }: { position: [number, number, number] }) {
  return <group position={position}>
    <mesh castShadow position={[0, .55, 0]}><cylinderGeometry args={[.58, .58, .08, 20]} /><meshStandardMaterial color="#6c3f2d" roughness={.72} /></mesh>
    <mesh castShadow position={[0, .27, 0]}><cylinderGeometry args={[.07, .09, .55, 10]} /><meshStandardMaterial color="#252523" metalness={.55} /></mesh>
    {[-.8, .8].map((x) => <group key={x} position={[x, 0, 0]}><mesh position={[0, .32, 0]}><boxGeometry args={[.42, .08, .42]} /><meshStandardMaterial color="#b23c34" /></mesh><mesh position={[0, .28, .18]} rotation={[.2, 0, 0]}><boxGeometry args={[.42, .65, .08]} /><meshStandardMaterial color="#b23c34" /></mesh></group>)}
  </group>;
}

function ParisStreetLife() {
  return <group>
    {[-9, -2, 6.5].map((z) => <CafeTable key={z} position={[-5.5, 0, z]} />)}
    <group position={[5.7, 0, -6]}>
      <mesh castShadow position={[0, 1.35, 0]}><cylinderGeometry args={[.07, .09, 2.7, 12]} /><meshStandardMaterial color="#315b4a" metalness={.55} /></mesh>
      <mesh position={[0, 2.72, 0]} rotation={[0, 0, -.08]}><circleGeometry args={[.5, 24]} /><meshStandardMaterial color="#3a7f68" /></mesh>
      <Html position={[0, 2.72, .03]} center distanceFactor={8} className="street-prop-label metro"><span>M</span></Html>
    </group>
    {[-10, 1, 11].map((z, index) => <group key={z} position={[5.6, 0, z]}>
      <mesh castShadow position={[0, .72, 0]} rotation={[0, index % 2 ? .08 : -.08, 0]}><boxGeometry args={[1.45, 1.4, .6]} /><meshStandardMaterial color="#315c4a" roughness={.8} /></mesh>
      <mesh position={[0, .82, -.32]}><planeGeometry args={[1.15, .85]} /><meshStandardMaterial color={index % 2 ? "#d7c7a4" : "#d9b870"} /></mesh>
      <Html position={[0, 1.58, 0]} center distanceFactor={9} className="street-prop-label"><span>BOUQUINISTE</span></Html>
    </group>)}
    {[-12, -4, 5, 13].map((z, index) => <StreetLamp key={z} position={[index % 2 ? 6.25 : -6.25, 0, z]} />)}
    <CityLandmark cityName="Paris" />
    <group position={[0, 0, -22]}>
      <mesh position={[0, .35, 0]}><boxGeometry args={[13, .7, .25]} /><meshStandardMaterial color="#767973" metalness={.45} /></mesh>
      {[-5, -3, -1, 1, 3, 5].map((x) => <mesh key={x} position={[x, 1.05, 0]}><cylinderGeometry args={[.035, .035, 1.4, 8]} /><meshStandardMaterial color="#555955" /></mesh>)}
    </group>
  </group>;
}

function AutoRickshaw({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return <group position={position} rotation={[0, rotation, 0]}>
    <mesh castShadow position={[0, .42, 0]}><boxGeometry args={[1.05, .62, 1.55]} /><meshStandardMaterial color="#e4ba22" roughness={.62} /></mesh>
    <mesh castShadow position={[0, .88, .1]}><boxGeometry args={[1.02, .58, 1.2]} /><meshStandardMaterial color="#171b19" roughness={.72} /></mesh>
    <mesh position={[0, .92, -.52]}><planeGeometry args={[.78, .42]} /><meshStandardMaterial color="#8ec0c7" transparent opacity={.72} /></mesh>
    {[-.43, .43].map((x) => <mesh key={x} position={[x, .18, .45]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.18, .18, .13, 14]} /><meshStandardMaterial color="#111" /></mesh>)}
    <mesh position={[0, .18, -.6]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.18, .18, .13, 14]} /><meshStandardMaterial color="#111" /></mesh>
  </group>;
}

function MumbaiStreetLife() {
  return <group>
    <AutoRickshaw position={[-1.3, .02, -8]} rotation={.05} />
    <AutoRickshaw position={[1.25, .02, 8]} rotation={Math.PI + .04} />
    <group position={[-5.7, 0, -3]}>
      <mesh castShadow position={[0, .7, 0]}><boxGeometry args={[1.7, 1.35, .8]} /><meshStandardMaterial color="#317c65" /></mesh>
      <mesh position={[0, 1.52, 0]}><coneGeometry args={[1.2, .75, 4]} /><meshStandardMaterial color="#e86c42" /></mesh>
      <Html position={[0, 1.5, .48]} center distanceFactor={9} className="street-prop-label"><span>CHAI · चहा</span></Html>
    </group>
    <group position={[5.75, 0, 6]}>
      <mesh castShadow position={[0, 1.15, 0]}><boxGeometry args={[1.8, 2.3, .8]} /><meshStandardMaterial color="#c94435" /></mesh>
      {[.35, .8, 1.25, 1.7].map((y) => <mesh key={y} position={[0, y, -.42]}><planeGeometry args={[1.4, .12]} /><meshBasicMaterial color="#f1d36c" /></mesh>)}
      <Html position={[0, 2.55, 0]} center distanceFactor={10} className="street-prop-label"><span>BEST</span></Html>
    </group>
    {[-12, -4, 5, 13].map((z, index) => <StreetLamp key={z} position={[index % 2 ? 6.25 : -6.25, 0, z]} />)}
    <CityLandmark cityName="Mumbai" />
    {[-8, 2, 11].map((z, index) => <group key={z} position={[index % 2 ? -5.8 : 5.8, 0, z]}>
      <mesh castShadow position={[0, .75, 0]}><boxGeometry args={[1.65, 1.4, .65]} /><meshStandardMaterial color={["#e46b43", "#4c8d79", "#d3a12f"][index]} /></mesh>
      <mesh position={[0, 1.55, 0]}><boxGeometry args={[1.9, .18, .85]} /><meshStandardMaterial color="#f0d6a2" /></mesh>
    </group>)}
  </group>;
}

function facadeTexture(seed: number) {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  const warm = seed % 5 === 0;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const frame = x % 12 < 2 || y % 10 < 2;
      const lit = ((Math.floor(x / 12) * 7 + Math.floor(y / 10) * 11 + seed) % 6) < 2;
      const index = (y * size + x) * 4;
      const value = frame ? 190 : lit ? (warm ? 128 : 112) : 48;
      data[index] = frame ? 196 : value;
      data[index + 1] = frame ? 198 : lit ? (warm ? 116 : 128) : 55;
      data[index + 2] = frame ? 194 : lit ? (warm ? 88 : 144) : 62;
      data[index + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(.62, 1.1);
  texture.needsUpdate = true;
  return texture;
}

function OsmBuilding({ building, sceneClass, detailed = false }: { building: Neighborhood["buildings"][number]; sceneClass: string; detailed?: boolean }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    building.points.forEach((point, index) => {
      if (index === 0) shape.moveTo(point.x, -point.z);
      else shape.lineTo(point.x, -point.z);
    });
    shape.closePath();
    const result = new THREE.ExtrudeGeometry(shape, { depth: building.height, bevelEnabled: false, curveSegments: 1 });
    result.rotateX(-Math.PI / 2);
    result.computeVertexNormals();
    return result;
  }, [building]);

  const texture = useMemo(() => detailed ? facadeTexture(building.id) : null, [building.id, detailed]);

  useEffect(() => () => { geometry.dispose(); texture?.dispose(); }, [geometry, texture]);
  const palette = detailed ? ["#b7aaa0", "#837c78", "#c0b8ae", "#716d69", "#9c8e82"] : sceneClass === "desert" ? ["#b99b72", "#d0b88f", "#927e63"] : sceneClass === "india" ? ["#ba8b70", "#d4ad80", "#846c62"] : sceneClass === "east" ? ["#7c8589", "#a0958a", "#657174"] : ["#8f9694", "#b2aaa0", "#707977"];
  const color = palette[building.id % palette.length];
  const center = building.points.reduce((total, point) => ({ x: total.x + point.x / building.points.length, z: total.z + point.z / building.points.length }), { x: 0, z: 0 });

  return (
    <group>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial color={color} map={texture ?? undefined} emissive={detailed ? "#101415" : "#000000"} emissiveIntensity={detailed ? .05 : 0} roughness={detailed ? .72 : .86} metalness={detailed ? .1 : .04} />
      </mesh>
      {detailed && building.height > 2.6 && (
        <group position={[center.x, building.height, center.z]}>
          <mesh castShadow position={[0, .16, 0]}><boxGeometry args={[.55, .32, .55]} /><meshStandardMaterial color="#575b5b" roughness={.72} metalness={.38} /></mesh>
          {building.id % 4 === 0 && <mesh position={[0, .62, 0]}><cylinderGeometry args={[.2, .24, .65, 12]} /><meshStandardMaterial color="#443b35" roughness={.82} /></mesh>}
        </group>
      )}
    </group>
  );
}

function buildingCenter(building: Neighborhood["buildings"][number]) {
  return building.points.reduce((total, point) => ({ x: total.x + point.x / building.points.length, z: total.z + point.z / building.points.length }), { x: 0, z: 0 });
}

function footprintScale(building: Neighborhood["buildings"][number], maximum = .78) {
  const xs = building.points.map((point) => point.x);
  const zs = building.points.map((point) => point.z);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs), 1);
  return Math.min(maximum, 4.4 / span);
}

function PlayableRoad() {
  return <group>
    <mesh receiveShadow position={[0, .01, 0]}><boxGeometry args={[8.4, .09, 48]} /><meshStandardMaterial color="#202427" roughness={.94} /></mesh>
    {[-5.15, 5.15].map((x) => <mesh key={x} receiveShadow position={[x, .055, 0]}><boxGeometry args={[1.5, .16, 48]} /><meshStandardMaterial color="#a9a49b" roughness={.96} /></mesh>)}
    {[-1.45, 1.45].map((x) => <group key={x}>{Array.from({ length: 16 }, (_, index) => <mesh key={index} position={[x, .075, -22.5 + index * 3]}><boxGeometry args={[.055, .018, 1.35]} /><meshBasicMaterial color="#e7d477" /></mesh>)}</group>)}
    {[-17, -5, 7, 19].map((z) => <group key={z}>{Array.from({ length: 11 }, (_, index) => <mesh key={index} position={[-3.6 + index * .72, .082, z]}><boxGeometry args={[.46, .018, .16]} /><meshBasicMaterial color="#eeeadd" /></mesh>)}</group>)}
  </group>;
}

function NewYorkNeighborhood({ data }: { data: Neighborhood }) {
  const towers = useMemo(() => [...data.buildings].sort((a, b) => b.height - a.height).slice(0, 18), [data.buildings]);
  return <group>
    <PlayableRoad />
    {towers.map((building, index) => {
      const side = index % 2 === 0 ? -1 : 1;
      const slot = Math.floor(index / 2);
      const target = { x: side * (8.2 + (index % 3) * .18), z: -19.2 + slot * 4.8 };
      const center = buildingCenter(building);
      const scale = footprintScale(building);
      return <group key={building.id}>
        <group position={[target.x - center.x * scale, 0, target.z - center.z * scale]} scale={[scale, 1, scale]}><OsmBuilding building={building} sceneClass="atlantic" detailed /></group>
      </group>;
    })}
  </group>;
}

function OsmNeighborhood({ data, sceneClass }: { data: Neighborhood; sceneClass: string }) {
  const detailed = data.detailLevel === "nyc-official";
  if (detailed) return <NewYorkNeighborhood data={data} />;
  const buildings = [...data.buildings].sort((a, b) => b.height - a.height).slice(0, 16);
  return <group>
    <PlayableRoad />
    {buildings.map((building, index) => {
      const side = index % 2 === 0 ? -1 : 1;
      const slot = Math.floor(index / 2);
      const target = { x: side * (8.25 + (index % 3) * .15), z: -18 + slot * 5.1 };
      const center = buildingCenter(building);
      const scale = footprintScale(building, .7);
      return <group key={building.id} position={[target.x - center.x * scale, 0, target.z - center.z * scale]} scale={[scale, 1, scale]}>
        <OsmBuilding building={building} sceneClass={sceneClass} />
      </group>;
    })}
  </group>;
}

function DetailedNeighborhood({ data, sceneClass }: { data: Neighborhood; sceneClass: string }) {
  return <OsmNeighborhood data={data} sceneClass={sceneClass} />;
}

function FallbackStreet() {
  return <PlayableRoad />;
}

function SadakStreetRibbon({ cityName, sceneClass }: { cityName: string; sceneClass: string }) {
  const citySeed = [...cityName].reduce((total, character) => total + character.charCodeAt(0), 0);
  const slots = [-11.5, -4.8, 1.9, 8.6, 15.3];
  return (
    <group>
      {([-1, 1] as const).flatMap((side) => slots.map((z, index) => {
        const seed = citySeed + index * 17 + (side > 0 ? 101 : 0);
        const floors = cityName === "New York" ? 4 + seed % 3 : 2 + seed % 3;
        return (
          <SadakStreetBuilding
            key={`${side}-${z}`}
            position={[side * 10.55, 0, z]}
            rotation={Math.PI / 2}
            width={6.15}
            depth={cityName === "New York" ? 4.1 : 4.5}
            floors={floors}
            seed={seed}
            sceneClass={sceneClass}
          />
        );
      }))}
    </group>
  );
}

const LANDMARKS: Record<string, string> = {
  "New York": "Liberty Harbor",
  Beijing: "Temple Gate",
  Delhi: "India Gate",
  Madrid: "Puerta de Alcalá",
  Paris: "Eiffel Tower",
  Cairo: "Giza Pyramids",
  Dhaka: "National Memorial",
  "São Paulo": "MASP",
  Moscow: "St. Basil’s",
  Lahore: "Minar-e-Pakistan",
  Mumbai: "Gateway of India",
  Bengaluru: "Vidhana Soudha",
};

function CityLandmark({ cityName }: { cityName: string }) {
  const stone = cityName === "Cairo" ? "#d8ad67" : cityName === "Moscow" ? "#d34f48" : cityName === "Beijing" ? "#b93632" : "#c9c0a6";
  const label = LANDMARKS[cityName] ?? cityName;
  let structure: ReactNode;

  if (cityName === "Paris") {
    structure = <><mesh position={[0, 2.6, 0]}><coneGeometry args={[2.2, 5.4, 4, 1, true]} /><meshStandardMaterial color="#5c5b57" wireframe /></mesh><mesh position={[0, 5.7, 0]}><cylinderGeometry args={[.05, .12, 1.4, 8]} /><meshStandardMaterial color="#444744" /></mesh>{[1.2, 2.8, 4.4].map((y) => <mesh key={y} position={[0, y, 0]}><boxGeometry args={[3.2 - y * .42, .13, 1.5 - y * .18]} /><meshStandardMaterial color="#575955" /></mesh>)}</>;
  } else if (cityName === "Cairo") {
    structure = <>{[-2.2, .2, 2.4].map((x, index) => <mesh key={x} position={[x, 1.5 - index * .2, index * .5]} rotation={[0, Math.PI / 4, 0]}><coneGeometry args={[2.2 - index * .35, 3.2 - index * .35, 4]} /><meshStandardMaterial color={["#d9aa61", "#c8944d", "#e1bd79"][index]} roughness={1} /></mesh>)}</>;
  } else if (cityName === "New York") {
    structure = <><mesh position={[0, .7, 0]}><boxGeometry args={[2.2, 1.4, 2.2]} /><meshStandardMaterial color="#7e827d" /></mesh><mesh position={[0, 2.55, 0]}><capsuleGeometry args={[.45, 2.3, 8, 12]} /><meshStandardMaterial color="#6fa994" /></mesh><mesh position={[0, 4.35, 0]}><sphereGeometry args={[.43, 12, 12]} /><meshStandardMaterial color="#6fa994" /></mesh><mesh position={[.7, 4.65, 0]} rotation={[0, 0, -.35]}><cylinderGeometry args={[.09, .12, 1.7, 8]} /><meshStandardMaterial color="#6fa994" /></mesh><pointLight position={[1, 5.6, 0]} color="#ffb84d" intensity={12} distance={8} /></>;
  } else if (cityName === "Lahore") {
    structure = <><mesh position={[0, 2.5, 0]}><cylinderGeometry args={[.42, 1.5, 5, 24]} /><meshStandardMaterial color="#ddd4bf" /></mesh><mesh position={[0, 5.4, 0]}><sphereGeometry args={[.35, 14, 14]} /><meshStandardMaterial color="#d8ff5f" /></mesh><mesh position={[0, .35, 0]}><cylinderGeometry args={[2.2, 2.6, .7, 24]} /><meshStandardMaterial color="#b7aa93" /></mesh></>;
  } else if (cityName === "Moscow") {
    structure = <>{[-1.7, 0, 1.7].map((x, index) => <group key={x} position={[x, 0, index === 1 ? -.45 : 0]}><mesh position={[0, 2, 0]}><cylinderGeometry args={[.7, .88, 4, 12]} /><meshStandardMaterial color={["#3d87b5", "#c44740", "#e2b84b"][index]} /></mesh><mesh position={[0, 4.35, 0]}><sphereGeometry args={[.76, 18, 12]} /><meshStandardMaterial color={["#e4c14d", "#4ca089", "#386fa2"][index]} /></mesh><mesh position={[0, 5.1, 0]}><coneGeometry args={[.18, 1.1, 8]} /><meshStandardMaterial color="#d7b94d" /></mesh></group>)}</>;
  } else if (cityName === "Beijing") {
    structure = <>{[0, 1.35, 2.5].map((y, index) => <group key={y} position={[0, y, 0]}><mesh position={[0, .55, 0]}><boxGeometry args={[4.6 - index * .8, 1.1, 2.8 - index * .45]} /><meshStandardMaterial color="#a83a31" /></mesh><mesh position={[0, 1.2, 0]} scale={[1 - index * .12, 1, 1 - index * .12]}><coneGeometry args={[3.3, .8, 4]} /><meshStandardMaterial color="#284b3d" /></mesh></group>)}</>;
  } else if (cityName === "São Paulo") {
    structure = <><mesh position={[0, 2.7, 0]}><boxGeometry args={[5.5, 2.2, 1.8]} /><meshStandardMaterial color="#3d4648" metalness={.35} /></mesh>{[-2.25, 2.25].map((x) => <mesh key={x} position={[x, 1.7, 0]}><boxGeometry args={[.3, 3.4, 2.1]} /><meshStandardMaterial color="#d83c35" /></mesh>)}</>;
  } else if (cityName === "Dhaka") {
    structure = <>{[-1.5, -.75, 0, .75, 1.5].map((x) => <mesh key={x} position={[x, 2.4 - Math.abs(x) * .45, 0]} rotation={[0, 0, x * .16]}><boxGeometry args={[.32, 5 - Math.abs(x) * .6, 1.3]} /><meshStandardMaterial color="#dedbd0" /></mesh>)}</>;
  } else if (["Delhi", "Madrid", "Mumbai"].includes(cityName)) {
    structure = <><mesh position={[-1.55, 2, 0]}><boxGeometry args={[1.15, 4, 1.7]} /><meshStandardMaterial color={stone} /></mesh><mesh position={[1.55, 2, 0]}><boxGeometry args={[1.15, 4, 1.7]} /><meshStandardMaterial color={stone} /></mesh><mesh position={[0, 4.3, 0]}><boxGeometry args={[4.3, 1.15, 1.9]} /><meshStandardMaterial color={stone} /></mesh>{cityName === "Mumbai" && [-1.5, 1.5].map((x) => <mesh key={x} position={[x, 5.15, 0]}><sphereGeometry args={[.52, 16, 10]} /><meshStandardMaterial color="#b9aa8c" /></mesh>)}</>;
  } else {
    structure = <><mesh position={[0, 2.1, 0]}><boxGeometry args={[5.2, 4.2, 2.1]} /><meshStandardMaterial color="#d7d0bc" /></mesh>{[-1.7, 0, 1.7].map((x) => <mesh key={x} position={[x, 4.45, 0]}><sphereGeometry args={[.62, 18, 12]} /><meshStandardMaterial color="#caa550" /></mesh>)}<mesh position={[0, 5.4, 0]}><coneGeometry args={[.18, 1.3, 8]} /><meshStandardMaterial color="#d8ff5f" /></mesh></>;
  }

  return (
    <group position={[0, 0, -27]} scale={1.05}>
      {structure}
      <Html position={[0, 6.5, 0]} center distanceFactor={13} className="landmark-label"><span>{label}</span></Html>
    </group>
  );
}

function PlayerOrbitCamera({ onDirectionChange, playerPosition, resetSignal }: { onDirectionChange: (direction: CameraDirection) => void; playerPosition: Point; resetSignal: number }) {
  const { camera } = useThree();
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null);
  const lastPlayerPosition = useRef(new THREE.Vector3());
  const playerTarget = useMemo(() => new THREE.Vector3(), []);
  const movementDelta = useMemo(() => new THREE.Vector3(), []);
  const initialized = useRef(false);

  const publishDirection = useCallback(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const x = controls.target.x - camera.position.x;
    const z = controls.target.z - camera.position.z;
    const length = Math.hypot(x, z);
    if (length > .001) onDirectionChange({ x: x / length, z: z / length });
  }, [camera, onDirectionChange]);

  useFrame(() => {
    const [x, , z] = toWorld(playerPosition);
    playerTarget.set(x, 1.15, z);
    const controls = controlsRef.current;
    if (!controls) return;

    if (!initialized.current) {
      camera.position.set(x, 5.1, z + 7.2);
      controls.target.copy(playerTarget);
      lastPlayerPosition.current.copy(playerTarget);
      controls.update();
      initialized.current = true;
      return;
    }

    movementDelta.subVectors(playerTarget, lastPlayerPosition.current);
    if (movementDelta.lengthSq() > 0) {
      camera.position.add(movementDelta);
      controls.target.add(movementDelta);
      lastPlayerPosition.current.copy(playerTarget);
    }
    controls.update();
  });

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || resetSignal === 0) return;
    const currentTarget = lastPlayerPosition.current;
    camera.position.set(currentTarget.x, 5.1, currentTarget.z + 7.2);
    controls.target.copy(currentTarget);
    controls.update();
  }, [camera, resetSignal]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={.08}
      enablePan={false}
      minDistance={3.8}
      maxDistance={16}
      minPolarAngle={.28}
      maxPolarAngle={Math.PI / 2.08}
      mouseButtons={{
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.ROTATE,
      }}
      touches={{
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      }}
      onChange={publishDirection}
    />
  );
}

function CityScene({ activeNpcIndex, cameraResetSignal, cityName, neighborhood, npcNames, npcPositions, onCameraDirectionChange, onMoveTo, onSelectNpc, playerPosition, sceneClass, waypointLabel }: World3DProps & { cameraResetSignal: number; neighborhood: Neighborhood | null }) {
  const playerWorld = toWorld(playerPosition);
  const sky = sceneClass === "desert" ? "#c9966f" : sceneClass === "india" ? "#d79a72" : sceneClass === "east" ? "#7894a4" : sceneClass === "tropical" ? "#5f9b9a" : "#86abc0";

  function moveOnGround(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    onMoveTo(toScreen(event.point.x, event.point.z));
  }

  return (
    <>
      <color attach="background" args={[sky]} />
      <fog attach="fog" args={[sky, 18, 46]} />
      <ambientLight intensity={1.25} />
      <hemisphereLight args={["#d9efff", "#29372f", 2.1]} />
      <directionalLight castShadow position={[-9, 14, 8]} intensity={3.2} color="#fff1d5" shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <Environment preset="city" environmentIntensity={.45} />
      <Sparkles count={30} scale={[24, 5, 24]} size={1.1} speed={.18} opacity={.18} color="#d8ff5f" />

      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -.03, 0]} onClick={moveOnGround}>
        <planeGeometry args={[44, 48]} />
        <meshStandardMaterial color="#70756e" roughness={.96} />
      </mesh>
      <group onClick={moveOnGround}>{neighborhood ? <DetailedNeighborhood data={neighborhood} sceneClass={sceneClass} /> : <FallbackStreet />}</group>
      <SadakStreetRibbon cityName={cityName} sceneClass={sceneClass} />
      {!['New York', 'Paris', 'Mumbai'].includes(cityName) && <>
        {[-11, -3, 6, 13].map((z, index) => <Model key={`tree-left-${z}`} url={`${MODEL_ROOT}/${index % 2 ? "tree-small" : "tree-large"}.glb`} position={[-6.8, 0, z]} scale={1.7} />)}
        {[-8, 1, 9].map((z, index) => <Model key={`tree-right-${z}`} url={`${MODEL_ROOT}/${index % 2 ? "tree-large" : "tree-small"}.glb`} position={[6.8, 0, z]} scale={1.6} />)}
        <StreetLamp position={[-6.2, 0, -4]} />
        <StreetLamp position={[6.2, 0, 4]} />
        <StreetLamp position={[-6.2, 0, 11]} />
        <CityLandmark cityName={cityName} />
      </>}
      <CityVehicles cityName={cityName} />
      {cityName === "New York" && <NewYorkStreetLife />}
      {cityName === "Paris" && <ParisStreetLife />}
      {cityName === "Mumbai" && <MumbaiStreetLife />}

      {npcPositions.map((point, index) => (
        <Person key={npcNames[index]} active={index === activeNpcIndex} model={["animated-woman.glb", "business.glb", "punk-woman.glb"][index]} name={npcNames[index]} onClick={() => onSelectNpc(index)} position={toWorld(point)} waypointLabel={index === activeNpcIndex ? waypointLabel : undefined} />
      ))}
      <Person key={`player-${cityName}`} player model="casual.glb" position={playerWorld} />
      <PlayerOrbitCamera key={cityName} onDirectionChange={onCameraDirectionChange} playerPosition={playerPosition} resetSignal={cameraResetSignal} />
    </>
  );
}

export default function World3D(props: World3DProps) {
  const [neighborhood, setNeighborhood] = useState<Neighborhood | null>(null);
  const [mapStatus, setMapStatus] = useState<"loading" | "bundled" | "refreshing" | "live" | "fallback">("loading");
  const [cameraResetSignal, setCameraResetSignal] = useState(0);

  function refreshMap() {
    setMapStatus("refreshing");
    fetch(`/api/osm?lat=${props.latitude.toFixed(5)}&lon=${props.longitude.toFixed(5)}`)
      .then((response) => {
        if (!response.ok) throw new Error("Map refresh failed");
        return response.json() as Promise<Neighborhood>;
      })
      .then((data) => {
        if (!data.roads?.length && !data.buildings?.length) throw new Error("No map geometry");
        setNeighborhood(data);
        setMapStatus("live");
      })
      .catch(() => setMapStatus("bundled"));
  }

  function releaseConversationFocus() {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) activeElement.blur();
  }

  useEffect(() => {
    const controller = new AbortController();
    setNeighborhood(null);
    setMapStatus("loading");
    fetch(`/city-data/${props.cityId}.json`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Map request failed");
        return response.json() as Promise<Neighborhood>;
      })
      .then((data) => {
        if (!data.roads?.length && !data.buildings?.length) throw new Error("No map geometry");
        setNeighborhood(data);
        setMapStatus("bundled");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMapStatus("fallback");
      });
    return () => controller.abort();
  }, [props.cityId]);

  return (
    <div className="world3d-canvas" aria-label={`Interactive 3D street in ${props.cityName}`}>
      <Canvas shadows camera={{ fov: 52, near: .1, far: 90, position: [0, 5, 12] }} dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: "high-performance" }} onContextMenu={(event) => event.preventDefault()} onPointerDown={releaseConversationFocus}>
        <Suspense fallback={null}><CityScene {...props} cameraResetSignal={cameraResetSignal} neighborhood={neighborhood} /></Suspense>
      </Canvas>
      <div className="camera-orbit-hud" role="group" aria-label="360 degree camera controls">
        <span aria-hidden="true">360°</span>
        <div><strong>ORBIT CAMERA</strong><small>DRAG TO TURN · WHEEL OR PINCH TO ZOOM</small></div>
        <button type="button" onClick={() => setCameraResetSignal((current) => current + 1)}>RESET</button>
      </div>
      <button className={`osm-world-status ${mapStatus}`} onClick={props.cityId === "new-york" ? undefined : refreshMap} disabled={props.cityId === "new-york" || mapStatus === "loading" || mapStatus === "refreshing"} title={props.cityId === "new-york" ? "Official NYC building footprints and roof heights" : "Load the newest map data from OpenStreetMap"}>
        <span />{props.cityId === "new-york" && mapStatus === "bundled" ? "NYC official digital street" : mapStatus === "live" ? "Live OSM district" : mapStatus === "bundled" ? "Downloaded OSM district · refresh" : mapStatus === "loading" ? "Loading city area…" : mapStatus === "refreshing" ? "Refreshing map…" : "Designed fallback district"}
      </button>
      <a className="osm-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
      <div className="world3d-loading">Loading city…</div>
    </div>
  );
}

useGLTF.preload(`${MODEL_ROOT}/building-type-a.glb`);
useGLTF.preload(`${MODEL_ROOT}/building-type-f.glb`);
useGLTF.preload(`${MODEL_ROOT}/building-type-t.glb`);
useGLTF.preload(`${CAR_ROOT}/taxi.glb`);
useGLTF.preload(`${CAR_ROOT}/sedan.glb`);
useGLTF.preload(`${CAR_ROOT}/suv.glb`);
useGLTF.preload(`${CAR_ROOT}/delivery.glb`);
useGLTF.preload(`${CAR_ROOT}/police.glb`);
