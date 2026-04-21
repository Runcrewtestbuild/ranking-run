import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { FONT_SIZES } from '../../utils/constants';

interface DataPoint {
  value: number;
  label?: string; // x-axis label (e.g. "1km", "2km")
}

interface Props {
  data: DataPoint[];
  height?: number;
  lineColor?: string;
  unit?: string; // e.g. "SPM", "BPM"
  title?: string;
  formatValue?: (v: number) => string;
}

const CHART_LEFT_PAD = 36;
const SCREEN_W = Dimensions.get('window').width;
const CHART_W = SCREEN_W - 20 * 2 - 16 * 2 - CHART_LEFT_PAD;

export default function TimeSeriesLineChart({
  data,
  height = 120,
  lineColor,
  unit = '',
  title,
  formatValue,
}: Props) {
  const colors = useTheme();
  const color = lineColor ?? colors.primary;
  const chartH = height - 24;

  const format = formatValue ?? ((v: number) => String(Math.round(v)));

  const { points, segments, yLabels, avgValue } = useMemo(() => {
    const values = data.map((d) => d.value).filter((v) => v > 0);
    if (values.length < 2) return { points: [], segments: [], yLabels: [], avgValue: 0 };

    const mn = Math.min(...values);
    const mx = Math.max(...values);
    const range = mx - mn || 10;
    const padMin = Math.max(0, mn - range * 0.1);
    const padMax = mx + range * 0.1;
    const yRange = padMax - padMin;
    const avg = values.reduce((a, b) => a + b, 0) / values.length;

    const pad = 4;
    const w = CHART_W - pad * 2;
    const h = chartH - pad * 2;

    const pts = data.map((d, i) => ({
      x: pad + (w * i) / (data.length - 1),
      y: d.value > 0 ? pad + ((padMax - d.value) / yRange) * h : chartH / 2,
      valid: d.value > 0,
    }));

    const segs: { x: number; y: number; length: number; angle: number }[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      if (!pts[i].valid || !pts[i + 1].valid) continue;
      const dx = pts[i + 1].x - pts[i].x;
      const dy = pts[i + 1].y - pts[i].y;
      const length = Math.sqrt(dx * dx + dy * dy);
      if (length < 0.5) continue;
      segs.push({
        x: pts[i].x,
        y: pts[i].y,
        length,
        angle: Math.atan2(dy, dx) * (180 / Math.PI),
      });
    }

    return {
      points: pts,
      segments: segs,
      yLabels: [format(mx), format(Math.round(avg)), format(mn)],
      avgValue: avg,
    };
  }, [data, chartH, format]);

  if (data.filter((d) => d.value > 0).length < 2) return null;

  return (
    <View style={{ height }}>
      {title && (
        <View style={s.titleRow}>
          <Text style={[s.title, { color: colors.text }]}>{title}</Text>
          <Text style={[s.avgBadge, { color, backgroundColor: color + '18' }]}>
            {format(avgValue)} {unit}
          </Text>
        </View>
      )}

      <View style={s.chartRow}>
        <View style={s.yLabels}>
          {yLabels.map((label, i) => (
            <Text key={i} style={[s.yLabel, { color: colors.textTertiary }]}>
              {label}
            </Text>
          ))}
        </View>

        <View style={[s.chartArea, { height: chartH }]}>
          {[0, 0.5, 1].map((frac, i) => (
            <View
              key={i}
              style={[s.gridLine, { top: `${frac * 100}%`, backgroundColor: colors.divider }]}
            />
          ))}

          {segments.map((seg, i) => (
            <View
              key={`s${i}`}
              style={{
                position: 'absolute',
                left: seg.x,
                top: seg.y - 1,
                width: seg.length,
                height: 2,
                backgroundColor: color,
                borderRadius: 1,
                transform: [{ rotate: `${seg.angle}deg` }],
                transformOrigin: 'left center',
              }}
            />
          ))}

          {points
            .filter((_, i) => i % Math.max(1, Math.floor(data.length / 12)) === 0 || i === data.length - 1)
            .filter((pt) => pt.valid)
            .map((pt, i) => (
              <View
                key={`p${i}`}
                style={[
                  s.dot,
                  {
                    left: pt.x - 2.5,
                    top: pt.y - 2.5,
                    backgroundColor: color,
                  },
                ]}
              />
            ))}
        </View>
      </View>

      {/* X-axis labels */}
      {data[0]?.label && (
        <View style={[s.xLabels, { marginLeft: CHART_LEFT_PAD }]}>
          <Text style={[s.xLabel, { color: colors.textTertiary }]}>{data[0].label}</Text>
          {data.length > 2 && (
            <Text style={[s.xLabel, { color: colors.textTertiary }]}>
              {data[Math.floor(data.length / 2)]?.label}
            </Text>
          )}
          <Text style={[s.xLabel, { color: colors.textTertiary }]}>
            {data[data.length - 1].label}
          </Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },
  avgBadge: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  chartRow: {
    flexDirection: 'row',
    flex: 1,
  },
  yLabels: {
    width: CHART_LEFT_PAD - 4,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: 4,
  },
  yLabel: {
    fontSize: 9,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  chartArea: {
    flex: 1,
    overflow: 'hidden',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    opacity: 0.6,
  },
  dot: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  xLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  xLabel: {
    fontSize: 9,
    fontWeight: '500',
  },
});
