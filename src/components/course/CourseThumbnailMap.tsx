import React, { useMemo, useState } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Ionicons } from '../../lib/icons';
import { useTheme } from '../../hooks/useTheme';
import { MAPBOX_ACCESS_TOKEN } from '../../config/env';

interface CourseThumbnailMapProps {
  routePreview?: number[][] | null;
  width: number;
  height: number;
  borderRadius?: number;
  thumbnailUrl?: string | null;
}

function downsample(pts: number[][], maxPts: number): number[][] {
  if (pts.length <= maxPts) return pts;
  const step = (pts.length - 1) / (maxPts - 1);
  const result: number[][] = [];
  for (let i = 0; i < maxPts - 1; i++) {
    result.push(pts[Math.round(i * step)]);
  }
  result.push(pts[pts.length - 1]);
  return result;
}

function buildStaticMapUrl(
  pts: number[][],
  styleId: string,
  pixelW: number,
  pixelH: number,
  decimals: number,
): string {
  const geojson = encodeURIComponent(JSON.stringify({
    type: 'Feature',
    properties: {
      stroke: '#FFD600',
      'stroke-width': 5,
      'stroke-opacity': 1,
    },
    geometry: {
      type: 'LineString',
      coordinates: pts.map(([lng, lat]) => [
        parseFloat(lng.toFixed(decimals)),
        parseFloat(lat.toFixed(decimals)),
      ]),
    },
  }));
  return `https://api.mapbox.com/styles/v1/${styleId}/static/geojson(${geojson})/auto/${pixelW}x${pixelH}@2x?padding=60&logo=false&attribution=false&access_token=${MAPBOX_ACCESS_TOKEN}`;
}

/**
 * Route thumbnail display.
 * - Dark mode + RSG snapshot exists → RSG 3D snapshot
 * - Dark mode + no snapshot → Mapbox Static API dark-v11
 * - Light mode → Mapbox Static API light-v11
 * - No route data → placeholder icon
 */
export default React.memo(function CourseThumbnailMap({
  routePreview,
  width,
  height,
  borderRadius = 8,
  thumbnailUrl,
}: CourseThumbnailMapProps) {
  const colors = useTheme();
  const isDark = colors.statusBar === 'light-content';
  const bgColor = isDark ? '#1C1C1E' : '#F2F2F7';

  const imageUri = useMemo(() => {
    const hasSnapshot = thumbnailUrl && thumbnailUrl.includes('/snapshots/');

    // Dark mode: prefer RSG 3D snapshot
    if (isDark && hasSnapshot) return thumbnailUrl;

    // Static API fallback (theme-aware)
    if (!routePreview || routePreview.length < 2 || !MAPBOX_ACCESS_TOKEN) {
      // No route data — use snapshot if available regardless of theme
      if (hasSnapshot) return thumbnailUrl;
      return null;
    }

    const styleId = isDark ? 'mapbox/dark-v11' : 'mapbox/light-v11';
    const pixelW = Math.min(Math.round(width * 2), 640);
    const pixelH = Math.min(Math.round(height * 2), 640);

    let pts = downsample(routePreview, 100);
    let url = buildStaticMapUrl(pts, styleId, pixelW, pixelH, 5);

    if (url.length > 8000) {
      pts = downsample(routePreview, 60);
      url = buildStaticMapUrl(pts, styleId, pixelW, pixelH, 5);
    }
    if (url.length > 8000) {
      pts = downsample(routePreview, 30);
      url = buildStaticMapUrl(pts, styleId, pixelW, pixelH, 4);
    }

    return url;
  }, [routePreview, width, height, isDark, thumbnailUrl]);

  const [failed, setFailed] = useState(false);

  if (!imageUri || failed) {
    return (
      <View style={[styles.container, styles.placeholder, { width, height, borderRadius, backgroundColor: bgColor }]}>
        <Ionicons name="map-outline" size={Math.min(width, height) * 0.25} color={colors.textTertiary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { width, height, borderRadius, backgroundColor: bgColor }]}>
      <Image
        source={{ uri: imageUri }}
        style={{ width, height }}
        resizeMode="cover"
        onError={() => setFailed(true)}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
