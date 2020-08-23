import {
    Vector3,
    Matrix3,
    MeshPhongMaterial,
    LineBasicMaterial,
    BufferGeometry,
    Line,
    Mesh,
    SphereBufferGeometry,
    BufferAttribute,
    VertexColors
} from "three";

import { MarchingCubes } from "three/examples/jsm/objects/MarchingCubes";
import Ellipsoid from "./ellipsoid";

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

const applyColor = (geometry, color) => {
    if (!geometry?.attributes?.position?.count) return geometry;
    return geometry.setAttribute(
        "color",
        new BufferAttribute(
            new Float32Array(
                Array(geometry.attributes.position.count)
                    .fill([
                        parseInt(color.substr(1, 6).substr(0, 2), 16) / 255,
                        parseInt(color.substr(1, 6).substr(2, 2), 16) / 255,
                        parseInt(color.substr(1, 6).substr(4, 2), 16) / 255
                    ])
                    .flat()
            ),
            3
        )
    );
};

export default class {
    constructor(
        start,
        end,
        radius,
        deformation,
        minDiameter,
        movement,
        ellipsoidDensity,
        voxelSizeInner,
        voxelSizeOuter
    ) {
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
                    movement
                )
        );
        this.voxelSizeInner = voxelSizeInner;
        this.voxelSizeOuter = voxelSizeOuter;
        this.color = "#" + Math.random().toString(16).substr(2, 6);
    }
    keepInVoxel() {
        this.ellipsoids.forEach(ellipsoid => ellipsoid.keepInVoxel(this.voxelSizeOuter));
        [this.ellipsoids[0], this.ellipsoids[this.ellipsoids.length - 1]].forEach(ellipsoid => {
            const ax = Math.abs(ellipsoid.pos.x);
            const ay = Math.abs(ellipsoid.pos.y);
            const az = Math.abs(ellipsoid.pos.z);
            if (ax > ay && ax > az) return (ellipsoid.pos.x *= this.voxelSizeOuter / (2 * ax));
            if (ay > az) return (ellipsoid.pos.y *= this.voxelSizeOuter / (2 * ay));
            ellipsoid.pos.z *= this.voxelSizeOuter / (2 * az);
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
            this.ellipsoids[i].pos.add(d.multiplyScalar(c.dot(d)));
            c.multiplyScalar(amount);
            this.ellipsoids[i].pos.add(c);
        }
    }
    generatePipe(scene, resolution) {
        const addEllipsoid = (mc, pos, shape, min, max) => {
            for (let x = min.x; x < max.x; x++) {
                for (let y = min.y; y < max.y; y++) {
                    for (let z = min.z; z < max.z; z++) {
                        if (x < 0 || x >= mc.size) continue;
                        if (y < 0 || y >= mc.size) continue;
                        if (z < 0 || z >= mc.size) continue;
                        const p = new Vector3(x, y, z).divideScalar(mc.size).sub(pos);
                        p.applyMatrix3(new Matrix3().getInverse(shape));
                        const val = 1.000001 / (0.000001 + Math.pow(p.dot(p), 3)) - 1;
                        if (val > 0) mc.field[mc.size2 * z + mc.size * y + x] += val;
                    }
                }
            }
        };
        const mc = new MarchingCubes(resolution, {}, true, false);
        mc.isolation = 1;
        this.ellipsoids.forEach(ellipsoid => {
            const bb = ellipsoid.boundingBox(0);
            addEllipsoid(
                mc,
                ellipsoid.pos.clone().divideScalar(this.voxelSizeInner).add(new Vector3(0.5, 0.5, 0.5)),
                ellipsoid.shape.clone().multiplyScalar(1 / this.voxelSizeInner),
                bb.min
                    .divideScalar(this.voxelSizeInner)
                    .add(new Vector3(0.5, 0.5, 0.5))
                    .multiplyScalar(mc.size)
                    .floor()
                    .max(new Vector3(0, 0, 0)),
                bb.max
                    .divideScalar(this.voxelSizeInner)
                    .add(new Vector3(0.5, 0.5, 0.5))
                    .multiplyScalar(mc.size)
                    .ceil()
                    .min(new Vector3(mc.size, mc.size, mc.size))
            );
        });
        const geometry = mc
            .generateBufferGeometry()
            .scale(this.voxelSizeInner / 2, this.voxelSizeInner / 2, this.voxelSizeInner / 2);
        applyColor(geometry, this.color);
        scene.add(new Mesh(geometry, new MeshPhongMaterial({ vertexColors: VertexColors })));
    }
    generateSkeleton(scene) {
        scene.add(
            new Line(
                applyColor(
                    new BufferGeometry().setFromPoints(this.ellipsoids.map(ellipsoid => ellipsoid.pos)),
                    this.color
                ),
                new LineBasicMaterial({
                    vertexColors: VertexColors
                })
            )
        );
    }
    draw(scene) {
        const mesh = new Mesh(
            applyColor(new SphereBufferGeometry(1, 16, 16), this.color),
            new MeshPhongMaterial({ vertexColors: VertexColors })
        );
        this.ellipsoids.forEach(ellipsoid => ellipsoid.draw(scene, mesh));
    }
}
