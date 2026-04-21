'use client';
// ============================================================
// components/ui/SignaturePad.tsx
//
// Canvas-based freehand signature capture. Lifted out of two
// near-identical implementations that lived in:
//   - app/doc/[token]/document-view.tsx (public signing modal)
//   - app/dashboard/personal/paperwork/page.tsx (SenderSignatureField)
// plus a third instance that now needs it in:
//   - app/dashboard/personal/settings/page.tsx (saved-signature card)
//
// The component renders a blank canvas. The caller reads the drawn
// bytes via the ref-forwarded getDataUrl() method. Keeping the
// caller in charge of export timing avoids re-rendering the canvas
// every stroke just to keep a string in state — on mid-range
// mobiles that lag was visible.
//
// Usage
// -----
//   const padRef = useRef<SignaturePadHandle>(null);
//   <SignaturePad ref={padRef} onDrawChange={setHasDrawn} />
//   const dataUrl = padRef.current?.getDataUrl() ?? '';
//
// Scaling
// -------
// The canvas has a fixed internal resolution (the `width`/`height`
// attributes — crisp output, stable aspect) and is stretched by CSS
// to whatever width its container gives it. Mouse coordinates are
// scaled from CSS pixels to canvas pixels on every stroke.
//
// Touch support
// -------------
// Matches the v3.5 behaviour of the public signing modal — mouse
// events only, no touch. The existing flows explicitly use
// onMouseDown etc. and work on tablets via a stylus. Adding touch
// is a focused follow-up (pointer events + preventDefault on
// touchmove to avoid page scrolling during signing).
// ============================================================

import {
  forwardRef, useImperativeHandle, useRef, useState,
  type CSSProperties,
} from 'react';

/** Handle exposed to the caller. */
export interface SignaturePadHandle {
  /** Returns the canvas contents as a PNG data URL, or null if empty. */
  getDataUrl: () => string | null;
  /** Returns the canvas contents as a PNG Blob (for FormData uploads). */
  getPngBlob: () => Promise<Blob | null>;
  /** Clears the canvas. Fires onDrawChange(false). */
  clear:      () => void;
  /** True if the user has drawn at least one stroke since last clear. */
  hasStrokes: () => boolean;
}

export interface SignaturePadProps {
  /** Internal canvas width in px. Default 432 — matches public signing modal. */
  width?:  number;
  /** Internal canvas height in px. Default 120. */
  height?: number;
  /** Underline colour (design-system token or literal). Default var(--accent-blue). */
  underlineColor?: string;
  /** Stroke colour. Default '#111318' — readable on light and white backgrounds. */
  strokeColor?: string;
  /** Fires true on first stroke, false after clear(). Use to gate the Save button. */
  onDrawChange?: (hasStrokes: boolean) => void;
  /** Additional inline styles merged onto the canvas element. */
  style?: CSSProperties;
}

export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  function SignaturePad(
    {
      width = 432,
      height = 120,
      underlineColor = 'var(--accent-blue)',
      strokeColor = '#111318',
      onDrawChange,
      style,
    },
    ref,
  ) {
    const canvasRef  = useRef<HTMLCanvasElement>(null);
    const drawing    = useRef(false);
    const [hasStrokes, setHasStrokes] = useState(false);

    function getCtx() {
      return canvasRef.current?.getContext('2d') ?? null;
    }

    // Convert mouse event coords to canvas-internal coords so strokes
    // land where the pointer is regardless of CSS scaling.
    function toCanvasCoords(e: React.MouseEvent<HTMLCanvasElement>) {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width  / rect.width;
      const scaleY = canvas.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top)  * scaleY,
      };
    }

    function startDraw(e: React.MouseEvent<HTMLCanvasElement>) {
      const ctx = getCtx();
      const pt  = toCanvasCoords(e);
      if (!ctx || !pt) return;
      drawing.current = true;
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
    }

    function draw(e: React.MouseEvent<HTMLCanvasElement>) {
      if (!drawing.current) return;
      const ctx = getCtx();
      const pt  = toCanvasCoords(e);
      if (!ctx || !pt) return;
      ctx.lineWidth   = 2.5;
      ctx.strokeStyle = strokeColor;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
      if (!hasStrokes) {
        setHasStrokes(true);
        onDrawChange?.(true);
      }
    }

    function endDraw() {
      drawing.current = false;
    }

    useImperativeHandle(ref, () => ({
      getDataUrl: () => {
        if (!hasStrokes) return null;
        return canvasRef.current?.toDataURL('image/png') ?? null;
      },
      getPngBlob: () => {
        return new Promise<Blob | null>((resolve) => {
          const canvas = canvasRef.current;
          if (!canvas || !hasStrokes) { resolve(null); return; }
          canvas.toBlob((blob) => resolve(blob), 'image/png');
        });
      },
      clear: () => {
        const canvas = canvasRef.current;
        const ctx    = getCtx();
        if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (hasStrokes) {
          setHasStrokes(false);
          onDrawChange?.(false);
        }
      },
      hasStrokes: () => hasStrokes,
    }), [hasStrokes, onDrawChange]);

    return (
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        style={{
          width:            '100%',
          height:           height,
          borderRadius:     'var(--radius-sm)',
          border:           '1px solid var(--border-default)',
          borderBottom:     `2px solid ${underlineColor}`,
          background:       '#ffffff',
          cursor:           'crosshair',
          display:          'block',
          touchAction:      'none',
          ...style,
        }}
      />
    );
  },
);
