import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { MAPBOX_DARK_STYLE } from '../../config/env';
import { userService } from '../../services/userService';
import { runService } from '../../services/runService';
import { courseService } from '../../services/courseService';
import api from '../../services/api';
import type { RunHistoryItem } from '../../types/api';

// ============================================================
// RouteSnapshotGenerator
//
// Background component that generates route thumbnail snapshots
// for runs that don't have one yet. Renders an offscreen MapView,
// draws each route, captures a snapshot, uploads it, and updates
// the run record.
//
// - Processes max MAX_RUNS_PER_SESSION runs per app launch
// - 1-second delay between snapshots to avoid battery drain
// - Failures are logged but never crash the app
// ============================================================

const MAX_RUNS_PER_SESSION = 700;
const SNAPSHOT_SIZE = 400;
const DELAY_BETWEEN_SNAPSHOTS_MS = 3000;
const INITIAL_DELAY_MS = 30000; // Wait 30s after app start
const ROUTE_LINE_COLOR = '#FFD600';
const ROUTE_LINE_WIDTH = 6;
const FIT_BOUNDS_PADDING = [80, 80, 80, 80] as const;

interface RunToProcess {
  id: string;
  routePreview: number[][];
  type: 'run' | 'course';
}

/** Compute NE/SW bounds from [[lng, lat], ...] coordinate pairs. */
function computeBounds(coords: number[][]): { ne: [number, number]; sw: [number, number] } {
  let minLng = coords[0][0];
  let maxLng = coords[0][0];
  let minLat = coords[0][1];
  let maxLat = coords[0][1];

  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  return {
    ne: [maxLng, maxLat],
    sw: [minLng, minLat],
  };
}

/** Build GeoJSON LineString from [[lng, lat], ...] coordinates. */
function toLineGeoJSON(coords: number[][]): GeoJSON.Feature<GeoJSON.LineString> {
  return {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: coords,
    },
    properties: {},
  };
}

interface RouteSnapshotGeneratorProps {
  /** When true, regenerate thumbnails for ALL items, even those that already have one. */
  forceRegenerate?: boolean;
}

export default function RouteSnapshotGenerator({ forceRegenerate = false }: RouteSnapshotGeneratorProps = {}) {
  const mapViewRef = useRef<Mapbox.MapView>(null);
  const cameraRef = useRef<Mapbox.Camera>(null);
  const [queue, setQueue] = useState<RunToProcess[]>([]);
  const [currentRun, setCurrentRun] = useState<RunToProcess | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const processingRef = useRef(false);
  const mountedRef = useRef(true);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tilesLoadedResolveRef = useRef<(() => void) | null>(null);

  // Fetch runs without thumbnails on mount
  useEffect(() => {
    mountedRef.current = true;

    async function fetchItemsWithoutThumbnails() {
      try {
        const itemsToProcess: RunToProcess[] = [];

        // Fetch courses first — use full route_geometry (not simplified route_preview)
        try {
          const coursesResp = await courseService.getCourses({ per_page: 50 });
          for (const course of coursesResp.data) {
            if (itemsToProcess.length >= MAX_RUNS_PER_SESSION) break;
            const needsUpgrade = !course.thumbnail_url || (course.thumbnail_url && course.thumbnail_url.includes('/thumbnails/'));
            if ((forceRegenerate || needsUpgrade) && course.route_preview && course.route_preview.length >= 2) {
              // Fetch full route_geometry from detail API
              try {
                const detail = await courseService.getCourseDetail(course.id);
                const coords = detail.route_geometry?.coordinates;
                if (coords && coords.length >= 2) {
                  const preview = coords.map((c: number[]) => [c[0], c[1]]);
                  itemsToProcess.push({ id: course.id, routePreview: preview, type: 'course' });
                }
              } catch {}
            }
          }
        } catch {}

        // Then fetch runs without thumbnails (paginate to get all)
        try {
          let page = 0;
          while (itemsToProcess.length < MAX_RUNS_PER_SESSION) {
            const history = await userService.getRunHistory(page, 50);
            if (!history.data || history.data.length === 0) break;
            for (const run of history.data) {
              if (itemsToProcess.length >= MAX_RUNS_PER_SESSION) break;
              const needsUpgrade = !run.route_thumbnail_url || (run.route_thumbnail_url && run.route_thumbnail_url.includes('/thumbnails/'));
              if ((forceRegenerate || needsUpgrade) && run.route_preview && run.route_preview.length >= 2) {
                // Fetch full route_geometry for accurate thumbnail (matches detail view)
                try {
                  const detail = await userService.getRunDetail(run.id);
                  const coords = detail.route_geometry?.coordinates;
                  if (coords && coords.length >= 2) {
                    const preview = coords.map((c: number[]) => [c[0], c[1]]);
                    itemsToProcess.push({ id: run.id, routePreview: preview, type: 'run' });
                  }
                } catch {
                  // Fallback to route_preview if detail fails
                  itemsToProcess.push({ id: run.id, routePreview: run.route_preview!, type: 'run' });
                }
              }
            }
            if (history.data.length < 50) break; // last page
            page++;
          }
        } catch {}

        if (__DEV__) {
          console.log(`[RouteSnapshotGenerator] Found ${itemsToProcess.length} items without thumbnails`);
        }

        if (mountedRef.current && itemsToProcess.length > 0) {
          setQueue(itemsToProcess);
          setCurrentRun(itemsToProcess[0]);
        }
      } catch (error) {
        if (__DEV__) {
          console.log('[RouteSnapshotGenerator] Failed to fetch items:', error);
        }
      }
    }

    // Delay start to avoid impacting app launch performance
    const startTimer = setTimeout(fetchItemsWithoutThumbnails, INITIAL_DELAY_MS);

    return () => {
      clearTimeout(startTimer);
      if (delayTimerRef.current) {
        clearTimeout(delayTimerRef.current);
        delayTimerRef.current = null;
      }
      mountedRef.current = false;
    };
  }, []);

  // GeoJSON for the current route being rendered
  const routeGeoJSON = useMemo(() => {
    if (!currentRun) return null;
    return toLineGeoJSON(currentRun.routePreview);
  }, [currentRun]);

  // When map finishes loading and we have a route, fit bounds and process
  const handleDidFinishLoadingMap = useCallback(() => {
    setMapReady(true);
  }, []);

  // Called when all tiles and layers are fully rendered
  const handleDidFinishRenderingMapFully = useCallback(() => {
    if (tilesLoadedResolveRef.current) {
      tilesLoadedResolveRef.current();
      tilesLoadedResolveRef.current = null;
    }
  }, []);

  /** Returns a promise that resolves when tiles finish rendering, with a max timeout fallback. */
  const waitForTilesLoaded = useCallback((): Promise<void> => {
    const MAX_TILE_TIMEOUT_MS = 10_000;
    return new Promise<void>((resolve) => {
      tilesLoadedResolveRef.current = resolve;
      setTimeout(() => {
        if (tilesLoadedResolveRef.current) {
          tilesLoadedResolveRef.current = null;
          if (__DEV__) console.log('[RouteSnapshotGenerator] Tile load timed out, proceeding with capture');
          resolve();
        }
      }, MAX_TILE_TIMEOUT_MS);
    });
  }, []);

  // Process the queue sequentially
  useEffect(() => {
    if (!mapReady || !currentRun || processingRef.current) return;

    async function processCurrentRun() {
      if (!currentRun || !mountedRef.current) return;
      processingRef.current = true;

      try {
        // Fit camera to route bounds
        const { ne, sw } = computeBounds(currentRun.routePreview);
        cameraRef.current?.fitBounds(
          ne,
          sw,
          [...FIT_BOUNDS_PADDING],
          0,
        );

        // Wait for tiles + route line to fully render via map callback
        await waitForTilesLoaded();
        if (!mountedRef.current) return;

        // Capture snapshot
        if (!mapViewRef.current) {
          throw new Error('MapView ref not available');
        }
        const uri = await (mapViewRef.current as any).takeSnap(true);
        if (!mountedRef.current) return;

        if (__DEV__) {
          console.log(`[RouteSnapshotGenerator] Captured snapshot for run ${currentRun.id}`);
        }

        // Upload snapshot
        const url = await runService.uploadRouteSnapshot(uri);
        if (!mountedRef.current) return;

        // Update record with thumbnail URL
        if (currentRun.type === 'course') {
          await api.patch(`/courses/${currentRun.id}/thumbnail`, { thumbnail_url: url });
        } else {
          await runService.updateRouteThumbnail(currentRun.id, url);
        }

        if (__DEV__) {
          console.log(`[RouteSnapshotGenerator] Updated thumbnail for run ${currentRun.id}`);
        }
      } catch (error) {
        if (__DEV__) {
          console.log(`[RouteSnapshotGenerator] Failed to process run ${currentRun.id}:`, error);
        }
      }

      // Move to next run or finish
      processingRef.current = false;

      if (!mountedRef.current) return;

      setQueue(prev => {
        const remaining = prev.slice(1);
        if (remaining.length === 0) {
          setCurrentRun(null);
          if (__DEV__) {
            console.log('[RouteSnapshotGenerator] All runs processed, unmounting');
          }
          return [];
        }

        // Delay before processing next run to avoid battery drain
        delayTimerRef.current = setTimeout(() => {
          if (mountedRef.current) {
            setCurrentRun(remaining[0]);
          }
        }, DELAY_BETWEEN_SNAPSHOTS_MS);

        return remaining;
      });
    }

    processCurrentRun();
  }, [mapReady, currentRun]);

  // Nothing to process — render nothing
  if (queue.length === 0 && !currentRun) {
    return null;
  }

  return (
    <View style={styles.offscreen} pointerEvents="none">
      <Mapbox.MapView
        ref={mapViewRef}
        styleURL={MAPBOX_DARK_STYLE}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
        scaleBarEnabled={false}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        onDidFinishLoadingMap={handleDidFinishLoadingMap}
        onDidFinishRenderingMapFully={handleDidFinishRenderingMapFully}
        style={styles.map}
      >
        <Mapbox.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [126.978, 37.5665],
            zoomLevel: 13,
          }}
          animationDuration={0}
        />

        {routeGeoJSON && (
          <Mapbox.ShapeSource id="snapshot-route-source" shape={routeGeoJSON}>
            <Mapbox.LineLayer
              id="snapshot-route-line"
              style={{
                lineColor: ROUTE_LINE_COLOR,
                lineWidth: ROUTE_LINE_WIDTH,
                lineCap: 'round',
                lineJoin: 'round',
                lineEmissiveStrength: 1,
              }}
            />
          </Mapbox.ShapeSource>
        )}
      </Mapbox.MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  offscreen: {
    position: 'absolute',
    top: -9999,
    left: -9999,
    width: SNAPSHOT_SIZE,
    height: SNAPSHOT_SIZE,
  },
  map: {
    width: SNAPSHOT_SIZE,
    height: SNAPSHOT_SIZE,
  },
});
