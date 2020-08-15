import { Vector3, Matrix3, MeshPhongMaterial, LineBasicMaterial, BufferGeometry, Line } from "three";

import { MarchingCubes } from "three/examples/jsm/objects/MarchingCubes";
import Joint from "./joint";
import { min, max } from "./helperFunctions";

const computeCollisionTree = (joints, minDist) => {
    if (joints.length === 1)
        return {
            joint: joints[0],
            aabb: joints[0].boundingBox(minDist),
            containsPoint: p => joints[0].containsPoint(p)
        };
    const a = computeCollisionTree(joints.slice(0, Math.ceil(joints.length / 2)), minDist);
    const b = computeCollisionTree(joints.slice(Math.ceil(joints.length / 2)), minDist);
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
    if (b.joint) {
        if (a.joint) return a.joint.collision(b.joint, minDist, maxOverlap);
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
    if (b.joint) {
        if (a.joint) return a.joint.getOverlap(b.joint, minDist, maxOverlap);
        return getOverlap(b, a, minDist, maxOverlap);
    }
    return Math.max(getOverlap(b.a, a, minDist, maxOverlap), getOverlap(b.b, a, minDist, maxOverlap));
};

export default class {
    constructor(start, end, radius, deformation, minDiameter, movement, jointDensity, voxelSize, gridSize) {
        this.start = start.clone();
        this.end = end.clone();
        this.radius = radius;
        const n = Math.max(Math.round(end.clone().sub(start.clone()).length() * jointDensity), 2);
        this.joints = new Array(n).fill(true).map(
            (_, i) =>
                new Joint(
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
        this.voxelSize = voxelSize;
        this.gridSize = gridSize;
    }
    keepInVoxel() {
        const gridMin = new Vector3(-this.gridSize / 2, -this.gridSize / 2, -this.gridSize / 2);
        const gridMax = new Vector3(this.gridSize / 2, this.gridSize / 2, this.gridSize / 2);
        this.joints.forEach(joint => (joint.pos = min(max(joint.pos, gridMin), gridMax)));
        [this.joints[0], this.joints[this.joints.length - 1]].forEach(joint => {
            const ax = Math.abs(joint.pos.x);
            const ay = Math.abs(joint.pos.y);
            const az = Math.abs(joint.pos.z);
            if (ax > ay && ax > az) return (joint.pos.x *= this.gridSize / (2 * ax));
            if (ay > az) return (joint.pos.y *= this.gridSize / (2 * ay));
            joint.pos.z *= this.gridSize / (2 * az);
        });
    }
    computeCollisionTree(minDist) {
        this.collisionTree = computeCollisionTree(this.joints, minDist);
    }
    collision(axon, minDist, maxOverlap) {
        return collision(this.collisionTree, axon.collisionTree, minDist, maxOverlap);
    }
    getOverlap(axon, minDist, maxOverlap) {
        return getOverlap(this.collisionTree, axon.collisionTree, minDist, maxOverlap);
    }
    grow(amount) {
        this.joints.forEach(joint => joint.grow(amount));
    }
    contract(amount) {
        for (let i = 1; i + 1 < this.joints.length; ++i) {
            const c = this.joints[i + 1].pos
                .clone()
                .add(this.joints[i - 1].pos)
                .divideScalar(2);
            const d = this.joints[i + 1].pos.clone().sub(this.joints[i - 1].pos);
            d.normalize();
            c.sub(this.joints[i].pos);
            this.joints[i].pos.add(d.multiplyScalar(c.dot(d)));
            c.multiplyScalar(amount);
            this.joints[i].pos.add(c);
        }
    }
    generatePipe() {
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
        const mc = new MarchingCubes(64, new MeshPhongMaterial({ color: "#ffffff" }), true, false);
        mc.isolation = 1;
        this.joints.forEach(joint => {
            const bb = joint.boundingBox(0);
            addEllipsoid(
                mc,
                joint.pos.clone().divideScalar(this.voxelSize).add(new Vector3(0.5, 0.5, 0.5)),
                joint.shape.clone().multiplyScalar(1 / this.voxelSize),
                bb.min
                    .divideScalar(this.voxelSize)
                    .add(new Vector3(0.5, 0.5, 0.5))
                    .multiplyScalar(mc.size)
                    .floor()
                    .max(new Vector3(0, 0, 0)),
                bb.max
                    .divideScalar(this.voxelSize)
                    .add(new Vector3(0.5, 0.5, 0.5))
                    .multiplyScalar(mc.size)
                    .ceil()
                    .min(new Vector3(mc.size, mc.size, mc.size))
            );
        });
        return mc.generateBufferGeometry().scale(this.voxelSize / 2, this.voxelSize / 2, this.voxelSize / 2);
    }
    generateSkeleton(scene) {
        scene.add(
            new Line(
                new BufferGeometry().setFromPoints(this.joints.map(joint => joint.pos)),
                new LineBasicMaterial({
                    color: 0xffffff
                })
            )
        );
    }
    draw(scene, mesh) {
        this.joints.forEach(joint => joint.draw(scene, mesh));
    }
}
