import * as THREE from 'three'

/**
 * Vitsœ's system illustrations keep the front true to scale and draw depth up and to the
 * right: each millimetre of depth moves half a millimetre right and half a millimetre up.
 */
const DEPTH_SHIFT = 0.5

/** Distance from the camera to the plane that the shear leaves in place. */
export const PIVOT = 20

const shear = new THREE.Matrix4().set(
  1,
  0,
  -DEPTH_SHIFT,
  -DEPTH_SHIFT * PIVOT,
  0,
  1,
  -DEPTH_SHIFT,
  -DEPTH_SHIFT * PIVOT,
  0,
  0,
  1,
  0,
  0,
  0,
  0,
  1,
)

/** The direction of projection in view space: deeper points lie down and to the left. */
const viewDirection = new THREE.Vector3(-DEPTH_SHIFT, -DEPTH_SHIFT, -1).normalize()

/** The world direction of projection for a camera that looks back along `facing`. */
export function lineOfSight(facing: THREE.Vector3) {
  const orientation = new THREE.Matrix4().lookAt(
    facing,
    new THREE.Vector3(),
    THREE.Object3D.DEFAULT_UP,
  )
  return viewDirection.clone().transformDirection(orientation)
}

/** Points `raycaster` through `pointer`, in normalised device coordinates, for any camera. */
export function castRay(raycaster: THREE.Raycaster, pointer: THREE.Vector2, camera: THREE.Camera) {
  raycaster.setFromCamera(pointer, camera)
  // three.js casts orthographic rays straight ahead, but the drawing projects at an angle
  if (camera instanceof ObliqueCamera) camera.direction(raycaster.ray.direction)
}

/**
 * An oblique parallel projection. Frustum units are CSS pixels, as R3F sets them for
 * orthographic cameras, so `zoom` is the scale in pixels per metre.
 */
export class ObliqueCamera extends THREE.OrthographicCamera {
  constructor() {
    super(-1, 1, 1, -1, 0.1, PIVOT * 3)
  }

  override updateProjectionMatrix() {
    super.updateProjectionMatrix()
    this.projectionMatrix.multiply(shear)
    this.projectionMatrixInverse.copy(this.projectionMatrix).invert()
  }

  /** The world direction that every pointer ray and every line of sight follows. */
  direction(target = new THREE.Vector3()) {
    return target.copy(viewDirection).transformDirection(this.matrixWorld)
  }

  setSize(width: number, height: number) {
    this.left = -width / 2
    this.right = width / 2
    this.top = height / 2
    this.bottom = -height / 2
    this.updateProjectionMatrix()
  }

  /**
   * Looks at `bounds` from the side `facing` points to and scales it to fill `fill` of
   * the width and height of the view. Returns the point the camera looks at.
   */
  frame(bounds: THREE.Box3, facing: THREE.Vector3, fill = { x: 0.85, y: 0.8 }) {
    const centre = bounds.getCenter(new THREE.Vector3())
    this.zoom = 1
    this.position.copy(centre).addScaledVector(facing, PIVOT)
    this.up.set(0, 1, 0)
    this.lookAt(centre)
    this.updateMatrixWorld()
    this.updateProjectionMatrix()

    const projected = new THREE.Box2()
    const corner = new THREE.Vector3()
    for (const x of [bounds.min.x, bounds.max.x]) {
      for (const y of [bounds.min.y, bounds.max.y]) {
        for (const z of [bounds.min.z, bounds.max.z]) {
          const { x: px, y: py } = corner.set(x, y, z).project(this)
          projected.expandByPoint(new THREE.Vector2(px, py))
        }
      }
    }

    // At zoom 1, one unit of normalised device coordinates spans half the view in metres
    const offset = projected.getCenter(new THREE.Vector2())
    const span = projected.getSize(new THREE.Vector2())
    const shift = new THREE.Vector3()
      .setFromMatrixColumn(this.matrixWorld, 0)
      .multiplyScalar((offset.x * (this.right - this.left)) / 2)
      .addScaledVector(
        new THREE.Vector3().setFromMatrixColumn(this.matrixWorld, 1),
        (offset.y * (this.top - this.bottom)) / 2,
      )
    this.position.add(shift)
    this.zoom = Math.min((2 * fill.x) / span.x, (2 * fill.y) / span.y)
    this.updateMatrixWorld()
    this.updateProjectionMatrix()
    return centre.add(shift)
  }
}
