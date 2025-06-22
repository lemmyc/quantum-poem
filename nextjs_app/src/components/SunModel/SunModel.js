'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { Modal, Button } from 'antd';
import styles from '../LanguageSelector/projects/style.module.scss';
import './SunModel.scss';
import { useSearchParams } from 'next/navigation';

const createGlowTexture = () => {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d', { alpha: true });
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.1,
    size / 2,
    size / 2,
    size / 2
  );
  gradient.addColorStop(0, 'rgba(255, 180, 0, 0.8)');
  gradient.addColorStop(0.4, 'rgba(255, 80, 0, 0.5)');
  gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
};

const SunModel = ({ mainWord, keywords, onPoem, sphereToCorner, className, onGeneratePoemFromSunModel, latestEmotionResult  }) => {
  const mountRef = useRef(null);
  let orbitGroup = null;
  const electronsRef = useRef([]);
  const orbitPathsRef = useRef([]);
  let orbitRadius = 0;
  const [highestProbWord, setHighestProbWord] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalText, setConfirmModalText] = useState('');
  const electronToHighlightRef = useRef(null);
  const [isMovingToCorner, setIsMovingToCorner] = useState(false);
  const animationStartTime = useRef(null);
  const animationDuration = 2000;
  const targetPosition = useRef(null);
  const targetScale = useRef(null);
  const lastHighlightedWordRef = useRef(null);

  const [cancelCount, setCancelCount] = useState(0);
  const [electronLabels, setElectronLabels] = useState(keywords);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const initialProbFetchDone = useRef(false);
  const electronLabelsRef = useRef([]);
  const searchParams = useSearchParams();
  const wordParam = searchParams.get('word');

  useEffect(() => {
    electronLabelsRef.current = electronLabels;
  }, [electronLabels]);

  const generateNewKeywords = useCallback(async () => {
    try {
      const currentEmotion = latestEmotionResult?.emotion || "happy";
      const keywordsResponse = await fetch('/api/generateKeywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputText: mainWord, emotion: currentEmotion }),
      });
      const tenWords = await keywordsResponse.json();

      const probResponse = await fetch('/api/getWordProbabilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: tenWords.keywords.filter(word => word !== wordParam) }),
      });
      if (!probResponse.ok) {
        const errorData = await probResponse.json();
        throw new Error(errorData.error || 'Unable to get new keyword probabilities.');
      }
      const probData = await probResponse.json();

      const newSortedWords = (probData.results || [])
        .sort((a, b) => b.probability - a.probability)
        .slice(0, 5)
        .map(item => ({ word: item.word, probability: item.probability }));

      if (newSortedWords.length === 0) {
        throw new Error("Could not determine relevant keywords from the generated list.");
      }

      setElectronLabels(newSortedWords);
      electronsRef.current.forEach((electron, index) => {
        if (electron.isMainWord) return;
        if (electron.mesh.children[0] && index < 5) {
          const canvas = document.createElement('canvas');
          canvas.width = 256;
          canvas.height = 64;
          const ctx = canvas.getContext('2d', { alpha: true });
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.font = 'bold 32px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#fff';
          ctx.fillText(newSortedWords[index]?.word || `Electron ${index + 1}`, 128, 32);
          const textTexture = new THREE.CanvasTexture(canvas);
          electron.mesh.children[0].material.map = textTexture;
          electron.mesh.children[0].material.needsUpdate = true;
        }
      });
      return newSortedWords;
    } catch (err) {
      console.error('Error generating new keywords:', err);
      return null;
    }
  }, [mainWord, latestEmotionResult, wordParam]);

  const fetchAndProcessProbabilities = useCallback(async () => {
    const currentElectronLabels = (Array.isArray(electronLabelsRef.current) && electronLabelsRef.current.length >= 5)
      ? electronLabelsRef.current.map(k => k.word || k)
      : [];
    const currentElectrons = electronsRef.current.filter(e => !e.isMainWord);

    if (currentElectronLabels.length === 0) {
      console.warn('Electron labels not available for fetching probabilities.');
      return; 
    }

    try {
      const electronTexts = currentElectronLabels.slice(0, 5);
      console.log('Sending to API:', electronTexts);
      const response = await fetch('/api/getWordProbabilities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: electronTexts }),
      });
      const data = await response.json();
      console.log('API response:', data);

      if (data && data.results && Array.isArray(data.results)) {
        const sortedResults = data.results.sort((a, b) => b.probability - a.probability);
        let wordToHighlight = null;

        if (sortedResults.length > 0) {
          if (lastHighlightedWordRef.current && sortedResults[0].word === lastHighlightedWordRef.current) {
            wordToHighlight = sortedResults.length > 1 ? sortedResults[1].word : null;
          } else {
            wordToHighlight = sortedResults[0].word;
          }
        }

        if (wordToHighlight) {
          setHighestProbWord(wordToHighlight);
          lastHighlightedWordRef.current = wordToHighlight;
          const indexToHighlight = electronTexts.findIndex(label => (label === wordToHighlight));

          if (indexToHighlight !== -1 && currentElectrons[indexToHighlight]) {
            electronToHighlightRef.current = currentElectrons[indexToHighlight];
            setConfirmModalText(`Text that matches your emotion is <span style="color: #FF8C00; font-weight: bold; text-shadow: 0 0 10px rgba(255, 140, 0, 0.5);">${wordToHighlight}</span>`);
            setTimeout(() => {
                setShowConfirmModal(true);
            }, 5000);
          }
        }
      }
    } catch (error) {
      console.error('Error calling API:', error);
      alert('Error calling API: ' + error.message);
    }
  }, [wordParam]);

  const handleConfirmOk = () => {
    if (electronToHighlightRef.current) {
      const highlightColor = new THREE.Color(0xFFA500);
      electronToHighlightRef.current.mesh.material.color.copy(highlightColor);
      electronToHighlightRef.current.mesh.material.emissive.copy(highlightColor);
      electronToHighlightRef.current.mesh.material.emissiveIntensity = 2.5;
      electronToHighlightRef.current.mesh.material.needsUpdate = true;
    }
    setShowConfirmModal(false);
    electronToHighlightRef.current = null;
    setIsMovingToCorner(true);
    animationStartTime.current = performance.now();
    targetPosition.current = new THREE.Vector3(-window.innerWidth/4, -window.innerHeight/4, 0);
    targetScale.current = new THREE.Vector3(0.3, 0.3, 0.3);

    if (onGeneratePoemFromSunModel && highestProbWord) {
      console.log(highestProbWord)
      onGeneratePoemFromSunModel(highestProbWord);
    }
    lastHighlightedWordRef.current = highestProbWord;
  };

  const handleConfirmCancel = async () => {
    setShowConfirmModal(false);
    electronToHighlightRef.current = null;

    const newCount = cancelCount + 1;
    setCancelCount(newCount);

    if (newCount === 2) {
      const newKeywords = await generateNewKeywords();
      if (newKeywords) {
        setCancelCount(0);
        initialProbFetchDone.current = false;
      }
    } else {
      setTimeout(() => {
        fetchAndProcessProbabilities();
      }, 3000);
    }
  };

  useEffect(() => {
    if (!mountRef.current) return;

    let sunModel = null;

    const scene = new THREE.Scene();
    
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    mountRef.current.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    camera.position.z = 5;
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.7,
      0.4,
      0.8
    );
    composer.addPass(bloomPass);

    const loader = new GLTFLoader();
    loader.load(
      '/assets/fireball__energy_sphere/scene.gltf',
      (gltf) => {
        const model = gltf.scene;
        sunModel = model;
        scene.add(model);
        model.renderOrder = 10;
        model.traverse(child => { if (child.isMesh) child.renderOrder = 10; });
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        camera.position.z = maxDim * 2.5;

        orbitRadius = maxDim * 1.2;

        const glowTexture = createGlowTexture();
        const spriteMaterial = new THREE.SpriteMaterial({
          map: glowTexture,
          color: 0xffffff,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const glowSprite = new THREE.Sprite(spriteMaterial);
        glowSprite.scale.set(maxDim * 1.3, maxDim * 1.3, 1);
        glowSprite.position.copy(model.position);
        scene.add(glowSprite);
        glowSprite.renderOrder = -1;

        orbitGroup = new THREE.Group();
        scene.add(orbitGroup);

        const NUM_ORBITS = 3;
        const currentElectronDisplayLabels = (Array.isArray(electronLabels) && electronLabels.length > 0)
          ? electronLabels.map(k => k.word || k)
          : [
              'Electron 1',
              'Electron 2',
              'Electron 3',
              'Electron 4',
              'Electron 5'
            ];
        const electronColor = '#00eaff';
        const highlightColor = new THREE.Color(0xFFA500);
        const textColor = '#fff';
        electronsRef.current = [];
        const orbitConfigs = [
          { x:  -(Math.PI / 4),  y: -(2 * Math.PI / 5), z: - Math.PI / 3 },
          { x: 0, y: Math.PI / 7, z: Math.PI / 4 },
          { x: (Math.PI / 4), y: 0, z: (2 * Math.PI / 3)  }
        ];
        
        // Phân bổ electron: mỗi orbit có 2 electron
        const electronsOnThisOrbitArr = [2, 2, 2];
        let electronCounter = 0;
        for (let i = 0; i < NUM_ORBITS; i++) {
          const { x, y, z } = orbitConfigs[i];
          const baseRadius = orbitRadius;
          const curve = new THREE.EllipseCurve(
            0, 0, baseRadius, baseRadius, 0, 2 * Math.PI, false, 0
          );
          const points = curve.getPoints(200).map(p => new THREE.Vector3(p.x, 0, p.y));
          const path = new THREE.CatmullRomCurve3(points, true);
          orbitPathsRef.current.push({ path, rotation: { x, y, z } });

          const geometry = new THREE.TubeGeometry(path, 600, 0.035, 12, true);
          const material = new THREE.MeshStandardMaterial({
            color: '#b0e0ff', emissive: '#00aaff', emissiveIntensity: 8.5, transparent: true, opacity: 0.22, metalness: 0.2, roughness: 0.4, depthWrite: true, depthTest: true, blending: THREE.NormalBlending
          });
          const orbit = new THREE.Mesh(geometry, material);
          orbit.rotation.set(x, y, z); orbit.renderOrder = 1;
          orbitGroup.add(orbit);

          const glowGeometry = new THREE.TubeGeometry(path, 800, 0.18, 16, true);
          const glowMaterial = new THREE.MeshBasicMaterial({
            color: '#00cfff', transparent: true, opacity: 0.22, depthWrite: true, depthTest: true, blending: THREE.NormalBlending
          });
          const glowOrbit = new THREE.Mesh(glowGeometry, glowMaterial);
          glowOrbit.rotation.set(x, y, z); glowOrbit.renderOrder = 2;
          orbitGroup.add(glowOrbit);

          const glowGeometry2 = new THREE.TubeGeometry(path, 3200, 0.32, 16, true);
          const glowMaterial2 = new THREE.MeshBasicMaterial({
            color: '#b0e0ff', transparent: true, opacity: 0.13, depthWrite: true, depthTest: true, blending: THREE.NormalBlending
          });
          const glowOrbit2 = new THREE.Mesh(glowGeometry2, glowMaterial2);
          glowOrbit2.rotation.set(x, y, z); glowOrbit2.renderOrder = 3;
          orbitGroup.add(glowOrbit2);

          const glowGeometry3 = new THREE.TubeGeometry(path, 4000, 0.65, 64, true);
          const glowMaterial3 = new THREE.MeshBasicMaterial({
            color: '#00eaff', transparent: true, opacity: 0.06, depthWrite: true, depthTest: true, blending: THREE.NormalBlending
          });
          const glowOrbit3 = new THREE.Mesh(glowGeometry3, glowMaterial3);
          glowOrbit3.rotation.set(x, y, z); glowOrbit3.renderOrder = 4;
          orbitGroup.add(glowOrbit3);

          // Phân bổ electron: mỗi orbit có 2 electron
          const electronsOnThisOrbit = electronsOnThisOrbitArr[i];
          for (let j = 0; j < electronsOnThisOrbit; j++) {
            // Nếu là orbit 1, j=1 và có wordParam thì electron này là electron đỏ
            if (i === 0 && j === 1 && wordParam) {
              // Electron đỏ (mainWord)
              const electron = new THREE.Mesh(
                new THREE.SphereGeometry(maxDim * 0.14, 32, 32),
                new THREE.MeshStandardMaterial({
                  color: '#ff2222', emissive: '#ff2222', emissiveIntensity: 2.5, transparent: false, opacity: 1
                })
              );
              electron.castShadow = false; electron.receiveShadow = false;
              orbitGroup.add(electron);

              // Label cho electron đỏ
              const canvas = document.createElement('canvas');
              canvas.width = 256; canvas.height = 64;
              const ctx = canvas.getContext('2d', { alpha: true });
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.font = 'bold 32px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
              ctx.lineWidth = 8;
              ctx.strokeStyle = '#000';
              ctx.strokeText(wordParam, 128, 32);
              ctx.fillStyle = '#ff2222';
              ctx.fillText(wordParam, 128, 32);
              const textTexture = new THREE.CanvasTexture(canvas);
              const textMaterial = new THREE.SpriteMaterial({ map: textTexture, transparent: true, depthTest: false, depthWrite: false });
              const textSprite = new THREE.Sprite(textMaterial);
              textSprite.position.set(0, maxDim * 0.28, 0);
              textSprite.scale.set(maxDim * 0.6, maxDim * 0.15, 1);
              electron.add(textSprite);

              // Offset cho electron đỏ: đặt lệch so với electron còn lại trên orbit 1
              const offset = Math.PI * 0.66;
              electronsRef.current.push({
                mesh: electron, orbitIdx: i, rotX: x, rotY: y, rotZ: z, offset,
                isMainWord: true // Đánh dấu electron đỏ
              });
              continue;
            }
            // Các electron thường
            if (electronCounter >= 5) break; // Chỉ tạo 5 electron thường
            const electron = new THREE.Mesh(
              new THREE.SphereGeometry(maxDim * 0.14, 32, 32),
              new THREE.MeshStandardMaterial({
                color: electronColor, emissive: electronColor, emissiveIntensity: 1.8, transparent: true, opacity: 0.95
              })
            );
            electron.castShadow = false; electron.receiveShadow = false;
            orbitGroup.add(electron);

            const electronIndex = electronCounter;
            const canvas = document.createElement('canvas');
            canvas.width = 256; canvas.height = 64;
            const ctx = canvas.getContext('2d', { alpha: true });
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.font = 'bold 32px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillStyle = textColor;
            ctx.fillText(currentElectronDisplayLabels[electronIndex] || `Electron ${electronIndex + 1}`, 128, 32);
            const textTexture = new THREE.CanvasTexture(canvas);
            const textMaterial = new THREE.SpriteMaterial({ map: textTexture, transparent: true, depthTest: false, depthWrite: false });
            const textSprite = new THREE.Sprite(textMaterial);
            textSprite.position.set(0, maxDim * 0.28, 0);
            textSprite.scale.set(maxDim * 0.6, maxDim * 0.15, 1);
            electron.add(textSprite);

            // Offset để các electron trên cùng quỹ đạo không chồng lên nhau
            const offset = (j / electronsOnThisOrbit) * Math.PI;
            electronsRef.current.push({
              mesh: electron, orbitIdx: i, rotX: x, rotY: y, rotZ: z, offset,
              isMainWord: false
            });
            electronCounter++;
          }
        }

        model.traverse((child) => {
          if (child.isMesh && child.material) {
            child.material.transparent = true; child.material.opacity = 0.95;
            child.material.emissive = new THREE.Color(0xffa800); child.material.emissiveIntensity = 1.2;
            child.material.depthWrite = true; child.material.toneMapped = false;
            if ('metalness' in child.material) child.material.metalness = 0;
            if ('roughness' in child.material) child.material.roughness = 1;
            if ('specular' in child.material) child.material.specular = new THREE.Color(0x000000);
            if ('envMap' in child.material) child.material.envMap = null;
            child.material.needsUpdate = true;
          }
        });

        setIsModelLoaded(true);
      },
      undefined,
      (error) => { console.error('An error happened:', error); }
    );

    // Animate luôn được khai báo và gọi ở đây
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      if (sunModel) { 
        sunModel.rotation.y += 0.005; 
        
        if (isMovingToCorner && targetPosition.current && targetScale.current && animationStartTime.current) {
          const currentTime = performance.now();
          const elapsed = currentTime - animationStartTime.current;
          const progress = Math.min(elapsed / animationDuration, 1);
          
          const easeProgress = progress < 0.5 
            ? 4 * progress * progress * progress 
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;

          const currentPos = sunModel.position.clone();
          const newPos = currentPos.lerp(targetPosition.current, easeProgress);
          sunModel.position.copy(newPos);

          const currentScale = sunModel.scale.clone();
          const newScale = currentScale.lerp(targetScale.current, easeProgress);
          sunModel.scale.copy(newScale);

          if (orbitGroup) {
            orbitGroup.position.copy(newPos);
            orbitGroup.scale.copy(newScale);
          }

          if (progress >= 1) {
            setIsMovingToCorner(false);
            animationStartTime.current = null;
          }
        }
      }

      const time = performance.now() * 0.0005;
      for (const { mesh, orbitIdx, offset } of electronsRef.current) {
        const { path, rotation } = orbitPathsRef.current[orbitIdx];
        const t = (time * (1.2 + 0.2 * orbitIdx) + offset) % (2 * Math.PI);
        const fraction = (t % (2 * Math.PI)) / (2 * Math.PI);
        let pos = path.getPointAt(fraction);
        const euler = new THREE.Euler(rotation.x, rotation.y, rotation.z);
        pos.applyEuler(euler);
        mesh.position.set(pos.x, pos.y, pos.z);
        if (mesh.children[0]) { mesh.children[0].quaternion.copy(camera.quaternion); }
      }

      composer.render();
    };
    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      composer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      mountRef.current?.removeChild(renderer.domElement);
      renderer.dispose();
      composer.dispose();
    };
  }, []);

  useEffect(() => {
    if (sphereToCorner) {
      setIsMovingToCorner(true);
      animationStartTime.current = performance.now();
      targetPosition.current = new THREE.Vector3(-window.innerWidth/4, -window.innerHeight/4, 0);
      targetScale.current = new THREE.Vector3(0.3, 0.3, 0.3);
    }
  }, [sphereToCorner]);

  useEffect(() => {
    if (isModelLoaded && electronLabels.length > 0 && !initialProbFetchDone.current) {
      fetchAndProcessProbabilities();
      initialProbFetchDone.current = true;
    }
  }, [isModelLoaded, electronLabels]);

  return (
    <div className="sun-model-container">
      <div className={`sun-model ${isMovingToCorner ? 'move-to-corner' : ''}`} ref={mountRef}>
        <Modal
          open={showConfirmModal}
          onCancel={handleConfirmCancel}
          footer={null}
          closable={false}
          maskClosable={true}
          centered
          title="Confirming"
          className={styles.customModal}
        >
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <p dangerouslySetInnerHTML={{ __html: confirmModalText }}></p>
            <div style={{ marginTop: '20px' }}>
              <Button onClick={handleConfirmCancel} style={{ marginRight: '10px' }}>Hủy</Button>
              <Button type="primary" onClick={handleConfirmOk}>OK</Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default SunModel; 