import React from 'react';

// Flat Palette Tokens:
const PALETTE = {
  primary: '#1F4D3F',
  accent: '#C2501F',
  grayDark: '#6B6F6A',
  grayLight: '#D8D4C9',
  bgSoft: '#FAF8F3',
  border: '#E4DFD3',
  green: '#1E5631',
  amber: '#D97706',
  red: '#9E2A2B',
};

// -------------------------------------------------------------
// 1. Department-wise Placement % (Horizontal Bars)
// -------------------------------------------------------------
export interface DeptPlacementStat {
  department: string;
  shortName: string;
  eligible: number;
  placed: number;
  percentage: number;
}

export const DeptPlacementBarChart: React.FC<{
  data: DeptPlacementStat[];
}> = ({ data }) => {
  return (
    <div className="space-y-3">
      {data.length === 0 ? (
        <div className="text-center py-6 text-xs text-[#6B6F6A]">
          No department data available.
        </div>
      ) : (
        data.map((item) => (
          <div key={item.department} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-[#1C1F1D] truncate max-w-[200px]" title={item.department}>
                {item.shortName}
              </span>
              <span className="tabular-nums font-semibold text-[#1F4D3F]">
                {item.percentage}% ({item.placed}/{item.eligible})
              </span>
            </div>
            <div className="h-4 bg-[#F0EEE9] rounded-[2px] overflow-hidden flex">
              <div
                className="h-full bg-[#1F4D3F] transition-all duration-300"
                style={{ width: `${Math.min(100, item.percentage)}%` }}
              />
            </div>
          </div>
        ))
      )}
      <p className="text-[11px] text-[#6B6F6A] leading-relaxed pt-2 border-t border-[#F0EEE9]">
        Placed % = unique placed students / registered and eligible students in that department. Withdrawn, rejected and cancelled-drive applications are excluded.
      </p>
    </div>
  );
};

// -------------------------------------------------------------
// 2. Company-wise Selections vs Offers (Grouped Bars)
// -------------------------------------------------------------
export interface CompanyStat {
  company: string;
  selections: number;
  offers: number;
}

export const CompanyGroupedBarChart: React.FC<{
  data: CompanyStat[];
}> = ({ data }) => {
  const maxVal = Math.max(1, ...data.map((d) => Math.max(d.selections, d.offers)));

  return (
    <div className="space-y-4">
      {data.length === 0 ? (
        <div className="text-center py-6 text-xs text-[#6B6F6A]">
          No company data available.
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((item) => (
            <div key={item.company} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-[#1C1F1D] truncate max-w-[160px]">
                  {item.company}
                </span>
                <span className="text-[11px] text-[#6B6F6A] tabular-nums">
                  <span className="font-semibold text-[#1F4D3F]">{item.selections}</span> sel ·{' '}
                  <span className="font-semibold text-[#C2501F]">{item.offers}</span> off
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="h-3 bg-[#F0EEE9] rounded-[2px] overflow-hidden">
                  <div
                    className="h-full bg-[#1F4D3F] transition-all duration-300"
                    style={{ width: `${(item.selections / maxVal) * 100}%` }}
                  />
                </div>
                <div className="h-3 bg-[#F0EEE9] rounded-[2px] overflow-hidden">
                  <div
                    className="h-full bg-[#C2501F] transition-all duration-300"
                    style={{ width: `${(item.offers / maxVal) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-4 text-[11px] text-[#6B6F6A] pt-2 border-t border-[#F0EEE9]">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 bg-[#1F4D3F] rounded-[1px]" />
          <span>Selections</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 bg-[#C2501F] rounded-[1px]" />
          <span>Offers</span>
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// 3. Placement Trend Across Batches (Line Chart)
// -------------------------------------------------------------
export interface BatchTrendStat {
  batch: string;
  placementPercentage: number;
  totalStudents: number;
}

export const BatchTrendLineChart: React.FC<{
  data: BatchTrendStat[];
}> = ({ data }) => {
  if (data.length <= 1) {
    return (
      <div className="py-8 text-center text-xs text-[#6B6F6A] bg-[#FAF8F3] rounded border border-[#E4DFD3] p-4">
        <p className="font-medium text-[#1C1F1D]">Only Batch {data[0]?.batch || 'current'} is recorded.</p>
        <p className="mt-1">Trends appear once more than one batch has data.</p>
      </div>
    );
  }

  // Draw clean SVG Line Chart
  const svgWidth = 360;
  const svgHeight = 120;
  const paddingX = 40;
  const paddingY = 24;

  const maxPct = 100;
  const points = data.map((d, i) => {
    const x = paddingX + (i / (data.length - 1)) * (svgWidth - paddingX * 2);
    const y = svgHeight - paddingY - (d.placementPercentage / maxPct) * (svgHeight - paddingY * 2);
    return { x, y, ...d };
  });

  const pathD = points.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, '');

  return (
    <div className="space-y-2">
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full h-32 overflow-visible select-none"
      >
        {/* Horizontal gridlines at 25%, 50%, 75%, 100% */}
        {[0, 25, 50, 75, 100].map((pct) => {
          const y = svgHeight - paddingY - (pct / 100) * (svgHeight - paddingY * 2);
          return (
            <g key={pct}>
              <line
                x1={paddingX}
                y1={y}
                x2={svgWidth - paddingX}
                y2={y}
                stroke="#E4DFD3"
                strokeWidth="1"
                strokeDasharray="2,2"
              />
              <text
                x={paddingX - 6}
                y={y + 3}
                textAnchor="end"
                className="text-[9px] fill-[#6B6F6A] font-mono tabular-nums"
              >
                {pct}%
              </text>
            </g>
          );
        })}

        {/* Trend line */}
        <path d={pathD} fill="none" stroke={PALETTE.primary} strokeWidth="2.5" />

        {/* Data points with direct value labels */}
        {points.map((pt) => (
          <g key={pt.batch}>
            <circle cx={pt.x} cy={pt.y} r="4" fill="#FFFFFF" stroke={PALETTE.primary} strokeWidth="2" />
            <text
              x={pt.x}
              y={pt.y - 8}
              textAnchor="middle"
              className="text-[10px] font-bold fill-[#1C1F1D] tabular-nums"
            >
              {pt.placementPercentage}%
            </text>
            <text
              x={pt.x}
              y={svgHeight - 6}
              textAnchor="middle"
              className="text-[10px] fill-[#6B6F6A] font-medium"
            >
              Batch {pt.batch}
            </text>
          </g>
        ))}
      </svg>
      <p className="text-[11px] text-[#6B6F6A] text-right">
        Comparing graduating cohort placement completion rate
      </p>
    </div>
  );
};

// -------------------------------------------------------------
// 4. Application Stage Funnel (Horizontal Funnel)
// -------------------------------------------------------------
export interface FunnelStageStat {
  stage: string;
  count: number;
}

export const ApplicationFunnelChart: React.FC<{
  data: FunnelStageStat[];
}> = ({ data }) => {
  const maxVal = Math.max(1, ...data.map((d) => d.count));

  return (
    <div className="space-y-2.5">
      {data.map((item, idx) => {
        const pctOfMax = Math.round((item.count / maxVal) * 100);
        // Stage color shading (greens and teals)
        return (
          <div key={item.stage} className="space-y-0.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-[#1C1F1D]">{item.stage}</span>
              <span className="font-semibold text-[#1F4D3F] tabular-nums">
                {item.count} applications
              </span>
            </div>
            <div className="h-4 bg-[#F0EEE9] rounded-[2px] overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  idx === data.length - 1 ? 'bg-[#1E5631]' : 'bg-[#1F4D3F]'
                }`}
                style={{ width: `${Math.max(4, pctOfMax)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// -------------------------------------------------------------
// 5. Department-wise No-Dues Clearance (Stacked Bar)
// -------------------------------------------------------------
export interface DeptClearanceStat {
  department: string;
  shortName: string;
  total: number;
  cleared: number;
  pending: number;
  rejected: number;
}

export const DeptClearanceStackedChart: React.FC<{
  data: DeptClearanceStat[];
}> = ({ data }) => {
  return (
    <div className="space-y-3">
      {data.map((item) => {
        const t = Math.max(1, item.total);
        const clearedPct = (item.cleared / t) * 100;
        const pendingPct = (item.pending / t) * 100;
        const rejectedPct = (item.rejected / t) * 100;

        return (
          <div key={item.department} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-[#1C1F1D] truncate max-w-[200px]" title={item.department}>
                {item.shortName}
              </span>
              <span className="text-[11px] tabular-nums text-[#6B6F6A]">
                <span className="font-semibold text-[#1E5631]">{item.cleared} cleared</span> ·{' '}
                <span className="text-[#8C5E09]">{item.pending} pend</span>
                {item.rejected > 0 && (
                  <span className="text-[#9E2A2B] font-semibold"> · {item.rejected} rej</span>
                )}
              </span>
            </div>
            <div className="h-4 bg-[#F0EEE9] rounded-[2px] overflow-hidden flex">
              <div
                title={`${item.cleared} Cleared`}
                className="h-full bg-[#1E5631] transition-all duration-300"
                style={{ width: `${clearedPct}%` }}
              />
              <div
                title={`${item.pending} Pending`}
                className="h-full bg-[#D97706] transition-all duration-300"
                style={{ width: `${pendingPct}%` }}
              />
              <div
                title={`${item.rejected} Rejected`}
                className="h-full bg-[#9E2A2B] transition-all duration-300"
                style={{ width: `${rejectedPct}%` }}
              />
            </div>
          </div>
        );
      })}

      <div className="flex items-center gap-4 text-[11px] text-[#6B6F6A] pt-2 border-t border-[#F0EEE9]">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 bg-[#1E5631] rounded-[1px]" />
          <span>Cleared</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 bg-[#D97706] rounded-[1px]" />
          <span>Pending</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 bg-[#9E2A2B] rounded-[1px]" />
          <span>Rejected / Action Required</span>
        </div>
      </div>
    </div>
  );
};
