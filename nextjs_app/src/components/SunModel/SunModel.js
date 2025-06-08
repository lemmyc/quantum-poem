'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';

const createGlowTexture = () => {
  // Tạo radial gradient đỏ-cam bằng canvas
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.1,
    size / 2,
    size / 2,
    size / 2
  );
  gradient.addColorStop(0, 'rgba(255, 180, 0, 1)'); // vàng cam đậm
  gradient.addColorStop(0.4, 'rgba(255, 80, 0, 0.7)'); // cam đỏ
  gradient.addColorStop(1, 'rgba(255, 0, 0, 0)'); // đỏ nhạt, mờ dần
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
};

const SunModel = ({ mainWord, keywords, onPoem, sphereToCorner }) => {
  const mountRef = useRef(null);
  let orbitGroup = null;
  let electrons = [];
  let orbitRadius = 0;
  const lastCenterTextRef = useRef('');
  const lastCenterTextureRef = useRef(null);
  const centerSpriteRef = useRef();
  // State để luân phiên text trung tâm
  const [centerTextIdx, setCenterTextIdx] = useState(0);

  // Luân phiên text trung tâm mỗi 1.5s
  useEffect(() => {
    if (!keywords || keywords.length === 0) return;
    const interval = setInterval(() => {
      setCenterTextIdx(idx => (idx + 1) % keywords.length);
    }, 1500);
    return () => clearInterval(interval);
  }, [keywords]);

  useEffect(() => {
    if (!mountRef.current) return;

    let sunModel = null; // Tham chiếu model để xoay

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    mountRef.current.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    // Controls
    camera.position.z = 5;
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Post-processing setup
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    // Bloom mạnh, radius lớn, threshold thấp
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.0,  // strength
      0.5,  // radius
      0.7   // threshold
    );
    composer.addPass(bloomPass);

    // Load the model
    const loader = new GLTFLoader();
    loader.load(
      '/assets/fireball__energy_sphere/scene.gltf',
      (gltf) => {
        const model = gltf.scene;
        sunModel = model; // Lưu lại để animate
        scene.add(model);
        // Đảm bảo quả cầu trung tâm render sau cùng (che quỹ đạo phía sau)
        model.renderOrder = 10;
        model.traverse(child => { if (child.isMesh) child.renderOrder = 10; });
        // Center the model
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);
        // Adjust camera to fit model
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        camera.position.z = maxDim * 2.5;

        orbitRadius = maxDim * 1.2;

        // Thêm sprite glow phía sau Sun
        const glowTexture = createGlowTexture();
        const spriteMaterial = new THREE.SpriteMaterial({
          map: glowTexture,
          color: 0xffffff,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const glowSprite = new THREE.Sprite(spriteMaterial);
        glowSprite.scale.set(maxDim * 1.6, maxDim * 1.6, 1);
        glowSprite.position.copy(model.position);
        scene.add(glowSprite);
        glowSprite.renderOrder = -1;

        // === Vẽ 4 đường quỹ đạo hình tròn đều quanh Sun ===
        orbitGroup = new THREE.Group();
        scene.add(orbitGroup);

        const orbits = [];
        const NUM_ORBITS = 4;
        const electronLabels = (Array.isArray(keywords) && keywords.length === 4)
          ? keywords.map(k => k.word || k)
          : [
              'Electron 1',
              'Electron 2',
              'Electron 3',
              'Electron 4'
            ];
        const electronColor = '#00eaff';
        const textColor = '#fff';
        electrons = [];
        for (let i = 0; i < NUM_ORBITS; i++) {
          const tilt = (Math.PI / NUM_ORBITS) * i;
          const baseRadius = orbitRadius;
          const curve = new THREE.EllipseCurve(
            0, 0, baseRadius, baseRadius, 0, 2 * Math.PI, false, 0
          );
          const points = curve.getPoints(200).map(p => new THREE.Vector3(p.x, 0, p.y));
          const path = new THREE.CatmullRomCurve3(points, true);

          // Đường chính: rất mảnh, phát sáng xanh dương mạnh hơn
          const geometry = new THREE.TubeGeometry(path, 600, 0.035, 12, true);
          const material = new THREE.MeshStandardMaterial({ 
            color: '#b0e0ff', // xanh dương nhạt
            emissive: '#00aaff', // xanh dương phát sáng
            emissiveIntensity: 8.5, // mạnh hơn
            transparent: true,
            opacity: 0.22, // đậm hơn
            metalness: 0.2,
            roughness: 0.4,
            depthWrite: true // Để quỹ đạo bị che bởi quả cầu
          });
          const orbit = new THREE.Mesh(geometry, material);
          orbit.rotation.x = tilt;
          orbit.renderOrder = 1;
          orbitGroup.add(orbit);

          // Glow chính: xanh dương, bán kính lớn, mờ hơn
          const glowGeometry = new THREE.TubeGeometry(path, 800, 0.18, 16, true);
          const glowMaterial = new THREE.MeshBasicMaterial({
            color: '#00cfff', // xanh dương sáng
            transparent: true,
            opacity: 0.22, // đậm hơn
            depthWrite: false, // Glow không bị che để giữ hiệu ứng sáng
            blending: THREE.AdditiveBlending
          });
          const glowOrbit = new THREE.Mesh(glowGeometry, glowMaterial);
          glowOrbit.rotation.x = tilt;
          glowOrbit.renderOrder = 2;
          orbitGroup.add(glowOrbit);

          // Glow phụ: xanh dương nhạt, bán kính lớn hơn, cực mờ
          const glowGeometry2 = new THREE.TubeGeometry(path, 3200, 0.32, 16, true);
          const glowMaterial2 = new THREE.MeshBasicMaterial({
            color: '#b0e0ff', // xanh dương nhạt
            transparent: true,
            opacity: 0.13,
            depthWrite: false, // Glow không bị che để giữ hiệu ứng sáng
            blending: THREE.AdditiveBlending
          });
          const glowOrbit2 = new THREE.Mesh(glowGeometry2, glowMaterial2);
          glowOrbit2.rotation.x = tilt;
          glowOrbit2.renderOrder = 3;
          orbitGroup.add(glowOrbit2);

          // Glow siêu lớn, cực mờ, tạo hiệu ứng wow
          const glowGeometry3 = new THREE.TubeGeometry(path, 4000, 0.65, 64, true);
          const glowMaterial3 = new THREE.MeshBasicMaterial({
            color: '#00eaff', // xanh dương tươi
            transparent: true,
            opacity: 0.06,
            depthWrite: false, // Glow không bị che để giữ hiệu ứng sáng
            blending: THREE.AdditiveBlending
          });
          const glowOrbit3 = new THREE.Mesh(glowGeometry3, glowMaterial3);
          glowOrbit3.rotation.x = tilt;
          glowOrbit3.renderOrder = 4;
          orbitGroup.add(glowOrbit3);

          // Electron là sphere nhỏ, chạy trên quỹ đạo
          const electron = new THREE.Mesh(
            new THREE.SphereGeometry(maxDim * 0.14, 32, 32),
            new THREE.MeshStandardMaterial({
              color: electronColor,
              emissive: electronColor,
              emissiveIntensity: 2.5,
              transparent: true,
              opacity: 0.95
            })
          );
          electron.castShadow = false;
          electron.receiveShadow = false;
          orbitGroup.add(electron);

          // Text label cho electron
          const canvas = document.createElement('canvas');
          canvas.width = 256;
          canvas.height = 64;
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height); // Đảm bảo nền trong suốt
          ctx.font = 'bold 32px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = textColor; // ví dụ: '#fff' hoặc '#FFD700'
          ctx.fillText(electronLabels[i], 128, 32);
          const textTexture = new THREE.CanvasTexture(canvas);
          const textMaterial = new THREE.SpriteMaterial({ map: textTexture, transparent: true });
          const textSprite = new THREE.Sprite(textMaterial);
          textSprite.position.set(0, maxDim * 0.28, 0);
          textSprite.scale.set(maxDim * 0.6, maxDim * 0.15, 1);
          electron.add(textSprite);

          electrons.push({ mesh: electron, orbitIdx: i, tilt: (Math.PI / NUM_ORBITS) * i });
        }

        model.traverse((child) => {
          if (child.isMesh && child.material) {
            child.material.transparent = true;
            child.material.opacity = 0.45;
            child.material.emissive = new THREE.Color(0xffa800);
            child.material.emissiveIntensity = 2.5;
            child.material.toneMapped = false;
            // Loại bỏ highlight/phản chiếu
            if ('metalness' in child.material) child.material.metalness = 0;
            if ('roughness' in child.material) child.material.roughness = 1;
            if ('specular' in child.material) child.material.specular = new THREE.Color(0x000000);
            if ('envMap' in child.material) child.material.envMap = null;
            child.material.needsUpdate = true;
          }
        });

        // --- Sprite text trung tâm ---
        const getCenterText = () => {
          if (keywords && keywords.length > 0) {
            const k = keywords[centerTextIdx];
            return k.word || k;
          }
          return mainWord;
        };
        const centerWord = getCenterText();
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Vẽ nền mờ phía sau text
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(0, 32, canvas.width, 64);

        // Viền ngoài đen dày
        ctx.font = 'bold 64px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 10;
        ctx.strokeStyle = '#222';
        ctx.strokeText(centerWord, 256, 64);

        // Viền trong trắng mỏng hơn
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#fff';
        ctx.strokeText(centerWord, 256, 64);

        // Đổ bóng cho text
        ctx.shadowColor = 'rgba(0,0,0,0.85)';
        ctx.shadowBlur = 18;

        // Fill text vàng
        ctx.fillStyle = '#FFD700';
        ctx.fillText(centerWord, 256, 64);

        // Tắt shadow để không ảnh hưởng các phần khác
        ctx.shadowBlur = 0;
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const centerSprite = new THREE.Sprite(material);
        centerSprite.position.copy(model.position);
        centerSprite.scale.set(maxDim * 0.9, maxDim * 0.22, 1);
        centerSprite.renderOrder = 20;
        scene.add(centerSprite);
        centerSpriteRef.current = centerSprite;
        lastCenterTextRef.current = centerWord;
        lastCenterTextureRef.current = texture;
      },
      undefined,
      (error) => {
        console.error('An error happened:', error);
      }
    );

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      if (sunModel) {
        sunModel.rotation.y += 0.005;
      }
      if (orbitGroup) {
        orbitGroup.rotation.y += 0.003;
        orbitGroup.rotation.x += 0.001;
        orbitGroup.rotation.z += 0.0007;
      }

      // Animate electron chạy quanh quỹ đạo
      const time = performance.now() * 0.0005;
      for (const { mesh, orbitIdx, tilt } of electrons) {
        // Tính vị trí electron trên quỹ đạo
        const r = orbitRadius;
        const t = time * (1.2 + 0.2 * orbitIdx) + orbitIdx * Math.PI / 2;
        const x = Math.cos(t) * r;
        const y = Math.sin(t) * r * Math.sin(tilt);
        const z = Math.sin(t) * r * Math.cos(tilt);
        mesh.position.set(x, y, z);
        // Quay text luôn hướng về camera
        if (mesh.children[0]) {
          mesh.children[0].quaternion.copy(camera.quaternion);
        }
      }

      // --- Update text trung tâm nếu cần ---
      if (centerSpriteRef.current) {
        const newText = (keywords && keywords.length > 0)
          ? (keywords[centerTextIdx]?.word || keywords[centerTextIdx])
          : mainWord;
        if (newText !== lastCenterTextRef.current) {
          // Dispose texture cũ nếu có
          if (lastCenterTextureRef.current) {
            lastCenterTextureRef.current.dispose();
          }
          // Tạo texture mới
          const canvas = document.createElement('canvas');
          canvas.width = 512;
          canvas.height = 128;
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.font = 'bold 64px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 8;
          ctx.fillStyle = '#000';
          ctx.shadowColor = '#fff';
          ctx.shadowBlur = 18;
          ctx.strokeText(newText, 256, 64);
          ctx.fillText(newText, 256, 64);
          const texture = new THREE.CanvasTexture(canvas);
          centerSpriteRef.current.material.map = texture;
          centerSpriteRef.current.material.needsUpdate = true;
          lastCenterTextRef.current = newText;
          lastCenterTextureRef.current = texture;
        }
      }

      composer.render();
    };
    animate();

    // Handle window resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      composer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      mountRef.current?.removeChild(renderer.domElement);
      renderer.dispose();
      composer.dispose();
      if (lastCenterTextureRef.current) {
        lastCenterTextureRef.current.dispose();
      }
    };
  }, [keywords]);

  return <div ref={mountRef} style={{ width: '100%', height: '100vh' }} />;
};

export default SunModel; 