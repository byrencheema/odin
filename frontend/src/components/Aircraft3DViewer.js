import React, { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

/* global CESIUM_BASE_URL */

const DEFAULT_CESIUM_BASE_URL = '/cesium/';
const DEFAULT_CAMERA_DISTANCE_METERS = 6000;
const ION_TOKEN = process.env.REACT_APP_CESIUM_ION_TOKEN;

const resolveCesiumBaseUrl = () => {
  if (typeof window === 'undefined') {
    return DEFAULT_CESIUM_BASE_URL;
  }

  if (window.CESIUM_BASE_URL) {
    return window.CESIUM_BASE_URL;
  }

  let baseUrl = DEFAULT_CESIUM_BASE_URL;
  try {
    if (typeof CESIUM_BASE_URL !== 'undefined') {
      baseUrl = CESIUM_BASE_URL;
    }
  } catch (error) {
    // Ignore – CESIUM_BASE_URL is injected at build time, so this mainly satisfies tests.
  }

  if (!baseUrl.endsWith('/')) {
    baseUrl = `${baseUrl}/`;
  }

  window.CESIUM_BASE_URL = baseUrl;
  return baseUrl;
};

const computeCameraDestination = (aircraft, distanceMeters) => {
  const headingRad = Cesium.Math.toRadians(aircraft.true_track || 0);
  const behindAngle = headingRad + Math.PI;
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLon = 111320 * Math.cos(Cesium.Math.toRadians(aircraft.latitude || 0));

  const deltaLat = (distanceMeters * Math.cos(behindAngle)) / metersPerDegreeLat;
  const deltaLon = metersPerDegreeLon === 0
    ? 0
    : (distanceMeters * Math.sin(behindAngle)) / metersPerDegreeLon;

  return Cesium.Cartesian3.fromDegrees(
    (aircraft.longitude || 0) + deltaLon,
    (aircraft.latitude || 0) + deltaLat,
    (aircraft.baro_altitude || 1000) + 2000
  );
};

export default function Aircraft3DViewer({ aircraft }) {
  const viewerRef = useRef(null);
  const cesiumViewerRef = useRef(null);

  useEffect(() => {
    if (!viewerRef.current || !aircraft) return;
    if (typeof aircraft.longitude !== 'number' || typeof aircraft.latitude !== 'number') {
      console.warn('Unable to initialize Cesium viewer without aircraft position');
      return;
    }

    const baseUrl = resolveCesiumBaseUrl();
    if (Cesium.buildModuleUrl && typeof Cesium.buildModuleUrl.setBaseUrl === 'function') {
      Cesium.buildModuleUrl.setBaseUrl(baseUrl);
    }

    let viewer;
    let rafHandle;

    const bootViewer = () => {
      try {
        if (ION_TOKEN) {
          Cesium.Ion.defaultAccessToken = ION_TOKEN;
        } else {
          console.error('Cesium ion token missing. Set REACT_APP_CESIUM_ION_TOKEN in your environment.');
          return;
        }

        viewer = new Cesium.Viewer(viewerRef.current, {
          animation: false,
          baseLayerPicker: false,
          fullscreenButton: false,
          vrButton: false,
          geocoder: false,
          homeButton: false,
          infoBox: false,
          sceneModePicker: false,
          selectionIndicator: false,
          timeline: false,
          navigationHelpButton: false,
          navigationInstructionsInitiallyVisible: false,
          sceneMode: Cesium.SceneMode.SCENE3D,
          terrain: Cesium.Terrain.fromWorldTerrain(),
          skyBox: new Cesium.SkyBox({
            sources: {
              positiveX: Cesium.buildModuleUrl('Assets/Textures/SkyBox/tycho2t3_80_px.jpg'),
              negativeX: Cesium.buildModuleUrl('Assets/Textures/SkyBox/tycho2t3_80_mx.jpg'),
              positiveY: Cesium.buildModuleUrl('Assets/Textures/SkyBox/tycho2t3_80_py.jpg'),
              negativeY: Cesium.buildModuleUrl('Assets/Textures/SkyBox/tycho2t3_80_my.jpg'),
              positiveZ: Cesium.buildModuleUrl('Assets/Textures/SkyBox/tycho2t3_80_pz.jpg'),
              negativeZ: Cesium.buildModuleUrl('Assets/Textures/SkyBox/tycho2t3_80_mz.jpg')
            }
          }),
        });
      } catch (error) {
        console.error('Failed to create Cesium viewer', error);
        return;
      }

      if (!viewer || !viewer.scene) {
        console.error('Cesium viewer missing scene, aborting initialization');
        viewer?.destroy();
        return;
      }

      finishSetup(viewer);
    };

    const finishSetup = (viewerInstance) => {
      cesiumViewerRef.current = viewerInstance;

      // Fix blurry rendering on high-DPI displays
      if (typeof window !== 'undefined' && typeof window.devicePixelRatio === 'number') {
        viewerInstance.resolutionScale = window.devicePixelRatio;
      }

      // Remove default credits and set atmospheric styling when scene is ready
      if (viewerInstance.scene && viewerInstance.scene.globe) {
        viewerInstance.scene.globe.showGroundAtmosphere = true;
        viewerInstance.scene.globe.baseColor = Cesium.Color.BLACK;
      }
      if (viewerInstance.creditDisplay?.container) {
        viewerInstance.creditDisplay.container.style.display = 'none';
      }
      if (viewerInstance.scene) {
        viewerInstance.scene.backgroundColor = Cesium.Color.BLACK;
      }
      Cesium.createOsmBuildingsAsync().then((buildings) => {
        if (viewerInstance && !viewerInstance.isDestroyed()) {
          viewerInstance.scene.primitives.add(buildings);
        }
      }).catch((error) => {
        console.warn('Failed to load OSM buildings', error);
      });

      // Aircraft position - convert altitude from meters to meters (already in meters)
      const altitudeMeters = aircraft.baro_altitude || 1000;
      const position = Cesium.Cartesian3.fromDegrees(
        aircraft.longitude,
        aircraft.latitude,
        altitudeMeters
      );

      // Calculate orientation from heading
      const heading = Cesium.Math.toRadians(aircraft.true_track || 0);
      const pitch = 0;
      const roll = 0;
      const hpr = new Cesium.HeadingPitchRoll(heading, pitch, roll);
      const orientation = Cesium.Transforms.headingPitchRollQuaternion(position, hpr);

      // Add aircraft entity - using a simple box that always renders plus the model
      const entity = viewerInstance.entities.add({
        name: aircraft.callsign || aircraft.icao24,
        position: position,
        orientation: orientation,
        box: {
          dimensions: new Cesium.Cartesian3(40.0, 10.0, 10.0),
          material: Cesium.Color.CYAN.withAlpha(0.8),
        },
        model: {
          uri: '/boeing_737.glb',
          minimumPixelSize: 128,
          maximumScale: 20000,
          scale: 1.0,
        },
      });

      // Keep aircraft centered in both 2D and 3D views
      viewerInstance.trackedEntity = entity;

      // Position camera directly behind the aircraft so it stays centered in view
      setTimeout(() => {
        const destination = computeCameraDestination(aircraft, DEFAULT_CAMERA_DISTANCE_METERS);
        viewerInstance.camera.flyTo({
          destination,
          orientation: {
            heading: Cesium.Math.toRadians(aircraft.true_track || 0),
            pitch: Cesium.Math.toRadians(-12),
            roll: 0.0,
          },
          duration: 1.5,
        });
      }, 150);
    };

    if (typeof requestAnimationFrame === 'function') {
      rafHandle = requestAnimationFrame(bootViewer);
    } else {
      bootViewer();
    }

    const cleanup = () => {
      if (rafHandle) {
        cancelAnimationFrame(rafHandle);
      }
      if (cesiumViewerRef.current) {
        cesiumViewerRef.current.destroy();
        cesiumViewerRef.current = null;
      }
    };

    // Cleanup
    return () => {
      cleanup();
    };
  }, [aircraft]);

  return (
    <div
      ref={viewerRef}
      style={{
        width: '100%',
        height: '100%',
        minHeight: '400px'
      }}
    />
  );
}
