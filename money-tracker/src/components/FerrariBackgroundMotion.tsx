'use client';

import React, { useEffect, useRef } from 'react';

export default function FerrariBackgroundMotion() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 400);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 280);

    const handleResize = () => {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', handleResize);

    // Neon speed streaks in background
    const streaks: { x: number; y: number; len: number; speed: number; alpha: number; color: string }[] = [];
    for (let i = 0; i < 24; i++) {
      streaks.push({
        x: Math.random() * width,
        y: Math.random() * height,
        len: 30 + Math.random() * 80,
        speed: 3 + Math.random() * 5,
        alpha: 0.15 + Math.random() * 0.35,
        color: Math.random() > 0.4 ? '239, 68, 68' : '234, 179, 8', // Rosso Corsa & Giallo Modena
      });
    }

    // Ferrari cruising state
    let carX = width + 50;
    const carY = height * 0.45;
    let frame = 0;

    const render = () => {
      frame++;
      ctx.clearRect(0, 0, width, height);

      // 1. Ambient Dark Road perspective horizon
      const horizonY = height * 0.75;
      const roadGrad = ctx.createLinearGradient(0, horizonY - 30, 0, height);
      roadGrad.addColorStop(0, 'rgba(15, 23, 42, 0)');
      roadGrad.addColorStop(1, 'rgba(239, 68, 68, 0.05)');
      ctx.fillStyle = roadGrad;
      ctx.fillRect(0, horizonY - 30, width, height - (horizonY - 30));

      // 2. Light speed trails streaming across the background
      streaks.forEach((s) => {
        s.x -= s.speed;
        if (s.x < -s.len) {
          s.x = width + Math.random() * 80;
          s.y = Math.random() * (height - 20);
          s.len = 30 + Math.random() * 90;
          s.speed = 3 + Math.random() * 6;
        }

        ctx.beginPath();
        const grad = ctx.createLinearGradient(s.x, s.y, s.x + s.len, s.y);
        grad.addColorStop(0, `rgba(${s.color}, ${s.alpha})`);
        grad.addColorStop(1, `rgba(${s.color}, 0)`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.2;
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + s.len, s.y);
        ctx.stroke();
      });

      // 3. Ferrari Supercar Silhouette cruising smoothly from right to left
      carX -= 1.8;
      if (carX < -160) {
        carX = width + 80;
      }

      ctx.save();
      const carBounce = Math.sin(frame * 0.25) * 0.8;
      ctx.translate(carX, carY + carBounce);

      // Long glowing red tail light laser streak
      const tailStreakLen = 95;
      const tailGrad = ctx.createLinearGradient(-35, -4, -35 - tailStreakLen, -4);
      tailGrad.addColorStop(0, 'rgba(239, 68, 68, 0.85)');
      tailGrad.addColorStop(0.4, 'rgba(220, 38, 38, 0.35)');
      tailGrad.addColorStop(1, 'rgba(220, 38, 38, 0)');
      ctx.fillStyle = tailGrad;
      ctx.fillRect(-35 - tailStreakLen, -6, tailStreakLen, 4);

      // Ferrari Aerodynamic Body
      ctx.beginPath();
      ctx.moveTo(-35, 0);
      ctx.lineTo(-32, -8);
      ctx.lineTo(-24, -13);
      ctx.lineTo(-10, -16);
      ctx.lineTo(10, -19);
      ctx.lineTo(26, -17);
      ctx.lineTo(46, -10);
      ctx.lineTo(60, -6);
      ctx.lineTo(62, 0);
      ctx.lineTo(48, 0);
      ctx.arc(38, 0, 7, Math.PI, 0, true);
      ctx.lineTo(6, 0);
      ctx.arc(-10, 0, 7, Math.PI, 0, true);
      ctx.lineTo(-35, 0);
      ctx.closePath();

      const bodyGrad = ctx.createLinearGradient(-35, -20, 62, 0);
      bodyGrad.addColorStop(0, '#991b1b');
      bodyGrad.addColorStop(0.5, '#dc2626');
      bodyGrad.addColorStop(1, '#ef4444');
      ctx.fillStyle = bodyGrad;
      ctx.shadowColor = 'rgba(239, 68, 68, 0.45)';
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Dark Cockpit Canopy
      ctx.beginPath();
      ctx.moveTo(-8, -14);
      ctx.lineTo(8, -17);
      ctx.lineTo(22, -15);
      ctx.lineTo(32, -10);
      ctx.lineTo(-4, -10);
      ctx.closePath();
      ctx.fillStyle = 'rgba(10, 15, 25, 0.9)';
      ctx.fill();

      // Signature Glowing Red LED Tail-light
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#ff1a1a';
      ctx.fillRect(-35, -7, 3, 4);

      // Xenon Headlight Beam cutting forward
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#e0f2fe';
      ctx.fillRect(60, -7, 2, 3);

      const beamGrad = ctx.createLinearGradient(62, -5, 140, 5);
      beamGrad.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
      beamGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(62, -6);
      ctx.lineTo(140, -18);
      ctx.lineTo(140, 12);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      // Spinning Wheels
      const drawWheel = (wx: number) => {
        ctx.save();
        ctx.translate(wx, 0);
        ctx.fillStyle = '#090d16';
        ctx.beginPath();
        ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#facc15'; // Yellow caliper
        ctx.fillRect(-1.5, -3.5, 3, 2);

        const spin = frame * 0.35;
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        for (let j = 0; j < 4; j++) {
          const a = spin + (j * Math.PI) / 2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * 4, Math.sin(a) * 4);
          ctx.stroke();
        }
        ctx.restore();
      };

      drawWheel(-10);
      drawWheel(38);

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0 opacity-55"
    />
  );
}