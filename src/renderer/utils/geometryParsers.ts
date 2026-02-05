import * as THREE from 'three'

/** Check if buffer is ASCII STL (starts with "solid") */
export function isAsciiSTL(buffer: ArrayBuffer): boolean {
  const header = new Uint8Array(buffer, 0, Math.min(80, buffer.byteLength))
  const text = String.fromCharCode(...header)
  return text.trimStart().startsWith('solid')
}

/** Parse ASCII STL into a Three.js BufferGeometry */
export function parseSTLAscii(buffer: ArrayBuffer): THREE.BufferGeometry {
  const text = new TextDecoder().decode(buffer)
  const posArr: number[] = []
  const normArr: number[] = []

  const facetRe = /facet\s+normal\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+outer\s+loop\s+vertex\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+vertex\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+vertex\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+endloop\s+endfacet/g
  let m: RegExpExecArray | null
  while ((m = facetRe.exec(text)) !== null) {
    const nx = parseFloat(m[1]), ny = parseFloat(m[2]), nz = parseFloat(m[3])
    for (let v = 0; v < 3; v++) {
      posArr.push(parseFloat(m[4 + v * 3]), parseFloat(m[5 + v * 3]), parseFloat(m[6 + v * 3]))
      normArr.push(nx, ny, nz)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3))
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normArr, 3))
  geometry.computeVertexNormals()
  geometry.center()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

/** Parse binary STL buffer into a Three.js BufferGeometry */
export function parseSTLBinary(buffer: ArrayBuffer): THREE.BufferGeometry {
  const data = new DataView(buffer)
  const numTriangles = data.getUint32(80, true)
  const expectedSize = 84 + numTriangles * 50
  if (numTriangles === 0 || expectedSize > buffer.byteLength + 1) {
    throw new Error(`Invalid binary STL: ${numTriangles} triangles, expected ${expectedSize} bytes but got ${buffer.byteLength}`)
  }
  const positions = new Float32Array(numTriangles * 9)
  const normals = new Float32Array(numTriangles * 9)

  let offset = 84
  for (let i = 0; i < numTriangles; i++) {
    const nx = data.getFloat32(offset, true); offset += 4
    const ny = data.getFloat32(offset, true); offset += 4
    const nz = data.getFloat32(offset, true); offset += 4

    for (let v = 0; v < 3; v++) {
      const idx = i * 9 + v * 3
      positions[idx] = data.getFloat32(offset, true); offset += 4
      positions[idx + 1] = data.getFloat32(offset, true); offset += 4
      positions[idx + 2] = data.getFloat32(offset, true); offset += 4
      normals[idx] = nx
      normals[idx + 1] = ny
      normals[idx + 2] = nz
    }
    offset += 2 // attribute byte count
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geometry.computeVertexNormals()
  geometry.center()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

/** Parse OFF/COFF text (with per-face RGBA colors) into a Three.js BufferGeometry */
export function parseOFF(text: string): THREE.BufferGeometry {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
  let idx = 0

  // Parse header — OpenSCAD outputs "OFF 8 6 0" (header + counts on one line)
  // or standard OFF has "OFF" then counts on the next line
  const headerMatch = lines[idx].match(/^C?OFF\s*(.*)/i)
  if (!headerMatch) throw new Error('Invalid OFF: missing header')
  const remainder = headerMatch[1].trim()
  idx++

  // Counts may be on the same line as OFF or on the next line
  const countsLine = remainder || lines[idx++]
  const counts = countsLine.split(/\s+/).map(Number)
  const nVerts = counts[0]
  const nFaces = counts[1]

  // Parse vertices
  const vertices: number[][] = []
  for (let i = 0; i < nVerts; i++) {
    const parts = lines[idx++].split(/\s+/).map(Number)
    vertices.push([parts[0], parts[1], parts[2]])
  }

  // Parse faces with colors — fan-triangulate polygons
  const positions: number[] = []
  const colors: number[] = []
  let hasAnyColor = false
  let needsNormalization = false

  for (let i = 0; i < nFaces; i++) {
    const parts = lines[idx++].split(/\s+/).map(Number)
    const n = parts[0]
    const faceIndices = parts.slice(1, 1 + n)

    // Color values come after the face indices
    const colorValues = parts.slice(1 + n)
    let r = 0.8, g = 0.8, b = 0.8
    if (colorValues.length >= 3) {
      hasAnyColor = true
      r = colorValues[0]
      g = colorValues[1]
      b = colorValues[2]
      if (r > 1 || g > 1 || b > 1) needsNormalization = true
    }

    // Fan-triangulate: (v0, v1, v2), (v0, v2, v3), ...
    for (let t = 1; t < n - 1; t++) {
      const i0 = faceIndices[0], i1 = faceIndices[t], i2 = faceIndices[t + 1]
      for (const vi of [i0, i1, i2]) {
        const v = vertices[vi]
        positions.push(v[0], v[1], v[2])
        colors.push(r, g, b)
      }
    }
  }

  // Normalize 0-255 colors to 0-1
  if (needsNormalization) {
    for (let i = 0; i < colors.length; i++) {
      colors[i] = colors[i] / 255
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  if (hasAnyColor) {
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  }
  geometry.computeVertexNormals()
  geometry.center()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}
