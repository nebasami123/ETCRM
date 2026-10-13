import { useId, useState } from "react";
import { salesPipelineStages } from "@etcrm/contracts";
import { ArrowRight, Check } from "lucide-react";
import type { AdminOverviewAggregates } from "../../types";
import { leadSources, normalizeLeadSource } from "../../lib/constants/lead-sources";
import "./pipeline-chart.css";

const stages = salesPipelineStages.filter((stage) => stage !== "Closed Lost");
const colors = ["#bd783d", "#309477", "#8b65b5", "#477db4", "#b64f6c", "#738b32", "#b08830", "#388b94", "#9b6252", "#686ab4", "#8d7964", "#717d88"];
const FLOW_DOT_COUNT = 72;
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const percent = (value: number, total: number) => `${total ? (value / total * 100).toFixed(1) : "0"}%`;

function allocateDots(weights: number[]) {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (!total) return weights.map(() => 0);
  const exact = weights.map((weight) => weight ? weight / total * FLOW_DOT_COUNT : 0);
  const dots = exact.map(Math.floor);
  let remaining = FLOW_DOT_COUNT - dots.reduce((sum, count) => sum + count, 0);
  exact.map((count, index) => ({ index, remainder: count - dots[index] }))
    .sort((a, b) => b.remainder - a.remainder)
    .forEach(({ index }) => { if (remaining > 0) { dots[index] += 1; remaining -= 1; } });
  return dots;
}

function particlePath(top: number[], bottom: number[], column: number, lane: number, totalLanes: number, lastStage: number, exitPoint: number) {
  const yAt = (stage: number) => {
    const drift = Math.sin(lane * 2.13 + stage * 1.7) * 0.12;
    const position = Math.max(0.04, Math.min(0.96, (lane + 0.5) / totalLanes + drift));
    return top[stage] + (bottom[stage] - top[stage]) * position;
  };
  let path = `M ${column * 0.24} ${yAt(0)}`;
  for (let stage = 0; stage <= lastStage; stage += 1) {
    const endX = (stage + 0.76) * column;
    path += ` L ${endX} ${yAt(stage)}`;
    if (stage < lastStage) {
      const middle = (stage + 1) * column;
      path += ` C ${middle} ${yAt(stage)} ${middle} ${yAt(stage + 1)} ${(stage + 1.24) * column} ${yAt(stage + 1)}`;
      path += ` L ${(stage + 1.76) * column} ${yAt(stage + 1)}`;
    }
  }
  if (lastStage < top.length - 1) {
    const startX = (lastStage + 0.76) * column;
    const endX = (lastStage + 1.24) * column;
    const middle = (startX + endX) / 2;
    const startY = yAt(lastStage);
    const endY = yAt(lastStage + 1);
    const t = exitPoint;
    const inverse = 1 - t;
    const x = inverse ** 3 * startX + 3 * inverse ** 2 * t * middle + 3 * inverse * t ** 2 * middle + t ** 3 * endX;
    const y = inverse ** 3 * startY + 3 * inverse ** 2 * t * startY + 3 * inverse * t ** 2 * endY + t ** 3 * endY;
    path += ` C ${middle} ${startY} ${middle} ${endY} ${x} ${y}`;
  }
  return path;
}

// Flat stage columns joined by cubic curves, independently drawn from live counts.
function edge(values: number[], width: number, reverse = false) {
  const indices = values.map((_, index) => index);
  if (reverse) indices.reverse();
  let path = "";
  indices.forEach((index, position) => {
    const start = (index + (reverse ? 0.76 : 0.24)) * width;
    const end = (index + (reverse ? 0.24 : 0.76)) * width;
    if (!position) path += `${reverse ? "L" : "M"} ${start} ${values[index]}`;
    else {
      const previous = indices[position - 1];
      const previousEnd = (previous + (reverse ? 0.24 : 0.76)) * width;
      const middle = (previousEnd + start) / 2;
      path += ` C ${middle} ${values[previous]} ${middle} ${values[index]} ${start} ${values[index]}`;
    }
    path += ` L ${end} ${values[index]}`;
  });
  return path;
}

export function PipelineChart({ sources = [] }: { sources: AdminOverviewAggregates["pipelineSources"] }) {
  const id = useId();
  const [source, setSource] = useState("all");
  const [split, setSplit] = useState(true);
  const [flow, setFlow] = useState(true);
  const [active, setActive] = useState<number | null>(null);
  const normalized = new Map<string, { counts: number[]; current: number[]; progressed: number[] }>();
  for (const row of sources) {
    const label = normalizeLeadSource(row.source).source || "Unknown / not recorded";
    const data = normalized.get(label) ?? { counts: stages.map(() => 0), current: stages.map(() => 0), progressed: stages.map(() => 0) };
    row.stages.forEach(({ stage, count, currentCount, progressedCount }) => {
      const index = stages.findIndex((value) => value === stage);
      if (index >= 0) {
        data.counts[index] += Math.max(0, count);
        data.current[index] += currentCount ?? 0;
        data.progressed[index] += progressedCount ?? 0;
      }
    });
    normalized.set(label, data);
  }
  const segments = leadSources.filter((label) => normalized.has(label)).map((label) => ({
    label, ...normalized.get(label)!, color: colors[leadSources.indexOf(label)]
  }));
  const selected = source === "all" || !normalized.has(source) ? segments : segments.filter((segment) => segment.label === source);
  const totals = stages.map((_, index) => selected.reduce((sum, segment) => sum + segment.counts[index], 0));
  const total = totals[0] ?? 0;
  const current = stages.map((_, index) => selected.reduce((sum, segment) => sum + segment.current[index], 0));
  const progressed = stages.map((_, index) => selected.reduce((sum, segment) => sum + segment.progressed[index], 0));
  const bands = split ? selected : [{ label: "All sources", counts: totals, color: "var(--accent)" }];
  const column = 112;
  const width = column * stages.length;
  const height = 240;
  const gap = bands.length > 1 ? 3 : 0;
  const scale = (height - 24 - Math.max(0, bands.length - 1) * gap) / Math.max(1, ...totals);
  const offsets = totals.map((count) => (height - count * scale - Math.max(0, bands.length - 1) * gap) / 2);
  const shapes = bands.map((band) => {
    const top = [...offsets];
    const bottom = top.map((value, index) => value + band.counts[index] * scale);
    bottom.forEach((value, index) => { offsets[index] = value + gap; });
    return { ...band, top, bottom, path: `${edge(top, column)} ${edge(bottom, column, true)} Z` };
  });
  const dotCounts = allocateDots(shapes.map((band) => band.counts[0]));
  const activeStage = active === null ? null : stages[active];

  return (
    <section className="pipeline-chart" aria-labelledby={`${id}-title`}>
      <div className="pipeline-chart-header">
        <div>
          <h3 id={`${id}-title`} className="text-sm font-bold text-foreground">Lead pipeline</h3>
          <p className="mt-1 text-xs text-muted">{total.toLocaleString("en-US")} leads · All-time journey by source</p>
        </div>
        <div className="pipeline-chart-controls">
          <select aria-label="Filter pipeline by lead source" value={source} onChange={(event) => setSource(event.target.value)}>
            <option value="all">All sources</option>
            {segments.map((segment) => <option key={segment.label}>{segment.label}</option>)}
          </select>
          <button type="button" role="switch" aria-checked={split} onClick={() => setSplit(!split)} className="pipeline-switch"><span aria-hidden="true" />Split</button>
          <button type="button" role="switch" aria-checked={flow} onClick={() => setFlow(!flow)} className="pipeline-switch"><span aria-hidden="true" />Flow</button>
        </div>
      </div>
      {total === 0 ? <div className="pipeline-chart-empty">No leads in this pipeline yet.</div> : <>
        <div className="pipeline-chart-scroll" tabIndex={0} aria-label="Pipeline stages. Scroll horizontally to see every stage.">
          <div className="pipeline-chart-plot" style={{ minWidth: width }} onMouseLeave={() => setActive(null)}>
            <div className="pipeline-chart-stages" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}>
              {stages.map((stage, index) => (
                <button key={stage} type="button" aria-pressed={active === index} aria-label={`${stage}: ${totals[index].toLocaleString("en-US")} leads reached this stage, ${percent(totals[index], total)} of starting leads`}
                  onMouseEnter={() => setActive(index)} onFocus={() => setActive(index)} onBlur={() => setActive(null)} onClick={() => setActive(index)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") { setActive(null); return; }
                    const target = event.key === "Home" ? 0 : event.key === "End" ? totals.length - 1 : event.key === "ArrowRight" ? Math.min(index + 1, totals.length - 1) : event.key === "ArrowLeft" ? Math.max(index - 1, 0) : null;
                    if (target !== null) { event.preventDefault(); (event.currentTarget.parentElement?.children[target] as HTMLElement)?.focus(); }
                  }}>
                  <span className="pipeline-stage-label">{stage}</span>
                  <strong>{compact.format(totals[index])}</strong>
                  <span className="text-muted">{percent(totals[index], total)} of leads</span>
                  <span className="pipeline-stage-current">{index === stages.length - 1 ? "Successful outcome" : `${compact.format(current[index])} currently here`}</span>
                </button>
              ))}
            </div>
            <svg viewBox={`0 0 ${width} ${height}`} className="pipeline-chart-bands" aria-hidden="true">
              {stages.map((stage, index) => <rect key={stage} x={index * column} y="0" width={column} height={height} fill="var(--foreground)" opacity={active === index ? 0.045 : 0} />)}
              {shapes.map((band, index) => <g key={band.label}>
                <path d={band.path} fill={band.color} fillOpacity="0.7" />
                <clipPath id={`${id}-clip-${index}`}><path d={band.path} /></clipPath>
                {flow && band.counts.some((count) => count > 0) && <g className="pipeline-flow-dots" clipPath={`url(#${id}-clip-${index})`}>
                  {Array.from({ length: dotCounts[index] }, (_, dot) => {
                    const ratio = (dot + 0.5) / dotCounts[index];
                    let lastStage = 0;
                    while (lastStage < stages.length - 1 && ratio < band.counts[lastStage + 1] / Math.max(1, band.counts[0])) lastStage += 1;
                    const exitPoint = 0.18 + ((dot * 37 + index * 19) % 65) / 100;
                    const pathId = `${id}-flow-${index}-${dot}`;
                    return <g key={dot}>
                      <path id={pathId} d={particlePath(band.top, band.bottom, column, dot, dotCounts[index], lastStage, exitPoint)} fill="none" />
                      <circle r="1.8" fill="#f1eee8" opacity="0.78">
                        <animateMotion dur="9s" begin={`${-dot * 9 / dotCounts[index]}s`} repeatCount="indefinite"><mpath href={`#${pathId}`} /></animateMotion>
                      </circle>
                    </g>;
                  })}
                </g>}
              </g>)}
              {stages.map((stage, index) => <rect key={stage} x={index * column} y="0" width={column} height={height} fill="transparent" onMouseEnter={() => setActive(index)} onClick={() => setActive(index)} />)}
            </svg>
            <div className="pipeline-chart-axis" aria-hidden="true">
              <span className="inline-flex items-center gap-1"><ArrowRight size={12} /> Recorded stages reached</span>
              <span className="inline-flex items-center gap-1">Closed Won <Check size={12} /></span>
            </div>
          </div>
        </div>
        <div className="pipeline-chart-detail" aria-live="polite">
          {activeStage !== null && active !== null ? <>
            <strong>{activeStage} · {totals[active].toLocaleString("en-US")} leads reached</strong>
            <p className="mt-1 text-muted">{current[active].toLocaleString("en-US")} currently here{active < stages.length - 1 ? ` · ${progressed[active].toLocaleString("en-US")} reached a later stage` : ""}</p>
            <div className="pipeline-chart-source-counts">{selected.filter((segment) => segment.counts[active] > 0).map((segment) => <span key={segment.label}><i style={{ backgroundColor: segment.color }} />{segment.label}<b>{segment.counts[active].toLocaleString("en-US")}</b></span>)}{totals[active] === 0 && <span>No leads at this stage.</span>}</div>
          </> : <span className="text-muted">Hover or select a stage to see its source breakdown. Each lead counts once per recorded stage, even after moving on. Skipped stages are not inferred.</span>}
        </div>
        <div className="pipeline-chart-legend" aria-label="Lead sources">
          {segments.map((segment) => <button key={segment.label} type="button" aria-pressed={source === segment.label} onClick={() => setSource(source === segment.label ? "all" : segment.label)} style={{ opacity: source !== "all" && source !== segment.label ? 0.5 : 1 }}><i style={{ backgroundColor: segment.color }} />{segment.label}</button>)}
        </div>
        <div className="sr-only"><table><caption>Unique leads that reached each stage, by lead source</caption><thead><tr><th>Stage</th>{selected.map((segment) => <th key={segment.label}>{segment.label}</th>)}<th>Total</th></tr></thead><tbody>{stages.map((stage, index) => <tr key={stage}><th scope="row">{stage}</th>{selected.map((segment) => <td key={segment.label}>{segment.counts[index]}</td>)}<td>{totals[index]}</td></tr>)}</tbody></table></div>
      </>}
    </section>
  );
}
