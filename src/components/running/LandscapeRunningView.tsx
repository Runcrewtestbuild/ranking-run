import React, { useRef, useMemo, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
} from 'react-native';
import { Ionicons } from '../../lib/icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../hooks/useTheme';
import RouteMapView from '../map/RouteMapView';
import type { RouteMapViewHandle, CheckpointMarkerData } from '../map/RouteMapView';
import type { ThemeColors } from '../../utils/constants';
import type { Split } from '../../types/api';
import { FONT_SIZES, SPACING, BORDER_RADIUS } from '../../utils/constants';
import { metersToKm, formatDuration, formatPace } from '../../utils/format';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface LandscapeRunningViewProps {
  // Metrics
  distanceMeters: number;
  durationSeconds: number;
  avgPaceSecondsPerKm: number;
  currentPaceSecondsPerKm: number;
  calories: number;
  heartRate: number;
  cadence: number;
  elevationGainMeters: number;
  splits: Split[];

  // GPS / Map
  routePoints: Array<{ latitude: number; longitude: number }>;
  myLocation: { latitude: number; longitude: number } | null;
  persistedLocation: { latitude: number; longitude: number } | null;
  headingValue: number | null;
  courseRoute: Array<{ latitude: number; longitude: number }> | null;
  checkpoints?: CheckpointMarkerData[];

  // State
  phase: string;
  isAutoPaused: boolean;
  courseId: string | null;

  // Controls
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

export default function LandscapeRunningView({
  distanceMeters,
  durationSeconds,
  avgPaceSecondsPerKm,
  currentPaceSecondsPerKm,
  calories,
  heartRate,
  cadence,
  elevationGainMeters,
  splits,
  routePoints,
  myLocation,
  persistedLocation,
  headingValue,
  courseRoute,
  checkpoints,
  phase,
  isAutoPaused,
  courseId,
  onPause,
  onResume,
  onStop,
}: LandscapeRunningViewProps) {
  const { t } = useTranslation();
  const colors = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView>(null);
  const mapRef = useRef<RouteMapViewHandle>(null);
  const [currentPage, setCurrentPage] = useState(1); // Start on main metrics (center)
  const [followUser, setFollowUser] = useState(true);

  const screenWidth = Dimensions.get('window').width;

  const onScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
    setCurrentPage(page);
  }, [screenWidth]);

  // Scroll to center page on mount
  const onContentSizeChange = useCallback(() => {
    scrollRef.current?.scrollTo({ x: screenWidth, animated: false });
  }, [screenWidth]);

  const mapCustomUserLocation = useMemo(() => {
    return myLocation ?? persistedLocation ?? undefined;
  }, [myLocation, persistedLocation]);

  return (
    <View style={styles.container}>
      {/* Page indicator dots */}
      <View style={styles.pageIndicator}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.dot, currentPage === i && styles.dotActive]} />
        ))}
      </View>

      {/* 3-tab horizontal pager */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        onContentSizeChange={onContentSizeChange}
        scrollEventThrottle={16}
        style={styles.pager}
      >
        {/* Tab 1: Detailed Stats */}
        <View style={[styles.page, { width: screenWidth }]}>
          <View style={styles.statsContainer}>
            <Text style={styles.statsTitle}>{t('running.landscape.stats')}</Text>

            <View style={styles.statsGrid}>
              <View style={styles.statsRow}>
                <View style={styles.statsCell}>
                  <Text style={styles.statsLabel}>{t('running.metrics.time')}</Text>
                  <Text style={[styles.statsValue, (phase === 'paused' || isAutoPaused) && { color: '#FFD60A' }]}>
                    {formatDuration(durationSeconds)}
                  </Text>
                </View>
                <View style={styles.statsDivider} />
                <View style={styles.statsCell}>
                  <Text style={styles.statsLabel}>{t('running.metrics.avgPace')}</Text>
                  <Text style={styles.statsValue}>{formatPace(avgPaceSecondsPerKm)}</Text>
                </View>
                <View style={styles.statsDivider} />
                <View style={styles.statsCell}>
                  <Text style={styles.statsLabel}>{t('running.metrics.calories')}</Text>
                  <Text style={styles.statsValue}>{calories}</Text>
                </View>
              </View>

              <View style={styles.statsRowDivider} />

              <View style={styles.statsRow}>
                <View style={styles.statsCell}>
                  <Text style={styles.statsLabel}>{t('running.metrics.heartRate')}</Text>
                  <Text style={[styles.statsValue, heartRate > 0 && { color: colors.error }]}>
                    {heartRate > 0 ? Math.round(heartRate) : '--'}
                  </Text>
                </View>
                <View style={styles.statsDivider} />
                <View style={styles.statsCell}>
                  <Text style={styles.statsLabel}>{t('running.metrics.cadence')}</Text>
                  <Text style={styles.statsValue}>{cadence > 0 ? cadence : '--'}</Text>
                </View>
                <View style={styles.statsDivider} />
                <View style={styles.statsCell}>
                  <Text style={styles.statsLabel}>{t('running.metrics.elevation')}</Text>
                  <Text style={styles.statsValue}>
                    {elevationGainMeters > 0 ? `+${Math.round(elevationGainMeters)}` : '--'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Recent splits */}
            {splits.length > 0 && (
              <View style={styles.splitsSection}>
                <Text style={styles.splitsTitle}>SPLITS</Text>
                {splits.slice(-5).map((s, i) => (
                  <View key={i} style={styles.splitRow}>
                    <Text style={styles.splitKm}>{s.split_number}km</Text>
                    <Text style={styles.splitPace}>{formatPace(s.pace_seconds_per_km)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Tab 2: Main Metrics (Hero) */}
        <View style={[styles.page, { width: screenWidth }]}>
          <View style={styles.heroContainer}>
            {/* Paused indicator */}
            {(phase === 'paused' || isAutoPaused) && (
              <View style={styles.pausedChip}>
                <Ionicons name="pause" size={14} color="#000" />
                <Text style={styles.pausedChipText}>
                  {isAutoPaused && phase !== 'paused' ? 'AUTO PAUSED' : 'PAUSED'}
                </Text>
              </View>
            )}

            {/* Distance — the hero */}
            <View style={styles.heroDistanceRow}>
              <Text style={styles.heroDistance}>{metersToKm(distanceMeters)}</Text>
              <Text style={styles.heroUnit}>km</Text>
            </View>

            {/* Time + Pace side by side */}
            <View style={styles.heroSecondaryRow}>
              <View style={styles.heroSecondaryCell}>
                <Text style={styles.heroSecondaryLabel}>{t('running.metrics.time')}</Text>
                <Text style={[styles.heroSecondaryValue, (phase === 'paused' || isAutoPaused) && { color: '#FFD60A' }]}>
                  {formatDuration(durationSeconds)}
                </Text>
              </View>
              <View style={styles.heroSecondaryDivider} />
              <View style={styles.heroSecondaryCell}>
                <Text style={styles.heroSecondaryLabel}>{t('running.metrics.avgPace')}</Text>
                <Text style={styles.heroSecondaryValue}>
                  {formatPace(avgPaceSecondsPerKm)}
                </Text>
              </View>
            </View>

            {/* Controls */}
            <View style={styles.controls}>
              {phase === 'paused' ? (
                <>
                  <TouchableOpacity style={styles.resumeBtn} onPress={onResume} activeOpacity={0.7}>
                    <Ionicons name="play" size={32} color={colors.white} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.stopBtn} onPress={onStop} activeOpacity={0.7}>
                    <Ionicons name="stop" size={28} color={colors.white} />
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity style={styles.pauseBtn} onPress={onPause} activeOpacity={0.7}>
                    <Ionicons name="pause" size={32} color={colors.text} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.stopBtn} onPress={onStop} activeOpacity={0.7}>
                    <Ionicons name="stop" size={28} color={colors.white} />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>

        {/* Tab 3: Full-screen Map with HUD overlay */}
        <View style={[styles.page, { width: screenWidth }]}>
          <View style={styles.mapContainer}>
            <RouteMapView
              ref={mapRef}
              routePoints={routePoints}
              hideRouteMarkers
              previewPolyline={courseRoute ?? undefined}
              checkpoints={checkpoints}
              showUserLocation
              followsUserLocation={followUser}
              followZoomLevel={16}
              followUserMode="course"
              followPitch={30}
              interactive
              onUserMapInteraction={() => setFollowUser(false)}
              lastKnownLocation={persistedLocation ?? undefined}
              customUserLocation={mapCustomUserLocation}
              customUserHeading={headingValue ?? undefined}
              style={styles.fullMap}
            />

            {/* HUD overlay on map */}
            <View style={styles.mapHud}>
              <View style={styles.mapHudRow}>
                <View style={styles.mapHudCell}>
                  <Text style={styles.mapHudValue}>{metersToKm(distanceMeters)}</Text>
                  <Text style={styles.mapHudLabel}>km</Text>
                </View>
                <View style={styles.mapHudCell}>
                  <Text style={styles.mapHudValue}>{formatDuration(durationSeconds)}</Text>
                  <Text style={styles.mapHudLabel}>{t('running.metrics.time')}</Text>
                </View>
                <View style={styles.mapHudCell}>
                  <Text style={styles.mapHudValue}>{formatPace(avgPaceSecondsPerKm)}</Text>
                  <Text style={styles.mapHudLabel}>{t('running.metrics.avgPace')}</Text>
                </View>
              </View>
            </View>

            {/* Recenter button */}
            {!followUser && (
              <TouchableOpacity
                style={styles.recenterBtn}
                onPress={() => {
                  const loc = myLocation ?? persistedLocation;
                  if (loc) mapRef.current?.recenterOnUser(loc);
                  setFollowUser(true);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="locate" size={20} color={colors.text} />
              </TouchableOpacity>
            )}

            {/* Paused banner on map */}
            {(phase === 'paused' || isAutoPaused) && (
              <View style={styles.mapPausedBanner}>
                <Ionicons name="pause" size={14} color="#000" />
                <Text style={styles.mapPausedText}>
                  {isAutoPaused && phase !== 'paused' ? 'AUTO PAUSED' : 'PAUSED'}
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (c: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  pageIndicator: {
    position: 'absolute',
    top: SPACING.sm,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
    zIndex: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: c.textTertiary,
    opacity: 0.4,
  },
  dotActive: {
    backgroundColor: c.primary,
    opacity: 1,
    width: 18,
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
  },

  // ========================
  // TAB 1: STATS
  // ========================
  statsContainer: {
    flex: 1,
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.xxl,
    justifyContent: 'center',
  },
  statsTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '800',
    color: c.textTertiary,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: SPACING.lg,
    textAlign: 'center',
  },
  statsGrid: {
    backgroundColor: c.surface,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
  },
  statsRowDivider: {
    height: 1,
    backgroundColor: c.divider,
    marginHorizontal: SPACING.lg,
  },
  statsCell: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statsLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '500',
    color: c.textSecondary,
  },
  statsValue: {
    fontSize: 26,
    fontWeight: '800',
    color: c.text,
    fontVariant: ['tabular-nums'],
  },
  statsDivider: {
    width: 1,
    height: 36,
    backgroundColor: c.divider,
  },
  splitsSection: {
    marginTop: SPACING.lg,
    backgroundColor: c.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
  },
  splitsTitle: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '800',
    color: c.textTertiary,
    letterSpacing: 2,
    marginBottom: SPACING.sm,
  },
  splitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  splitKm: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: c.textSecondary,
  },
  splitPace: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: c.text,
    fontVariant: ['tabular-nums'],
  },

  // ========================
  // TAB 2: HERO METRICS
  // ========================
  heroContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
    gap: SPACING.lg,
  },
  pausedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFD60A',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pausedChipText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1,
  },
  heroDistanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  heroDistance: {
    fontSize: 96,
    fontWeight: '900',
    color: c.text,
    fontVariant: ['tabular-nums'],
    lineHeight: 100,
  },
  heroUnit: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    color: c.textSecondary,
  },
  heroSecondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xxl,
  },
  heroSecondaryCell: {
    alignItems: 'center',
    gap: 4,
  },
  heroSecondaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: c.divider,
  },
  heroSecondaryLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: c.textSecondary,
  },
  heroSecondaryValue: {
    fontSize: 32,
    fontWeight: '800',
    color: c.text,
    fontVariant: ['tabular-nums'],
  },
  controls: {
    flexDirection: 'row',
    gap: SPACING.xxl,
    marginTop: SPACING.md,
  },
  pauseBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: c.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resumeBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: c.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: c.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  stopBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: c.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: c.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },

  // ========================
  // TAB 3: MAP + HUD
  // ========================
  mapContainer: {
    flex: 1,
  },
  fullMap: {
    flex: 1,
  },
  mapHud: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  mapHudRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  mapHudCell: {
    alignItems: 'center',
    gap: 2,
  },
  mapHudValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
    fontVariant: ['tabular-nums'],
  },
  mapHudLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  recenterBtn: {
    position: 'absolute',
    bottom: SPACING.lg,
    right: SPACING.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.card,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  mapPausedBanner: {
    position: 'absolute',
    bottom: SPACING.lg,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFD60A',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  mapPausedText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000',
    letterSpacing: 1,
  },
});
