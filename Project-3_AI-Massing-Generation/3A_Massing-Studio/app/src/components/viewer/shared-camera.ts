// Mirrors one camera across several viewports (the 2x3 options grid).
// Stores registered camera-controls instances; sync(sourceId) copies the source's END values
// (so followers glide with their own smoothing) to every other registered controller.
import type { Spherical, Vector3 } from "three";

export interface SyncableControls {
  getSpherical(out: Spherical, receiveEndValue?: boolean): Spherical;
  getTarget(out: Vector3, receiveEndValue?: boolean): Vector3;
  rotateTo(azimuth: number, polar: number, enableTransition?: boolean): Promise<void>;
  dollyTo(distance: number, enableTransition?: boolean): Promise<void>;
  moveTo(x: number, y: number, z: number, enableTransition?: boolean): Promise<void>;
}

export interface SharedCamera {
  register(id: string, controls: SyncableControls): () => void;
  /** True while sync() is writing to followers; ignore control events then. */
  isSyncing(): boolean;
  sync(sourceId: string, enableTransition?: boolean): void;
}

export function createSharedCamera(
  makeSpherical: () => Spherical,
  makeVector: () => Vector3,
): SharedCamera {
  const members = new Map<string, SyncableControls>();
  let syncing = false;
  return {
    register(id, controls) {
      members.set(id, controls);
      return () => void members.delete(id);
    },
    isSyncing: () => syncing,
    sync(sourceId, enableTransition = true) {
      const src = members.get(sourceId);
      if (!src) return;
      const s = src.getSpherical(makeSpherical(), true);
      const t = src.getTarget(makeVector(), true);
      syncing = true;
      try {
        members.forEach((c, id) => {
          if (id === sourceId) return;
          void c.rotateTo(s.theta, s.phi, enableTransition);
          void c.dollyTo(s.radius, enableTransition);
          void c.moveTo(t.x, t.y, t.z, enableTransition);
        });
      } finally {
        syncing = false;
      }
    },
  };
}
