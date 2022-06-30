import {
    addMatrix3,
    applyColor,
    hexColorToVector,
    projectOntoCube,
    randomHexColor,
    valueToColor
} from "./helperFunctions.js";
import random from "./random.js";
import createEllipsoid from "./ellipsoid.js";
import THREE from "./three.js";
import plyParser from "./plyParser.js";

const {
    Vector3,
    MeshPhongMaterial,
    LineBasicMaterial,
    BufferGeometry,
    Line,
    Mesh,
    SphereBufferGeometry,
    VertexColors,
    DoubleSide,
    Geometry,
    Face3,
    InstancedMesh,
    BufferAttribute
} = THREE;

import { BufferGeometryUtils } from "./BufferGeometryUtils.js";

const computeCollisionTree = (ellipsoids, minDist) => {
    if (ellipsoids.length === 1)
        return {
            ellipsoid: ellipsoids[0],
            aabb: ellipsoids[0].boundingBox(minDist),
            containsPoint: p => ellipsoids[0].containsPoint(p)
        };
    const a = computeCollisionTree(ellipsoids.slice(0, Math.ceil(ellipsoids.length / 2)), minDist);
    const b = computeCollisionTree(ellipsoids.slice(Math.ceil(ellipsoids.length / 2)), minDist);
    const aabb = a.aabb.clone().union(b.aabb);
    return {
        a: a,
        b: b,
        aabb: aabb,
        containsPoint: p => {
            if (!aabb.containsPoint(p)) return false;
            return a.containsPoint(p) || b.containsPoint(p);
        }
    };
};

const collision = (a, b, minDist, maxOverlap) => {
    if (!a.aabb.intersectsBox(b.aabb)) return;
    if (b.ellipsoid) {
        if (a.ellipsoid) return a.ellipsoid.collision(b.ellipsoid, minDist, maxOverlap);
        return collision(b, a, minDist, maxOverlap);
    }
    const f1 = () => collision(b.a, a, minDist, maxOverlap);
    const f2 = () => collision(b.b, a, minDist, maxOverlap);
    if (random() < 0.5) {
        f1();
        f2();
    } else {
        f2();
        f1();
    }
};

const getOverlap = (a, b, minDist, maxOverlap) => {
    if (!a.aabb.intersectsBox(b.aabb)) return 0;
    if (b.ellipsoid) {
        if (a.ellipsoid) return a.ellipsoid.getOverlap(b.ellipsoid, minDist, maxOverlap);
        return getOverlap(b, a, minDist, maxOverlap);
    }
    return Math.max(getOverlap(b.a, a, minDist, maxOverlap), getOverlap(b.b, a, minDist, maxOverlap));
};

const generatePipeUtil = (ellipsoids, color, gFactor, resolution, viewSizes, minAndMaxDiameter) => {
    const getSP = (pos, dir, i, scale) => {
        const shape = ellipsoids[i].shape;
        ellipsoids[i].shape = shape.clone().multiplyScalar(scale);
        const sp = ellipsoids[i].getSurfacePoint(pos, dir);
        ellipsoids[i].shape = shape;
        return sp;
    };
    const d = ellipsoids[ellipsoids.length - 1].pos.clone().sub(ellipsoids[0].pos);
    d.normalize();
    const x = new Vector3(1, 0, 0);
    const y = new Vector3(0, 1, 0);
    const cx = d.clone().cross(x);
    const cy = d.clone().cross(y);
    const a = cx.length() > cy.length() ? cx : cy;
    a.normalize();
    const b = d.clone().cross(a).normalize();
    const verts = ellipsoids.map((ellipsoid, i) => {
        return new Array(resolution).fill(true).map((r, j) => {
            const angle = (2 * Math.PI * j) / resolution;
            const dir = a
                .clone()
                .multiplyScalar(Math.cos(angle))
                .add(b.clone().multiplyScalar(Math.sin(angle)));
            let sp = getSP(ellipsoid.pos, dir, i, gFactor);
            let dist = sp.clone().sub(ellipsoid.pos).dot(dir);
            for (let i2 = i + 1; i2 < ellipsoids.length; ++i2) {
                let sp2 = getSP(ellipsoid.pos, dir, i2, gFactor);
                if (!sp2) break;
                let dist2 = sp2.clone().sub(ellipsoid.pos).dot(dir);
                if (dist2 < dist) continue;
                sp = sp2;
                dist = dist2;
            }
            for (let i2 = i - 1; i2 >= 0; --i2) {
                let sp2 = getSP(ellipsoid.pos, dir, i2, gFactor);
                if (!sp2) break;
                let dist2 = sp2.clone().sub(ellipsoid.pos).dot(dir);
                if (dist2 < dist) continue;
                sp = sp2;
                dist = dist2;
            }
            return sp;
        });
    });
    const geom = new Geometry();
    geom.vertices = verts.flat();
    geom.faces = verts
        .slice(0, verts.length - 1)
        .map((verti, i) => {
            const c0 = viewSizes
                ? valueToColor(
                      ellipsoids[i].crossSectionDiameter(
                          ellipsoids[Math.min(i + 1, ellipsoids.length - 1)].pos
                              .clone()
                              .sub(ellipsoids[Math.max(i - 1, 0)].pos)
                      ),
                      minAndMaxDiameter
                  )
                : hexColorToVector(color);
            const c1 = viewSizes
                ? valueToColor(
                      ellipsoids[i + 1].crossSectionDiameter(
                          ellipsoids[Math.min(i + 2, ellipsoids.length - 1)].pos
                              .clone()
                              .sub(ellipsoids[Math.max(i, 0)].pos)
                      ),
                      minAndMaxDiameter
                  )
                : hexColorToVector(color);
            return verti.map((vertij, j) => {
                const i00 = i * resolution + j;
                const i01 = i * resolution + ((j + 1) % resolution);
                const i10 = (i + 1) * resolution + j;
                const i11 = (i + 1) * resolution + ((j + 1) % resolution);
                const a = new Face3(i00, i01, i10);
                const b = new Face3(i10, i01, i11);
                a.vertexColors = [c0, c0, c1];
                b.vertexColors = [c1, c0, c1];
                return [a, b];
            });
        })
        .flat()
        .flat();
    geom.computeVertexNormals();
    const bg = new BufferGeometry().fromGeometry(geom);
    const result = new Mesh(
        BufferGeometryUtils.mergeVertices(bg),
        new MeshPhongMaterial({ vertexColors: VertexColors, side: DoubleSide })
    );
    geom.dispose();
    bg.dispose();
    return result;
};

const createAxon = (pos, dir, radius, color, gFactor, { deformation, minDiameter, ellipsoidDensity, voxelSize }) => {
    const axon = {
        start: projectOntoCube(pos, dir, voxelSize),
        end: projectOntoCube(pos, dir.clone().negate(), voxelSize),
        gFactor: gFactor || 1,
        ellipsoidDensity,
        voxelSize,
        deformation,
        minDiameter,
        color: color || randomHexColor(),
        meshes: []
    };
    axon.radius = radius / axon.gFactor;
    axon.ellipsoids = [
        createEllipsoid(axon.start, axon.radius, deformation, minDiameter, 1, axon.color, false),
        createEllipsoid(axon.end, axon.radius, deformation, minDiameter, 1, axon.color, false)
    ];
    const dispose = () => {
        axon.ellipsoids.forEach(e => e.dispose());
        axon.meshes.forEach(mesh => {
            mesh.geometry.dispose();
            mesh.material.dispose();
        });
    };
    const keepInVoxel = minDist => {
        const a = axon.ellipsoids[0];
        const b = axon.ellipsoids[axon.ellipsoids.length - 1];
        axon.ellipsoids.slice(1, axon.ellipsoids.length - 1).forEach(ellipsoid => {
            const axisLengthA = ellipsoid.getOverlap(a, minDist, 0);
            const axisLengthB = ellipsoid.getOverlap(b, minDist, 0);
            const entireCell = axisLengthA <= 0 && axisLengthB <= 0;
            ellipsoid.keepInVoxel(axon.voxelSize, minDist, entireCell);
        });
        [a, b].forEach(ellipsoid => {
            const min = Math.min(
                ...ellipsoid.pos.toArray().map((v, i) => axon.voxelSize.getComponent(i) / 2 - Math.abs(v))
            );
            ellipsoid.pos.fromArray(
                ellipsoid.pos
                    .toArray()
                    .map((v, i) =>
                        axon.voxelSize.getComponent(i) / 2 - Math.abs(v) === min
                            ? (v = Math.sign(v) * (axon.voxelSize.getComponent(i) / 2))
                            : v
                    )
            );
        });
    };
    const getMinAndMaxDiameter = () => {
        const d = axon.ellipsoids.map((e, i) =>
            e.crossSectionDiameter(
                axon.ellipsoids[Math.min(i + 1, axon.ellipsoids.length - 1)].pos
                    .clone()
                    .sub(axon.ellipsoids[Math.max(i - 1, 0)].pos)
            )
        );
        return { min: Math.min(...d), max: Math.max(...d) };
    };
    const grow = amount => {
        axon.ellipsoids.forEach(ellipsoid => ellipsoid.grow(amount));
    };
    const redistribute = () => {
        const length = getLength();
        const ellipsoidCount = 1 + Math.max(Math.ceil(length * (axon.ellipsoidDensity / (2 * axon.radius))), 1);
        const dLength = length / (ellipsoidCount - 1);
        let d = 0;
        let index = 0;
        axon.ellipsoids = [...Array(ellipsoidCount)].map(() => {
            while (index + 2 < axon.ellipsoids.length) {
                const l = axon.ellipsoids[index].pos
                    .clone()
                    .sub(axon.ellipsoids[index + 1].pos)
                    .length();
                if (d < l) break;
                d -= l;
                ++index;
            }
            const w =
                d /
                axon.ellipsoids[index].pos
                    .clone()
                    .sub(axon.ellipsoids[index + 1].pos)
                    .length();
            const e = createEllipsoid(
                axon.ellipsoids[index].pos
                    .clone()
                    .multiplyScalar(1 - w)
                    .add(axon.ellipsoids[index + 1].pos.clone().multiplyScalar(w)),
                axon.radius,
                axon.deformation,
                axon.minDiameter,
                1,
                axon.color,
                false
            );
            e.shape = addMatrix3(
                axon.ellipsoids[index].shape.clone().multiplyScalar(1 - w),
                axon.ellipsoids[index + 1].shape.clone().multiplyScalar(w)
            );
            d += dLength;
            return e;
        });
    };
    const contract = amount => {
        for (let i = 1; i + 1 < axon.ellipsoids.length; ++i) {
            const c = axon.ellipsoids[i + 1].pos
                .clone()
                .add(axon.ellipsoids[i - 1].pos)
                .divideScalar(2);
            const d = axon.ellipsoids[i + 1].pos.clone().sub(axon.ellipsoids[i - 1].pos);
            d.normalize();
            c.sub(axon.ellipsoids[i].pos);
            d.multiplyScalar(c.dot(d));
            c.sub(d);
            axon.ellipsoids[i].pos.add(c.multiplyScalar(amount));
        }
        redistribute();
    };
    const getLength = () => {
        let result = 0;
        for (let i = 0; i + 1 < axon.ellipsoids.length; ++i)
            result += axon.ellipsoids[i].pos
                .clone()
                .sub(axon.ellipsoids[i + 1].pos)
                .length();
        return result;
    };
    const getSurfacePoint = (pos, dir) => {
        return axon.ellipsoids.reduce((pMax, ellipsoid) => {
            const p = ellipsoid.getSurfacePoint(pos, dir);
            if (!pMax) return p;
            const distMax = pMax.clone().sub(pos).dot(dir);
            if (!p) return pMax;
            const dist = p.clone().sub(pos).dot(dir);
            return dist > distMax ? p : pMax;
        }, undefined);
    };
    const generatePipe = (gFactor, resolution, extended, viewSizes, minAndMaxDiameter) => {
        if (!extended)
            return generatePipeUtil(axon.ellipsoids, axon.color, gFactor, resolution, viewSizes, minAndMaxDiameter);
        const firstPos = axon.ellipsoids[0].pos;
        const lastPos = axon.ellipsoids[axon.ellipsoids.length - 1].pos;
        const d = lastPos.clone().sub(firstPos).normalize();
        const n = new Vector3(1, 0, 0).cross(d).normalize();
        const ellipsoids = [];
        for (let i = axon.ellipsoids.length - 1; i > 1; --i) {
            const e = axon.ellipsoids[i].clone();
            e.pos.sub(firstPos).applyAxisAngle(n, Math.PI).add(firstPos);
            ellipsoids.push(e);
        }
        for (let i = 0; i < axon.ellipsoids.length; ++i) {
            const e = axon.ellipsoids[i].clone();
            ellipsoids.push(e);
        }
        for (let i = axon.ellipsoids.length - 1; i > 1; --i) {
            const e = axon.ellipsoids[i].clone();
            e.pos.sub(lastPos).applyAxisAngle(n, Math.PI).add(lastPos);
            ellipsoids.push(e);
        }
        return generatePipeUtil(ellipsoids, axon.color, gFactor, resolution, viewSizes, minAndMaxDiameter);
    };
    const generatePipes = (scene, resolution, extended, viewSizes, minAndMaxDiameter) => {
        const outer = generatePipe(1, resolution, extended, viewSizes, minAndMaxDiameter);
        const inner = generatePipe(axon.gFactor, resolution, extended, viewSizes, minAndMaxDiameter);
        scene.add(outer);
        scene.add(inner);
        axon.meshes.forEach(mesh => {
            mesh.geometry.dispose();
            mesh.material.dispose();
        });
        axon.meshes = [outer, inner];
    };
    const generateSkeleton = (scene, viewSizes, minAndMaxDiameter) => {
        let geometry = new BufferGeometry().setFromPoints(axon.ellipsoids.map(ellipsoid => ellipsoid.pos));
        if (viewSizes) {
            const colors = axon.ellipsoids
                .map((e, i) =>
                    valueToColor(
                        e.crossSectionDiameter(
                            axon.ellipsoids[Math.min(i + 1, axon.ellipsoids.length - 1)].pos
                                .clone()
                                .sub(axon.ellipsoids[Math.max(i - 1, 0)].pos)
                        ) * axon.gFactor,
                        minAndMaxDiameter
                    ).toArray()
                )
                .flat();
            geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
        } else geometry = applyColor(geometry, axon.color);
        const mesh = new Line(geometry, new LineBasicMaterial({ vertexColors: VertexColors, side: DoubleSide }));
        axon.meshes.forEach(mesh => {
            mesh.geometry.dispose();
            mesh.material.dispose();
        });
        axon.meshes = [mesh];
        scene.add(mesh);
    };
    const draw = (scene, viewSizes, minAndMaxDiameter) => {
        if (viewSizes) return axon.ellipsoids.map(e => e.draw(scene, true, viewSizes, minAndMaxDiameter));
        const geom = applyColor(new SphereBufferGeometry(1, 16, 16), axon.color);
        const material = new MeshPhongMaterial({ vertexColors: VertexColors, side: DoubleSide });
        const mesh = new InstancedMesh(geom, material, axon.ellipsoids.length);
        axon.ellipsoids.forEach((ellipsoid, i) => {
            mesh.setMatrixAt(i, ellipsoid.getMatrix4());
        });
        scene.add(mesh);
        axon.mesh = [mesh];
    };
    const toJSON = () => {
        return {
            position: [axon.start.x, axon.start.y, axon.start.z],
            direction: [axon.end.x - axon.start.x, axon.end.y - axon.start.y, axon.end.z - axon.start.z],
            maxDiameter: axon.radius * axon.gFactor * 2,
            color: axon.color,
            gFactor: axon.gFactor,
            ellipsoids: axon.ellipsoids.map((ellipsoid, i) => {
                const myelinDiameter = ellipsoid.crossSectionDiameter(
                    axon.ellipsoids[Math.min(i + 1, axon.ellipsoids.length - 1)].pos
                        .clone()
                        .sub(axon.ellipsoids[Math.max(i - 1, 0)].pos)
                );
                return {
                    position: [ellipsoid.pos.x, ellipsoid.pos.y, ellipsoid.pos.z],
                    shape: ellipsoid.shape.elements,
                    axonDiameter: myelinDiameter * axon.gFactor,
                    myelinDiameter: myelinDiameter
                };
            })
        };
    };
    const toPLY = (binary, simple, i) => {
        return plyParser([axon.meshes[i].geometry], {
            binary: binary,
            includeColors: !simple,
            includeNormals: !simple
        });
    };
    redistribute();
    return Object.assign(axon, {
        dispose,
        keepInVoxel,
        computeCollisionTree: minDist => {
            axon.collisionTree = computeCollisionTree(axon.ellipsoids, minDist);
        },
        collision: (ax, minDist, maxOverlap) => collision(axon.collisionTree, ax.collisionTree, minDist, maxOverlap),
        getOverlap: (ax, minDist, maxOverlap) => getOverlap(axon.collisionTree, ax.collisionTree, minDist, maxOverlap),
        getMinAndMaxDiameter,
        grow,
        contract,
        redistribute,
        getLength,
        getSurfacePoint,
        generatePipe,
        generatePipes,
        generateSkeleton,
        draw,
        toJSON,
        toPLY
    });
};

export default createAxon;
