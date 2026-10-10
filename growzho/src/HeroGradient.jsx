import { ShaderGradientCanvas, ShaderGradient } from '@shadergradient/react'

export default function HeroGradient() {
  return (
    <ShaderGradientCanvas
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      pointerEvents="none"
    >
      <ShaderGradient
        animate="on"
        axesHelper="off"
        brightness={0.4}
        cAzimuthAngle={270}
        cDistance={0.5}
        cPolarAngle={180}
        cameraZoom={14.9}
        color1="#000000"
        color2="#F23005"
        color3="#000000"
        destination="onCanvas"
        embedMode="off"
        envPreset="city"
        format="gif"
        fov={45}
        frameRate={10}
        gizmoHelper="hide"
        grain="on"
        lightType="env"
        pixelDensity={1}
        positionX={-0.1}
        positionY={0}
        positionZ={0}
        range="disabled"
        rangeEnd={40}
        rangeStart={0}
        reflection={0.2}
        rotationX={0}
        rotationY={130}
        rotationZ={70}
        shader="defaults"
        type="sphere"
        uAmplitude={6.2}
        uDensity={0.4}
        uFrequency={5.5}
        uSpeed={0.3}
        uStrength={0.5}
        uTime={0}
        wireframe={false}
      />
    </ShaderGradientCanvas>
  )
}