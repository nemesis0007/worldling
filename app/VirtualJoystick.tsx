"use client";

import { PointerEvent, useCallback, useEffect, useRef } from "react";

const RADIUS = 38;
const DEAD_ZONE = 0.12;

type Props = {
  disabled?: boolean;
  onMove: (x: number, y: number) => void;
};

/**
 * Touch movement control adapted from Sadak's virtual joystick with permission
 * from Parth Mittal. Worldling adds a held-input animation loop so movement
 * continues while the player's thumb stays still.
 */
export default function VirtualJoystick({ disabled = false, onMove }: Props) {
  const baseRef = useRef<HTMLDivElement | null>(null);
  const pointerRef = useRef<number | null>(null);
  const outputRef = useRef({ x: 0, y: 0 });
  const frameRef = useRef<number | null>(null);

  const stopLoop = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  const startLoop = useCallback(() => {
    stopLoop();
    const tick = () => {
      const output = outputRef.current;
      if (pointerRef.current !== null && !disabled) onMove(output.x, output.y);
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
  }, [disabled, onMove, stopLoop]);

  const reset = useCallback(() => {
    pointerRef.current = null;
    outputRef.current = { x: 0, y: 0 };
    stopLoop();
    const knob = baseRef.current?.querySelector<HTMLElement>("[data-joystick-knob]");
    if (knob) knob.style.transform = "translate(-50%, -50%)";
  }, [stopLoop]);

  useEffect(() => reset, [reset]);

  function update(clientX: number, clientY: number) {
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    let x = clientX - (rect.left + rect.width / 2);
    let y = clientY - (rect.top + rect.height / 2);
    const rawLength = Math.hypot(x, y);
    if (rawLength > RADIUS) {
      x = x / rawLength * RADIUS;
      y = y / rawLength * RADIUS;
    }
    const length = Math.min(1, Math.hypot(x, y) / RADIUS);
    if (length < DEAD_ZONE) outputRef.current = { x: 0, y: 0 };
    else {
      const scaled = (length - DEAD_ZONE) / (1 - DEAD_ZONE);
      const curve = scaled * scaled * .65 + scaled * .35;
      const directionLength = Math.max(1, Math.hypot(x, y));
      outputRef.current = { x: x / directionLength * curve, y: y / directionLength * curve };
    }
    const knob = base.querySelector<HTMLElement>("[data-joystick-knob]");
    if (knob) knob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
  }

  function handleDown(event: PointerEvent<HTMLDivElement>) {
    if (disabled) return;
    event.preventDefault();
    event.stopPropagation();
    pointerRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    update(event.clientX, event.clientY);
    startLoop();
  }

  function handleMove(event: PointerEvent<HTMLDivElement>) {
    if (disabled || pointerRef.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    update(event.clientX, event.clientY);
  }

  function handleUp(event: PointerEvent<HTMLDivElement>) {
    if (pointerRef.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    reset();
  }

  return (
    <div className={`virtual-joystick ${disabled ? "disabled" : ""}`} aria-label="Touch movement joystick">
      <div
        ref={baseRef}
        className="virtual-joystick-base"
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
        onLostPointerCapture={reset}
      >
        <div data-joystick-knob className="virtual-joystick-knob" />
      </div>
    </div>
  );
}
