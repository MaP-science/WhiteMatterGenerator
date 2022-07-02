import {
    Vector3,
    Box3,
    MeshPhongMaterial,
    LineBasicMaterial,
    BufferGeometry,
    Line,
    Mesh,
    SphereBufferGeometry,
    DoubleSide,
    Geometry,
    Face3,
    InstancedMesh,
    BufferAttribute,
    Scene
} from "three";
import {
    addMatrix3,
    applyColor,
    hexColorToVector,
    projectOntoCube,
    randomHexColor,
    valueToColor
} from "./helperFunctions";
import random from "./random";
import createEllipsoid from "./ellipsoid";
import plyParser from "./plyParser";
import { BufferGeometryUtils } from "./BufferGeometryUtils";
import { Ellipsoid, EllipsoidJSON } from "./ellipsoid";
import { Mapping } from "./mapping";

type CollisionTree = {
    a?: CollisionTree;
    b?: CollisionTree;
    ellipsoid?: Ellipsoid;
    aabb: Box3;
    containsPoint: (p: Vector3) => boolean;
};

const computeCollisionTree = (ellipsoids: Ellipsoid[], minDist: number): CollisionTree => {
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

const collision = (a: CollisionTree, b: CollisionTree, minDist: number, maxOverlap: number): void => {
    if (!a.aabb.intersectsBox(b.aabb)) return;
    if (b.ellipsoid) {
        if (a.ellipsoid) return a.ellipsoid.collision(b.ellipsoid, minDist, maxOverlap);
        return collision(b, a, minDist, maxOverlap);
    }
    const f1 = () => {
        if (b.a) collision(b.a, a, minDist, maxOverlap);
    };
    const f2 = () => {
        if (b.b) collision(b.b, a, minDist, maxOverlap);
    };
    if (random() < 0.5) {
        f1();
        f2();
    } else {
        f2();
        f1();
    }
};

const getOverlap = (a: CollisionTree, b: CollisionTree, minDist: number, maxOverlap: number): number => {
    if (!a.aabb.intersectsBox(b.aabb)) return 0;
    if (b.ellipsoid) {
        if (a.ellipsoid) return a.ellipsoid.getOverlap(b.ellipsoid, minDist, maxOverlap);
        return getOverlap(b, a, minDist, maxOverlap);
    }
    if (!b.a || !b.b) return 0;
    return Math.max(getOverlap(b.a, a, minDist, maxOverlap), getOverlap(b.b, a, minDist, maxOverlap));
};

const generatePipeUtil = (
    ellipsoids: Ellipsoid[],
    color: string,
    gRatio: number,
    resolution: number,
    viewSizes: boolean,
    minAndMaxDiameter: { min: number; max: number }
) => {
    const getSP = (pos: Vector3, dir: Vector3, i: number, scale: number) => {
        const shape = ellipsoids[i].shape;
        ellipsoids[i].shape = shape.clone().multiplyScalar(scale);
        const sp = ellipsoids[i].getSurfacePoint(pos, dir);
        ellipsoids[i].shape = shape;
        return sp;
    };
    const d = ellipsoids
        .map((_, i) =>
            ellipsoids[Math.min(i + 1, ellipsoids.length - 1)].pos.clone().sub(ellipsoids[Math.max(i - 1, 0)].pos)
        )
        .map(d => d.normalize());
    const sd = 0.05;
    const dSmooth = d.map((_, i) => {
        const sum = new Vector3(0, 0, 0);
        let weight = 0;
        d.forEach((dj, j) => {
            const dist = Math.abs((i - j) / d.length);
            const w = Math.exp(-0.5 * (dist / sd) ** 2);
            sum.add(d[j].clone().multiplyScalar(w));
            weight += w;
        });
        return sum.multiplyScalar(1 / weight);
    });

    const x = new Vector3(1, 0, 0);
    const y = new Vector3(0, 1, 0);
    const cx = dSmooth[0].clone().cross(x);
    const cy = dSmooth[0].clone().cross(y);
    const a = [...Array(dSmooth.length)].map(() => new Vector3(0, 0, 0));
    dSmooth.forEach((_, i) => {
        if (i === 0) {
            a[i] = cx.length() > cy.length() ? cx : cy;
            return;
        }
        a[i] = dSmooth[i - 1]
            .clone()
            .cross(a[i - 1])
            .cross(dSmooth[i])
            .normalize();
    });
    const verts = ellipsoids.map((ellipsoid, i) => {
        const b = dSmooth[i].clone().cross(a[i]).normalize();
        return [...Array(resolution)].map((r, j) => {
            const angle = (2 * Math.PI * j) / resolution;
            const dir = a[i]
                .clone()
                .multiplyScalar(Math.cos(angle))
                .add(b.clone().multiplyScalar(Math.sin(angle)));
            let sp = getSP(ellipsoid.pos, dir, i, gRatio) || new Vector3(0, 0, 0);
            let dist = sp.clone().sub(ellipsoid.pos).dot(dir);
            for (let i2 = i + 1; i2 < ellipsoids.length; ++i2) {
                const sp2 = getSP(ellipsoid.pos, dir, i2, gRatio);
                if (!sp2) break;
                const dist2 = sp2.clone().sub(ellipsoid.pos).dot(dir);
                if (dist2 < dist) continue;
                sp = sp2;
                dist = dist2;
            }
            for (let i2 = i - 1; i2 >= 0; --i2) {
                const sp2 = getSP(ellipsoid.pos, dir, i2, gRatio);
                if (!sp2) break;
                const dist2 = sp2.clone().sub(ellipsoid.pos).dot(dir);
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
        new MeshPhongMaterial({ vertexColors: true, side: DoubleSide })
    );
    geom.dispose();
    bg.dispose();
    return result;
};

export type AxonJSON = {
    position: number[];
    direction: number[];
    maxDiameter: number;
    color: string;
    gRatio: number;
    ellipsoids: EllipsoidJSON[];
};

interface AxonState {
    start: Vector3;
    end: Vector3;
    gRatio: number;
    ellipsoidDensity: number;
    voxelSize: Vector3;
    deformation: Mapping;
    minDiameter: Mapping;
    color: string;
    meshes: (Mesh | Line)[];
    radius: number;
    ellipsoids: Ellipsoid[];
    collisionTree: CollisionTree;
}

export interface Axon extends AxonState {
    dispose: () => void;
    keepInVoxel: (minDist: number) => void;
    computeCollisionTree: (minDist: number) => void;
    collision: (ax: Axon, minDist: number, maxOverlap: number) => void;
    getOverlap: (ax: Axon, minDist: number, maxOverlap: number) => number;
    getMinAndMaxDiameter: () => { min: number; max: number };
    grow: (amount: number) => void;
    contract: (amount: number) => void;
    redistribute: () => void;
    getLength: () => number;
    getSurfacePoint: (pos: Vector3, dir: Vector3) => Vector3 | undefined;
    generatePipe: (
        gRatio: number,
        resolution: number,
        extended: boolean,
        viewSizes: boolean,
        minAndMaxDiameter: { min: number; max: number }
    ) => Mesh;
    generatePipes: (
        scene: Scene,
        resolution: number,
        extended: boolean,
        viewSizes: boolean,
        minAndMaxDiameter: { min: number; max: number }
    ) => void;
    generateSkeleton: (scene: Scene, viewSizes: boolean, minAndMaxDiameter: { min: number; max: number }) => void;
    draw: (scene: Scene, viewSizes: boolean, minAndMaxDiameter: { min: number; max: number }) => void;
    toJSON: () => AxonJSON;
    toPLY: (binary: boolean, simple: boolean, i: number) => string | ArrayBuffer;
}

const createAxon = (
    pos: Vector3,
    dir: Vector3,
    radius: number,
    color: string | undefined,
    gRatio: number,
    {
        deformation,
        minDiameter,
        ellipsoidDensity,
        voxelSize
    }: { deformation: Mapping; minDiameter: Mapping; ellipsoidDensity: number; voxelSize: Vector3 }
): Axon => {
    const axon: AxonState = {
        start: projectOntoCube(pos, dir, voxelSize),
        end: projectOntoCube(pos, dir.clone().negate(), voxelSize),
        gRatio: gRatio || 1,
        ellipsoidDensity,
        voxelSize,
        deformation,
        minDiameter,
        color: color || randomHexColor(),
        meshes: [],
        radius: radius,
        ellipsoids: [],
        collisionTree: {
            aabb: new Box3(new Vector3(0, 0, 0), new Vector3(0, 0, 0)),
            containsPoint: () => false
        }
    };
    axon.radius /= axon.gRatio;
    axon.ellipsoids = [
        createEllipsoid(axon.start, axon.radius, deformation, minDiameter, 1, axon.color, false),
        createEllipsoid(axon.end, axon.radius, deformation, minDiameter, 1, axon.color, false)
    ];
    const dispose = () => {
        axon.ellipsoids.forEach(e => e.dispose());
        axon.meshes.forEach(mesh => {
            mesh.geometry.dispose();
            [mesh.material].flat().map(m => m.dispose());
        });
    };
    const keepInVoxel = (minDist: number) => {
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
    const grow = (amount: number) => {
        axon.ellipsoids.forEach(ellipsoid => ellipsoid.grow(amount));
    };
    const redistribute = () => {
        const length = getLength();
        const ellipsoidCount = 1 + Math.max(Math.ceil(length * axon.ellipsoidDensity), 1);
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
    const contract = (amount: number) => {
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
    const getSurfacePoint = (pos: Vector3, dir: Vector3) => {
        return axon.ellipsoids.reduce((pMax: Vector3 | undefined, ellipsoid: Ellipsoid) => {
            const p = ellipsoid.getSurfacePoint(pos, dir);
            if (!pMax) return p;
            const distMax = pMax.clone().sub(pos).dot(dir);
            if (!p) return pMax;
            const dist = p.clone().sub(pos).dot(dir);
            return dist > distMax ? p : pMax;
        }, undefined);
    };
    const generatePipe = (
        gRatio: number,
        resolution: number,
        extended: boolean,
        viewSizes: boolean,
        minAndMaxDiameter: { min: number; max: number }
    ) => {
        if (!extended)
            return generatePipeUtil(axon.ellipsoids, axon.color, gRatio, resolution, viewSizes, minAndMaxDiameter);
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
        return generatePipeUtil(ellipsoids, axon.color, gRatio, resolution, viewSizes, minAndMaxDiameter);
    };
    const generatePipes = (
        scene: Scene,
        resolution: number,
        extended: boolean,
        viewSizes: boolean,
        minAndMaxDiameter: { min: number; max: number }
    ) => {
        const outer = generatePipe(1, resolution, extended, viewSizes, minAndMaxDiameter);
        const inner = generatePipe(axon.gRatio, resolution, extended, viewSizes, minAndMaxDiameter);
        scene.add(outer);
        scene.add(inner);
        axon.meshes.forEach(mesh => {
            mesh.geometry.dispose();
            [mesh.material].flat().map(m => m.dispose());
        });
        axon.meshes = [outer, inner];
    };
    const generateSkeleton = (scene: Scene, viewSizes: boolean, minAndMaxDiameter: { min: number; max: number }) => {
        let geometry = new BufferGeometry().setFromPoints(axon.ellipsoids.map(ellipsoid => ellipsoid.pos));
        if (viewSizes) {
            const colors = axon.ellipsoids
                .map((e, i) =>
                    valueToColor(
                        e.crossSectionDiameter(
                            axon.ellipsoids[Math.min(i + 1, axon.ellipsoids.length - 1)].pos
                                .clone()
                                .sub(axon.ellipsoids[Math.max(i - 1, 0)].pos)
                        ) * axon.gRatio,
                        minAndMaxDiameter
                    ).toArray()
                )
                .flat();
            geometry.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
        } else geometry = applyColor(geometry, axon.color);
        const mesh = new Line(geometry, new LineBasicMaterial({ vertexColors: true, side: DoubleSide }));
        axon.meshes.forEach(mesh => {
            mesh.geometry.dispose();
            [mesh.material].flat().map(m => m.dispose());
        });
        axon.meshes = [mesh];
        scene.add(mesh);
    };
    const draw = (scene: Scene, viewSizes: boolean, minAndMaxDiameter: { min: number; max: number }) => {
        if (viewSizes) return axon.ellipsoids.map(e => e.draw(scene, true, minAndMaxDiameter));
        const geom = applyColor(new SphereBufferGeometry(1, 16, 16), axon.color);
        const material = new MeshPhongMaterial({ vertexColors: true, side: DoubleSide });
        const mesh = new InstancedMesh(geom, material, axon.ellipsoids.length);
        axon.ellipsoids.forEach((ellipsoid, i) => {
            mesh.setMatrixAt(i, ellipsoid.getMatrix4());
        });
        scene.add(mesh);
        axon.meshes = [mesh];
    };
    const toJSON = () => {
        return {
            position: [axon.start.x, axon.start.y, axon.start.z],
            direction: [axon.end.x - axon.start.x, axon.end.y - axon.start.y, axon.end.z - axon.start.z],
            maxDiameter: axon.radius * axon.gRatio * 2,
            color: axon.color,
            gRatio: axon.gRatio,
            ellipsoids: axon.ellipsoids.map((ellipsoid, i) => {
                const myelinDiameter = ellipsoid.crossSectionDiameter(
                    axon.ellipsoids[Math.min(i + 1, axon.ellipsoids.length - 1)].pos
                        .clone()
                        .sub(axon.ellipsoids[Math.max(i - 1, 0)].pos)
                );
                return {
                    position: [ellipsoid.pos.x, ellipsoid.pos.y, ellipsoid.pos.z],
                    shape: ellipsoid.shape.elements,
                    axonDiameter: myelinDiameter * axon.gRatio,
                    myelinDiameter: myelinDiameter
                };
            })
        };
    };
    const toPLY = (binary: boolean, simple: boolean, i: number) => {
        const geometry = axon.meshes[i].geometry;
        const geom = geometry instanceof Geometry ? new BufferGeometry().fromGeometry(geometry) : geometry;
        return plyParser([geom], {
            binary: binary,
            includeColors: !simple,
            includeNormals: !simple,
            littleEndian: false
        });
    };
    redistribute();
    return Object.assign(axon, {
        dispose,
        keepInVoxel,
        computeCollisionTree: (minDist: number) => {
            axon.collisionTree = computeCollisionTree(axon.ellipsoids, minDist);
        },
        collision: (ax: Axon, minDist: number, maxOverlap: number) =>
            collision(axon.collisionTree, ax.collisionTree, minDist, maxOverlap),
        getOverlap: (ax: Axon, minDist: number, maxOverlap: number) =>
            getOverlap(axon.collisionTree, ax.collisionTree, minDist, maxOverlap),
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
