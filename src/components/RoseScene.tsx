"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { MotionValue } from "motion/react";

/** A single cupped petal, base at the origin, growing up +Y, concave side facing -Z (toward the flower centre). */
function makePetalGeometry(cup = 0.55, curl = 0.35) {
  const g = new THREE.PlaneGeometry(0.95, 1.25, 16, 20);
  const pos = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i) + 0.625; // 0..1.25
    const v = y / 1.25; // 0..1
    // broad, rounded rose petal: narrow claw at the base, widest near the top, soft round tip
    const tip = v > 0.82 ? Math.sqrt(Math.max(0, 1 - Math.pow((v - 0.82) / 0.18, 2))) : 1;
    const width = (0.25 + 0.75 * Math.sin((Math.PI / 2) * Math.min(1, v / 0.7))) * (0.35 + 0.65 * tip);
    const nx = x * width;
    const z = -cup * nx * nx * 2 + curl * Math.pow(Math.max(0, v - 0.65), 2) * 4 - 0.08 * Math.sin(v * Math.PI);
    pos.setXYZ(i, nx, y, z);
  }
  g.computeVertexNormals();
  return g;
}

const ROSE_PETALS = 34;
const golden = Math.PI * (3 - Math.sqrt(5));

function Rose({ x, y = -0.2, size = 1.15, ready, scroll }: { x: number; y?: number; size?: number; ready: boolean; scroll?: MotionValue<number> }) {
  const group = useRef<THREE.Group>(null);
  const petals = useRef<(THREE.Mesh | null)[]>([]);
  const start = useRef<number | null>(null);
  const geometry = useMemo(() => makePetalGeometry(), []);

  const petalData = useMemo(
    () =>
      Array.from({ length: ROSE_PETALS }, (_, i) => {
        const t = i / (ROSE_PETALS - 1);
        const color = new THREE.Color("#9c1046").lerp(new THREE.Color("#f4a3c0"), Math.pow(t, 0.7));
        return {
          angle: i * golden,
          scale: 0.3 + Math.pow(t, 0.8) * 0.62,
          closed: -0.05 + t * 0.2,
          open: -0.02 + Math.pow(t, 2.2) * 0.95,
          radius: t * 0.1,
          color,
        };
      }),
    []
  );

  const materials = useMemo(
    () =>
      petalData.map(
        (p) =>
          new THREE.MeshPhysicalMaterial({
            color: p.color,
            roughness: 0.6,
            sheen: 1,
            sheenRoughness: 0.4,
            sheenColor: new THREE.Color("#ffd3e2"),
            side: THREE.DoubleSide,
          })
      ),
    [petalData]
  );

  useFrame((state) => {
    if (!ready) start.current = null;
    else if (start.current === null) start.current = state.clock.elapsedTime;
    const elapsed = start.current === null ? 0 : state.clock.elapsedTime - start.current;
    const s = scroll?.get() ?? 0;
    // bloom on load, then bloom further as you scroll
    const p = Math.min(1.35, 1 - Math.pow(1 - Math.min(1, elapsed / 4), 3) + s * 0.45);
    const breathe = Math.sin(state.clock.elapsedTime * 0.8) * 0.03;
    petals.current.forEach((m, i) => {
      if (!m) return;
      const d = petalData[i];
      m.rotation.x = d.closed + (d.open - d.closed) * p + breathe * (i / ROSE_PETALS);
    });
    if (group.current) {
      const px = state.pointer.x;
      const py = state.pointer.y;
      group.current.rotation.y = state.clock.elapsedTime * 0.12 + px * 0.25 + s * 2.4;
      group.current.rotation.x = 0.38 - py * 0.12 + s * 0.6;
      group.current.position.x = THREE.MathUtils.lerp(group.current.position.x, x * (1 - s * 0.8), 0.06);
      group.current.position.y = y + Math.sin(state.clock.elapsedTime * 0.6) * 0.05 + s * 0.9;
      group.current.scale.setScalar(size * (1 + s * 0.7));
    }
  });

  return (
    <group ref={group} position={[x, y, 0]} rotation={[0.38, 0, 0]} scale={size}>
      {petalData.map((d, i) => (
        <group key={i} rotation={[0, d.angle, 0]}>
          <mesh
            ref={(el) => {
              petals.current[i] = el;
            }}
            geometry={geometry}
            material={materials[i]}
            position={[0, 0, d.radius]}
            scale={d.scale}
            castShadow
          />
        </group>
      ))}
      {/* sepals */}
      {Array.from({ length: 5 }, (_, i) => (
        <group key={`s${i}`} rotation={[0, (i / 5) * Math.PI * 2, 0]}>
          <mesh geometry={geometry} position={[0, -0.02, 0.05]} rotation={[2.3, 0, 0]} scale={[0.26, 0.48, 0.26]}>
            <meshStandardMaterial color="#7fae8c" roughness={0.7} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

const FALLING = 46;

function FallingPetals() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => makePetalGeometry(0.4, 0.2), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const seeds = useMemo(
    () =>
      Array.from({ length: FALLING }, () => ({
        x: (Math.random() - 0.5) * 12,
        y: Math.random() * 8 - 2,
        z: -Math.random() * 4 - 0.5,
        speed: 0.18 + Math.random() * 0.25,
        sway: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 1.4,
        scale: 0.1 + Math.random() * 0.12,
      })),
    []
  );

  useFrame((state, delta) => {
    const m = mesh.current;
    if (!m) return;
    const t = state.clock.elapsedTime;
    seeds.forEach((s, i) => {
      s.y -= s.speed * delta;
      if (s.y < -3.5) {
        s.y = 4.5;
        s.x = (Math.random() - 0.5) * 12;
      }
      dummy.position.set(s.x + Math.sin(t * 0.7 + s.sway) * 0.4, s.y, s.z);
      dummy.rotation.set(t * s.spin + s.sway, t * s.spin * 0.7, Math.sin(t + s.sway) * 0.8);
      dummy.scale.setScalar(s.scale);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });

  const colors = useMemo(() => {
    const palette = ["#f7a8c4", "#f9c9d8", "#e0457b", "#fbd9e4", "#f3c77a"];
    const arr = new Float32Array(FALLING * 3);
    for (let i = 0; i < FALLING; i++) {
      const c = new THREE.Color(palette[i % palette.length]);
      arr.set([c.r, c.g, c.b], i * 3);
    }
    return arr;
  }, []);

  return (
    <instancedMesh ref={mesh} args={[geometry, undefined, FALLING]}>
      <instancedBufferAttribute attach="instanceColor" args={[colors, 3]} />
      <meshStandardMaterial roughness={0.6} side={THREE.DoubleSide} transparent opacity={0.85} />
    </instancedMesh>
  );
}

export default function RoseScene({ roseX, active = true, compact = false, ready = true, scroll }: { roseX: number; active?: boolean; compact?: boolean; ready?: boolean; scroll?: MotionValue<number> }) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      frameloop={active ? "always" : "never"}
      camera={{ position: [0, 0.6, 5], fov: 40 }}
      gl={{ antialias: true, alpha: true }}
      style={{ position: "absolute", inset: 0 }}
      aria-hidden="true"
    >
      <ambientLight intensity={0.9} color="#fff1f4" />
      <directionalLight position={[3, 5, 4]} intensity={2.2} color="#fff6ea" />
      <directionalLight position={[-4, 1, -2]} intensity={0.9} color="#ffc0d4" />
      <pointLight position={[0, 1.4, 1.5]} intensity={2} color="#ffd6e2" distance={6} />
      <Rose x={roseX} y={compact ? 0.8 : -0.3} size={compact ? 0.55 : 1.15} ready={ready} scroll={scroll} />
      <FallingPetals />
    </Canvas>
  );
}
