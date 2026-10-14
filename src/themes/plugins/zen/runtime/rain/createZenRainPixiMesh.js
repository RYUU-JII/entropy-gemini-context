import { ZEN_RAIN_BUCKET_COUNT, ZEN_RAIN_STREAKS_PER_BUCKET,
    createZenRainBucketIndices, packZenRainBucketVertices } from './zenRainStreakGeometry.js';
import { createZenRainStreakRuntime } from './zenRainStreakRuntime.js';

export function resolveZenRainShaderSources(webGLVersion) {
    if (webGLVersion === 1) return {
        vertex: 'precision highp float;\nattribute vec2 aVertexPosition;\nuniform mat3 projectionMatrix;\nuniform mat3 translationMatrix;\nvoid main(){vec3 p=projectionMatrix*translationMatrix*vec3(aVertexPosition,1.0);gl_Position=vec4(p.xy,0.0,1.0);}',
        fragment: 'precision mediump float;\nuniform vec4 uColor;\nuniform float uWorldAlpha;\nvoid main(){gl_FragColor=uColor*uWorldAlpha;}',
        dialect: 'glsl_es_100',
    };
    if (webGLVersion === 2) return {
        vertex: '#version 300 es\nprecision highp float;\nlayout(location=0) in vec2 aVertexPosition;\nuniform mat3 projectionMatrix;\nuniform mat3 translationMatrix;\nvoid main(){vec3 p=projectionMatrix*translationMatrix*vec3(aVertexPosition,1.0);gl_Position=vec4(p.xy,0.0,1.0);}',
        fragment: '#version 300 es\nprecision mediump float;\nuniform vec4 uColor;\nuniform float uWorldAlpha;\nlayout(location=0) out vec4 rainFragColor;\nvoid main(){rainFragColor=uColor*uWorldAlpha;}',
        dialect: 'glsl_es_300',
    };
    throw Error('ZEN_RAIN_WEBGL_VERSION_INVALID');
}

// Borrows the admitted renderer/root. The rain owns only two retained meshes;
// it never creates a texture, canvas, mask, filter, clock or renderer.
export function createZenRainPixiMesh({ pixi, renderer, parent, insertIndex = parent?.children?.length } = {}) {
    if (!pixi || !['Container', 'Geometry', 'Mesh', 'Shader'].every(key => typeof pixi[key] === 'function')
        || !Number.isInteger(insertIndex) || insertIndex < 0 || insertIndex > parent?.children?.length
        || typeof parent?.addChildAt !== 'function') throw Error('ZEN_RAIN_PIXI_OWNER_REQUIRED');
    const webGLVersion = renderer?.context?.webGLVersion, sources = resolveZenRainShaderSources(webGLVersion);
    const container = new pixi.Container(), runtime = createZenRainStreakRuntime(), buckets = [];
    let disposed = false;
    const last = { visibleBuckets: 0, bufferUpdateCalls: 0, requestedVertexBytes: 0 };
    const cumulative = { updates: 0, sampledFrames: 0, bufferUpdateCalls: 0, requestedVertexBytes: 0 };
    const destroyBucket = bucket => {
        bucket.mesh?.destroy(); bucket.shader?.destroy();
        // Mesh destruction releases its geometry reference, while these public
        // buffer/geometry owners release the retained allocations explicitly.
        for (const buffer of bucket.geometry.buffers) buffer.destroy();
        bucket.geometry.destroy();
        bucket.positions = null; bucket.indices = null; bucket.color = null;
    };
    try {
        for (let index = 0; index < ZEN_RAIN_BUCKET_COUNT; index++) {
            const positions = new Float32Array(ZEN_RAIN_STREAKS_PER_BUCKET * 8), indices = createZenRainBucketIndices();
            const geometry = new pixi.Geometry().addAttribute('aVertexPosition', positions, 2).addIndex(indices);
            const vertexBuffer = geometry.getBuffer('aVertexPosition'); vertexBuffer.static = false;
            const color = new Float32Array(4);
            const bucket = { positions, indices, geometry, vertexBuffer, color, shader: null, mesh: null };
            buckets.push(bucket);
            bucket.shader = pixi.Shader.from(sources.vertex, sources.fragment, { uColor: color, uWorldAlpha: 1 });
            bucket.shader.batchable = false;
            bucket.shader.update = function updateRainWorldAlpha() { this.uniforms.uWorldAlpha = this.alpha; };
            bucket.mesh = new pixi.Mesh(geometry, bucket.shader, undefined, 4);
            bucket.mesh.visible = false; bucket.mesh.size = 0; bucket.mesh.eventMode = 'none';
            container.addChild(bucket.mesh);
        }
        parent.addChildAt(container, insertIndex);
    } catch (error) {
        for (const bucket of buckets) destroyBucket(bucket);
        runtime.dispose(); container.destroy(); throw error;
    }
    const requireLive = () => { if (disposed) throw Error('ZEN_RAIN_MESH_DISPOSED'); };
    function setInputs(input) {
        requireLive();
        if (!runtime.setInputs(input)) return false;
        for (let index = 0; index < buckets.length; index++) {
            const { color, mesh } = buckets[index], alpha = runtime.weather.opacity[index];
            for (let channel = 0; channel < 3; channel++) color[channel] = runtime.weather.colors[index][channel] / 255 * alpha;
            color[3] = alpha;
            if (runtime.weather.totalCount === 0) { mesh.visible = false; mesh.size = 0; }
        }
        return true;
    }
    function update(activeTimeSec) {
        requireLive(); cumulative.updates++;
        last.bufferUpdateCalls = 0; last.requestedVertexBytes = 0;
        if (!runtime.sample(activeTimeSec)) return;
        cumulative.sampledFrames++; last.visibleBuckets = 0;
        for (let index = 0; index < buckets.length; index++) {
            const bucket = buckets[index];
            const visible = packZenRainBucketVertices(runtime.weather.counts, runtime.state, index, bucket.positions);
            bucket.mesh.visible = visible > 0; bucket.mesh.size = visible * 6;
            if (!bucket.mesh.visible) continue;
            last.visibleBuckets++; bucket.vertexBuffer.update(); last.bufferUpdateCalls++;
            last.requestedVertexBytes += bucket.positions.byteLength;
        }
        cumulative.bufferUpdateCalls += last.bufferUpdateCalls;
        cumulative.requestedVertexBytes += last.requestedVertexBytes;
    }
    function receipt() {
        const pose = runtime.receipt();
        return { ...pose, webGLVersion, shaderDialect: sources.dialect, meshCount: buckets.length,
            vertexCapacityBytes: 512, indexCapacityBytes: 192,
            retainedNumericBufferBytes: disposed ? 0 : pose.geometryNumericBufferBytes + 736,
            textures: 0, filters: 0, masks: 0, additionalCanvas: 0, additionalLoops: 0,
            ...last, cumulative: { ...cumulative } };
    }
    function dispose() {
        if (disposed) return;
        disposed = true; container.parent?.removeChild(container);
        for (const bucket of buckets) destroyBucket(bucket);
        runtime.dispose(); container.destroy();
    }
    return { container, setInputs, update, receipt, dispose };
}
