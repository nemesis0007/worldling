"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Street-facing building geometry adapted from mittal-parth/sadak with
 * Parth Mittal's permission (17 August 2026). Worldling keeps the same core
 * idea: visible depth, shopfronts, ledges and roof clutter instead of a
 * texture printed on a box. See THIRD_PARTY_NOTICES.md.
 */

type SceneClass = "desert" | "east" | "india" | "tropical" | string;

type BuildingParts = {
  shell: THREE.BufferGeometry;
  glass: THREE.BufferGeometry;
  metal: THREE.BufferGeometry;
  signage: THREE.BufferGeometry;
};

const FLOOR_HEIGHT = 2.65;
const GROUND_HEIGHT = 3.35;

function randomFor(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) | 0;
    let next = Math.imul(value ^ (value >>> 15), 1 | value);
    next = (next + Math.imul(next ^ (next >>> 7), 61 | next)) ^ next;
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function slab(width: number, height: number, depth: number, x: number, y: number, z: number) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  geometry.translate(x, y, z);
  return geometry;
}

function addChhajja(
  output: THREE.BufferGeometry[],
  x: number,
  y: number,
  faceZ: number,
  facing: 1 | -1,
  width: number,
) {
  const depth = .48;
  const eave = new THREE.BoxGeometry(width, .1, depth);
  eave.rotateX(facing * -.06);
  eave.translate(x, y, faceZ + facing * depth / 2);
  output.push(eave);
  output.push(slab(width, .12, .08, x, y - .04, faceZ + facing * depth));
  [-.36, .36].forEach((offset) => {
    const bracket = new THREE.BoxGeometry(.12, .34, .26);
    bracket.rotateX(facing * .5);
    bracket.translate(x + width * offset, y - .2, faceZ + facing * .15);
    output.push(bracket);
  });
}

function addWindow(
  shell: THREE.BufferGeometry[],
  glass: THREE.BufferGeometry[],
  metal: THREE.BufferGeometry[],
  x: number,
  y: number,
  faceZ: number,
  facing: 1 | -1,
  width: number,
  arched: boolean,
) {
  const height = 1.34;
  const frame = .11;
  const reveal = .2;
  const glassZ = faceZ - facing * reveal;
  shell.push(slab(width + frame * 2, frame, reveal, x, y + height / 2, faceZ - facing * reveal / 2));
  shell.push(slab(width + frame * 2, frame, reveal, x, y - height / 2, faceZ - facing * reveal / 2));
  shell.push(slab(frame, height, reveal, x - width / 2, y, faceZ - facing * reveal / 2));
  shell.push(slab(frame, height, reveal, x + width / 2, y, faceZ - facing * reveal / 2));
  shell.push(slab(width + .28, .09, .24, x, y - height / 2 - .06, faceZ + facing * .05));
  glass.push(slab(width, height, .045, x, y, glassZ));
  metal.push(slab(.04, height, .055, x, y, glassZ - facing * .04));
  metal.push(slab(width, .035, .055, x, y, glassZ - facing * .04));

  if (arched) {
    const segments = 7;
    for (let index = 0; index < segments; index += 1) {
      const start = Math.PI - Math.PI * index / segments;
      const end = Math.PI - Math.PI * (index + 1) / segments;
      const radius = width / 2;
      const x1 = Math.cos(start) * radius;
      const y1 = Math.sin(start) * radius * .72;
      const x2 = Math.cos(end) * radius;
      const y2 = Math.sin(end) * radius * .72;
      const arch = new THREE.BoxGeometry(Math.hypot(x2 - x1, y2 - y1) + .06, .09, .17);
      arch.rotateZ(Math.atan2(y2 - y1, x2 - x1));
      arch.translate(x + (x1 + x2) / 2, y + height / 2 + (y1 + y2) / 2, faceZ + facing * .04);
      shell.push(arch);
    }
  }
}

function addBalcony(
  shell: THREE.BufferGeometry[],
  metal: THREE.BufferGeometry[],
  x: number,
  y: number,
  faceZ: number,
  facing: 1 | -1,
  width: number,
) {
  const depth = .72;
  shell.push(slab(width, .13, depth, x, y, faceZ + facing * depth / 2));
  const edgeZ = faceZ + facing * depth;
  metal.push(slab(width, .06, .06, x, y + .72, edgeZ));
  for (let index = 0; index <= 6; index += 1) {
    metal.push(slab(.035, .72, .035, x - width / 2 + width * index / 6, y + .36, edgeZ));
  }
}

function addShopfront(
  shell: THREE.BufferGeometry[],
  glass: THREE.BufferGeometry[],
  metal: THREE.BufferGeometry[],
  signage: THREE.BufferGeometry[],
  x: number,
  faceZ: number,
  facing: 1 | -1,
  width: number,
  random: () => number,
) {
  const height = 2.25;
  const inset = .3;
  const backZ = faceZ - facing * inset;
  shell.push(slab(.24, height, inset, x - width / 2, height / 2, faceZ - facing * inset / 2));
  shell.push(slab(.24, height, inset, x + width / 2, height / 2, faceZ - facing * inset / 2));
  shell.push(slab(width, .24, inset, x, height, faceZ - facing * inset / 2));

  if (random() > .32) {
    glass.push(slab(width - .3, height - .38, .05, x, height / 2 - .04, backZ));
    metal.push(slab(.06, height - .35, .06, x, height / 2, backZ - facing * .04));
  } else {
    for (let index = 0; index < 8; index += 1) {
      metal.push(slab(width - .28, height / 8 - .025, .08, x, height / 8 * (index + .5), backZ));
    }
  }

  signage.push(slab(width + .08, .58, .11, x, height + .42, faceZ + facing * .055));
  if (random() > .3) {
    const awning = new THREE.BoxGeometry(width, .055, .92);
    awning.rotateX(facing * -.3);
    awning.translate(x, height + .88, faceZ + facing * .45);
    signage.push(awning);
  }
}

function buildParts(width: number, depth: number, floors: number, seed: number, sceneClass: SceneClass): BuildingParts {
  const random = randomFor(seed);
  const totalHeight = GROUND_HEIGHT + floors * FLOOR_HEIGHT;
  const shell: THREE.BufferGeometry[] = [
    slab(width, totalHeight, depth, 0, totalHeight / 2, 0),
    slab(width + .32, .42, depth + .32, 0, .21, 0),
  ];
  const glass: THREE.BufferGeometry[] = [];
  const metal: THREE.BufferGeometry[] = [];
  const signage: THREE.BufferGeometry[] = [];
  const arched = sceneClass === "india" || sceneClass === "desert";

  for (let floor = 1; floor <= floors; floor += 1) {
    const ledgeY = GROUND_HEIGHT + (floor - 1) * FLOOR_HEIGHT;
    shell.push(slab(width + .2, .13, depth + .2, 0, ledgeY, 0));
  }
  shell.push(slab(width + .38, .24, depth + .38, 0, totalHeight + .12, 0));
  shell.push(slab(width + .16, .62, depth + .16, 0, totalHeight + .43, 0));

  for (const facing of [1, -1] as const) {
    const faceZ = facing * depth / 2;
    const bays = Math.max(2, Math.floor(width / 2.25));
    const bayWidth = width / bays;
    for (let bay = 0; bay < bays; bay += 1) {
      const x = -width / 2 + bayWidth * (bay + .5);
      addShopfront(shell, glass, metal, signage, x, faceZ, facing, bayWidth * .82, random);
      for (let floor = 0; floor < floors; floor += 1) {
        const y = GROUND_HEIGHT + floor * FLOOR_HEIGHT + FLOOR_HEIGHT / 2;
        addWindow(shell, glass, metal, x, y, faceZ, facing, Math.min(1.16, bayWidth * .5), arched && floor === 0);
        if (sceneClass === "india" && floor % 2 === 0) addChhajja(shell, x, y + .88, faceZ, facing, bayWidth * .76);
        if ((seed + bay + floor) % 5 === 0) addBalcony(shell, metal, x, GROUND_HEIGHT + floor * FLOOR_HEIGHT + .08, faceZ, facing, bayWidth * .76);
      }
    }
  }

  const tankCount = 1 + seed % 2;
  for (let index = 0; index < tankCount; index += 1) {
    const x = (random() - .5) * (width - 1.2);
    const z = (random() - .5) * (depth - 1.2);
    const tank = new THREE.CylinderGeometry(.38, .4, .75, 10);
    tank.translate(x, totalHeight + 1.15, z);
    metal.push(tank, slab(.76, .35, .76, x, totalHeight + .66, z));
  }
  if (seed % 3 === 0) shell.push(slab(1.55, 1.55, 1.45, width * .18, totalHeight + 1.15, depth * -.12));

  const merge = (geometries: THREE.BufferGeometry[]) => mergeGeometries(geometries, false) ?? new THREE.BufferGeometry();
  const result = { shell: merge(shell), glass: merge(glass), metal: merge(metal), signage: merge(signage) };
  [...shell, ...glass, ...metal, ...signage].forEach((geometry) => geometry.dispose());
  return result;
}

function paletteFor(sceneClass: SceneClass, seed: number) {
  const palettes: Record<string, string[]> = {
    desert: ["#d1a66e", "#bb805d", "#dfbd83", "#ad765e"],
    east: ["#8f938e", "#b2a391", "#737e81", "#9c8175"],
    india: ["#df9d65", "#c97c5d", "#e5b879", "#b96852"],
    tropical: ["#d9ad77", "#bc7867", "#e3c28d", "#9f8d69"],
    default: ["#9b8d82", "#b1a69a", "#7f8584", "#aa8f7d"],
  };
  const colors = palettes[sceneClass] ?? palettes.default;
  return colors[seed % colors.length];
}

export default function SadakStreetBuilding({
  depth = 4.4,
  floors = 3,
  position,
  rotation = 0,
  sceneClass,
  seed,
  width = 6,
}: {
  depth?: number;
  floors?: number;
  position: [number, number, number];
  rotation?: number;
  sceneClass: SceneClass;
  seed: number;
  width?: number;
}) {
  const parts = useMemo(() => buildParts(width, depth, floors, seed, sceneClass), [depth, floors, sceneClass, seed, width]);
  useEffect(() => () => Object.values(parts).forEach((geometry) => geometry.dispose()), [parts]);

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh geometry={parts.shell} castShadow receiveShadow>
        <meshStandardMaterial color={paletteFor(sceneClass, seed)} roughness={.82} metalness={.03} />
      </mesh>
      <mesh geometry={parts.glass} castShadow>
        <meshStandardMaterial color="#1b2b31" emissive="#d6a55a" emissiveIntensity={seed % 3 === 0 ? .34 : .1} roughness={.2} metalness={.42} />
      </mesh>
      <mesh geometry={parts.metal} castShadow>
        <meshStandardMaterial color={sceneClass === "india" ? "#31433b" : "#303637"} roughness={.48} metalness={.5} />
      </mesh>
      <mesh geometry={parts.signage} castShadow>
        <meshStandardMaterial color={["#d9533f", "#e7b533", "#2f8274", "#496f9d"][seed % 4]} roughness={.62} />
      </mesh>
    </group>
  );
}
