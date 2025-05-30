import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

type Keyword = { word: string, probability?: number };
type Props = { keywords?: Keyword[], onPoem?: (poem: string) => void };

const ElectronOrbit = ({ keywords, onPoem }: Props) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // Cleanup renderer cũ nếu có
    while (mountRef.current.firstChild) {
      mountRef.current.removeChild(mountRef.current.firstChild);
    }

    // Khởi tạo scene, camera và renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000);
    mountRef.current.appendChild(renderer.domElement);

    // Thêm điều khiển quỹ đạo
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Đặt vị trí camera
    camera.position.set(0, 0, 30);

    // Tạo quả cầu trung tâm (hạt nhân)
    const nucleusGeometry = new THREE.SphereGeometry(2, 32, 32);
    const nucleusMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x3498db,
      transparent: true,
      opacity: 0.8
    });
    const nucleus = new THREE.Mesh(nucleusGeometry, nucleusMaterial);
    scene.add(nucleus);

    // Tạo 4 quỹ đạo và 4 electron
    const orbitColors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00];
    const electronColors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00];
    const radii = [5, 8, 11, 14];
    const electrons: THREE.Mesh[] = [];
    const labels: THREE.Sprite[] = [];

    // Raycaster cho sự kiện click
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Hàm gọi API khi click label
    const callPoemApi = async (mainWord: string) => {
      try {
        const poemApiResponse = await fetch('/api/generatePoem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mainWord,
            emotion: "love",
            language: "vietnamese"
          }),
        });
        if (!poemApiResponse.ok) {
          const errorData = await poemApiResponse.json();
          throw new Error(errorData.error || 'Unable to generate poem from API.');
        }
        const poemData = await poemApiResponse.json();
        if (onPoem) onPoem(poemData.poem);
      } catch (err: any) {
        if (onPoem) onPoem('Error: ' + err.message);
      }
    };

    for (let i = 0; i < 4; i++) {
      const radius = radii[i];

      // Tạo quỹ đạo (vòng tròn)
      const orbitGeometry = new THREE.BufferGeometry();
      const orbitPoints = [];
      for (let j = 0; j <= 128; j++) {
        const theta = (j / 128) * Math.PI * 2;
        orbitPoints.push(
          new THREE.Vector3(
            radius * Math.cos(theta),
            radius * Math.sin(theta),
            0
          )
        );
      }
      orbitGeometry.setFromPoints(orbitPoints);

      const orbitMaterial = new THREE.LineBasicMaterial({ 
        color: orbitColors[i],
        transparent: true,
        opacity: 0.5
      });
      const orbit = new THREE.Line(orbitGeometry, orbitMaterial);

      // Xoay mỗi quỹ đạo một góc khác nhau để tạo hiệu ứng 3D
      orbit.rotation.x = Math.PI / 4 + (i * Math.PI) / 8;
      orbit.rotation.y = (i * Math.PI) / 8;
      scene.add(orbit);

      // Tạo 1 electron cho quỹ đạo này
      const electronGeometry = new THREE.SphereGeometry(0.5, 16, 16);
      const electronMaterial = new THREE.MeshBasicMaterial({ 
        color: electronColors[i]
      });
      const electron = new THREE.Mesh(electronGeometry, electronMaterial);

      // Đặt vị trí ban đầu của electron trên quỹ đạo
      let angle = 0;
      electron.position.x = radius * Math.cos(angle);
      electron.position.y = radius * Math.sin(angle);

      // Lưu thông tin quỹ đạo cho electron
      (electron as any).orbitRadius = radius;
      (electron as any).orbitSpeed = 0.01 + i * 0.003;
      (electron as any).currentAngle = angle;
      (electron as any).orbitInclination = orbit.rotation.x;

      scene.add(electron);
      electrons.push(electron);

      // Tạo label cho electron
      let labelText = keywords && keywords[i] ? keywords[i].word : '';
      if (labelText) {
        // Tạo texture từ canvas
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d')!;
        ctx.font = '28px Arial';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 8;
        ctx.fillText(labelText, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(3, 0.8, 1);
        scene.add(sprite);
        labels.push(sprite);

        // Gắn label vào electron (cập nhật vị trí trong animate)
        (electron as any).labelSprite = sprite;
        // Gắn từ vào sprite để biết khi click
        (sprite as any).mainWord = labelText;
      }
    }

    // Hàm animate
    const animate = () => {
      requestAnimationFrame(animate);

      // Cập nhật điều khiển
      controls.update();

      // Di chuyển các electron và label
      electrons.forEach((electron: any, idx) => {
        const radius = electron.orbitRadius;
        const speed = electron.orbitSpeed;
        const inclination = electron.orbitInclination;

        electron.currentAngle += speed;

        electron.position.x = radius * Math.cos(electron.currentAngle) * Math.cos(inclination);
        electron.position.y = radius * Math.sin(electron.currentAngle);
        electron.position.z = radius * Math.cos(electron.currentAngle) * Math.sin(inclination);

        // Cập nhật vị trí label nếu có
        if (electron.labelSprite) {
          electron.labelSprite.position.set(
            electron.position.x,
            electron.position.y + 1.2,
            electron.position.z
          );
          // Luôn hướng về camera
          electron.labelSprite.lookAt(camera.position);
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    // Xử lý click vào label
    const onClick = (event: MouseEvent) => {
      // Tính toán vị trí chuột chuẩn hóa
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(labels, true);
      if (intersects.length > 0) {
        const sprite = intersects[0].object as any;
        if (sprite.mainWord) {
          callPoemApi(sprite.mainWord);
        }
      }
    };
    renderer.domElement.addEventListener('click', onClick);

    // Xử lý resize window
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('click', onClick);
      if (mountRef.current && mountRef.current.contains(renderer.domElement)) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, [keywords, onPoem]); // Chạy lại khi keywords thay đổi

  return <div ref={mountRef} style={{ width: '100vw', height: '100vh' }} />;
};

export default ElectronOrbit;