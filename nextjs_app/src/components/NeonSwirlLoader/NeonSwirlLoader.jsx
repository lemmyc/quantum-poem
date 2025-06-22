import React, { useEffect, useRef } from 'react';
import './NeonSwirlLoader.scss';

const NeonSwirlLoader = () => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const particlesArrayRef = useRef([]);
  const angleOffsetRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const container = canvas.parentElement;

    let centerX, centerY;

    const resizeCanvas = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      centerX = canvas.width / 2;
      centerY = canvas.height / 2;
    };
    
    resizeCanvas();

    class Particle {
      constructor(x, y, size, hue, angle, radiusSpeed) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.hue = hue;
        this.angle = angle;
        this.radiusSpeed = radiusSpeed;
        this.baseRadius = (Math.min(centerX, centerY) * 0.2) + Math.random() * (Math.min(centerX, centerY) * 0.4);
        this.history = [];
        this.trailLength = 10;
      }

      update() {
        this.history.unshift({ x: this.x, y: this.y });
        if (this.history.length > this.trailLength) {
          this.history.pop();
        }

        this.angle += this.radiusSpeed;
        const radius = this.baseRadius + Math.sin(angleOffsetRef.current) * 20;
        this.x = centerX + Math.cos(this.angle) * radius;
        this.y = centerY + Math.sin(this.angle) * radius;
      }

      draw() {
        this.history.forEach((pos, i) => {
          const opacity = 1 - (i / this.history.length);
          const size = this.size * (1 - i / this.history.length);
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, size > 0 ? size : 0.1, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${this.hue}, 100%, 50%, ${opacity})`;
          ctx.fill();
        });
      }
    }

    const createParticles = () => {
      particlesArrayRef.current = [];
      for (let i = 0; i < 70; i++) {
        const size = Math.random() * 4 + 1;
        const hue = Math.random() * 360;
        const angle = Math.random() * Math.PI * 2;
        const radiusSpeed = Math.random() * 0.04 + 0.01;
        particlesArrayRef.current.push(
          new Particle(centerX, centerY, size, hue, angle, radiusSpeed)
        );
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particlesArrayRef.current.forEach((particle) => {
        particle.update();
        particle.draw();
      });

      angleOffsetRef.current += 0.02;
      animationRef.current = requestAnimationFrame(animate);
    };

    const handleResize = () => {
      resizeCanvas();
      createParticles();
    };

    createParticles();
    animate();

    window.addEventListener('resize', handleResize);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div className="neon-swirl-loader">
      <canvas ref={canvasRef} />
    </div>
  );
};

export default NeonSwirlLoader;
