// Millimetres. Post envelopes (including the H-post's 65 mm depth), extrusion
// walls and hole offsets remain visual estimates, not dimensioned manual data.
// Mating faces share these values to avoid floating joints.
export const mountingProfile = {
  trackWeb: 1.5,
  pinDepth: 11.6,
  xPostDepth: 45,
  hPostDepth: 65,
}

export function mountingDepths(hPost: boolean, wall = false) {
  const depth = hPost ? mountingProfile.hPostDepth : mountingProfile.xPostDepth
  const frontTrack = wall ? 0 : -mountingProfile.trackWeb
  const backTrack = -depth - mountingProfile.trackWeb
  return {
    postCentre: -depth / 2 - mountingProfile.trackWeb,
    frontTrack,
    backTrack,
    frontPin: frontTrack + mountingProfile.pinDepth,
    backPin: backTrack - mountingProfile.pinDepth,
  }
}
