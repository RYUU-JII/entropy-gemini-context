const GLSL_TO_SIZE = Object.freeze({
  float: 1,
  vec2: 2,
  vec3: 3,
  vec4: 4,
  int: 1,
  ivec2: 2,
  ivec3: 3,
  ivec4: 4,
  uint: 1,
  uvec2: 2,
  uvec3: 3,
  uvec4: 4,
  bool: 1,
  bvec2: 2,
  bvec3: 3,
  bvec4: 4,
  mat2: 4,
  mat3: 9,
  mat4: 16,
  sampler2D: 1,
});

const GLSL_TO_STD140_SIZE = Object.freeze({
  float: 4,
  vec2: 8,
  vec3: 12,
  vec4: 16,
  int: 4,
  ivec2: 8,
  ivec3: 12,
  ivec4: 16,
  uint: 4,
  uvec2: 8,
  uvec3: 12,
  uvec4: 16,
  bool: 4,
  bvec2: 8,
  bvec3: 12,
  bvec4: 16,
  mat2: 32,
  mat3: 48,
  mat4: 64,
});

function uboUpdate(_cachedUniforms, _uniformValues, renderer, _syncData, buffer) {
  renderer.buffer.update(buffer);
}

function mapSize(type) {
  return GLSL_TO_SIZE[type] || 1;
}

export function createUBOElements(uniformData) {
  const uboElements = uniformData.map((data) => ({
    data,
    offset: 0,
    dataLen: 0,
    dirty: 0,
  }));
  let size = 0;
  let chunkSize = 0;
  let offset = 0;

  for (let index = 0; index < uboElements.length; index += 1) {
    const uboElement = uboElements[index];
    size = GLSL_TO_STD140_SIZE[uboElement.data.type] || 4;
    if (uboElement.data.size > 1) {
      size = Math.max(size, 16) * uboElement.data.size;
    }
    uboElement.dataLen = size;
    if (chunkSize % size !== 0 && chunkSize < 16) {
      const lineUpValue = chunkSize % size % 16;
      chunkSize += lineUpValue;
      offset += lineUpValue;
    }
    if (chunkSize + size > 16) {
      offset = Math.ceil(offset / 16) * 16;
      uboElement.offset = offset;
      offset += size;
      chunkSize = size;
    } else {
      uboElement.offset = offset;
      chunkSize += size;
      offset += size;
    }
  }

  return {
    uboElements,
    size: Math.ceil(offset / 16) * 16,
  };
}

export function getUBOData(uniforms, uniformData) {
  const usedUniformDatas = [];
  for (const name in uniforms) {
    if (uniformData[name]) {
      usedUniformDatas.push(uniformData[name]);
    }
  }
  return usedUniformDatas.sort((a, b) => a.index - b.index);
}

function writeVec(data, offset, value, size) {
  for (let index = 0; index < size; index += 1) {
    data[offset + index] = value?.[index] ?? 0;
  }
}

function writeSingleValue(data, offset, value, type) {
  if (type === 'float' || type === 'int' || type === 'uint' || type === 'bool') {
    data[offset] = Number(value) || 0;
    return;
  }
  if (type === 'vec2' || type === 'ivec2' || type === 'uvec2' || type === 'bvec2') {
    data[offset] = value?.x ?? value?.[0] ?? 0;
    data[offset + 1] = value?.y ?? value?.[1] ?? 0;
    return;
  }
  if (type === 'vec3' || type === 'ivec3' || type === 'uvec3' || type === 'bvec3') {
    data[offset] = value?.red ?? value?.[0] ?? 0;
    data[offset + 1] = value?.green ?? value?.[1] ?? 0;
    data[offset + 2] = value?.blue ?? value?.[2] ?? 0;
    return;
  }
  if (type === 'vec4' || type === 'ivec4' || type === 'uvec4' || type === 'bvec4') {
    data[offset] = value?.red ?? value?.x ?? value?.[0] ?? 0;
    data[offset + 1] = value?.green ?? value?.y ?? value?.[1] ?? 0;
    data[offset + 2] = value?.blue ?? value?.width ?? value?.[2] ?? 0;
    data[offset + 3] = value?.alpha ?? value?.height ?? value?.[3] ?? 0;
    return;
  }
  if (type === 'mat2') {
    data[offset] = value?.[0] ?? 0;
    data[offset + 1] = value?.[1] ?? 0;
    data[offset + 4] = value?.[2] ?? 0;
    data[offset + 5] = value?.[3] ?? 0;
    return;
  }
  if (type === 'mat3') {
    const matrix = typeof value?.toArray === 'function' ? value.toArray(true) : value;
    data[offset] = matrix?.[0] ?? 0;
    data[offset + 1] = matrix?.[1] ?? 0;
    data[offset + 2] = matrix?.[2] ?? 0;
    data[offset + 4] = matrix?.[3] ?? 0;
    data[offset + 5] = matrix?.[4] ?? 0;
    data[offset + 6] = matrix?.[5] ?? 0;
    data[offset + 8] = matrix?.[6] ?? 0;
    data[offset + 9] = matrix?.[7] ?? 0;
    data[offset + 10] = matrix?.[8] ?? 0;
    return;
  }
  if (type === 'mat4') {
    writeVec(data, offset, value, 16);
  }
}

function writeArrayValue(data, offset, value, type, size) {
  const rowSize = Math.max((GLSL_TO_STD140_SIZE[type] || 4) / 16, 1);
  const elementSize = mapSize(type) / rowSize;
  const remainder = (4 - (elementSize % 4)) % 4;
  let valueIndex = 0;
  let cursor = offset;
  for (let index = 0; index < size * rowSize; index += 1) {
    for (let column = 0; column < elementSize; column += 1) {
      data[cursor] = value?.[valueIndex] ?? 0;
      cursor += 1;
      valueIndex += 1;
    }
    cursor += remainder;
  }
}

function syncUniformBuffer(uboElements, _cachedUniforms, uniformValues, renderer, _syncData, buffer) {
  const data = buffer.data;
  for (let index = 0; index < uboElements.length; index += 1) {
    const uboElement = uboElements[index];
    const name = uboElement.data.name;
    const value = uniformValues[name];
    const offset = uboElement.offset / 4;
    if (uboElement.data.size > 1) {
      writeArrayValue(data, offset, value, uboElement.data.type, uboElement.data.size);
    } else {
      writeSingleValue(data, offset, value, uboElement.data.type);
    }
  }
  renderer.buffer.update(buffer);
}

export function generateUniformBufferSync(group, uniformData) {
  if (!group.autoManage) {
    return { size: 0, syncFunc: uboUpdate };
  }

  const usedUniformDatas = getUBOData(group.uniforms, uniformData);
  const { uboElements, size } = createUBOElements(usedUniformDatas);

  return {
    size,
    syncFunc: (cachedUniforms, uniformValues, renderer, syncData, buffer) => {
      syncUniformBuffer(uboElements, cachedUniforms, uniformValues, renderer, syncData, buffer);
    },
  };
}
