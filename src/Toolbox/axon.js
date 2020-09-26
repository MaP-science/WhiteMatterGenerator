import THREE from "./three.js";

import BufferGeometryUtils from "./BufferGeometryUtils.js";

import Ellipsoid from "./ellipsoid.js";

import { hexColorToVector, applyColor } from "./helperFunctions.js";

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
    InstancedMesh
} = THREE;

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
    if (Math.random() < 0.5) {
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

export default class {
    constructor(start, end, radius, deformation, minDiameter, movement, ellipsoidDensity, voxelSize, color) {
        this.start = start.clone();
        this.end = end.clone();
        this.radius = radius;
        const n = Math.max(Math.round(end.clone().sub(start.clone()).length() * ellipsoidDensity), 2);
        this.ellipsoids = new Array(n).fill(true).map(
            (_, i) =>
                new Ellipsoid(
                    start
                        .clone()
                        .multiplyScalar(1 - i / (n - 1))
                        .add(end.clone().multiplyScalar(i / (n - 1))),
                    radius,
                    deformation,
                    minDiameter,
                    movement,
                    color,
                    false
                )
        );
        this.voxelSize = voxelSize;
        this.color = color;
        this.meshes = [];
    }
    keepInVoxel() {
        this.ellipsoids.forEach(ellipsoid => ellipsoid.keepInVoxel(this.voxelSize));
        [this.ellipsoids[0], this.ellipsoids[this.ellipsoids.length - 1]].forEach(ellipsoid => {
            const ax = Math.abs(ellipsoid.pos.x);
            const ay = Math.abs(ellipsoid.pos.y);
            const az = Math.abs(ellipsoid.pos.z);
            if (ax > ay && ax > az) return (ellipsoid.pos.x *= this.voxelSize / (2 * ax));
            if (ay > az) return (ellipsoid.pos.y *= this.voxelSize / (2 * ay));
            ellipsoid.pos.z *= this.voxelSize / (2 * az);
        });
    }
    computeCollisionTree(minDist) {
        this.collisionTree = computeCollisionTree(this.ellipsoids, minDist);
    }
    collision(axon, minDist, maxOverlap) {
        return collision(this.collisionTree, axon.collisionTree, minDist, maxOverlap);
    }
    getOverlap(axon, minDist, maxOverlap) {
        return getOverlap(this.collisionTree, axon.collisionTree, minDist, maxOverlap);
    }
    grow(amount) {
        this.ellipsoids.forEach(ellipsoid => ellipsoid.grow(amount));
    }
    contract(amount) {
        for (let i = 1; i + 1 < this.ellipsoids.length; ++i) {
            const c = this.ellipsoids[i + 1].pos
                .clone()
                .add(this.ellipsoids[i - 1].pos)
                .divideScalar(2);
            const d = this.ellipsoids[i + 1].pos.clone().sub(this.ellipsoids[i - 1].pos);
            d.normalize();
            c.sub(this.ellipsoids[i].pos);
            d.multiplyScalar(c.dot(d));
            c.sub(d);
            this.ellipsoids[i].pos.add(d);
            this.ellipsoids[i].pos.add(c.multiplyScalar(amount));
        }
    }
    getSurfacePoint(pos, dir) {
        return this.ellipsoids.reduce((pMax, ellipsoid) => {
            const p = ellipsoid.getSurfacePoint(pos, dir);
            if (!pMax) return p;
            const distMax = pMax.clone().sub(pos).dot(dir);
            if (!p) return pMax;
            const dist = p.clone().sub(pos).dot(dir);
            return dist > distMax ? p : pMax;
        }, undefined);
    }
    generatePipe(scene, resolution) {
        const getSP = (pos, dir, i, iDiff, maxDist = 1e-10) => {
            if (!iDiff) {
                const sp1 = getSP(pos, dir, i, 1);
                const sp2 = getSP(pos, dir, i, -1);
                const dist1 = sp1.clone().sub(pos).dot(dir);
                const dist2 = sp2.clone().sub(pos).dot(dir);
                return dist1 > dist2 ? sp1 : sp2;
            }
            if (i < 0 || i >= this.ellipsoids.length) return undefined;
            const sp = this.ellipsoids[i].getSurfacePoint(pos, dir);
            if (!sp) return undefined;
            const dist = sp.clone().sub(pos).dot(dir);
            if (dist < maxDist) return undefined;
            return getSP(pos, dir, i + iDiff, iDiff, dist) || sp;
        };
        const d = this.ellipsoids[this.ellipsoids.length - 1].pos.clone().sub(this.ellipsoids[0].pos);
        d.normalize();
        const x = new Vector3(1, 0, 0);
        const y = new Vector3(0, 1, 0);
        const cx = d.clone().cross(x);
        const cy = d.clone().cross(y);
        const a = cx.length() > cy.length() ? cx : cy;
        a.normalize();
        const b = d.clone().cross(a).normalize();
        const verts = this.ellipsoids.map((ellipsoid, i) => {
            return new Array(resolution).fill(true).map((r, j) => {
                const angle = (2 * Math.PI * j) / resolution;
                const dir = a
                    .clone()
                    .multiplyScalar(Math.cos(angle))
                    .add(b.clone().multiplyScalar(Math.sin(angle)));
                return getSP(ellipsoid.pos, dir, i);
            });
        });
        const geom = new Geometry();
        geom.vertices = verts.flat();
        geom.faces = verts
            .slice(0, verts.length - 1)
            .map((verti, i) =>
                verti.map((vertij, j) => {
                    const i00 = i * resolution + j;
                    const i01 = i * resolution + ((j + 1) % resolution);
                    const i10 = (i + 1) * resolution + j;
                    const i11 = (i + 1) * resolution + ((j + 1) % resolution);
                    return [new Face3(i00, i01, i10), new Face3(i10, i01, i11)];
                })
            )
            .flat()
            .flat();
        geom.computeVertexNormals();
        geom.faces.forEach(
            face => (face.vertexColors = new Array(3).fill(true).map(() => hexColorToVector(this.color)))
        );
        const mesh = new Mesh(geom, new MeshPhongMaterial({ vertexColors: VertexColors, side: DoubleSide }));
        scene.add(mesh);
        this.meshes = [mesh];
    }
    generateSkeleton(scene) {
        const mesh = new Line(
            applyColor(new BufferGeometry().setFromPoints(this.ellipsoids.map(ellipsoid => ellipsoid.pos)), this.color),
            new LineBasicMaterial({ vertexColors: VertexColors, side: DoubleSide })
        );
        this.meshes = [mesh];
        scene.add(mesh);
    }
    draw(scene) {
        const geom = applyColor(new SphereBufferGeometry(1, 16, 16), this.color);
        const material = new MeshPhongMaterial({ vertexColors: VertexColors, side: DoubleSide });
        const mesh = new InstancedMesh(geom, material, this.ellipsoids.length);
        this.ellipsoids.forEach((ellipsoid, i) => {
            mesh.setMatrixAt(i, ellipsoid.getMatrix4());
        });
        scene.add(mesh);
        this.meshes = [mesh];
    }
    getStaticGeometry() {
        const geom = applyColor(
            BufferGeometryUtils.mergeBufferGeometries(this.ellipsoids.map(ellipsoid => ellipsoid.getGeometry())),
            this.color
        );
        const material = new MeshPhongMaterial({ vertexColors: VertexColors, side: DoubleSide });
        return new Mesh(geom, material);
    }
}
