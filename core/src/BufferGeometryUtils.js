/**
 * @author mrdoob / http://mrdoob.com/
 */

import {
    BufferAttribute,
    BufferGeometry,
    InterleavedBuffer,
    InterleavedBufferAttribute,
    TriangleFanDrawMode,
    TriangleStripDrawMode,
    TrianglesDrawMode,
    Vector2,
    Vector3
} from "three";

let BufferGeometryUtils = {
    computeTangents: function (geometry) {
        let index = geometry.index;
        let attributes = geometry.attributes;

        // based on http://www.terathon.com/code/tangent.html
        // (per vertex tangents)

        if (
            index === null ||
            attributes.position === undefined ||
            attributes.normal === undefined ||
            attributes.uv === undefined
        ) {
            console.error(
                "THREE.BufferGeometryUtils: .computeTangents() failed. Missing required attributes (index, position, normal or uv)"
            );
            return;
        }

        let indices = index.array;
        let positions = attributes.position.array;
        let normals = attributes.normal.array;
        let uvs = attributes.uv.array;

        let nVertices = positions.length / 3;

        if (attributes.tangent === undefined) {
            geometry.setAttribute("tangent", new BufferAttribute(new Float32Array(4 * nVertices), 4));
        }

        let tangents = attributes.tangent.array;

        let tan1 = [],
            tan2 = [];

        for (let i = 0; i < nVertices; i++) {
            tan1[i] = new Vector3();
            tan2[i] = new Vector3();
        }

        let vA = new Vector3(),
            vB = new Vector3(),
            vC = new Vector3(),
            uvA = new Vector2(),
            uvB = new Vector2(),
            uvC = new Vector2(),
            sdir = new Vector3(),
            tdir = new Vector3();

        function handleTriangle(a, b, c) {
            vA.fromArray(positions, a * 3);
            vB.fromArray(positions, b * 3);
            vC.fromArray(positions, c * 3);

            uvA.fromArray(uvs, a * 2);
            uvB.fromArray(uvs, b * 2);
            uvC.fromArray(uvs, c * 2);

            vB.sub(vA);
            vC.sub(vA);

            uvB.sub(uvA);
            uvC.sub(uvA);

            let r = 1.0 / (uvB.x * uvC.y - uvC.x * uvB.y);

            // silently ignore degenerate uv triangles having coincident or colinear vertices

            if (!isFinite(r)) return;

            sdir.copy(vB).multiplyScalar(uvC.y).addScaledVector(vC, -uvB.y).multiplyScalar(r);
            tdir.copy(vC).multiplyScalar(uvB.x).addScaledVector(vB, -uvC.x).multiplyScalar(r);

            tan1[a].add(sdir);
            tan1[b].add(sdir);
            tan1[c].add(sdir);

            tan2[a].add(tdir);
            tan2[b].add(tdir);
            tan2[c].add(tdir);
        }

        let groups = geometry.groups;

        if (groups.length === 0) {
            groups = [
                {
                    start: 0,
                    count: indices.length
                }
            ];
        }

        for (let i = 0, il = groups.length; i < il; ++i) {
            let group = groups[i];

            let start = group.start;
            let count = group.count;

            for (let j = start, jl = start + count; j < jl; j += 3) {
                handleTriangle(indices[j + 0], indices[j + 1], indices[j + 2]);
            }
        }

        let tmp = new Vector3(),
            tmp2 = new Vector3();
        let n = new Vector3(),
            n2 = new Vector3();
        let w, t, test;

        function handleVertex(v) {
            n.fromArray(normals, v * 3);
            n2.copy(n);

            t = tan1[v];

            // Gram-Schmidt orthogonalize

            tmp.copy(t);
            tmp.sub(n.multiplyScalar(n.dot(t))).normalize();

            // Calculate handedness

            tmp2.crossVectors(n2, t);
            test = tmp2.dot(tan2[v]);
            w = test < 0.0 ? -1.0 : 1.0;

            tangents[v * 4] = tmp.x;
            tangents[v * 4 + 1] = tmp.y;
            tangents[v * 4 + 2] = tmp.z;
            tangents[v * 4 + 3] = w;
        }

        for (let i = 0, il = groups.length; i < il; ++i) {
            let group = groups[i];

            let start = group.start;
            let count = group.count;

            for (let j = start, jl = start + count; j < jl; j += 3) {
                handleVertex(indices[j + 0]);
                handleVertex(indices[j + 1]);
                handleVertex(indices[j + 2]);
            }
        }
    },

    /**
     * @param  {Array<BufferGeometry>} geometries
     * @param  {Boolean} useGroups
     * @return {BufferGeometry}
     */
    mergeBufferGeometries: function (geometries, useGroups) {
        let isIndexed = geometries[0].index !== null;

        let attributesUsed = new Set(Object.keys(geometries[0].attributes));
        let morphAttributesUsed = new Set(Object.keys(geometries[0].morphAttributes));

        let attributes = {};
        let morphAttributes = {};

        let morphTargetsRelative = geometries[0].morphTargetsRelative;

        let mergedGeometry = new BufferGeometry();

        let offset = 0;

        for (let i = 0; i < geometries.length; ++i) {
            let geometry = geometries[i];
            let attributesCount = 0;

            // ensure that all geometries are indexed, or none

            if (isIndexed !== (geometry.index !== null)) {
                console.error(
                    "THREE.BufferGeometryUtils: .mergeBufferGeometries() failed with geometry at index " +
                        i +
                        ". All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them."
                );
                return null;
            }

            // gather attributes, exit early if they're different

            for (let name in geometry.attributes) {
                if (!attributesUsed.has(name)) {
                    console.error(
                        "THREE.BufferGeometryUtils: .mergeBufferGeometries() failed with geometry at index " +
                            i +
                            '. All geometries must have compatible attributes; make sure "' +
                            name +
                            '" attribute exists among all geometries, or in none of them.'
                    );
                    return null;
                }

                if (attributes[name] === undefined) attributes[name] = [];

                attributes[name].push(geometry.attributes[name]);

                attributesCount++;
            }

            // ensure geometries have the same number of attributes

            if (attributesCount !== attributesUsed.size) {
                console.error(
                    "THREE.BufferGeometryUtils: .mergeBufferGeometries() failed with geometry at index " +
                        i +
                        ". Make sure all geometries have the same number of attributes."
                );
                return null;
            }

            // gather morph attributes, exit early if they're different

            if (morphTargetsRelative !== geometry.morphTargetsRelative) {
                console.error(
                    "THREE.BufferGeometryUtils: .mergeBufferGeometries() failed with geometry at index " +
                        i +
                        ". .morphTargetsRelative must be consistent throughout all geometries."
                );
                return null;
            }

            for (let name in geometry.morphAttributes) {
                if (!morphAttributesUsed.has(name)) {
                    console.error(
                        "THREE.BufferGeometryUtils: .mergeBufferGeometries() failed with geometry at index " +
                            i +
                            ".  .morphAttributes must be consistent throughout all geometries."
                    );
                    return null;
                }

                if (morphAttributes[name] === undefined) morphAttributes[name] = [];

                morphAttributes[name].push(geometry.morphAttributes[name]);
            }

            // gather .userData

            mergedGeometry.userData.mergedUserData = mergedGeometry.userData.mergedUserData || [];
            mergedGeometry.userData.mergedUserData.push(geometry.userData);

            if (useGroups) {
                let count;

                if (isIndexed) {
                    count = geometry.index.count;
                } else if (geometry.attributes.position !== undefined) {
                    count = geometry.attributes.position.count;
                } else {
                    console.error(
                        "THREE.BufferGeometryUtils: .mergeBufferGeometries() failed with geometry at index " +
                            i +
                            ". The geometry must have either an index or a position attribute"
                    );
                    return null;
                }

                mergedGeometry.addGroup(offset, count, i);

                offset += count;
            }
        }

        // merge indices

        if (isIndexed) {
            let indexOffset = 0;
            let mergedIndex = [];

            for (let i = 0; i < geometries.length; ++i) {
                let index = geometries[i].index;

                for (let j = 0; j < index.count; ++j) {
                    mergedIndex.push(index.getX(j) + indexOffset);
                }

                indexOffset += geometries[i].attributes.position.count;
            }

            mergedGeometry.setIndex(mergedIndex);
        }

        // merge attributes

        for (let name in attributes) {
            let mergedAttribute = this.mergeBufferAttributes(attributes[name]);

            if (!mergedAttribute) {
                console.error(
                    "THREE.BufferGeometryUtils: .mergeBufferGeometries() failed while trying to merge the " +
                        name +
                        " attribute."
                );
                return null;
            }

            mergedGeometry.setAttribute(name, mergedAttribute);
        }

        // merge morph attributes

        for (let name in morphAttributes) {
            let numMorphTargets = morphAttributes[name][0].length;

            if (numMorphTargets === 0) break;

            mergedGeometry.morphAttributes = mergedGeometry.morphAttributes || {};
            mergedGeometry.morphAttributes[name] = [];

            for (let i = 0; i < numMorphTargets; ++i) {
                let morphAttributesToMerge = [];

                for (let j = 0; j < morphAttributes[name].length; ++j) {
                    morphAttributesToMerge.push(morphAttributes[name][j][i]);
                }

                let mergedMorphAttribute = this.mergeBufferAttributes(morphAttributesToMerge);

                if (!mergedMorphAttribute) {
                    console.error(
                        "THREE.BufferGeometryUtils: .mergeBufferGeometries() failed while trying to merge the " +
                            name +
                            " morphAttribute."
                    );
                    return null;
                }

                mergedGeometry.morphAttributes[name].push(mergedMorphAttribute);
            }
        }

        return mergedGeometry;
    },

    /**
     * @param {Array<BufferAttribute>} attributes
     * @return {BufferAttribute}
     */
    mergeBufferAttributes: function (attributes) {
        let TypedArray;
        let itemSize;
        let normalized;
        let arrayLength = 0;

        for (let i = 0; i < attributes.length; ++i) {
            let attribute = attributes[i];

            if (attribute.isInterleavedBufferAttribute) {
                console.error(
                    "THREE.BufferGeometryUtils: .mergeBufferAttributes() failed. InterleavedBufferAttributes are not supported."
                );
                return null;
            }

            if (TypedArray === undefined) TypedArray = attribute.array.constructor;
            if (TypedArray !== attribute.array.constructor) {
                console.error(
                    "THREE.BufferGeometryUtils: .mergeBufferAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes."
                );
                return null;
            }

            if (itemSize === undefined) itemSize = attribute.itemSize;
            if (itemSize !== attribute.itemSize) {
                console.error(
                    "THREE.BufferGeometryUtils: .mergeBufferAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes."
                );
                return null;
            }

            if (normalized === undefined) normalized = attribute.normalized;
            if (normalized !== attribute.normalized) {
                console.error(
                    "THREE.BufferGeometryUtils: .mergeBufferAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes."
                );
                return null;
            }

            arrayLength += attribute.array.length;
        }

        let array = new TypedArray(arrayLength);
        let offset = 0;

        for (let i = 0; i < attributes.length; ++i) {
            array.set(attributes[i].array, offset);

            offset += attributes[i].array.length;
        }

        return new BufferAttribute(array, itemSize, normalized);
    },

    /**
     * @param {Array<BufferAttribute>} attributes
     * @return {Array<InterleavedBufferAttribute>}
     */
    interleaveAttributes: function (attributes) {
        // Interleaves the provided attributes into an InterleavedBuffer and returns
        // a set of InterleavedBufferAttributes for each attribute
        let TypedArray;
        let arrayLength = 0;
        let stride = 0;

        // calculate the the length and type of the interleavedBuffer
        for (let i = 0, l = attributes.length; i < l; ++i) {
            let attribute = attributes[i];

            if (TypedArray === undefined) TypedArray = attribute.array.constructor;
            if (TypedArray !== attribute.array.constructor) {
                console.error("AttributeBuffers of different types cannot be interleaved");
                return null;
            }

            arrayLength += attribute.array.length;
            stride += attribute.itemSize;
        }

        // Create the set of buffer attributes
        let interleavedBuffer = new InterleavedBuffer(new TypedArray(arrayLength), stride);
        let offset = 0;
        let res = [];
        let getters = ["getX", "getY", "getZ", "getW"];
        let setters = ["setX", "setY", "setZ", "setW"];

        for (let j = 0, l = attributes.length; j < l; j++) {
            let attribute = attributes[j];
            let itemSize = attribute.itemSize;
            let count = attribute.count;
            let iba = new InterleavedBufferAttribute(interleavedBuffer, itemSize, offset, attribute.normalized);
            res.push(iba);

            offset += itemSize;

            // Move the data for each attribute into the new interleavedBuffer
            // at the appropriate offset
            for (let c = 0; c < count; c++) {
                for (let k = 0; k < itemSize; k++) {
                    iba[setters[k]](c, attribute[getters[k]](c));
                }
            }
        }

        return res;
    },

    /**
     * @param {Array<BufferGeometry>} geometry
     * @return {number}
     */
    estimateBytesUsed: function (geometry) {
        // Return the estimated memory used by this geometry in bytes
        // Calculate using itemSize, count, and BYTES_PER_ELEMENT to account
        // for InterleavedBufferAttributes.
        let mem = 0;
        for (let name in geometry.attributes) {
            let attr = geometry.getAttribute(name);
            mem += attr.count * attr.itemSize * attr.array.BYTES_PER_ELEMENT;
        }

        let indices = geometry.getIndex();
        mem += indices ? indices.count * indices.itemSize * indices.array.BYTES_PER_ELEMENT : 0;
        return mem;
    },

    /**
     * @param {BufferGeometry} geometry
     * @param {number} tolerance
     * @return {BufferGeometry>}
     */
    mergeVertices: function (geometry, tolerance = 1e-4) {
        tolerance = Math.max(tolerance, Number.EPSILON);

        // Generate an index buffer if the geometry doesn't have one, or optimize it
        // if it's already available.
        let hashToIndex = {};
        let indices = geometry.getIndex();
        let positions = geometry.getAttribute("position");
        let vertexCount = indices ? indices.count : positions.count;

        // next value for triangle indices
        let nextIndex = 0;

        // attributes and new attribute arrays
        let attributeNames = Object.keys(geometry.attributes);
        let attrArrays = {};
        let morphAttrsArrays = {};
        let newIndices = [];
        let getters = ["getX", "getY", "getZ", "getW"];

        // initialize the arrays
        for (let i = 0, l = attributeNames.length; i < l; i++) {
            let name = attributeNames[i];

            attrArrays[name] = [];

            let morphAttr = geometry.morphAttributes[name];
            if (morphAttr) {
                morphAttrsArrays[name] = new Array(morphAttr.length).fill().map(() => []);
            }
        }

        // convert the error tolerance to an amount of decimal places to truncate to
        let decimalShift = Math.log10(1 / tolerance);
        let shiftMultiplier = Math.pow(10, decimalShift);
        for (let i = 0; i < vertexCount; i++) {
            let index = indices ? indices.getX(i) : i;

            // Generate a hash for the vertex attributes at the current index 'i'
            let hash = "";
            for (let j = 0, l = attributeNames.length; j < l; j++) {
                let name = attributeNames[j];
                let attribute = geometry.getAttribute(name);
                let itemSize = attribute.itemSize;

                for (let k = 0; k < itemSize; k++) {
                    // double tilde truncates the decimal value
                    hash += `${~~(attribute[getters[k]](index) * shiftMultiplier)},`;
                }
            }

            // Add another reference to the vertex if it's already
            // used by another index
            if (hash in hashToIndex) {
                newIndices.push(hashToIndex[hash]);
            } else {
                // copy data to the new index in the attribute arrays
                for (let j = 0, l = attributeNames.length; j < l; j++) {
                    let name = attributeNames[j];
                    let attribute = geometry.getAttribute(name);
                    let morphAttr = geometry.morphAttributes[name];
                    let itemSize = attribute.itemSize;
                    let newarray = attrArrays[name];
                    let newMorphArrays = morphAttrsArrays[name];

                    for (let k = 0; k < itemSize; k++) {
                        let getterFunc = getters[k];
                        newarray.push(attribute[getterFunc](index));

                        if (morphAttr) {
                            for (let m = 0, ml = morphAttr.length; m < ml; m++) {
                                newMorphArrays[m].push(morphAttr[m][getterFunc](index));
                            }
                        }
                    }
                }

                hashToIndex[hash] = nextIndex;
                newIndices.push(nextIndex);
                nextIndex++;
            }
        }

        // Generate typed arrays from new attribute arrays and update
        // the attributeBuffers
        const result = geometry.clone();
        for (let i = 0, l = attributeNames.length; i < l; i++) {
            let name = attributeNames[i];
            let oldAttribute = geometry.getAttribute(name);

            let buffer = new oldAttribute.array.constructor(attrArrays[name]);
            let attribute = new BufferAttribute(buffer, oldAttribute.itemSize, oldAttribute.normalized);

            result.setAttribute(name, attribute);

            // Update the attribute arrays
            if (name in morphAttrsArrays) {
                for (let j = 0; j < morphAttrsArrays[name].length; j++) {
                    let oldMorphAttribute = geometry.morphAttributes[name][j];

                    let buffer = new oldMorphAttribute.array.constructor(morphAttrsArrays[name][j]);
                    let morphAttribute = new BufferAttribute(
                        buffer,
                        oldMorphAttribute.itemSize,
                        oldMorphAttribute.normalized
                    );
                    result.morphAttributes[name][j] = morphAttribute;
                }
            }
        }

        // indices

        result.setIndex(newIndices);

        return result;
    },

    /**
     * @param {BufferGeometry} geometry
     * @param {number} drawMode
     * @return {BufferGeometry>}
     */
    toTrianglesDrawMode: function (geometry, drawMode) {
        if (drawMode === TrianglesDrawMode) {
            console.warn("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Geometry already defined as triangles.");
            return geometry;
        }

        if (drawMode === TriangleFanDrawMode || drawMode === TriangleStripDrawMode) {
            let index = geometry.getIndex();

            // generate index if not present

            if (index === null) {
                let indices = [];

                let position = geometry.getAttribute("position");

                if (position !== undefined) {
                    for (let i = 0; i < position.count; i++) {
                        indices.push(i);
                    }

                    geometry.setIndex(indices);
                    index = geometry.getIndex();
                } else {
                    console.error(
                        "THREE.BufferGeometryUtils.toTrianglesDrawMode(): Undefined position attribute. Processing not possible."
                    );
                    return geometry;
                }
            }

            //

            let numberOfTriangles = index.count - 2;
            let newIndices = [];

            if (drawMode === TriangleFanDrawMode) {
                // gl.TRIANGLE_FAN

                for (let i = 1; i <= numberOfTriangles; i++) {
                    newIndices.push(index.getX(0));
                    newIndices.push(index.getX(i));
                    newIndices.push(index.getX(i + 1));
                }
            } else {
                // gl.TRIANGLE_STRIP

                for (let i = 0; i < numberOfTriangles; i++) {
                    if (i % 2 === 0) {
                        newIndices.push(index.getX(i));
                        newIndices.push(index.getX(i + 1));
                        newIndices.push(index.getX(i + 2));
                    } else {
                        newIndices.push(index.getX(i + 2));
                        newIndices.push(index.getX(i + 1));
                        newIndices.push(index.getX(i));
                    }
                }
            }

            if (newIndices.length / 3 !== numberOfTriangles) {
                console.error(
                    "THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unable to generate correct amount of triangles."
                );
            }

            // build final geometry

            let newGeometry = geometry.clone();
            newGeometry.setIndex(newIndices);
            newGeometry.clearGroups();

            return newGeometry;
        } else {
            console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unknown draw mode:", drawMode);
            return geometry;
        }
    }
};

export { BufferGeometryUtils };
