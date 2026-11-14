'use client';

import { BarChart3 } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/orbat/primitives';
import type { VolumePoint } from '@/lib/data/overview';
import { fmtInt, niceCeil } from './format';

const H = 220;

/* Main.dc.html "Conversation volume". The backend reports new and solved
   tickets per day, so each day is a pair of bars (new, solved) rather than
   the design's AI / human / open stack: the per-day AI split is not stored
   (docs/design/BACKEND_GAPS.md). A hidden table carries the numbers for
   screen readers. */
export function VolumeChart({ points }: { points: VolumePoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(0, ...points.map((p) => Math.max(p.created, p.solved)));
  const totalNew = points.reduce((a, p) => a + p.created, 0);
  const totalSolved = points.reduce((a, p) => a + p.solved, 0);

  if (max === 0) {
    return (
      <EmptyState
        icon={<BarChart3 size={22} />}
        title="No conversations in this period yet"
        body="Once customers start writing in, daily volume shows up here."
        className="py-10"
      />
    );
  }

  const top = niceCeil(max);
  const scale = H / top;
  const labelEvery = Math.max(1, Math.ceil(points.length / 8));
  const gap = points.length > 31 ? 1 : points.length > 14 ? 3 : 8;
  const line =
    hover !== null
      ? `${points[hover].label} · ${fmtInt(points[hover].created)} new · ${fmtInt(points[hover].solved)} solved`
      : `${fmtInt(totalNew)} new · ${fmtInt(totalSolved)} solved · hover a day for detail`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="o-num text-[13.5px] text-o-text-2" aria-live="polite">
          {line}
        </p>
        <div className="flex items-center gap-3.5 text-[12.5px] text-o-text-2" aria-hidden="true">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-o-border-strong" />
            New
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-o-accent-text" />
            Solved
          </span>
        </div>
      </div>

      <div className="flex gap-2.5" aria-hidden="true">
        <div className="o-num flex w-9 flex-col justify-between text-right text-[11px] text-o-text-3" style={{ height: H }}>
          <span>{fmtInt(top)}</span>
          <span>{fmtInt(Math.round((top * 2) / 3))}</span>
          <span>{fmtInt(Math.round(top / 3))}</span>
          <span>0</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div
            className="flex items-end border-b border-o-border"
            style={{
              height: H,
              gap,
              background: `linear-gradient(var(--border) 1px, transparent 1px) 0 0 / 100% ${H / 3}px`,
            }}
            onMouseLeave={() => setHover(null)}
          >
            {points.map((p, i) => (
              <div
                key={p.date}
                className="flex h-full min-w-0 flex-1 items-end justify-center gap-[2px] transition-opacity"
                style={{ opacity: hover === null || hover === i ? 1 : 0.45 }}
                onMouseEnter={() => setHover(i)}
              >
                <span
                  className="w-full max-w-[18px] rounded-t-[4px] bg-o-border-strong"
                  style={{ height: Math.max(p.created ? 2 : 0, Math.round(p.created * scale)) }}
                />
                <span
                  className="w-full max-w-[18px] rounded-t-[4px] bg-o-accent-text"
                  style={{ height: Math.max(p.solved ? 2 : 0, Math.round(p.solved * scale)) }}
                />
              </div>
            ))}
          </div>
          <div className="o-num flex text-[11px] text-o-text-3" style={{ gap }}>
            {points.map((p, i) => (
              <span key={p.date} className="min-w-0 flex-1 overflow-hidden whitespace-nowrap text-center">
                {i % labelEvery === 0 ? p.label : ''}
              </span>
            ))}
          </div>
        </div>
      </div>

      <table className="sr-only">
        <caption>Conversations per day</caption>
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">New</th>
            <th scope="col">Solved</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.date}>
              <th scope="row">{p.label}</th>
              <td>{p.created}</td>
              <td>{p.solved}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
