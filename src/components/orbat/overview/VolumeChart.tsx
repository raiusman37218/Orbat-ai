'use client';

import { BarChart3 } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/orbat/primitives';
import type { VolumePoint } from '@/lib/data/overview';
import { fmtInt, niceCeil } from './format';

const H = 220;

export function VolumeChart({
  points,
  granularity = 'day',
  timeZone,
}: {
  points: VolumePoint[];
  granularity?: 'day' | 'hour';
  timeZone?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(0, ...points.map((p) => p.aiResolved + p.humanResolved + p.stillOpen));
  const totalAi = points.reduce((a, p) => a + p.aiResolved, 0);
  const totalHuman = points.reduce((a, p) => a + p.humanResolved, 0);
  const totalOpen = points.reduce((a, p) => a + p.stillOpen, 0);
  const totalNew = points.reduce((a, p) => a + p.created, 0);

  if (max === 0 && totalNew === 0) {
    return (
      <EmptyState
        icon={<BarChart3 size={22} />}
        title={
          granularity === 'hour'
            ? 'No conversations in the last 24 hours'
            : 'No conversations in this period yet'
        }
        body="Once customers start writing in, AI vs human resolution volume shows up here."
        className="py-10"
      />
    );
  }

  const top = niceCeil(Math.max(max, totalNew > 0 ? 1 : 0));
  const scale = H / top;
  const labelEvery = Math.max(1, Math.ceil(points.length / 8));
  const gap = points.length > 31 ? 1 : points.length > 14 ? 3 : 8;
  const unitNoun = granularity === 'hour' ? 'an hour' : 'a day';

  const line =
    hover !== null && points[hover]
      ? `${points[hover].label} · ${fmtInt(points[hover].aiResolved)} AI · ${fmtInt(points[hover].humanResolved)} human · ${fmtInt(points[hover].stillOpen)} open`
      : `${fmtInt(totalAi)} AI · ${fmtInt(totalHuman)} human · ${fmtInt(totalOpen)} open${
          timeZone && granularity === 'hour' ? ` (${timeZone})` : ''
        } · hover ${unitNoun} for detail`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="o-num text-[13.5px] text-o-text-2" aria-live="polite">
          {line}
        </p>
        <div className="flex flex-wrap items-center gap-3.5 text-[12.5px] text-o-text-2" aria-hidden="true">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-o-ai" />
            AI resolved
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-o-accent-text" />
            Human resolved
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-o-border-strong" />
            Still open
          </span>
        </div>
      </div>

      <div className="flex gap-2.5" aria-hidden="true">
        <div
          className="o-num flex w-9 flex-col justify-between text-right text-[11px] text-o-text-3"
          style={{ height: H }}
        >
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
            {points.map((p, i) => {
              const stackTotal = p.aiResolved + p.humanResolved + p.stillOpen;
              const openH = p.stillOpen > 0 ? Math.max(2, Math.round(p.stillOpen * scale)) : 0;
              const humanH = p.humanResolved > 0 ? Math.max(2, Math.round(p.humanResolved * scale)) : 0;
              const aiH = p.aiResolved > 0 ? Math.max(2, Math.round(p.aiResolved * scale)) : 0;

              return (
                <div
                  key={p.date}
                  className="flex h-full min-w-0 flex-1 items-end justify-center transition-opacity"
                  style={{ opacity: hover === null || hover === i ? 1 : 0.45 }}
                  onMouseEnter={() => setHover(i)}
                >
                  <div
                    className="flex w-full max-w-[24px] flex-col justify-end overflow-hidden rounded-t-[5px]"
                    style={{ maxHeight: H, minHeight: stackTotal > 0 ? 2 : 0 }}
                  >
                    {openH > 0 ? <span className="w-full bg-o-border-strong" style={{ height: openH }} /> : null}
                    {humanH > 0 ? <span className="w-full bg-o-accent-text" style={{ height: humanH }} /> : null}
                    {aiH > 0 ? <span className="w-full bg-o-ai" style={{ height: aiH }} /> : null}
                  </div>
                </div>
              );
            })}
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
        <caption>{granularity === 'hour' ? 'Hourly' : 'Daily'} conversation breakdown</caption>
        <thead>
          <tr>
            <th scope="col">{granularity === 'hour' ? 'Hour' : 'Day'}</th>
            <th scope="col">New</th>
            <th scope="col">AI resolved</th>
            <th scope="col">Human resolved</th>
            <th scope="col">Still open</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.date}>
              <th scope="row">{p.label}</th>
              <td>{p.created}</td>
              <td>{p.aiResolved}</td>
              <td>{p.humanResolved}</td>
              <td>{p.stillOpen}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
