// Millimetres. The E-track section and pin line follow the 1:5 and 1:10
// drawings in Vitsœ's 606 planning guide (UK/EU), pp4, 9 and 10:
// https://www.vitsoe.com/site/download/3563/606_Universal_Shelving_System_planning_guide_UK_EU_RW.pdf
// Post envelopes (including the H-post's 65 mm depth) remain visual estimates.
// Mating faces share these values to avoid floating joints.
export const mountingProfile = {
  trackDepth: 20,
  trackWeb: 2,
  pinDepth: 10.5,
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
