 
let rotation = 0.0;
let deltaTime = 0;

const modelConfig = {
    parts: [
        "https://models.elasticone.net/midas_part_aa",
        "https://models.elasticone.net/midas_part_ab"
    ],
    desired_width: 384,
    desired_height: 384,
};

 var state = {
    gl: null,
    initialized: false,
    zoom: -3,
    canvas: null,
    shaderProgramInfo: null,
    ui: {
      dragging: false,
      mouse: {
        lastX: -1,
        lastY: -1,
      },      
    },    
    app: {
      angle: {
        x: 0,
        y: 0,
      },
      eye: {
        x:2.,
        y:2.,
        z:7.,
      },
    },
    autoRotate: true,
    model: modelConfig,
    session: null,
    buffers: null,
    colorTexture: null,
    depthTexture: null,
    renderScene: false,
    currentDepthWidth: 0,
    currentDepthHeight: 0,
  };

function constrainToMultipleOf(value,  max_val, alignment) {
    let aligned = Math.floor(Math.round(value / alignment) * alignment);
    if (aligned > max_val) {
        aligned = Math.floor(value / alignment) * alignment;
    }
    if (aligned < 0) {
        aligned = Math.ceil(value / alignment) * alignment;
    }
    return aligned;
}
 
 function getScaleSize(width, height, desired_width, desired_height) {
    let scale_height = desired_height / height;
    let scale_width = desired_width / width;
    if (scale_width < scale_height) {
        scale_height = scale_width;
    } else {
        scale_width = scale_height;
    }
    let new_height = constrainToMultipleOf(scale_height * height, desired_height, 32);
    let new_width = constrainToMultipleOf(scale_width * width, desired_width, 32);
    return [new_width, new_height];
}

function isPowerOf2(value) {
  return (value & (value - 1)) === 0;
}

function drawScene(gl, programInfo, buffers, texture, depth, rotation) {
    gl.clearColor(0.04, 0.043, 0.109, 1.0);
    gl.clearDepth(1.0);
    gl.enable(gl.DEPTH_TEST); // Enable depth testing
    gl.depthFunc(gl.LEQUAL); // Near things obscure far things

    // Clear the canvas before we start drawing on it.

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const fieldOfView = (45 * Math.PI) / 180; // in radians
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const zNear = 0.1;
    const zFar = 100.0;
    const projectionMatrix = mat4.create();

    mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);

    const modelViewMatrix = mat4.create();

    mat4.translate(
        modelViewMatrix, // destination matrix
        modelViewMatrix, // matrix to translate
        [-0.0, 0.0, state.zoom]
    ); // amount to translate

    if (state.autoRotate) {
        mat4.rotateX(modelViewMatrix, modelViewMatrix, Math.sin(rotation) * 0.05);   
        mat4.rotateY(modelViewMatrix, modelViewMatrix, Math.cos(rotation) * 0.05);   
    }
    mat4.rotateX(modelViewMatrix, modelViewMatrix, state.app.angle.x);
    mat4.rotateY(modelViewMatrix, modelViewMatrix, state.app.angle.y);
    
    setPositionAttribute(gl, buffers, programInfo);

    setTextureAttribute(gl, buffers, programInfo);

    // Tell WebGL which indices to use to index the vertices
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers['indexBuffer']);

    // Tell WebGL to use our program when drawing
    gl.useProgram(programInfo.program);

    // Set the shader uniforms
    gl.uniformMatrix4fv(
        programInfo.uniformLocations.projectionMatrix,
        false,
        projectionMatrix
    );
    gl.uniformMatrix4fv(
        programInfo.uniformLocations.modelViewMatrix,
        false,
        modelViewMatrix
    );

    gl.activeTexture(gl.TEXTURE0);

    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.uniform1i(programInfo.uniformLocations.uSampler, 0);

    if (depth != null) {
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, depth);
        gl.uniform1i(programInfo.uniformLocations.depthTexture, 1);
    }

    {
        const type = gl.UNSIGNED_INT;
        const offset = 0;
        gl.drawElements(gl.TRIANGLES, buffers.vertexCount, type, offset);
    }
}

function setPositionAttribute(gl, buffers, programInfo) {
    const numComponents = 3;
    const type = gl.FLOAT; // the data in the buffer is 32bit floats
    const normalize = false; // don't normalize
    const stride = 0; // how many bytes to get from one set of values to the next
    const offset = 0; // how many bytes inside the buffer to start from
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers['vertexBuffer']);
    gl.vertexAttribPointer(
        programInfo.attribLocations.vertexPosition,
        numComponents,
        type,
        normalize,
        stride,
        offset
    );
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);
}


function initShaderProgram(gl, vsSource, fsSource) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert(
            `Unable to initialize the shader program: ${gl.getProgramInfoLog(
            shaderProgram
            )}`
        );
        return null;
    }

    return shaderProgram;
}

function loadShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);

    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert(
            `An error occurred compiling the shaders: ${gl.getShaderInfoLog(shader)}`
        );
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}

function setTextureAttribute(gl, buffers, programInfo) {
    const num = 2; // every coordinate composed of 2 values
    const type = gl.FLOAT; // the data in the buffer is 32-bit float
    const normalize = false; // don't normalize
    const stride = 0; // how many bytes to get from one set to the next
    const offset = 0; // how many bytes inside the buffer to start from
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers['texcoordBuffer']);
    gl.vertexAttribPointer(
        programInfo.attribLocations.textureCoord,
        num,
        type,
        normalize,
        stride,
        offset
    );
    gl.enableVertexAttribArray(programInfo.attribLocations.textureCoord);
}

function loadTexture(gl, data, width, height, format, dataType) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    const level = 0;
    const internalFormat = format;
    const border = 0;
    const srcFormat = format;
    const srcType = dataType;
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat, width, height, border, srcFormat, srcType, data);

    if (isPowerOf2(width) && isPowerOf2(height)) {
        gl.generateMipmap(gl.TEXTURE_2D);
    } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
    return texture;
}

function makeGrid(width, height) {
    const width_float = width;
    const height_float = height;
    vertices = []
    texcoord = []
    indices = []
    for (var j = 0; j <= height; ++j) {
        for (var i = width; i >= 0; --i) {
            const x = i / width_float;
            const y = j / height_float;
            vertices.push((x - 0.5) * 2.0);
            vertices.push((y - 0.5) * 2.0);
            vertices.push(0);
            texcoord.push(x);
            texcoord.push(y);
        }
    }

    for (var j = 0; j < height; ++j) {
        for (var i = 0; i < width; ++i) {
            const row1 = j * (width + 1);
            const row2 = (j + 1) * (width + 1);

            // triangle 1
            indices.push(row1 + i);
            indices.push(row1 + i + 1);
            indices.push(row2 + i + 1);

            // triangle 2
            indices.push(row1 + i);
            indices.push(row2 + i + 1);
            indices.push(row2 + i);
        }
    }
    return {"vertices": vertices, "texcoord": texcoord, "indices": indices, vertexCount: width * height * 2 * 3};
}

function initializeBuffer(gl, bufferType, data) {
    const buffer = gl.createBuffer();

    gl.bindBuffer(bufferType, buffer);
    gl.bufferData(bufferType, data, gl.STATIC_DRAW);
    return buffer;
}

function makeGridBuffers(gl, width, height) {
    const bufferData = makeGrid(width, height);
    const ext = gl.getExtension('OES_element_index_uint');
    const vertexBuffer = initializeBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(bufferData['vertices']));
    const indexBuffer = initializeBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(bufferData['indices']));
    const texcoordBuffer = initializeBuffer(gl, gl.ARRAY_BUFFER, new Float32Array(bufferData['texcoord']));
    return { "vertexBuffer": vertexBuffer, "indexBuffer": indexBuffer, "texcoordBuffer": texcoordBuffer, vertexCount: bufferData.vertexCount};
}

function initializeRenderer(state) {
    if (state.initialized) return true;
    const canvas = document.querySelector("#gl-canvas");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight * 0.9;
    canvas.style.display = "block";
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!gl) {
        alert("Unable to initialize WebGL. Your browser or machine may not support it.");
        return false;
    }
    state.canvas = canvas;
    state.gl = gl;

    canvas.addEventListener("mousedown", mouseDown);
    canvas.addEventListener("mouseup", mouseUp);
    canvas.addEventListener("mousemove", mouseMove);
    canvas.addEventListener('touchstart', handleStart);
    canvas.addEventListener('touchend', handleEnd);
    canvas.addEventListener('touchcancel', handleEnd);
    canvas.addEventListener('touchmove', handleMove);

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight * 0.9;
        gl.viewport(0, 0, canvas.width, canvas.height);
    }
    window.addEventListener('resize', resizeCanvas);

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const vsSource = `
        attribute vec4 aVertexPosition;
        attribute vec2 aTextureCoord;        
        uniform mat4 uModelViewMatrix;
        uniform mat4 uProjectionMatrix;
        varying highp vec2 vTextureCoord;
        uniform sampler2D depth;
        
        void main(void) {
            vec4 position = aVertexPosition;
            position.z = texture2D(depth, aTextureCoord).r;
            gl_Position = uProjectionMatrix * uModelViewMatrix * position;
            vTextureCoord = aTextureCoord;
        }
        `;
    const fsSource = `
        varying highp vec2 vTextureCoord;
        uniform sampler2D uSampler;        
        
        void main(void) {
            gl_FragColor = texture2D(uSampler,  vTextureCoord);
        }
        `;
    const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
    const programInfo = {
        program: shaderProgram,
        attribLocations: {
            vertexPosition: gl.getAttribLocation(shaderProgram, "aVertexPosition"),
            textureCoord: gl.getAttribLocation(shaderProgram, "aTextureCoord"),            
        },
        uniformLocations: {
            projectionMatrix: gl.getUniformLocation(shaderProgram, "uProjectionMatrix"),
            modelViewMatrix: gl.getUniformLocation(shaderProgram, "uModelViewMatrix"),
            uSampler: gl.getUniformLocation(shaderProgram, "uSampler"),
            depthTexture: gl.getUniformLocation(shaderProgram, "depth"),
        },
    };
    state.shaderProgramInfo = programInfo;
    state.initialized = true;
    let then = 0;
    function render(now) {
        now *= 0.001;
        deltaTime = now - then;
        then = now;
        if (state.renderScene) {
            drawScene(state.gl, state.shaderProgramInfo, state.buffers, state.colorTexture, state.depthTexture, rotation);
        }
        rotation += deltaTime;

        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
    return true;
}

function renderDisplacement(sourceWidth, sourceHeight, depthWidth, depthHeight, imgData, depthData) {
    if (!initializeRenderer(state)) {
        return;
    }
    const fileSelectContainer = document.getElementById("select-file");
    fileSelectContainer.style.display = "block";
    fileSelectContainer.style.marginTop = "0";
    
    const gl = state.gl;
    state.buffers = makeGridBuffers(gl, depthWidth, depthHeight);

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    state.colorTexture = loadTexture(gl, imgData.data, sourceWidth, sourceHeight, gl.RGBA, gl.UNSIGNED_BYTE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    state.depthTexture = loadTexture(gl, imgData.data, sourceWidth, sourceHeight, gl.RGBA, gl.UNSIGNED_BYTE);
    state.renderScene = true;
}

function renderDisplacementFromCanvas(canvasContext, depthWidth, depthHeight) {
    if (!initializeRenderer(state)) {
        return;
    }
    const fileSelectContainer = document.getElementById("select-file");
    fileSelectContainer.style.display = "block";
    fileSelectContainer.style.marginTop = "0";
    
    const gl = state.gl;
    state.buffers = makeGridBuffers(gl, depthWidth, depthHeight);
    const colorImageWidth = canvasContext.canvas.width - depthWidth;
    const colorImageHeight = canvasContext.canvas.height; 
    const colorImageData = canvasContext.getImageData(0, 0, colorImageWidth, colorImageHeight);
    const depthImageData = canvasContext.getImageData(colorImageWidth, 0, depthWidth, depthHeight);

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    state.colorTexture = loadTexture(gl, colorImageData.data, colorImageWidth, colorImageHeight, gl.RGBA, gl.UNSIGNED_BYTE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    state.depthTexture = loadTexture(gl, depthImageData.data, depthWidth, depthHeight, gl.RGBA, gl.UNSIGNED_BYTE);
    state.renderScene = true;
}


function rgbaFromGrayscale(buffer) {
  const gray = new Uint8ClampedArray(buffer);
  const pixelCount = gray.length;
  const rgba = new Uint8ClampedArray(pixelCount * 4);

  for (let iPixel = 0; iPixel < pixelCount; iPixel += 1) {
    const iRgba = iPixel * 4;
    // @ts-expect-error
    for (let i = 0; i < 3; i += 1) rgba[iRgba + i] = gray[iPixel];
    rgba[iRgba + 3] = 255;
  }

  return rgba;
}

function wrapImageDataInCanvas(imageData){
    var canvas = document.getElementById("scaling-canvas");
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    
    canvas.getContext("2d").putImageData(imageData, 0, 0);
   
    return canvas;
}


function makeDepthMap(session, img) {
    const processingModel = document.getElementById("processing-data-progress");
    var cnv = document.getElementById("staging-canvas");
    const size = Math.min(img.width, img.height);
    const xOffset = size < img.width ? (img.width - size) / 2  : 0;
    const yOffset = size < img.height ? (img.height - size) / 2 : 0;
    const scaled_size  = getScaleSize(size, size, state.model.desired_width, state.model.desired_height);
    const w = cnv.width = scaled_size[0];
    const h = cnv.height = scaled_size[1];
    var ctx = cnv.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, xOffset, yOffset, size, size, 0, 0, w, h);
    const imgData = ctx.getImageData(0, 0, w, h);
    const rgba = imgData.data;
    const pixelCount = w * h;
    const mean = [0.485, 0.456, 0.406];
    const std = [0.229, 0.224, 0.225];
    const chw = new Float32Array(3 * pixelCount);
    for (let i = 0; i < pixelCount; i++) {
        for (let c = 0; c < 3; c++) {
            chw[c * pixelCount + i] = (rgba[i * 4 + c] / 255.0 - mean[c]) / std[c];
        }
    }
    const inputTensor = new ort.Tensor('float32', chw, [1, 3, h, w]);
    const feeds = { input: inputTensor };
    session.run(feeds).then(result => { 
        var textureCanvas = document.getElementById("texture-canvas");
        textureCanvas.height = size;
        textureCanvas.width = size + w;
        var textureCanvasContext = textureCanvas.getContext("2d", { willReadFrequently: true });
        textureCanvasContext.drawImage(img, xOffset, yOffset, size, size, 0, 0, size, size);
        state.currentDepthWidth = w;
        state.currentDepthHeight = h;
        const depthRaw = result.output.data;
        let depthMin = depthRaw[0], depthMax = depthRaw[0];
        for (let i = 1; i < depthRaw.length; i++) {
            if (depthRaw[i] < depthMin) depthMin = depthRaw[i];
            if (depthRaw[i] > depthMax) depthMax = depthRaw[i];
        }
        const depthRange = depthMax - depthMin || 1;
        const depthNormalized = new Uint8ClampedArray(depthRaw.length);
        for (let i = 0; i < depthRaw.length; i++) {
            depthNormalized[i] = ((depthRaw[i] - depthMin) / depthRange) * 255;
        }
        var depthImageData = new ImageData(rgbaFromGrayscale(depthNormalized), w, h);
        textureCanvasContext.putImageData(depthImageData, size, 0);
        processingModel.style.display = "none";
        cnv.style.display = "none";
        renderDisplacementFromCanvas(textureCanvasContext, w, h);
        document.getElementById("share-image").style.display = "block";
    });
}

function beginDrag(x, y) {
    state.ui.mouse.lastX = x;
    state.ui.mouse.lastY = y;
    state.ui.dragging = true;
}

function processDrag(x, y) {
    if (state.ui.dragging) {
        var factor = 10/state.canvas.height;
        var dx = factor * (x - state.ui.mouse.lastX);
        var dy = factor * (y - state.ui.mouse.lastY);

        state.app.angle.x = state.app.angle.x + dy;
        state.app.angle.y = state.app.angle.y + dx;
    }
    state.ui.mouse.lastX = x;
    state.ui.mouse.lastY = y;
}

function endDrag() {
     state.ui.dragging = false;
}


function handleStart(evt) {
    evt.preventDefault();
    const touches = evt.changedTouches;
    beginDrag(touches[0].clientX, touches[0].clientY);
}

function handleMove(evt) {
    evt.preventDefault();
    const touches = evt.changedTouches;
    processDrag(touches[0].clientX, touches[0].clientY);
}

function handleEnd(evt) {
    evt.preventDefault();
    endDrag();
}

function mouseDown(event) {
    var x = event.clientX;
    var y = event.clientY;
    var rect = event.target.getBoundingClientRect();
    if (rect.left <= x && x < rect.right && rect.top <= y && y < rect.bottom) {
        beginDrag(x, y);
    }
}

function mouseUp(event) {
    endDrag();
}

function mouseMove(event) {
    processDrag(event.clientX, event.clientY);    
}

function promisifyRequest(request) {
    return new Promise((resolve, reject) => {
        request.oncomplete = request.onsuccess = () => resolve(request.result);
        request.onabort = request.onerror = () => reject(request.error);
    });
}

function createStore(dbName, storeName) {
    const request = indexedDB.open(dbName);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName);
    const dbp = promisifyRequest(request);

    return (txMode, callback) =>
        dbp.then((db) =>
        callback(db.transaction(storeName, txMode).objectStore(storeName)),
        );
}

let defaultGetStoreFunc;

function defaultGetStore() {
    if (!defaultGetStoreFunc) {
        defaultGetStoreFunc = createStore('keyval-store', 'keyval');
    }
    return defaultGetStoreFunc;
}

function set(key, value, customStore = defaultGetStore()) {
    return customStore('readwrite', (store) => {
        store.put(value, key);
        return promisifyRequest(store.transaction);
    });
}

function get(key, customStore = defaultGetStore()) {
    return customStore('readonly', (store) => promisifyRequest(store.get(key)));
}

async function fetchModelBlob(parts, next) {
    const fileSelectContainer = document.getElementById("select-file");
    const loadingModelProgess = document.getElementById("loading-model-progress");

    loadingModelProgess.style.display = "block";
    fileSelectContainer.style.display = "none";
    console.log("fetching model weights");
    const downloadProgress = document.getElementById("download-progress");
    const modelKey = "modelData" + parts[0];
    const modelData = await get(modelKey);
    if (modelData != null) {
        downloadProgress.value = 100;
        console.log("fetching model weights - success from cache");
        next(modelData);
        return;
    }
    try {
        const allChunks = [];
        let totalReceived = 0;
        const totalSize = 416356409;
        for (const url of parts) {
            const response = await fetch(url);
            if (!response.ok) throw new Error("fetch failed: " + response.status);
            const reader = response.body.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                allChunks.push(value);
                totalReceived += value.length;
                downloadProgress.value = (totalReceived / totalSize) * 100;
            }
        }
        const data = new Uint8Array(totalReceived);
        let offset = 0;
        for (const chunk of allChunks) {
            data.set(chunk, offset);
            offset += chunk.length;
        }
        console.log("fetching model weights - from server success= true");
        set(modelKey, data);
        next(data);
    } catch (e) {
        console.log("fetching model weights - from server success= false", e);
    }
}

function validateImageUrl(url) {
    return(url.match(/\.(jpeg|jpg|gif|png)$/) != null);
}

function iOS() {
  return [
    'iPad Simulator',
    'iPhone Simulator',
    'iPod Simulator',
    'iPad',
    'iPhone',
    'iPod'
  ].includes(navigator.platform)
  // iPad on iOS 13 detection
  || (navigator.userAgent.includes("Mac") && "ontouchend" in document);
}

function initializeUI() {
    const fileSelectContainer = document.getElementById("select-file");
    const fileSelect = document.getElementById("file-select-button");
    const urlInput = document.getElementById("url-input");
    const makeLinkButton = document.getElementById("make-link");
    const makeEmbedButton = document.getElementById("make-embed");
    const uploadInput = document.getElementById("upload-input");
    const makeOutput = document.getElementById("make-output");
    const copy = document.getElementById("copy-to-clipboard");
    const makeResultDiv = document.getElementById("make-result");
    const emptyImageUrlProvided = document.getElementById("empty-image-url-warning");
    const downloadShareable = document.getElementById("download-shareable");
    const notImageUrlProvided = document.getElementById("not-image-url-warning");

    makeLinkButton.addEventListener('click', (e)=> {
        if (!validateImageUrl(uploadInput.value)) {
            notImageUrlProvided.style.display = "block";
        } else {
            notImageUrlProvided.style.display = "none";
        }
        if (uploadInput.value.length < 5) {
            emptyImageUrlProvided.style.display = "block";            
            makeResultDiv.style.display = "none";
        } else {
            emptyImageUrlProvided.style.display = "none";
            makeResultDiv.style.display = "block";
            const base = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
            const url = base + "render.html?url=" + encodeURIComponent(uploadInput.value) + "&size=" + state.currentDepthWidth;
            makeOutput.value = url;
        }
         e.preventDefault();
    });

    makeEmbedButton.addEventListener('click', (e)=> {
        if (!validateImageUrl(uploadInput.value)) {
            notImageUrlProvided.style.display = "block";
        } else {
            notImageUrlProvided.style.display = "none";
        }
        if (uploadInput.value.length < 5) {
            emptyImageUrlProvided.style.display = "block";            
            makeResultDiv.style.display = "none";
        } else {
            makeResultDiv.style.display = "block";
            const base = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
            const url = base + "render.html?url=" + encodeURIComponent(uploadInput.value) + "&size=" + state.currentDepthWidth;
            makeOutput.value = '<iframe width="800" height="600" src="' + url + '" scrolling="no" frameborder="0"></iframe>';
        }
         e.preventDefault();
    });

    downloadShareable.addEventListener('click', (e)=> {
        if (iOS()) {
            document.getElementById('save-image-container').style.display = "block";
            const saveImage = document.getElementById('save-image');
            saveImage.src = document.getElementById('texture-canvas').toDataURL();
            saveImage.style.display = 'block';
        } else {
            document.getElementById('save-image-container').style.display = "none";
            var link = document.createElement('a');
            link.download = 'depth_3d.png';
            link.href = document.getElementById('texture-canvas').toDataURL();
            link.click();
        }
        e.preventDefault();
    });

    copy.addEventListener('click', (e)=> {        
        navigator.clipboard.writeText(makeOutput.value);
        e.preventDefault();
    });

    document.getElementById("share-image").addEventListener("click", (e)=> {
         const shareElement = document.getElementById("share-container");
         if (shareElement.style.display == "block") {
            shareElement.style.display = "none";
         } else {
            shareElement.style.display = "block";
         }
         e.preventDefault();
    });

    fileElem = document.getElementById("file-elem");
    selectUrl = document.getElementById("select-url");
    selectUrl.addEventListener("click", (e)=>{
        if (urlInput.value.length < 5) {
            document.getElementById("empty-url-warning").style.display = "block";
        } else {
            document.getElementById("empty-url-warning").style.display = "none";
            const img = document.createElement("img");
            const processingModel = document.getElementById("processing-data-progress");
            processingModel.style.display = "block";
            fileSelectContainer.style.display = "none";
            img.crossOrigin = "Anonymous";
            img.onload = () => {
                makeDepthMap(session, img);
            }
            img.src = urlInput.value;
        }
        e.preventDefault();
    });

    fileSelect.addEventListener("click", (e) => {
            document.getElementById("empty-url-warning").style.display = "none";             
            if (fileElem) {
                fileElem.click();
            }
            e.preventDefault();
        }, false);        
        fileElem.addEventListener("change", handleFiles, false);

        function handleFiles() {
            if (this.files.length >= 1) {
                const img = document.createElement("img");
                const processingModel = document.getElementById("processing-data-progress");
                processingModel.style.display = "block";
                fileSelectContainer.style.display = "none";
                img.onload = () => {
                    document.getElementById("how-to").style.display = "none";
                    makeDepthMap(state.session, img);
                }                
                img.src = URL.createObjectURL(this.files[0]);
            }
    }

}

async function createONNXSession(modelBlob) {
    try {
        const fileSelectContainer = document.getElementById("select-file");
        const loadingModelProgess = document.getElementById("loading-model-progress");

        console.log("loading model weights");
        const session = await ort.InferenceSession.create(modelBlob);
        console.log("loading model weights - success");
        state.session = session;
        
        loadingModelProgess.style.display = "none";
        fileSelectContainer.style.display = "block";
    } catch (e) {
        document.write(`failed to inference ONNX model: ${e}.`);
    }
}


async function main() {
    initializeUI();

    fetchModelBlob(state.model.parts, createONNXSession);
}

main();

