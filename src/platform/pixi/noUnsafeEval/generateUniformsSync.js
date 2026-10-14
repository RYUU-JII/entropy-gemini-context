const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

const isSamplerType = (type) => (
  type === 'sampler2D'
  || type === 'samplerCube'
  || type === 'sampler2DArray'
);

const shouldBindSamplerTexture = (uniform) => (
  uniform == null
  || typeof uniform?.castToBaseTexture === 'function'
);

function getTextureSlot(syncData) {
  if (!syncData || typeof syncData !== 'object') return 0;
  const slot = Number.isFinite(syncData.textureCount) ? syncData.textureCount : 0;
  syncData.textureCount = slot + 1;
  return slot;
}

function ensureCacheArray(cachedUniform, size) {
  const current = cachedUniform.value;
  if (current && typeof current === 'object' && typeof current.length === 'number') {
    return current;
  }
  const next = new Array(size).fill(undefined);
  cachedUniform.value = next;
  return next;
}

function syncScalar(gl, location, cachedUniform, value, setter) {
  if (cachedUniform.value === value) return;
  cachedUniform.value = value;
  setter(location, value);
}

function syncVec2(gl, location, cachedUniform, value) {
  const cache = ensureCacheArray(cachedUniform, 2);
  const x = value?.x ?? value?.[0] ?? 0;
  const y = value?.y ?? value?.[1] ?? 0;
  if (cache[0] === x && cache[1] === y) return;
  cache[0] = x;
  cache[1] = y;
  gl.uniform2f(location, x, y);
}

function syncVec3(gl, location, cachedUniform, value) {
  const cache = ensureCacheArray(cachedUniform, 3);
  const x = value?.red ?? value?.[0] ?? 0;
  const y = value?.green ?? value?.[1] ?? 0;
  const z = value?.blue ?? value?.[2] ?? 0;
  if (cache[0] === x && cache[1] === y && cache[2] === z) return;
  cache[0] = x;
  cache[1] = y;
  cache[2] = z;
  gl.uniform3f(location, x, y, z);
}

function syncVec4(gl, location, cachedUniform, value) {
  const cache = ensureCacheArray(cachedUniform, 4);
  const x = value?.red ?? value?.x ?? value?.[0] ?? 0;
  const y = value?.green ?? value?.y ?? value?.[1] ?? 0;
  const z = value?.blue ?? value?.width ?? value?.[2] ?? 0;
  const w = value?.alpha ?? value?.height ?? value?.[3] ?? 0;
  if (cache[0] === x && cache[1] === y && cache[2] === z && cache[3] === w) return;
  cache[0] = x;
  cache[1] = y;
  cache[2] = z;
  cache[3] = w;
  gl.uniform4f(location, x, y, z, w);
}

function syncIntVec(gl, location, value, size, method) {
  if (size === 2) {
    gl[method](location, value?.[0] ?? 0, value?.[1] ?? 0);
  } else if (size === 3) {
    gl[method](location, value?.[0] ?? 0, value?.[1] ?? 0, value?.[2] ?? 0);
  } else {
    gl[method](location, value?.[0] ?? 0, value?.[1] ?? 0, value?.[2] ?? 0, value?.[3] ?? 0);
  }
}

function syncArrayUniform(gl, location, data, value) {
  const setters = {
    float: 'uniform1fv',
    vec2: 'uniform2fv',
    vec3: 'uniform3fv',
    vec4: 'uniform4fv',
    int: 'uniform1iv',
    ivec2: 'uniform2iv',
    ivec3: 'uniform3iv',
    ivec4: 'uniform4iv',
    uint: 'uniform1uiv',
    uvec2: 'uniform2uiv',
    uvec3: 'uniform3uiv',
    uvec4: 'uniform4uiv',
    bool: 'uniform1iv',
    bvec2: 'uniform2iv',
    bvec3: 'uniform3iv',
    bvec4: 'uniform4iv',
    sampler2D: 'uniform1iv',
    samplerCube: 'uniform1iv',
    sampler2DArray: 'uniform1iv',
  };
  if (data.type === 'mat2') {
    gl.uniformMatrix2fv(location, false, value);
    return;
  }
  if (data.type === 'mat3') {
    gl.uniformMatrix3fv(location, false, value);
    return;
  }
  if (data.type === 'mat4') {
    gl.uniformMatrix4fv(location, false, value);
    return;
  }
  const setter = setters[data.type];
  if (setter && typeof gl[setter] === 'function') {
    gl[setter](location, value);
  }
}

function syncSingleUniform(gl, location, cachedUniform, value, data, uniform, renderer, syncData) {
  if (data.type === 'float') {
    syncScalar(gl, location, cachedUniform, value, gl.uniform1f.bind(gl));
    return;
  }
  if (data.type === 'bool') {
    syncScalar(gl, location, cachedUniform, Number(value), gl.uniform1i.bind(gl));
    return;
  }
  if (data.type === 'int') {
    syncScalar(gl, location, cachedUniform, value, gl.uniform1i.bind(gl));
    return;
  }
  if (data.type === 'uint') {
    syncScalar(gl, location, cachedUniform, value, gl.uniform1ui.bind(gl));
    return;
  }
  if (isSamplerType(data.type)) {
    if (shouldBindSamplerTexture(uniform)) {
      const textureSlot = getTextureSlot(syncData);
      renderer.texture.bind(value, textureSlot);
      syncScalar(gl, location, cachedUniform, textureSlot, gl.uniform1i.bind(gl));
    } else {
      syncScalar(gl, location, cachedUniform, value, gl.uniform1i.bind(gl));
    }
    return;
  }
  if (data.type === 'vec2') {
    syncVec2(gl, location, cachedUniform, value);
    return;
  }
  if (data.type === 'vec3') {
    syncVec3(gl, location, cachedUniform, value);
    return;
  }
  if (data.type === 'vec4') {
    syncVec4(gl, location, cachedUniform, value);
    return;
  }
  if (data.type === 'ivec2' || data.type === 'bvec2') {
    syncIntVec(gl, location, value, 2, 'uniform2i');
    return;
  }
  if (data.type === 'ivec3' || data.type === 'bvec3') {
    syncIntVec(gl, location, value, 3, 'uniform3i');
    return;
  }
  if (data.type === 'ivec4' || data.type === 'bvec4') {
    syncIntVec(gl, location, value, 4, 'uniform4i');
    return;
  }
  if (data.type === 'uvec2') {
    syncIntVec(gl, location, value, 2, 'uniform2ui');
    return;
  }
  if (data.type === 'uvec3') {
    syncIntVec(gl, location, value, 3, 'uniform3ui');
    return;
  }
  if (data.type === 'uvec4') {
    syncIntVec(gl, location, value, 4, 'uniform4ui');
    return;
  }
  if (data.type === 'mat2') {
    gl.uniformMatrix2fv(location, false, value);
    return;
  }
  if (data.type === 'mat3') {
    const nextValue = typeof value?.toArray === 'function' ? value.toArray(true) : value;
    gl.uniformMatrix3fv(location, false, nextValue);
    return;
  }
  if (data.type === 'mat4') {
    gl.uniformMatrix4fv(location, false, value);
  }
}

function syncUniforms(group, uniformData, cachedUniforms, uniformValues, renderer, syncData) {
  const gl = renderer.gl;
  const uniforms = group.uniforms || {};
  for (const name in uniforms) {
    if (!hasOwn(uniforms, name)) continue;
    const data = uniformData[name];
    const uniform = uniforms[name];
    const value = uniformValues[name];
    if (!data) {
      if (uniform?.group === true) {
        if (uniform.ubo === true) {
          renderer.shader.syncUniformBufferGroup(value, name);
        } else {
          renderer.shader.syncUniformGroup(value, syncData);
        }
      }
      continue;
    }
    const cachedUniform = cachedUniforms[name];
    if (!cachedUniform) continue;
    if (data.size === 1 && !data.isArray) {
      syncSingleUniform(
        gl,
        cachedUniform.location,
        cachedUniform,
        value,
        data,
        uniform,
        renderer,
        syncData,
      );
    } else {
      syncArrayUniform(gl, cachedUniform.location, data, value);
    }
  }
}

export function generateUniformsSync(group, uniformData) {
  return (cachedUniforms, uniformValues, renderer, syncData = {}) => {
    syncUniforms(group, uniformData, cachedUniforms, uniformValues, renderer, syncData);
  };
}
