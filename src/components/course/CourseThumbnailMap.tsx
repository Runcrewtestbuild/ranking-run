import React, { useMemo, useState } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Ionicons } from '../../lib/icons';
import { useTheme } from '../../hooks/useTheme';

interface CourseThumbnailMapProps {
  width: number;
  height: number;
  borderRadius?: number;
  thumbnailUrl?: string | null;
  thumbnailUrlLight?: string | null;
  routePreview?: number[][] | null;
}

export default React.memo(function CourseThumbnailMap({
  width,
  height,
  borderRadius = 8,
  thumbnailUrl,
  thumbnailUrlLight,
}: CourseThumbnailMapProps) {
  const colors = useTheme();
  const isDark = colors.statusBar === 'light-content';
  const bgColor = isDark ? '#1C1C1E' : '#F2F2F7';

  const imageUri = useMemo(() => {
    if (isDark) return thumbnailUrl || thumbnailUrlLight || null;
    return thumbnailUrlLight || thumbnailUrl || null;
  }, [isDark, thumbnailUrl, thumbnailUrlLight]);

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
