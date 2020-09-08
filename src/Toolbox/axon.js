import {
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
} from "three";

import { BufferGeometryUtils } from "three/examples/jsm/utils/BufferGeometryUtils";

import Ellipsoid from "./ellipsoid";

import { applyColor } from "./helperFunctions";

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
                    color
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
            const distMax = pMax.clone().sub(pos).dot(dir);
            const p = ellipsoid.getSurfacePoint(pos, dir);
            if (!p) return pMax;
            const dist = p.clone().sub(pos).dot(dir);
            return dist > distMax ? p : pMax;
        }, pos);
    }
    generatePipe(scene, resolution) {
        const d = this.ellipsoids[this.ellipsoids.length - 1].pos.clone().sub(this.ellipsoids[0].pos);
        d.normalize();
        const x = new Vector3(1, 0, 0);
        const y = new Vector3(0, 1, 0);
        const cx = d.clone().cross(x);
        const cy = d.clone().cross(y);
        const a = cx.length() > cy.length() ? cx : cy;
        a.normalize();
        const b = d.clone().cross(a).normalize();
        const geom = new Geometry();
        for (let i = 0; i < this.ellipsoids.length - 1; ++i) {
            const p1 = this.ellipsoids[i].pos;
            const p2 = this.ellipsoids[i + 1].pos;
            for (let j = 0; j < resolution; ++j) {
                const angle1 = (2 * Math.PI * j) / resolution;
                const angle2 = (2 * Math.PI * (j + 1)) / resolution;
                const angleAvg = (2 * Math.PI * (j + 0.5)) / resolution;
                const dir1 = a
                    .clone()
                    .multiplyScalar(Math.cos(angle1))
                    .add(b.clone().multiplyScalar(Math.sin(angle1)));
                const dir2 = a
                    .clone()
                    .multiplyScalar(Math.cos(angle2))
                    .add(b.clone().multiplyScalar(Math.sin(angle2)));
                const dirAvg = a
                    .clone()
                    .multiplyScalar(Math.cos(angleAvg))
                    .add(b.clone().multiplyScalar(Math.sin(angleAvg)));
                const len = geom.vertices.length;
                geom.vertices.push(this.getSurfacePoint(p1, dir1));
                geom.vertices.push(this.getSurfacePoint(p2, dir1));
                geom.vertices.push(this.getSurfacePoint(p1, dir2));
                geom.vertices.push(this.getSurfacePoint(p2, dir2));
                geom.faces.push(new Face3(len, len + 2, len + 1, dirAvg));
                geom.faces.push(new Face3(len + 1, len + 2, len + 3, dirAvg));
            }
        }
        const mesh = new Mesh(
            applyColor(new BufferGeometry().fromGeometry(geom), this.color),
            new MeshPhongMaterial({ vertexColors: VertexColors, side: DoubleSide })
        );
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
