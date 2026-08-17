"use client";

import { Suspense, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, ThreeElements, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { Environment, Html, Sparkles, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import SadakStreetBuilding from "./SadakStreetBuilding";

type Point = { x: number; y: number };

type World3DProps = {
  activeNpcIndex: number;
  cityId: string;
  cityName: string;
  npcNames: string[];
  npcPositions: Point[];
  onMoveTo: (point: Point) => void;
  onSelectNpc: (index: number) => void;
  playerPosition: Point;
  sceneClass: string;
  latitude: number;
  longitude: number;
};

type MapPoint = { x: number; z: number };
type Neighborhood = {
  roads: Array<{ id: number; kind?: string; points: MapPoint[] }>;
  buildings: Array<{ id: number; height: number; heightMeters?: number; year?: number | null; bin?: string; points: MapPoint[] }>;
  osm?: string;
  detailLevel?: string;
};

type O2WMesh = {
  positions: () => number[];
  indices: () => number[];
  normals: () => number[];
  uvs: () => number[];
  color: () => number[];
  baseColorTexture: () => string | null;
  normalTexture: () => string | null;
  clampTextures: () => boolean;
  transparency: () => boolean;
};

type O2WModule = {
  O2WConverter: new () => { setConfig: (config: unknown) => void; convertJson: (json: string, success: (meshes: O2WMesh[]) => void, failure: (error: unknown) => void) => void };
  loadO2WConfig: (url: string, options: { lod: string }, success: (config: unknown) => void, failure: (error: unknown) => void) => void;
};

const MODEL_ROOT = "/models/kenney-city";
const CHARACTER_ROOT = "/models/quaternius";

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

function Person({ active = false, model, name, onClick, player = false, position }: {
  active?: boolean;
  model: string;
  name?: string;
  onClick?: () => void;
  player?: boolean;
  position: [number, number, number];
}) {
  const group = useRef<THREE.Group>(null);
  const source = useGLTF(`${CHARACTER_ROOT}/${model}`);
  const character = useMemo(() => cloneSkeleton(source.scene) as THREE.Group, [source.scene]);
  const mixer = useMemo(() => new THREE.AnimationMixer(character), [character]);
  const destination = useMemo(() => new THREE.Vector3(...position), [position]);
  const [initialPosition] = useState(() => new THREE.Vector3(...position));
  const activeAction = useRef<THREE.AnimationAction | null>(null);
  const activeClipName = useRef("");
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
      group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, Math.atan2(dx, dz), .18);
    }
    group.current.position.lerp(destination, player ? .16 : .08);
  });

  return (
    <group ref={group} position={initialPosition} onClick={(event) => { event.stopPropagation(); onClick?.(); }}>
      <primitive object={character} scale={.92} rotation={[0, Math.PI, 0]} />
      {active && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .035, 0]}>
          <ringGeometry args={[.7, .86, 40]} />
          <meshBasicMaterial color="#d8ff5f" transparent opacity={.9} side={THREE.DoubleSide} />
        </mesh>
      )}
      {name && (
        <Html position={[0, 2.58, 0]} center distanceFactor={10} className="world3d-name">
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

function Taxi({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return <group position={position} rotation={[0, rotation, 0]}>
    <mesh castShadow position={[0, .32, 0]}><boxGeometry args={[1.08, .38, 2.05]} /><meshStandardMaterial color="#f2bd16" roughness={.52} metalness={.18} /></mesh>
    <mesh castShadow position={[0, .62, -.05]}><boxGeometry args={[.92, .38, 1.05]} /><meshStandardMaterial color="#e4aa0d" roughness={.5} metalness={.15} /></mesh>
    <mesh position={[0, .67, -.58]}><boxGeometry args={[.78, .27, .018]} /><meshStandardMaterial color="#18262e" metalness={.55} roughness={.2} /></mesh>
    {[-.45, .45].flatMap((x) => [-.68, .68].map((z) => <mesh key={`${x}-${z}`} position={[x, .21, z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[.18, .18, .14, 14]} /><meshStandardMaterial color="#121515" roughness={.8} /></mesh>))}
    <mesh position={[0, .89, 0]}><boxGeometry args={[.44, .14, .3]} /><meshStandardMaterial color="#f4f0df" emissive="#fff3bc" emissiveIntensity={1.2} /></mesh>
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
    <TrafficSignal position={[-3.2, 0, -2.8]} />
    <TrafficSignal position={[3.1, 0, 5.5]} />
    {[-10.5, -3.3, 4.5, 11.8].map((z, index) => <group key={z} position={[index % 2 ? 3.9 : -3.9, 0, z]}>
      <mesh castShadow position={[0, .32, 0]}><cylinderGeometry args={[.1, .14, .64, 10]} /><meshStandardMaterial color="#b83227" roughness={.72} /></mesh>
      <mesh position={[0, .68, 0]}><sphereGeometry args={[.15, 12, 8]} /><meshStandardMaterial color="#bd3a2c" /></mesh>
    </group>)}
    <group position={[0, 0, -14.5]}>
      <mesh castShadow position={[-3.6, 3.2, 0]}><boxGeometry args={[3.2, 5.8, .45]} /><meshStandardMaterial color="#24282b" metalness={.25} /></mesh>
      <mesh position={[-3.35, 4.1, -.25]}><planeGeometry args={[2.45, 2.1]} /><meshStandardMaterial color="#ed375e" emissive="#d51646" emissiveIntensity={1.7} /></mesh>
      <mesh castShadow position={[3.65, 3.5, .1]}><boxGeometry args={[3.5, 6.5, .5]} /><meshStandardMaterial color="#272b2e" metalness={.25} /></mesh>
      <mesh position={[3.4, 4.35, -.18]}><planeGeometry args={[2.7, 2.35]} /><meshStandardMaterial color="#3cc5e8" emissive="#1678d4" emissiveIntensity={1.8} /></mesh>
      <Html position={[0, 7.15, 0]} center distanceFactor={13} className="landmark-label"><span>Times Square · Broadway</span></Html>
    </group>
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

function NewYorkNeighborhood({ data }: { data: Neighborhood }) {
  const towers = useMemo(() => [...data.buildings].sort((a, b) => b.height - a.height).slice(0, 18), [data.buildings]);
  return <group>
    <mesh receiveShadow position={[0, .01, 0]}><boxGeometry args={[5.4, .09, 48]} /><meshStandardMaterial color="#202427" roughness={.94} /></mesh>
    {[-3.35, 3.35].map((x) => <mesh key={x} receiveShadow position={[x, .055, 0]}><boxGeometry args={[1.25, .16, 48]} /><meshStandardMaterial color="#a9a49b" roughness={.96} /></mesh>)}
    {[-.92, .92].map((x) => <group key={x}>{Array.from({ length: 16 }, (_, index) => <mesh key={index} position={[x, .075, -22.5 + index * 3]}><boxGeometry args={[.055, .018, 1.35]} /><meshBasicMaterial color="#e7d477" /></mesh>)}</group>)}
    {[-17, -5, 7, 19].map((z) => <group key={z}>{Array.from({ length: 7 }, (_, index) => <mesh key={index} position={[-2.15 + index * .72, .082, z]}><boxGeometry args={[.46, .018, .16]} /><meshBasicMaterial color="#eeeadd" /></mesh>)}</group>)}
    {towers.map((building, index) => {
      const side = index % 2 === 0 ? -1 : 1;
      const slot = Math.floor(index / 2);
      const target = { x: side * (6.15 + (index % 3) * .18), z: -19.2 + slot * 4.8 };
      const center = buildingCenter(building);
      const footprintScale = .78;
      return <group key={building.id}>
        <group position={[target.x - center.x * footprintScale, 0, target.z - center.z * footprintScale]} scale={[footprintScale, 1, footprintScale]}><OsmBuilding building={building} sceneClass="atlantic" detailed /></group>
      </group>;
    })}
  </group>;
}

function OsmNeighborhood({ data, sceneClass }: { data: Neighborhood; sceneClass: string }) {
  const detailed = data.detailLevel === "nyc-official";
  if (detailed) return <NewYorkNeighborhood data={data} />;
  return (
    <group>
      {data.roads.map((road) => {
        const major = ["primary", "secondary", "tertiary"].includes(road.kind ?? "");
        return (
          <group key={road.id}>
            {road.points.slice(1).map((point, index) => {
              const start = road.points[index];
              const dx = point.x - start.x;
              const dz = point.z - start.z;
              const length = Math.hypot(dx, dz);
              const angle = Math.atan2(dx, dz);
              const width = major ? 1.5 : road.kind === "pedestrian" ? .8 : 1.05;
              return <group key={`${road.id}-${index}`} position={[(start.x + point.x) / 2, 0, (start.z + point.z) / 2]} rotation={[0, angle, 0]}>
                {detailed && <mesh receiveShadow position={[0, .005, 0]}><boxGeometry args={[width + .48, .08, length + .18]} /><meshStandardMaterial color="#aaa79f" roughness={.98} /></mesh>}
                <mesh receiveShadow position={[0, .055, 0]}><boxGeometry args={[width, .075, length + .1]} /><meshStandardMaterial color={detailed ? "#222628" : "#303534"} roughness={.93} /></mesh>
                {road.kind !== "pedestrian" && <mesh position={[0, .096, 0]}><boxGeometry args={[.035, .012, Math.max(.1, length - .18)]} /><meshBasicMaterial color={major ? "#e3c956" : "#c9c8be"} /></mesh>}
              </group>;
            })}
          </group>
        );
      })}
      {data.buildings.map((building) => <OsmBuilding key={building.id} building={building} sceneClass={sceneClass} detailed={detailed} />)}
    </group>
  );
}

function DetailedNeighborhood({ data, sceneClass }: { data: Neighborhood; sceneClass: string }) {
  const [cityModel, setCityModel] = useState<THREE.Group | null>(null);

  useEffect(() => {
    if (!data.osm) return;
    let cancelled = false;
    let generatedModel: THREE.Group | null = null;
    const textureLoader = new THREE.TextureLoader();
    const moduleUrl = "https://osm2world.org/build/web/0.5.0-SNAPSHOT_2026-02-18/osm2world-core-web.mjs";

    import(/* @vite-ignore */ moduleUrl).then((module: O2WModule) => {
      module.loadO2WConfig("https://tiles.osm2world.org/styles/default/standard.properties", { lod: "3" }, (config) => {
        if (cancelled) return;
        const converter = new module.O2WConverter();
        converter.setConfig(config);
        converter.convertJson(data.osm!, (meshes) => {
          if (cancelled) return;
          const group = new THREE.Group();
          meshes.slice(0, 420).forEach((source, index) => {
            const positions = source.positions();
            if (!positions?.length) return;
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
            if (source.normals()?.length === positions.length) geometry.setAttribute("normal", new THREE.Float32BufferAttribute(source.normals(), 3));
            else geometry.computeVertexNormals();
            if (source.uvs()?.length) geometry.setAttribute("uv", new THREE.Float32BufferAttribute(source.uvs(), 2));
            if (source.indices()?.length) geometry.setIndex(source.indices());
            const color = source.color?.() ?? [.55, .57, .55];
            const material = new THREE.MeshStandardMaterial({
              color: new THREE.Color(color[0] ?? .55, color[1] ?? .57, color[2] ?? .55),
              roughness: .82,
              metalness: .04,
              transparent: source.transparency?.() ?? false,
              alphaTest: source.transparency?.() ? .25 : 0,
            });
            const baseTexture = source.baseColorTexture?.();
            if (baseTexture) {
              material.map = textureLoader.load(`https://tiles.osm2world.org/${baseTexture}`);
              material.map.colorSpace = THREE.SRGBColorSpace;
              material.map.wrapS = material.map.wrapT = source.clampTextures?.() ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
            }
            const normalTexture = source.normalTexture?.();
            if (normalTexture) material.normalMap = textureLoader.load(`https://tiles.osm2world.org/${normalTexture}`);
            const mesh = new THREE.Mesh(geometry, material);
            mesh.name = `osm2world-${index}`;
            mesh.castShadow = index < 180;
            mesh.receiveShadow = true;
            group.add(mesh);
          });
          const bounds = new THREE.Box3().setFromObject(group);
          const center = bounds.getCenter(new THREE.Vector3());
          const scale = .052;
          group.scale.setScalar(scale);
          group.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
          generatedModel = group;
          setCityModel(group);
        }, () => undefined);
      }, () => undefined);
    }).catch(() => undefined);

    return () => {
      cancelled = true;
      if (generatedModel) {
        generatedModel.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          object.geometry.dispose();
          const material = object.material as THREE.MeshStandardMaterial;
          material.map?.dispose();
          material.normalMap?.dispose();
          material.dispose();
        });
      }
    };
  }, [data.osm]);

  return cityModel ? <primitive object={cityModel} /> : <OsmNeighborhood data={data} sceneClass={sceneClass} />;
}

function FallbackStreet() {
  return (
    <>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, .005, 0]}>
        <planeGeometry args={[8.2, 42]} /><meshStandardMaterial color="#292d2d" roughness={.88} />
      </mesh>
      {[-8, -2, 4, 10].map((z) => <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[0, .025, z]}><planeGeometry args={[.15, 2.6]} /><meshBasicMaterial color="#e9dba7" /></mesh>)}
    </>
  );
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
            position={[side * 8.35, 0, z]}
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
    <group position={[0, 0, -15]} scale={1.05}>
      {structure}
      <Html position={[0, 6.5, 0]} center distanceFactor={13} className="landmark-label"><span>{label}</span></Html>
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

function CityScene({ activeNpcIndex, cityName, neighborhood, npcNames, npcPositions, onMoveTo, onSelectNpc, playerPosition, sceneClass }: World3DProps & { neighborhood: Neighborhood | null }) {
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
      {cityName !== "New York" && <>
        {[-11, -3, 6, 13].map((z, index) => <Model key={`tree-left-${z}`} url={`${MODEL_ROOT}/${index % 2 ? "tree-small" : "tree-large"}.glb`} position={[-5.5, 0, z]} scale={1.7} />)}
        {[-8, 1, 9].map((z, index) => <Model key={`tree-right-${z}`} url={`${MODEL_ROOT}/${index % 2 ? "tree-large" : "tree-small"}.glb`} position={[5.5, 0, z]} scale={1.6} />)}
        <StreetLamp position={[-4.2, 0, -4]} />
        <StreetLamp position={[4.2, 0, 4]} />
        <StreetLamp position={[-4.2, 0, 11]} />
        <CityLandmark cityName={cityName} />
      </>}
      {cityName === "New York" && <NewYorkStreetLife />}

      {npcPositions.map((point, index) => (
        <Person key={npcNames[index]} active={index === activeNpcIndex} model={["animated-woman.glb", "business.glb", "punk-woman.glb"][index]} name={npcNames[index]} onClick={() => onSelectNpc(index)} position={toWorld(point)} />
      ))}
      <Person key={`player-${cityName}`} player model="casual.glb" position={playerWorld} />
      <FollowCamera playerPosition={playerPosition} />
    </>
  );
}

export default function World3D(props: World3DProps) {
  const [neighborhood, setNeighborhood] = useState<Neighborhood | null>(null);
  const [mapStatus, setMapStatus] = useState<"loading" | "bundled" | "refreshing" | "live" | "fallback">("loading");

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
      <Canvas shadows camera={{ fov: 52, near: .1, far: 90, position: [0, 5, 12] }} dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: "high-performance" }}>
        <Suspense fallback={null}><CityScene {...props} neighborhood={neighborhood} /></Suspense>
      </Canvas>
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
