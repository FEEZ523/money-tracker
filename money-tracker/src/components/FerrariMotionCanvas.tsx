'use client';

import React, { useEffect, useRef } from 'react';

interface FerrariMotionProps {
  isAccelerating?: boolean;
}

export default function FerrariMotionCanvas({ isAccelerating = false }: FerrariMotionProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = canvas.offsetWidth || 380);
    let height = (canvas.height = canvas.offsetHeight || 110);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', handleResize);

    // Speed light streaks
    const streaks: { x: number; y: number; len: number; speed: number; alpha: number; color: string }[] = [];
    for (let i = 0; i < 28; i++) {
      streaks.push({
        x: Math.random() * width,
        y: 15 + Math.random() * (height - 35),
        len: 20 + Math.random() * 60,
        speed: 6 + Math.random() * 10,
        alpha: 0.3 + Math.random() * 0.5,
        color: Math.random() > 0.4 ? '239, 68, 68' : '234, 179, 8',
      });
    }

    let frame = 0;
    // Car horizontal drive cycle (moves across the road smoothly with high speed)
    let carPosOffset = 0;

    const render = () => {
      frame++;
      ctx.clearRect(0, 0, width, height);

      const speedMultiplier = isAccelerating ? 2.2 : 1;

      // 1. Road surface
      const roadY = height - 16;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, roadY);
      ctx.lineTo(width, roadY);
      ctx.stroke();

      // Passing highway road markers
      const dashOffset = (frame * (isAccelerating ? 24 : 9)) % 32;
      ctx.strokeStyle = 'rgba(234, 179, 8, 0.5)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.setLineDash([16, 16]);
      ctx.lineDashOffset = -dashOffset;
      ctx.moveTo(0, roadY + 6);
      ctx.lineTo(width, roadY + 6);
      ctx.stroke();
      ctx.setLineDash([]);

      // 2. Rushing speed light streaks
      streaks.forEach((s) => {
        s.x -= s.speed * speedMultiplier;
        if (s.x < -s.len) {
          s.x = width + Math.random() * 60;
          s.y = 12 + Math.random() * (height - 35);
          s.len = 25 + Math.random() * (isAccelerating ? 120 : 60);
          s.speed = (isAccelerating ? 16 : 7) + Math.random() * 6;
        }

        ctx.beginPath();
        const grad = ctx.createLinearGradient(s.x, s.y, s.x + s.len, s.y);
        grad.addColorStop(0, `rgba(${s.color}, ${s.alpha})`);
        grad.addColorStop(1, `rgba(${s.color}, 0)`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + s.len, s.y);
        ctx.stroke();
      });

      // 3. FERRARI SUPERCAR (Large, Bold, High-Definition Vector Rendering)
      // Natural supercar suspension bounce
      const carBounce = Math.sin(frame * 0.45) * (isAccelerating ? 1.5 : 0.7);
      const carBaseX = width * 0.44 + (isAccelerating ? 14 : 0);
      const carBaseY = roadY - 4 + carBounce;

      ctx.save();
      ctx.translate(carBaseX, carBaseY);

      // --- Long Neon Tail Light Trail streaming backwards ---
      const trailLength = isAccelerating ? 180 : 90;
      const trailGrad = ctx.createLinearGradient(-50, -10, -50 - trailLength, -10);
      trailGrad.addColorStop(0, 'rgba(239, 68, 68, 0.95)');
      trailGrad.addColorStop(0.35, 'rgba(220, 38, 38, 0.5)');
      trailGrad.addColorStop(1, 'rgba(220, 38, 38, 0)');
      ctx.fillStyle = trailGrad;
      ctx.fillRect(-50 - trailLength, -12, trailLength, 6);

      // --- Ferrari Aerodynamic Body Profile ---
      ctx.beginPath();
      ctx.moveTo(-50, 0); // Rear diffuser bottom
      ctx.lineTo(-46, -12); // Rear bumper slope
      ctx.lineTo(-34, -18); // Rear aerodynamic ducktail spoiler
      ctx.lineTo(-14, -22); // Rear engine glass cover
      ctx.lineTo(12, -26); // Roof apex
      ctx.lineTo(34, -24); // Windshield slope start
      ctx.lineTo(62, -14); // Front hood slope
      ctx.lineTo(82, -8); // Front nose cone / splitter
      ctx.lineTo(84, -2); // Lower bumper
      ctx.lineTo(68, -2); // Front chin
      ctx.arc(52, 0, 10, Math.PI, 0, true); // Front wheel arch
      ctx.lineTo(8, 0); // Aerodynamic side skirt
      ctx.arc(-14, 0, 10, Math.PI, 0, true); // Rear wheel arch
      ctx.lineTo(-50, 0); // Rear diffuser
      ctx.closePath();

      // Rosso Corsa Ferrari Red Metallic Gradient
      const bodyGrad = ctx.createLinearGradient(-50, -28, 85, 0);
      bodyGrad.addColorStop(0, '#881337');
      bodyGrad.addColorStop(0.2, '#dc2626');
      bodyGrad.addColorStop(0.5, '#ef4444');
      bodyGrad.addColorStop(0.85, '#f87171');
      bodyGrad.addColorStop(1, '#dc2626');
      ctx.fillStyle = bodyGrad;
      ctx.shadowColor = 'rgba(239, 68, 68, 0.4)';
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.shadowBlur = 0; // reset

      // Carbon Fiber Side Air Intake
      ctx.beginPath();
      ctx.moveTo(2, -8);
      ctx.lineTo(18, -8);
      ctx.lineTo(8, -16);
      ctx.closePath();
      ctx.fillStyle = '#090d16';
      ctx.fill();

      // Sleek Tinted Canopy Glass
      ctx.beginPath();
      ctx.moveTo(-10, -20);
      ctx.lineTo(10, -24);
      ctx.lineTo(30, -22);
      ctx.lineTo(44, -14);
      ctx.lineTo(-6, -14);
      ctx.closePath();
      ctx.fillStyle = 'rgba(10, 14, 22, 0.95)';
      ctx.fill();

      // Window reflection highlight
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(2, -22);
      ctx.lineTo(28, -20);
      ctx.stroke();

      // Ferrari Giallo Modena Shield on Front Fender
      ctx.fillStyle = '#facc15';
      ctx.fillRect(40, -11, 3, 4);

      // Signature Glowing Red LED Tail Light Bar
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#ff1a1a';
      ctx.fillRect(-50, -12, 4, 6);

      // Bright Xenon Headlight Lens
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#e0f2fe';
      ctx.fillRect(80, -9, 3, 4);

      // Powerful Forward Headlight Beam Cone
      const beamGrad = ctx.createLinearGradient(84, -7, 200, 10);
      beamGrad.addColorStop(0, 'rgba(56, 189, 248, 0.6)');
      beamGrad.addColorStop(0.3, 'rgba(56, 189, 248, 0.25)');
      beamGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(84, -8);
      ctx.lineTo(200, -24);
      ctx.lineTo(200, 18);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      // Supercar Wheels with Spinning Rims & Yellow Calipers
      const drawFerrariWheel = (wx: number) => {
        ctx.save();
        ctx.translate(wx, 0);

        // Tire rubber
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fill();

        // Rim outer ring
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
        ctx.stroke();

        // Yellow Ferrari Brake Caliper
        ctx.fillStyle = '#facc15';
        ctx.fillRect(-2, -5, 4, 3);

        // Spinning 5-Spoke Rim Motion
        const spinAngle = frame * (isAccelerating ? 0.8 : 0.35);
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1.2;
        for (let i = 0; i < 5; i++) {
          const a = spinAngle + (i * Math.PI * 2) / 5;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * 6, Math.sin(a) * 6);
          ctx.stroke();
        }

        ctx.restore();
      };

      drawFerrariWheel(-14);
      drawFerrariWheel(52);

      // Exhaust Turbo Flame Bursts
      if (isAccelerating || frame % 45 < 12) {
        ctx.shadowColor = '#f97316';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(-52, -4, 3 + Math.random() * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
    };
  }, [isAccelerating]);

  return (
    <div className="w-full h-full relative overflow-hidden select-none">
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}
