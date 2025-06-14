import { useRef, useState, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Text } from '@react-three/drei'
import './WordSphere.css'
import * as THREE from 'three'

// Thông số quỹ đạo cách đều quanh tâm
const NUM_ORBITS = 4
const RADIUS = 15

// Hạt nhân wireframe
function Nucleus({ centerText }) {
  const meshRef = useRef()
  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = clock.getElapsedTime() * 0.5
      meshRef.current.rotation.x = clock.getElapsedTime() * 0.3
    }
  })
  return (
    <group>
      {/* Wireframe sphere */}
      <mesh ref={meshRef} castShadow receiveShadow>
        <sphereGeometry args={[9, 64, 64]} />
        <meshPhysicalMaterial
          color="#00eaff"
          metalness={0.7}
          roughness={0.15}
          clearcoat={0.7}
          clearcoatRoughness={0.1}
          transmission={0.5}
          thickness={1.5}
          ior={1.3}
          reflectivity={0.8}
          opacity={0.85}
          transparent={true}
          depthWrite={false}
        />
      </mesh>
      {/* Fresnel-like glow effect */}
      <mesh>
        <sphereGeometry args={[9.25, 64, 64]} />
        <meshBasicMaterial color="#fff" transparent={true} opacity={0.18} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      {/* Glow sphere nhỏ hơn */}
      <mesh>
        <sphereGeometry args={[7, 32, 32]} />
        <meshBasicMaterial color="#00eaff" transparent={true} opacity={0.12} depthWrite={false} />
      </mesh>
      {/* Center text inside nucleus */}
      <Text
        position={[0, 0, 0]}
        fontSize={3.2}
        color="#FFD700"
        outlineColor="#fff"
        outlineWidth={0.12}
        depthTest={false}
        anchorX="center"
        anchorY="middle"
        renderOrder={10}
      >
        {centerText}
      </Text>
    </group>
  )
}

// Quỹ đạo glowing
function OrbitPath({ radius, tilt, color, orbitIdx }) {
  const ref = useRef()
  // Tạo đường ellipse 3D
  const curve = new THREE.EllipseCurve(
    0, 0, radius, radius, 0, 2 * Math.PI, false, 0
  )
  const points = curve.getPoints(200).map(
    p => new THREE.Vector3(p.x, 0, p.y)
  )
  const path = new THREE.CatmullRomCurve3(points, true)
  const geometry = new THREE.TubeGeometry(path, 200, 0.08, 16, true)
  const glowGeometry = new THREE.TubeGeometry(path, 200, 0.25, 16, true)

  // Chỉ xoay quanh trục Y, giữ tilt cố định, mỗi quỹ đạo tốc độ khác nhau
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.getElapsedTime() * (0.15 + 0.1 * orbitIdx)
    }
  })

  return (
    <group ref={ref} rotation={[tilt, 0, 0]}>
      {/* Lớp phát sáng chính - luôn rõ nét */}
      <mesh renderOrder={1}>
        <primitive object={geometry} attach="geometry" />
        <meshBasicMaterial color={color} transparent={false} opacity={1} />
      </mesh>
      {/* Lớp glow ngoài - mờ, không ảnh hưởng depth */}
      <mesh renderOrder={2}>
        <primitive object={glowGeometry} attach="geometry" />
        <meshBasicMaterial 
          color="#fff" 
          transparent 
          opacity={0.35}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  )
}

// Electron glowing di chuyển trên quỹ đạo
function Electron({ radius, tilt, speed, color, offset = 0, label, onElectronClick }) {
  const ref = useRef()
  const labelRef = useRef()
  useFrame(({ clock, camera }) => {
    const t = clock.getElapsedTime() * speed + offset
    const x = Math.cos(t) * radius
    const y = Math.sin(t) * radius * Math.sin(tilt)
    const z = Math.sin(t) * radius * Math.cos(tilt)
    if (ref.current) {
      ref.current.position.set(x, y, z)
    }
    // Billboard effect cho label
    if (labelRef.current) {
      labelRef.current.quaternion.copy(camera.quaternion)
    }
  })

  const handleClick = (e) => {
    e.stopPropagation()
    if (onElectronClick) {
      onElectronClick(label)
    }
  }

  return (
    <group ref={ref}>
      {/* Glow ngoài electron */}
      <mesh onClick={handleClick}>
        <sphereGeometry args={[1.2, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.18} />
      </mesh>
      {/* Electron chính */}
      <mesh onClick={handleClick}>
        <sphereGeometry args={[0.7, 16, 16]} />
        <meshStandardMaterial color="#fff" emissive={color} emissiveIntensity={2.5} />
      </mesh>
      {/* Label từ ví dụ */}
      <group ref={labelRef} position={[0, 1.8, 0]} onClick={handleClick}>
        <Text fontSize={1.5} color="#FFD700" outlineColor="#fff" outlineWidth={0.08}>
          {label}
        </Text>
      </group>
    </group>
  )
}

export default function WordSphere({ keywords = [], onPoem, mainWord }) {
  // Đảm bảo keywords luôn là mảng
  const safeKeywords = Array.isArray(keywords) ? keywords : [];
  // Tạo orbits từ keywords
  const orbits = safeKeywords.map((keyword, i) => {
    const tilt = (Math.PI / safeKeywords.length) * i
    return {
      radius: RADIUS,
      tilt,
      speed: 1 + 0.3 * i,
      color: '#00eaff',
      label: keyword.word
    }
  })

  // State điều khiển hiệu ứng di chuyển sphere
  const [sphereToCorner, setSphereToCorner] = useState(false);

  // Hàm gọi API khi click electron
  const callPoemApi = async (subWord) => {
    try {
      const poemApiResponse = await fetch('/api/generatePoem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mainWord,
          subWord,
          emotion: "sad",
          language: "vietnamese"
        }),
      });
      if (!poemApiResponse.ok) {
        const errorData = await poemApiResponse.json();
        throw new Error(errorData.error || 'Unable to generate poem from API.');
      }
      const poemData = await poemApiResponse.json();
      if (onPoem) onPoem(poemData.poem);
    } catch (err) {
      if (onPoem) onPoem('Error: ' + err.message);
    }
  };

  // State cho text trung tâm
  const [centerTextIdx, setCenterTextIdx] = useState(0)
  useEffect(() => {
    if (safeKeywords.length === 0) return;
    const interval = setInterval(() => {
      setCenterTextIdx(idx => (idx + 1) % safeKeywords.length)
    }, 1500)
    return () => clearInterval(interval)
  }, [safeKeywords])

  // Hàm xử lý khi click electron
  const handleElectronClick = (label) => {
    setSphereToCorner(true);
    callPoemApi(label);
  }

  return (
    <div
      className={`word-sphere-outer${sphereToCorner ? '-to-corner' : ''}`}
    >
      <div className="word-sphere-container">
        <Canvas camera={{ position: [0, 0, 38], fov: 60 }} style={{ background: 'transparent' }}>
          <ambientLight intensity={0.7} />
          <pointLight position={[0, 0, 0]} intensity={2.5} color="#00eaff" />
          <Nucleus centerText={null} />
          {/* Center text always on top */}
          {safeKeywords.length > 0 && (
            <Text
              position={[0, 0, 0]}
              fontSize={3.2}
              color="#FFD700"
              outlineColor="#fff"
              outlineWidth={0.12}
              depthTest={false}
              depthWrite={false}
              renderOrder={999}
              anchorX="center"
              anchorY="middle"
              onClick={() => callPoemApi(safeKeywords[centerTextIdx]?.word)}
            >
              {safeKeywords[centerTextIdx]?.word}
            </Text>
          )}
          {orbits.map((orbit, idx) => (
            <group key={idx}>
              <OrbitPath {...orbit} orbitIdx={idx} />
              {/* Mỗi quỹ đạo chỉ có 1 electron và 1 label */}
              <Electron {...orbit} offset={0} onElectronClick={handleElectronClick} />
            </group>
          ))}
          <OrbitControls enablePan={false} minDistance={20} maxDistance={80} />
        </Canvas>
      </div>
    </div>
  )
}