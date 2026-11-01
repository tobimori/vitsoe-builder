import { useFrame } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

export interface LabelStyle {
  color: string
  background: string
  fontSize: number
  paddingX: number
  paddingY: number
  radius?: number
}

const ignoreRaycast = () => {}

function drawLabel(text: string, style: LabelStyle) {
  const ratio = Math.min(window.devicePixelRatio || 1, 3)
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D is unavailable.')

  const font = `${style.fontSize}px ${getComputedStyle(document.body).fontFamily}`
  context.font = font
  const width = Math.ceil(context.measureText(text).width + style.paddingX * 2)
  const height = Math.ceil(style.fontSize * 1.2 + style.paddingY * 2)

  canvas.width = width * ratio
  canvas.height = height * ratio
  context.scale(ratio, ratio)
  context.fillStyle = style.background
  context.beginPath()
  context.roundRect(0, 0, width, height, style.radius ?? 0)
  context.fill()
  context.font = font
  context.fillStyle = style.color
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(text, width / 2, height / 2)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  return { texture, width, height }
}

function LabelSprite({
  position,
  text,
  style,
}: {
  position: THREE.Vector3Tuple
  text: string
  style: LabelStyle
}) {
  const sprite = useRef<THREE.Sprite>(null)
  const [label] = useState(() => drawLabel(text, style))

  useEffect(() => () => label.texture.dispose(), [label])

  // Keeps a constant CSS pixel size: a non-attenuated sprite spans `scale * P[1][1]` in clip space.
  useFrame(({ camera, size }) => {
    const pixel = 2 / (camera.projectionMatrix.elements[5]! * size.height)
    sprite.current?.scale.set(label.width * pixel, label.height * pixel, 1)
  })

  return (
    <sprite ref={sprite} position={position} renderOrder={30} raycast={ignoreRaycast}>
      <spriteMaterial
        map={label.texture}
        sizeAttenuation={false}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
        transparent
      />
    </sprite>
  )
}

/** A text label with a constant on-screen size, drawn into the WebGL scene. */
export function ScreenLabel(props: {
  position: THREE.Vector3Tuple
  text: string
  style: LabelStyle
}) {
  return <LabelSprite key={props.text} {...props} />
}
