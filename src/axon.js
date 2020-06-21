import Joint from "./joint";
import { min, max, randomDirection } from "./helperFunctions";

export default class {
    constructor(start, end, radius, n, scene, mesh) {
        this.start = start.clone();
        this.end = end.clone();
        this.radius = radius;
        this.joints = new Array(n).fill(true).map(
            (_, i) =>
                new Joint(
                    scene,
                    mesh,
                    start
                        .clone()
                        .multiplyScalar(1 - i / (n - 1))
                        .add(end.clone().multiplyScalar(i / (n - 1)))
                )
        );
        this.boundingBoxes = [new Array(n)];
        for (let i = 0; this.boundingBoxes[i].length > 1; ++i) {
            this.boundingBoxes.push(new Array(Math.floor((this.boundingBoxes[i].length + 1) / 2)));
        }
    }
    computeBoundingBoxes() {
        if (this.joints.length === 0) return;
        this.joints.forEach((joint, i) => (this.boundingBoxes[0][i] = joint.boundingBox()));
        for (let i = 1; i < this.boundingBoxes.length; ++i) {
            for (let j = 0; 2 * j + 1 < this.boundingBoxes[i - 1].length; ++j) {
                const a = min(this.boundingBoxes[i - 1][2 * j].min, this.boundingBoxes[i - 1][2 * j + 1].min);
                const b = max(this.boundingBoxes[i - 1][2 * j].max, this.boundingBoxes[i - 1][2 * j + 1].max);
                this.boundingBoxes[i][j] = { min: a, max: b };
            }
            if (this.boundingBoxes[i - 1].length % 2)
                this.boundingBoxes[i][this.boundingBoxes[i].length - 1] = this.boundingBoxes[i - 1][
                    this.boundingBoxes[i - 1].length - 1
                ];
        }
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
                .multiplyScalar(1 / 2);
            const d = this.joints[i + 1].pos.clone().sub(this.joints[i - 1].pos);
            d.normalize();
            this.joints[i].pos.add(d.multiplyScalar(c.clone().sub(this.joints[i].pos).dot(d)));
            this.joints[i].pos.add(c.clone().sub(this.joints[i].pos).multiplyScalar(amount));
        }
    }
    inside(p, i = -1, j = 0) {
        if (i === -1) i = this.boundingBoxes.length - 1;
        if (j >= this.boundingBoxes[i].length) return false;
        if (this.boundingBoxes[i][j].min.x > p.x) return false;
        if (this.boundingBoxes[i][j].min.y > p.y) return false;
        if (this.boundingBoxes[i][j].min.z > p.z) return false;
        if (this.boundingBoxes[i][j].max.x < p.x) return false;
        if (this.boundingBoxes[i][j].max.y < p.y) return false;
        if (this.boundingBoxes[i][j].max.z < p.z) return false;
        if (i === 0) return this.joints[j].inside(p);
        return this.inside(p, i - 1, 2 * j) || this.inside(p, i - 1, 2 * j + 1);
    }
    draw() {
        this.joints.forEach(joint => joint.draw());
    }
}
