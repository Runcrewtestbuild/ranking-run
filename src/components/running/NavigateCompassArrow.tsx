import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '../../lib/icons';
import { useRunningStore } from '../../stores/runningStore';
import { bearing as geoBearing } from '../../utils/geo';

interface NavigateCompassArrowProps {
  targetLat: number;
  targetLng: number;
  heading: number;
  color: string;
}

/**
 * Compass arrow that points toward a target location. Subscribes to
 * currentLocation independently so the parent doesn't re-render on
 * every GPS tick.
 */
export default React.memo(function NavigateCompassArrow({
  targetLat,
  targetLng,
  heading,
  color,
}: NavigateCompassArrowProps) {
  const currentLocation = useRunningStore((s) => s.currentLocation);

  if (!currentLocation) return null;

  const bearingToTarget = geoBearing(
    { latitude: currentLocation.latitude, longitude: currentLocation.longitude },
    { latitude: targetLat, longitude: targetLng },
  );
  const rotation = ((bearingToTarget - heading) + 360) % 360;

  return (
    <View style={{ transform: [{ rotate: `${rotation}deg` }] }}>
      <Ionicons name="navigate" size={28} color={color} />
    </View>
  );
});
