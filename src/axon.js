import Joint from "./joint";
import { randomDirection } from "./helperFunctions";

const computeCollisionTree = joints => {
    if (joints.length === 1)
        return { joint: joints[0], aabb: joints[0].boundingBox(), containsPoint: p => joints[0].containsPoint(p) };
    const a = computeCollisionTree(joints.slice(0, Math.ceil(joints.length / 2)));
    const b = computeCollisionTree(joints.slice(Math.ceil(joints.length / 2)));
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

const collision = (a, b) => {
    if (!a.aabb.intersectsBox(b.aabb)) return;
    if (b.joint) {
        if (a.joint) return a.joint.collision(b.joint);
        return collision(b, a);
    }
    collision(b.a, a);
    collision(b.b, a);
};

const getOverlap = (a, b) => {
    if (!a.aabb.intersectsBox(b.aabb)) return 0;
    if (b.joint) {
        if (a.joint) return a.joint.getOverlap(b.joint);
        return getOverlap(b, a);
    }
    return Math.max(getOverlap(b.a, a), getOverlap(b.b, a));
};

export default class {
    constructor(start, end, radius, deformation, minDiameter, n) {
        this.start = start.clone();
        this.end = end.clone();
        this.radius = radius;
        this.joints = new Array(n).fill(true).map(
            (_, i) =>
                new Joint(
                    start
                        .clone()
                        .multiplyScalar(1 - i / (n - 1))
                        .add(end.clone().multiplyScalar(i / (n - 1))),
                    radius,
                    deformation,
                    minDiameter
                )
        );
    }
    computeCollisionTree() {
        return computeCollisionTree(this.joints);
    }
    collision(axon) {
        return collision(computeCollisionTree(this.joints), computeCollisionTree(axon.joints));
    }
    getOverlap(axon) {
        return getOverlap(computeCollisionTree(this.joints), computeCollisionTree(axon.joints));
    }
    grow(amount, repeat) {
        this.joints.forEach(joint => {
            for (let j = 0; j < repeat; ++j) {
                const p = randomDirection();
                joint.deform(p, (this.radius / joint.extremum(p).dot(p) - 1) * amount);
            }
        });
    }
    contract(amount) {
        if (this.joints.length === 0) return;
        this.joints[0].pos = this.start.clone();
        this.joints[this.joints.length - 1].pos = this.end.clone();
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
    draw(scene, mesh) {
        this.joints.forEach(joint => joint.draw(scene, mesh));
    }
}
