 
let rotation = 0.0;
let deltaTime = 0;

const modelInfo = {
    'small': {
        path: "midas_s.onnx",
        desired_width: 256,
        desired_height: 256,
    },
    'large': {
        path: "midas_l.onnx",
        desired_width: 384,
        desired_height: 384,
    }
}

function isPowerOf2(value) {
  return (value & (value - 1)) === 0;
}

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
    model: modelInfo['small'],
    session: null,
    buffers: null,
    colorTexture: null,
    depthTexture: null,
    renderScene: false,
    backgroundColor: {r: 0.04, g: 0.043, b: 0.109},
  };


function drawScene(gl, programInfo, buffers, texture, depth, rotation) {
    gl.clearColor(state.backgroundColor.r, state.backgroundColor.g, state.backgroundColor.b, 1.0);
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


function makeDepthMap(image, w, h) {
    var canvas = document.getElementById("staging-canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    var ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, image.width, image.height);
    renderDisplacementFromCanvas(ctx, w, h);
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

function hexToRgb(hex) {
    var bigint = parseInt(hex, 16);
    var r = (bigint >> 16) & 255;
    var g = (bigint >> 8) & 255;
    var b = bigint & 255;

    return {r:r, g:g, b:b};
}

function isColorDark(color){
    const darkness = 1.0 - (0.299 * color.r + 0.587 * color.g + 0.114 * color.b) / 255.0;
    if (darkness < 0.5) {
        return false;
    }else{
        return true;
    }
}

function initializeRenderUI() {
    const url = window.location.href;
    const queryString = url.split('?')[1];
    const params = new URLSearchParams(queryString);
    const backLink = params.get('back-link');
    if (backLink != null) {
        if (backLink == 'false') {
             document.getElementById('back-link-container').style.display = 'none';
        }
    }
    const colorHex = params.get('color');    
    if (colorHex != null) {

        document.body.style.background = '#' + colorHex;
        const colorRGB = hexToRgb(colorHex);
        if (isColorDark(colorRGB)) {
            document.getElementById('back-link').style.color = '#CAF0F8';
        } else {
            document.getElementById('back-link').style.color = '#03045E';
        }
        
        state.backgroundColor = {r: colorRGB.r / 255, g: colorRGB.g / 255, b: colorRGB.b / 255};
    }
    const image = document.getElementById("staging-image");
    image.onload = () => {
        const size = parseInt(params.get('size'));
        makeDepthMap(image, size, size);
    }    
    image.crossOrigin = "Anonymous";
    image.src = params.get('url');
}

async function main() {
    initializeRenderUI();
}

main();

