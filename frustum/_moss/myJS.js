<!--Reference for Phong model: http://voxelent.com/html/beginners-guide/chapter_3/ch3_Sphere_Phong.html-->
<!--Reference for alpha test: http://stackoverflow.com/questions/7277047/alphafunctions-in-webgl-->
<!--Reference for multiple light sources: http://voxelent.com/html/beginners-guide/chapter_6/ch6_Wall_LightArrays.html-->
<!--Referece for WebGL basics: http://learningwebgl.com-->

var gl;
var ctx;
var shaderProgram;
var frameCount = 0;

/*
 * Transformaion matrices
 */
var mvMatrix = mat4.create();
var pMatrix = mat4.create();
var nMatrix = mat4.create();

/*
 * Buffers
 */
var vertexPositionBuffers = [];
var vertexIndexBuffers = [];
var vertexNormalBuffers = [];
var vertexTextureCoordBuffers = [];
var boxPositionBuffers = [];
var boxIndexBuffer;

var angle = 0;
var lastTime = 0;
var elapsed = 0;

/*
 * The URLs of each object's related files.
 */
var objFile;
var mtlFiles = [];
var textureFiles = []

/*
 * Variables for storing information parsed from files.
 */
var myObjs = [];
var myMtls = [];
var myLights;
var myHierarchy;

/*
 * Variables for key board control.
 */
var currentlyPressedKeys = {};
var z = -10;
var x = 0;
var y = 0;
var windowX;
var windowY;
var speed = 0;
var rDirection = 0;
var drawBox = false;
var bKeyPressed = false;
var boxNum = -1;

/*
 * The min and max of each object's x, y, z coordinates
 * [ [minX1, maxX1, minY1, maxY1, minZ1, maxZ1], [...], ... ]
 */
var boxBoundaries = [];

/*
 * An array of boolean variables that decide whether to draw a node and its subtrees
 */
var drawNode = [];;
var useFrustum = false;
window.onkeydown = function(event) {
    if (event.keyCode == 32) {
        boxNum = boxNum + 1;
    } else if (event.keyCode == 66) {
        if (boxNum == -1) {
            boxNum = 0;
        } else if (boxNum > -1) {
            boxNum = -1
        }
    }
};

function initGL(canvas) {
    try {
        gl = canvas.getContext("experimental-webgl");
        gl.viewportWidth = parseInt(document.getElementById("canvasWidth").value);
        gl.viewportHeight = parseInt(document.getElementById("canvasHeight").value);
        windowX = gl.viewportWidth;
        windowY = gl.viewportHeight;
        
        var oldCanvas = canvas.toDataURL("image/png");
        var img = new Image();
        img.src = oldCanvas;
        img.onload = function() {
            canvas.width = gl.viewportWidth;
            canvas.height = gl.viewportHeight;
        }
        
        // Create a canvas for displaying the time text
        /*
         var canvas2 = document.createElement('canvas');
         canvas2.id = 'canvas2';
         document.body.appendChild(canvas2);
         document.getElementById('canvas').appendChild(canvas2);
         */
        var canvas2 = document.getElementById("canvas2");
        ctx = canvas2.getContext("2d");
        ctx.fillStyle = "white";
    } catch (e) {}
    if (!gl) {
        alert("Could not initialise WebGL, sorry :-(");
    }
}

function getShader(gl, id) {
    var shaderScript = document.getElementById(id);
    if (!shaderScript) {
        return null;
    }
    
    var str = "";
    var k = shaderScript.firstChild;
    while (k) {
        if (k.nodeType == 3) {
            str += k.textContent;
        }
        k = k.nextSibling;
    }
    
    var shader;
    if (shaderScript.type == "x-shader/x-fragment") {
        shader = gl.createShader(gl.FRAGMENT_SHADER);
    } else if (shaderScript.type == "x-shader/x-vertex") {
        shader = gl.createShader(gl.VERTEX_SHADER);
    } else {
        return null;
    }
    
    gl.shaderSource(shader, str);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert(gl.getShaderInfoLog(shader));
        return null;
    }
    
    return shader;
}

function initShaders() {
    var fragmentShader = getShader(gl, "shader-fs");
    var vertexShader = getShader(gl, "shader-vs");
    
    shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);
    
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert("Could not initialise shaders");
    }
    
    gl.useProgram(shaderProgram);
    
    shaderProgram.vertexPositionAttribute = gl.getAttribLocation(shaderProgram, "aVertexPosition");
    gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);
    shaderProgram.vertexNormalAttribute = gl.getAttribLocation(shaderProgram, "aVertexNormal");
    gl.enableVertexAttribArray(shaderProgram.vertexNormalAttribute);
    
    shaderProgram.pMatrixUniform = gl.getUniformLocation(shaderProgram, "uPMatrix");
    shaderProgram.mvMatrixUniform = gl.getUniformLocation(shaderProgram, "uMVMatrix");
    shaderProgram.nMatrixUniform = gl.getUniformLocation(shaderProgram, "uNMatrix");
    
    shaderProgram.uLightAmbient = gl.getUniformLocation(shaderProgram, "uLightAmbient");
    shaderProgram.uLightDiffuse = gl.getUniformLocation(shaderProgram, "uLightDiffuse");
    shaderProgram.uLightSpecular = gl.getUniformLocation(shaderProgram, "uLightSpecular");
    shaderProgram.uPointLightLocation = gl.getUniformLocation(shaderProgram, "uPointLightLocation");
    
    shaderProgram.samplerUniform = gl.getUniformLocation(shaderProgram, "uSampler");
    shaderProgram.useTextureUniform = gl.getUniformLocation(shaderProgram, "uUseTexture");
    
    shaderProgram.drawBoxUniform = gl.getUniformLocation(shaderProgram, "uDrawBox");
    
    shaderProgram.uKa = gl.getUniformLocation(shaderProgram, "uKa");
    shaderProgram.uKd = gl.getUniformLocation(shaderProgram, "uKd");
    shaderProgram.uKs = gl.getUniformLocation(shaderProgram, "uKs");
    shaderProgram.uShininess = gl.getUniformLocation(shaderProgram, "uShininess");
}



/*
 * Initialize the light sources' locations and La, Ld, Ls parameters
 */
function initLight() {
    locs = [];
    Las = [];
    Lds = [];
    Lss = [];
    for (var k = 0; k < myLights.length; k++) {
        light = myLights[k];
        
        loc = [0.0, 0.0, 0.0];
        La = [1.0, 1.0, 1.0, 1.0];
        Ld = [1.0, 1.0, 1.0, 1.0];
        Ls = [1.0, 1.0, 1.0, 1.0];
        
        for (var i = 0; i < light.length; i++) {
            if (light[i][0] == "loc") {
                loc = light[i].slice(1, 4);
            } else if (light[i][0] == "La") {
                for (var j = 1; j < light[i].length; j++) {
                    La[j-1] = light[i][j];
                }
            } else if (light[i][0] == "Ld") {
                for (var j = 1; j < light[i].length; j++) {
                    Ld[j-1] = light[i][j];
                }
            } else if (light[i][0] == "Ls") {
                for (var j = 1; j < light[i].length; j++) {
                    Ls[j-1] = light[i][j];
                }
            }
        }
        locs = locs.concat(loc);
        Las = Las.concat(La);
        Lds = Lds.concat(Ld);
        Lss = Lss.concat(Ls);
    }
    gl.uniform3fv(shaderProgram.uPointLightLocation, locs);
    gl.uniform4fv(shaderProgram.uLightAmbient, Las);
    gl.uniform4fv(shaderProgram.uLightDiffuse, Lds);
    gl.uniform4fv(shaderProgram.uLightSpecular, Lss);
}



function initMaterial(Ka, Kd, Ks, shininess) {
    gl.uniform4fv(shaderProgram.uKa, Ka);
    gl.uniform4fv(shaderProgram.uKd, Kd);
    gl.uniform4fv(shaderProgram.uKs, Ks);
    gl.uniform1f(shaderProgram.uShininess, shininess);
}



/*
 * Parse the lights file
 * Input: The url of the lights file
 * Output: an array of all the lights
 * 		   format: [ [ [light1Info1], [light1Infor2], ...],
 * 					 [...] ...]
 */
function parseLights(lightsUrl) {
    var result = null;
    $.ajax({
           url: lightsUrl,
           type: 'get',
           dataType: 'text',
           async: false,
           success: function(data) {
           var lights = [];
           var currentLight = [];
           var lines = data.split("\n");
           for (var i=0; i < lines.length; i++) {
           // Split each line by blank space
           var temp = lines[i].split(' ');
           var line = [];
           for (var j = 0; j < temp.length; j++) {
           if (temp[j] != '') {
           line.push(temp[j].replace(/\s/g, ''));
           }
           }
           if (line[0] == "light") {
           if (currentLight.length > 0) {
           lights.push(currentLight);
           }
           currentLight = [];
           } else if ( (line[0] == "loc") || (line[0] == "La") || (line[0] == "Ld") || (line[0] == "Ls") ) {
           currentLight.push(line);
           }
           if (i == lines.length-1) {
           if (currentLight.length > 0) {
           lights.push(currentLight);
           }
           }
           }
           result = lights;
           }
           });
    return result;
}



/*
 * Parse the hierarchy information from a .txt file.
 * Input: The url of the hierarchy file
 * Output: an array of information for each object
 *		   format: [ [objFilrUrl, [16 floats], numChildren], ... ]
 */
function parseHierarchy(hierarchyUrl) {
    var result = null;
    $.ajax({
           url: hierarchyUrl,
           type: 'get',
           dataType: 'text',
           async: false,
           success: function(data) {
           var hierarchy = [];
           var currentObj = [];
           var lines = data.split("\n");
           
           for (var i=0; i < lines.length; i++) {
           var temp = lines[i].split(' ');
           var line = [];
           
           for (var j = 0; j < temp.length; j++) {
           if (temp[j] != '') {
           line.push(temp[j].replace(/\s/g, ''));
           }
           }
           
           if (line.length == 0) {
           if (currentObj.length > 0) {
           hierarchy.push(currentObj);
           }
           currentObj = [];
           } else {
           currentObj.push(line);
           }
           }
           
           if (currentObj.length > 0) {
           hierarchy.push(currentObj);
           }
           result = hierarchy;
           }
           });
    return result;
}




/*
 * Parse the information from .mtl file.
 * Input: The url of the .mtl file
 * Output: an array of the material information.
 *		   format: [ [mtlName1, [mtlInfo11], [mtlInfo12], ... ],
 * 					 [mtlName2, [mtlInfo21], [mtlInfo22], ... ], ... ]
 */
function parseMtl(mtlUrl) {
    var result = null;
    $.ajax({
           url: mtlUrl,
           type: 'get',
           dataType: 'text',
           async: false,
           success: function(data) {
           var materials = [];
           var useTexture = false;
           var currentGroups = [];
           var allGroups = [];
           var lines = data.split("\n");
           
           for (var i=0; i < lines.length; i++) {
           var temp = lines[i].split(' ');
           var line = [];
           
           for (var j = 0; j < temp.length; j++) {
           if (temp[j] != '') {
           line.push(temp[j].replace(/\s/g, ''));
           }
           }
           
           if ( (line[0] == "newmtl") || (line == "") ) {
           for (var j = 0; j < currentGroups.length; j++) {
           var mtlName = currentGroups[j][0];
           var mtlInfo = currentGroups[j].slice(1, currentGroups[j].length);
           if (allGroups.indexOf(mtlName) != -1) {
           for (var k = 0; k < materials.length; k++) {
           if (mtlName == materials[k][0]) {
           materials[k].push(mtlInfo);
           }
           }
           } else {
           materials.push(currentGroups[j]);
           allGroups.push(mtlName);
           }
           }
           currentGroups = [];
           if (line.length > 1) {
           for (var j = 1; j < line.length; j++) {
           var temp = [line[j]];
           currentGroups.push(temp);
           }
           }
           } else {
           if (line != "") {
           for (var j = 0; j < currentGroups.length; j++) {
           currentGroups[j].push(line);
           }
           }
           }
           if (line[0] == "map_Kd") {
           useTexture = true;
           }
           if (i == lines.length-1) {
           for (var j = 0; j < currentGroups.length; j++) {
           mtlName = currentGroups[j][0];
           mtlInfo = currentGroups[j].slice(1, currentGroups[j].length);
           if (allGroups.indexOf(mtlName) != -1) {
           for (var k = 0; k < materials.length; k++) {
           if (mtlName == aterials[k][0]) {
           materials[k].push(mtlInfo);
           }
           }
           } else {
           materials.push(currentGroups[j]);
           allGroups.push(mtlName);
           }
           }
           currentGroups = [];
           }
           }
           result = materials;
           //				gl.uniform1i(shaderProgram.useTextureUniform, useTexture);
           //				if (useTexture) {
           //			        shaderProgram.textureCoordAttribute = gl.getAttribLocation(shaderProgram, "aTextureCoord");
           //			        gl.enableVertexAttribArray(shaderProgram.textureCoordAttribute);
           //				}
           }
           });
    return result;
}



/*
 * Output:
 *	obj.v: an array of all the v's
 * 			 [ [x1,y1,z1], [x2,y2,z2], ...]
 * 	obj.vn: an array of all the vn's
 * 			  [ [x1,y1,z1], [x2,y2,z2], ...]
 *	obj.vt: an arrary of all the vt's
 * 			  [ [x1,y1,z1], [x2,y2,z2], ...]
 * 	obj.fv: an arry of the indices of vertices for each f
 *			  [ [f1v1Ind,f1v2Ind,f1v3Ind], [f2v1Ind,f2v2Ind,f2v3Ind], ...]
 *	obj.fvn: an arry of the indices of vn's for each f
 *	obj.fvt: an arry of the indices of vt's for each f
 *  obj.groups: an array of each group's corresponding faces' indices
 *				  [ [g1Name,g1f1Ind,g1f2Ind,...], [g2Name,g2f1Ind,g2f2Ind,...], ...]
 *	obj.mtls: an array of each material's corresponding faces' indices
 *				  [ [mtl1Name,mtl1f1Ind,mtl1f2Ind,...], [mtl2Name,mtl2f1Ind,mtl2f2Ind,...], ...]
 */
function parseObj(objUrl, idx) {
    result = null;
    $.ajax({
           url: objUrl,
           type: 'get',
           dataType: 'text',
           async: false,
           success: function(data) {
           obj = new Object;
           obj.v = [];
           obj.vn = [];
           obj.vt = [];
           obj.fv = [];
           obj.fvn = [];
           obj.fvt = [];
           obj.groups = [];
           obj.mtls = [];
           
           lines = data.split("\n");
           
           count = 0;			// To count the number of faces
           groupNames = [];	// The group names that have appeared before
           mtlNames = [];
           currentGroups = [];
           currentMtl = [];
           
           for (var i = 0; i < lines.length; i++) {
           // Split each line by blank space
           temp = lines[i].split(' ');
           
           // Delete empty character caused by consecutive blank spaces
           line = [];
           for (var j = 0; j < temp.length; j++) {
           if ( (temp[j] != "") && (temp[j] != " ") ) {
           // Replace empty spaces with ''. Necessary to match with mtl file.
           line.push(temp[j].replace(/\s/g, ''));
           }
           }
           
           if (line[0] == "mtllib") {
           mtlFiles[idx] = mtlFiles[idx].concat(line[1]);
           } else if (line[0] == "v") {
           obj.v.push(line.slice(1, line.length));
           } else if (line[0] == "vn") {
           obj.vn.push(line.slice(1, line.length));
           } else if (line[0] == "vt") {
           obj.vt.push(line.slice(1, line.length));
           } else if (line[0] == "f") {
           for (var j = 0; j < currentGroups.length; j++) {
           currentGroups[j].push(count);
           }
           if (currentMtl.length > 0) {
           currentMtl.push(count);
           }
           /*
            * The format for f:
            * 0--[v1Ind, v2Ind, v3Ind]
            * 1--[v1Ind//vn1Ind, v2Ind//vn2Ind, v3Ind//vn3Ind]
            * 2--[v1Ind/vt1Ind/vn1Ind, v2Ind/vt2Ind/vn2Ind, v3Ind/vt3Ind/vn3Ind]
            */
           fformat = 0;
           for (var j = 1; j < 4; j++) {
           if (line[j].indexOf("//") > -1) {
           fformat = 1;
           } else if ( (fformat == 0) && (line[j].indexOf("/") > -1) ) {
           fformat = 2;
           }
           }
           if (fformat == 2) {
           v = [];
           vt = [];
           vn = [];
           for (var j = 1; j < 4; j++) {
           temp = line[j].split("/");
           v.push(temp[0]);
           vt.push(temp[1]);
           vn.push(temp[2]);
           }
           obj.fv.push(v);
           obj.fvt.push(vt);
           obj.fvn.push(vn);
           } else if (fformat == 0) {
           obj.fv.push(line.slice(1, 4));
           } else if (fformat == 1) {
           v = [];
           vn = [];
           for (var j = 1; j < line.length; j++) {
           temp = line[j].split("//");
           v.push(temp[0]);
           vn.push(temp[1]);
           }
           obj.fv.push(v);
           obj.fvn.push(vn);
           }
           count++;
           } else if (line[0] == "g") {
           // Save currentGroups to obj.groups
           for (var j = 0; j < currentGroups.length; j++) {
           gName = currentGroups[j][0];
           if (groupNames.indexOf(gName) > -1) {
           for (var k = 0; k < obj.groups.length; k++) {
           if (gName == obj.groups[k][0]) {
           obj.groups[k].concat(currentGroups[j].slice(1,currentGroups[j].length));
           }
           }
           } else {
           obj.groups.push(currentGroups[j]);
           groupNames.push(currentGroups[j][0]);
           }
           }
           // Update currentGroups
           currentGroups = [];
           for (var j = 1; j < line.length; j++) {
           temp = [line[j]];
           currentGroups.push(temp);
           }
           } else if (line[0] == "usemtl") {
           // Save currentMtl to obj.mtls
           if (currentMtl.length > 0) {
           if (mtlNames.indexOf(currentMtl[0]) > -1) {
           for (var j = 0; j < obj.mtls.length; j++) {
           if (obj.mtls[j][0] == currentMtl[0]) {
           obj.mtls[j] = obj.mtls[j].concat(currentMtl.slice(1,currentMtl.length));
           }
           }
           } else {
           obj.mtls.push(currentMtl);
           mtlNames.push(currentMtl[0]);
           }
           }
           // Update currentMtl
           currentMtl = [line[1]];
           }
           
           // Save currentGroups and currentMtl at the end of the file
           if (i == lines.length-1) {
           for (var j = 0; j < currentGroups.length; j++) {
           gName = currentGroups[j][0];
           if (groupNames.indexOf(gName) > -1) {
           for (var k = 0; k < obj.groups.length; k++) {
           if (gName == obj.groups[k][0]) {
           obj.groups[k].concat(currentGroups[j].slice(1,currentGroups[j].length));
           }
           }
           } else {
           obj.groups.push(currentGroups[j]);
           groupNames.push(currentGroups[j][0]);
           }
           }
           if (currentMtl.length > 0) {
           if (mtlNames.indexOf(currentMtl[0]) > -1) {
           for (var j = 0; j < obj.mtls.length; j++) {
           if (obj.mtls[j][0] == currentMtl[0]) {
           obj.mtls[j].concat(currentMtl.slice(1,currentMtl.length));
           }
           }
           } else {
           obj.mtls.push(currentMtl);
           mtlNames.push(currentMtl[0]);
           }
           }
           }
           
           
           }
           // Handle the special case of cube2.obj
           if (objFile == "objs/cube2.obj") {
           obj.mtls = obj.groups;
           }
           result = obj;
           }
           });
    return result;
}


function initBuffer(myObj, idx) {
    myMtl = myMtls[idx];
    
    // The order of the elements in the following arrays correspond to the materials
    vertices = [];
    vertexNormals = [];
    textureCoords = [];
    
    fvnDefined = true;
    fvtDefined = true;
    if (myObj.fvn.length < 1) { fvnDefined = false; }
    if (myObj.fvt.length < 1) { fvtDefined = false; }
    
    // Calculate vertexNormals if the object file did not define fvn (or vn)
    faceNormals = [];		// an array of the coordinates of the normal for each f [ [x1,y1,z1], ...]
    if (fvnDefined == false) {
        // Calculate the normal of each face: in the order of fv
        vf = [];				// the indices of faces that each vertex is in
        for (var i = 0; i < myObj.v.length; i++) {
            vf.push([]);
        }
        for (var i = 0; i < myObj.fv.length; i++) {
            p1Ind = parseInt(myObj.fv[i][0]-1);
            p2Ind = myObj.fv[i][1]-1;
            p3Ind = myObj.fv[i][2]-1;
            
            vf[p1Ind].push(i);
            vf[p2Ind].push(i);
            vf[p3Ind].push(i);
            
            p1 = myObj.v[p1Ind];
            p2 = myObj.v[p2Ind];
            p3 = myObj.v[p3Ind];
            a = [];
            b = [];
            for (var j = 0; j < 3; j++) {
                a.push(p2[j] - p1[j]);
                b.push(p3[j] - p1[j]);
            }
            faceNormals.push([a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]);
        }
        
        // Calculate the normal of each vertex: the average of the normals that the vertex participates in
        vn = [];
        for (var i = 0; i < myObj.v.length; i++) {
            faces = vf[i];
            avgNormal = [0, 0, 0];
            for (var j = 0; j < faces.length; j++) {
                fNormal = faceNormals[faces[j]];
                for (var m = 0; m < 3; m++) {
                    avgNormal[m] += fNormal[m];
                }
            }
            vn.push(avgNormal);
        }
    }
    
    // Draw each material and its corresponding vertices one by one
    for (var i = 0; i < myMtl.length; i++) {
        mtl = myMtl[i];
        for (var j = 0; j < myObj.mtls.length; j++) {
            if (myObj.mtls[j][0] == mtl[0]) {
                for (var k = 1; k < myObj.mtls[j].length; k++) {
                    fv = myObj.fv[myObj.mtls[j][k]];
                    if (fvnDefined) { fvn = myObj.fvn[myObj.mtls[j][k]]; }
                    if (fvtDefined) { fvt = myObj.fvt[myObj.mtls[j][k]]; }
                    // fv, fvn, fvt all have the same length
                    for (var m = 0; m < fv.length; m++) {
                        vertices = vertices.concat(myObj.v[fv[m]-1]);
                        if (fvnDefined) {
                            vertexNormals = vertexNormals.concat(myObj.vn[fvn[m]-1]);
                        } else {
                            vertexNormals = vertexNormals.concat(vn[fv[m]-1]);
                        }
                        if (fvtDefined) { textureCoords = textureCoords.concat(myObj.vt[fvt[m]-1]); }
                    }
                }
            }
        }
        
    }
    
    
    vertexIndices = [];
    for (var j = 0; j < vertices.length/3; j++) {
        vertexIndices.push(j);
    }
    
    // Find the min, max for x, y, and z
    xBound = [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
    yBound = [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
    zBound = [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
    for (var i = 0; i < myObj.v.length; i++) {
        vertex = myObj.v[i];
        if (parseFloat(vertex[0]) < parseFloat(xBound[0])) {
            xBound[0] = vertex[0];
        }
        if (parseFloat(vertex[0]) > parseFloat(xBound[1])) {
            xBound[1] = vertex[0];
        }
        if (parseFloat(vertex[1]) < parseFloat(yBound[0])) {
            yBound[0] = vertex[1];
        }
        if (parseFloat(vertex[1]) > parseFloat(yBound[1])) {
            yBound[1] = vertex[1];
        }
        if (parseFloat(vertex[2]) < parseFloat(zBound[0])) {
            zBound[0] = vertex[2];
        }
        if (parseFloat(vertex[2]) > parseFloat(zBound[1])) {
            zBound[1] = vertex[2];
        }
    }
    currentBoxBoundary = [];
    for (var i = 0; i < xBound.length; i++) {
        currentBoxBoundary .push(parseFloat(xBound[i]));
    }
    for (var i = 0; i < yBound.length; i++) {
        currentBoxBoundary .push(parseFloat(yBound[i]));
    }
    for (var i = 0; i < zBound.length; i++) {
        currentBoxBoundary .push(parseFloat(zBound[i]));
    }
    boxBoundaries.push(currentBoxBoundary);
    
    vertexPositionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexPositionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    vertexPositionBuffer.itemSize = 3;
    vertexPositionBuffer.numItems = vertices.length / vertexPositionBuffer.itemSize;
    vertexPositionBuffers.push(vertexPositionBuffer);
    
    vertexNormalBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexNormalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertexNormals), gl.STATIC_DRAW);
    vertexNormalBuffer.itemSize = 3;
    vertexNormalBuffer.numItems = vertexNormals.length / vertexNormalBuffer.itemSize;
    vertexNormalBuffers.push(vertexNormalBuffer);
    
    vertexIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vertexIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(vertexIndices), gl.STATIC_DRAW);
    vertexIndexBuffer.itemSize = 1;
    vertexIndexBuffer.numItems = vertexIndices.length;
    vertexIndexBuffers.push(vertexIndexBuffer);
    
    if (fvtDefined) {
        vertexTextureCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexTextureCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoords), gl.STATIC_DRAW);
        vertexTextureCoordBuffer.itemSize = 3;
        vertexTextureCoordBuffer.numItems = textureCoords.length / vertexTextureCoordBuffer.itemSize;
        vertexTextureCoordBuffers.push(vertexTextureCoordBuffer);
    } else {
        vertexTextureCoordBuffers.push(null);
    }
    
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
}

function initBoxBuffers() {
    boxBoundariesCopy = boxBoundaries;
    for (var i = 0; i < boxBoundariesCopy.length; i++) {
        numChildren = parseInt(myHierarchy[i][2]);
        for (var j = 0; j < numChildren; j++) {
            // Reset the mins
            for (var k = 0; k < 3; k++) {
                if (boxBoundariesCopy[i+1+j][2*k] < boxBoundaries[i][2*k]) {
                    boxBoundaries[i][2*k] = boxBoundariesCopy[i+1+j][2*k];
                }
            }
            // Reset the maxes
            for (var k = 0; k < 3; k++) {
                if (boxBoundariesCopy[i+1+j][2*k+1] > boxBoundaries[i][2*k+1]) {
                    boxBoundaries[i][2*k+1] = boxBoundariesCopy[i+1+j][2*k+1];
                }
            }
        }
    }
    
    order = [0, 2, 4,
             0, 2, 5,
             0, 3, 4,
             0, 3, 5,
             1, 2, 4,
             1, 2, 5,
             1, 3, 4,
             1, 3, 5];
    for (var i = 0; i < boxBoundaries.length; i++) {
        boxVertices = [];
        for (var j = 0; j < order.length; j++) {
            boxVertices.push(boxBoundaries[i][order[j]]);
        }
        boxPositionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, boxPositionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(boxVertices), gl.STATIC_DRAW);
        boxPositionBuffer.itemSize = 3;
        boxPositionBuffer.numItems = boxVertices.length / boxPositionBuffer.itemSize;
        boxPositionBuffers.push(boxPositionBuffer);
    }
    
    boxIdx = [0, 1, 0, 2, 0, 4,
              1, 3, 1, 5,
              2, 3, 2, 6,
              3, 7,
              4, 5, 4, 6,
              5, 7,
              6, 7];
    boxIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, boxIndexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(boxIdx), gl.STATIC_DRAW);
    boxIndexBuffer.itemSize = 1;
    boxIndexBuffer.numItems = boxIdx.length;
}



function initTexture(textureFile) {
    texture = gl.createTexture();
    texture.image = new Image();
    texture.image.onload = function() {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
        if (isPowerOf2(texture.image.width) && isPowerOf2(texture.image.height)) {
            gl.generateMipmap(gl.TEXTURE_2D);
        } else {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        }
        gl.uniform1i(shaderProgram.samplerUniform, 0);
    }
    // The image is loaded asynchronously
    texture.image.src = textureFile;
}

function isPowerOf2(value) {
    return (value & (value-1)) == 0;
}



/*
 * Input: the data retrieved from an obj file
 * Output: an array of the coordinates of vertices that correspond to the information from faces
 * 		   eg. [-1,-1,1, -1,1,1, 1,1,1,
 *			    -1,-1,1, 1,1,1, 1,-1,1, ...]
 */
function processVertices(obj) {
    myV = obj.v;
    result = [];
    if (objFile != "objs/cube2.obj") {
        for (var i = 0; i < obj.fv.length; i++) {
            face = obj.fv[i];
            for (var j = 0; j < face.length; j++) {
                result = result.concat(myV[face[j]-1]);
            }
        }
    } else {
        for (var i = 0; i < 10; i++) {
            face = obj.fv[i];
            for (var j = 0; j < face.length; j++) {
                result = result.concat(myV[face[j]-1]);
            }
        }
    }
    return result;
}



function testFrustumCulling(boundaries) {
    // left, right, bottom, top, far, near
    frustum = [-100, 100, -100, 100, 1, 100];
    
    // Modify furstum and boudaries into an array of three pairs:
    // [minX, maxX], [minY, maxY], [minZ, maxZ]
    frustumPairs = [];
    boundariesPairs = [];
    for (var i = 0; i < 3; i++) {
        frustumPair = [];
        frustumPair.push(frustum[2*i]);
        frustumPair.push(frustum[2*i+1]);
        frustumPairs.push(frustumPair);
        
        boundariesPair = [];
        boundariesPair.push(boundaries[2*i]);
        boundariesPair.push(boundaries[2*i+1]);
        boundariesPairs.push(boundariesPair);
    }
    
    // Test if the box formed by boundaries intersects with the frustum on every axis
    temp = true;
    for (var i = 0; i < 3; i++) {
        if (Math.max(boundariesPairs[i][0], frustumPairs[i][0]) > Math.min(boundariesPairs[i][1], frustumPairs[i][1])) {
            temp = false;
        }
    }
    return temp;
}



function drawScene() {
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clearDepth(100.0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.viewport(0, 0, windowX, windowY);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    mat4.perspective(90, windowX / windowY, 0.1, 10000.0, pMatrix);
    
    gl.enableVertexAttribArray(shaderProgram.vertexNormalAttribute);
    
    for (var m = 0; m < myObjs.length; m++) {
        mat4.identity(mvMatrix);
        transformMatrix = myHierarchy[m][1];
        translateV = [parseFloat(transformMatrix[3]), parseFloat(transformMatrix[7]), parseFloat(transformMatrix[11])];
        scaleV = [];
        if (transformMatrix[0] != 0) { scaleV.push(parseFloat(transformMatrix[0])); }
        if (transformMatrix[5] != 0) { scaleV.push(parseFloat(transformMatrix[5])); }
        if (transformMatrix[10] != 0) { scaleV.push(parseFloat(transformMatrix[10])); }
        
        mat4.translate(mvMatrix, translateV);
        mat4.translate(mvMatrix, [x, y, z]);
        mat4.scale(mvMatrix, scaleV);
        
        currentBoxBoundaries = [];
        
        for (var i = 0; i < boxBoundaries[m].length; i++) {
            currentBoxBoundaries.push(boxBoundaries[m][i]);
        }
        
        for (var i = 0; i < 3; i++) {
            currentBoxBoundaries[2*i] = translateV[i] + boxBoundaries[m][2*i];
            currentBoxBoundaries[2*i+1] = translateV[i] + boxBoundaries[m][2*i+1];
            currentBoxBoundaries[2*i] = scaleV[i] * currentBoxBoundaries[2*i];
            currentBoxBoundaries[2*i+1] = scaleV[i] * currentBoxBoundaries[2*i+1];
        }
        
        if (useFrustum) {
            draw = testFrustumCulling(currentBoxBoundaries);
            drawNode[m] = draw;
        }
        
        if (drawNode[m]) {
            
            mat4.rotate(mvMatrix, rDirection * angle * Math.PI * m / 180, [0, 0, 1]);
            
            gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
            gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
            mat4.set(mvMatrix, nMatrix);
            mat4.inverse(nMatrix);
            mat4.transpose(nMatrix);
            gl.uniformMatrix4fv(shaderProgram.nMatrixUniform, false, nMatrix);
            
            myMtl = myMtls[m];
            myObj = myObjs[m];
            textureFile = textureFiles[m];
            
            gl.bindBuffer(gl.ARRAY_BUFFER, vertexPositionBuffers[m]);
            gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, vertexPositionBuffers[m].itemSize, gl.FLOAT, false, 0, 0);
            
            gl.bindBuffer(gl.ARRAY_BUFFER, vertexNormalBuffers[m]);
            gl.vertexAttribPointer(shaderProgram.vertexNormalAttribute, vertexNormalBuffers[m].itemSize, gl.FLOAT, false, 0, 0);
            
            if (myObj.fvt.length > 0) {
                gl.bindBuffer(gl.ARRAY_BUFFER, vertexTextureCoordBuffers[m]);
                gl.vertexAttribPointer(shaderProgram.textureCoordAttribute, vertexTextureCoordBuffers[m].itemSize, gl.FLOAT, false, 0, 0);
                
                gl.uniform1i(shaderProgram.useTextureUniform, true);
                shaderProgram.textureCoordAttribute = gl.getAttribLocation(shaderProgram, "aTextureCoord");
                gl.enableVertexAttribArray(shaderProgram.textureCoordAttribute);
            } else {
                gl.uniform1i(shaderProgram.useTextureUniform, false);
                shaderProgram.textureCoordAttribute = gl.getAttribLocation(shaderProgram, "aTextureCoord");
                gl.disableVertexAttribArray(shaderProgram.textureCoordAttribute);
            }
            
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, vertexIndexBuffers[m]);
            
            bufferOffset = 0;
            for (var i = 0; i < myMtl.length; i++) {
                // Check if the material is used in obj
                used = false;
                for (var j = 0; j < myObj.mtls.length; j++) {
                    if (myObj.mtls[j][0] == myMtl[i][0]) {
                        used = true;
                    }
                }
                if (used == true) {
                    mtl = myMtl[i];
                    Ka = [1.0, 1.0, 1.0, 1.0];
                    Kd = [1.0, 1.0, 1.0, 1.0];
                    Ks = [1.0, 1.0, 1.0, 1.0];
                    shininess = 20;
                    for (var j = 1; j < mtl.length; j++) {
                        if (mtl[j][0] == "Ka") {
                            Ka = [];
                            for (var k = 1; k < mtl[j].length; k++) {
                                Ka.push(mtl[j][k]);
                            }
                            Ka.push(1.0);
                        } else if (mtl[j][0] == "Kd") {
                            Kd = [];
                            for (var k = 1; k < mtl[j].length; k++) {
                                Kd.push(mtl[j][k]);
                            }
                            Kd.push(1.0);
                        } else if (mtl[j][0] == "Ks") {
                            Ks = [];
                            for (var k = 1; k < mtl[j].length; k++) {
                                Ks.push(mtl[j][k]);
                            }
                            Ks.push(1.0);
                        } else if (mtl[j][0] == "Ns") {
                            shininess = mtl[j][1];
                        } else if (mtl[j][0] == "N") {
                            shininess = mtl[j][1] / 1000.0 * 128.0;
                        } else if (mtl[j][0] == "map_Kd") {
                            temp = textureFile.concat(mtl[j][1]);
                            initTexture(temp);
                        }
                    }
                    initMaterial(Ka, Kd, Ks, shininess);
                    
                    // Get the number of vertices to draw for current material
                    numItems = 0;
                    for (var j = 0; j < myObj.mtls.length; j++) {
                        if (myObj.mtls[j][0] == mtl[0]) {
                            numItems = myObj.mtls[j].length - 1;
                        }
                    }
                    numItems = numItems * 3;
                    
                    gl.drawElements(gl.TRIANGLES, numItems, gl.UNSIGNED_SHORT, bufferOffset);
                    bufferOffset = bufferOffset + numItems * 2;
                }
            }
            
            gl.bindBuffer(gl.ARRAY_BUFFER, null);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        }
    }
    
    if (drawBox) {
        gl.uniform1i(shaderProgram.drawBoxUniform, true);
        drawBoxNum = 0;
        if (boxNum == 0) {
            drawBoxNum = myObjs.length;
        } else {
            drawBoxNum = Math.min(boxNum, myObjs.length);
        }
        
        for (var m = 0; m < drawBoxNum; m++) {
            if (drawNode[m] == true) {
                mat4.identity(mvMatrix);
                transformMatrix = myHierarchy[m][1];
                translateV = [transformMatrix[3], transformMatrix[7], transformMatrix[11]];
                scaleV = [];
                if (transformMatrix[0] != 0) { scaleV.push(transformMatrix[0]); }
                if (transformMatrix[5] != 0) { scaleV.push(transformMatrix[5]); }
                if (transformMatrix[10] != 0) { scaleV.push(transformMatrix[10]); }
                
                mat4.translate(mvMatrix, translateV);
                mat4.translate(mvMatrix, [x, y, z]);
                mat4.scale(mvMatrix, scaleV);
                mat4.rotate(mvMatrix, rDirection * angle * Math.PI * m / 180, [0, 0, 1]);
                
                gl.uniformMatrix4fv(shaderProgram.mvMatrixUniform, false, mvMatrix);
                gl.uniformMatrix4fv(shaderProgram.pMatrixUniform, false, pMatrix);
                mat4.set(mvMatrix, nMatrix);
                mat4.inverse(nMatrix);
                mat4.transpose(nMatrix);
                
                gl.uniformMatrix4fv(shaderProgram.nMatrixUniform, false, nMatrix);
                
                gl.bindBuffer(gl.ARRAY_BUFFER, boxPositionBuffers[m]);
                gl.vertexAttribPointer(shaderProgram.vertexPositionAttribute, boxPositionBuffers[m].itemSize, gl.FLOAT, false, 0, 0);
                gl.bindBuffer(gl.ARRAY_BUFFER, null)
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, boxIndexBuffer);
                gl.lineWidth(1.0);
                gl.drawElements(gl.LINES, boxIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
                
                gl.bindBuffer(gl.ARRAY_BUFFER, null);
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
            }
        }
        gl.uniform1i(shaderProgram.drawBoxUniform, false);
    }
}

function animate() {
    var timeNow = new Date().getTime();
    if (lastTime != 0) {
        elapsed = timeNow - lastTime;
        angle -= (75 * elapsed) / 1000.0;
    }
    lastTime = timeNow;
    frameCount += 1;
    if (frameCount == 10) {
        frameCount = 0;
        ctx.clearRect(0, 0, 50, 20);
        ctx.fillText(elapsed + "ms", 13, 20);
    }
}

function handleKeyDown(event) {
    currentlyPressedKeys[event.keyCode] = true;
}
function handleKeyUp(event) {
    currentlyPressedKeys[event.keyCode] = false;
}

function handleKeys() {
    if (currentlyPressedKeys[90]) {
        // Use "z" to zoom-in/scale-up the object
        windowX += 3.0;
        windowY += 3.0;
    } else if (currentlyPressedKeys[88]) {
        // Use "x" to zoom-out/scale-down the object
        windowX -= 3.0;
        windowY -= 3.0;
    } else if (currentlyPressedKeys[38]) {
        // Use "up-arrow" to move the object in +Y
        y += 0.5;
    } else if (currentlyPressedKeys[40]) {
        // Use "down-arrow" to move the object in -Y
        y -= 0.5;
    } else if (currentlyPressedKeys[39]) {
        // Use "right-arrow" to move the object in +X
        x += 0.5;
    } else if (currentlyPressedKeys[37]) {
        // Use "left-arrow" to move the object in -X
        x -= 0.5;
    } else if (currentlyPressedKeys[219]) {
        // Use "[" to move the object in +Z
        z += 0.5;
    } else if (currentlyPressedKeys[221]) {
        // Use "]" to move the object in -Z
        z -= 0.5;
    } else if (currentlyPressedKeys[81]) {
        // Use "q" to rotate the view in clockwise direction
        rDirection = 1;
    } else if (currentlyPressedKeys[87]) {
        // Use "w" to rotate the view in counter clockwise direction
        rDirection = -1;
    } else if (currentlyPressedKeys[83]) {
        // Use "s" to stop rotating
        rDirection = 0;
    } else if (currentlyPressedKeys[66]) {
        // Use "b" to show bounding boxes
        drawBox = true;
    } else if (currentlyPressedKeys[70]) {
        useFrustum = true;
    }
}



function parseURL() {
    query_string = {};
    query = window.location.search.substring(1);
    vars = query.split("&");
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split("=");
        if (typeof query_string[pair[0]] === "undefined") {
            query_string[pair[0]] = decodeURIComponent(pair[1]);
        } else if (typeof query_string[pair[0]] === "string") {
            query_string[pair[0]] = [query_string[pair[0]], decodeURIComponent(pair[1])];
        } else {
            query_string[pair[0]].push(decodeURIComponent(pair[1]));
        }
    }
    return query_string;
}



function tick() {
    requestAnimationFrame(tick);
    handleKeys();
    drawScene();
    animate();
}



function webGLStart() {
    var canvas = document.getElementById("canvas");
    
    initGL(canvas);
    initShaders();
    myLights = parseLights("lights.txt");
    initLight();
    
    hierarchyFile = "hierarchy.txt"
    myHierarchy = parseHierarchy(hierarchyFile);
    for (var i = 0; i < myHierarchy.length; i++) {
        objFile = myHierarchy[i][0];
        mtlFiles.push(objFile[0].slice(0, objFile[0].lastIndexOf("/") + 1));
        textureFiles.push(objFile[0].slice(0, objFile[0].lastIndexOf("/") + 1));
        myObjs.push(parseObj(objFile, i));
    }
    for (var i = 0; i < mtlFiles.length; i++) {
        myMtls.push(parseMtl(mtlFiles[i]));
    }
    
    for (var i = 0; i < myObjs.length; i++) {
        initBuffer(myObjs[i], i);
        drawNode.push(true);
    }
    initBoxBuffers();
    
    document.onkeydown = handleKeyDown;
    document.onkeyup = handleKeyUp;
    
    tick();
}