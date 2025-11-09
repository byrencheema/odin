/**
 * LiveATC audio feeds for Bay Area ATC facilities
 * Maps facility IDs to their available audio streams
 */

export const LIVE_ATC_FEEDS = {
  KSFO: [
    {
      name: "KSFO Tower",
      streamId: "ksfo_twr",
      frequency: "120.5",
      type: "Tower"
    },
    {
      name: "KSFO Ground",
      streamId: "ksfo_gnd",
      frequency: "121.8",
      type: "Ground"
    },
    {
      name: "KSFO Ground/Tower",
      streamId: "ksfo_gnd_twr",
      frequency: "120.5 / 121.8",
      type: "Combined"
    },
    {
      name: "KSFO Ramp",
      streamId: "ksfo_ramp",
      frequency: "121.9",
      type: "Ramp"
    },
    {
      name: "KSFO Company Channels",
      streamId: "ksfo_co",
      frequency: "Company",
      type: "Company"
    }
  ],
  KOAK: [
    {
      name: "KOAK Tower",
      streamId: "koak_twr",
      frequency: "118.3",
      type: "Tower"
    },
    {
      name: "KOAK Ground",
      streamId: "koak_gnd",
      frequency: "121.7",
      type: "Ground"
    }
  ],
  KSJC: [
    {
      name: "KSJC Tower",
      streamId: "ksjc_twr",
      frequency: "120.9",
      type: "Tower"
    },
    {
      name: "KSJC Ground",
      streamId: "ksjc_gnd",
      frequency: "121.9",
      type: "Ground"
    }
  ],
  ZOA: [
    {
      name: "ZOA Oakland Center (35)",
      streamId: "zoa_35",
      frequency: "133.5",
      type: "Center"
    }
  ]
};

/**
 * Generate LiveATC stream URL with cache-busting timestamp
 */
export const getLiveATCUrl = (streamId) => {
  const timestamp = Date.now();
  return `https://s1-bos.liveatc.net/${streamId}?nocache=${timestamp}`;
};
