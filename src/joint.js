import { Vector3, Matrix3, Box3 } from "three";
import { mat3ToMat4, randomDirection, collisionAxis, deform, extremum } from "./helperFunctions";

export default class {
    constructor(pos, radius, deformation, minDiameter) {
        this.pos = pos.clone();
        this.radius = radius;
        this.deformation = deformation;
        this.minDiameter = minDiameter;
        this.shape = new Matrix3().multiplyScalar(0.1);
    }
    boundingBox() {
        const x = extremum(this.shape, new Vector3(1, 0, 0)).dot(new Vector3(1, 0, 0));
        const y = extremum(this.shape, new Vector3(0, 1, 0)).dot(new Vector3(0, 1, 0));
        const z = extremum(this.shape, new Vector3(0, 0, 1)).dot(new Vector3(0, 0, 1));
        const d = new Vector3(x, y, z);
        return new Box3(this.pos.clone().sub(d), this.pos.clone().add(d));
    }
    containsPoint(p) {
        return p.clone().sub(this.pos).applyMatrix3(new Matrix3().getInverse(this.shape)).length() < 1;
    }
    collision(joint) {
        const d = joint.pos.clone().sub(this.pos);
        const dSqr = d.dot(d);
        if (dSqr > 1) return;
        if (dSqr < 0.00001) {
            const r = randomDirection().multiplyScalar(0.0001);
            this.pos.sub(r);
            joint.pos.add(r);
            return;
        }
        let [axisLength, axis] = collisionAxis(this.pos, this.shape, joint.pos, joint.shape);
        if (axisLength < 0) return;
        // Collision resolution
        // Update shape
        const c1 = extremum(this.shape, axis).dot(axis);
        const c2 = extremum(joint.shape, axis).dot(axis);
        const delta1 = this.deformation.map(c1 * 2) / (c1 * 2);
        const delta2 = this.deformation.map(c2 * 2) / (c2 * 2);
        const mu1 = this.minDiameter.map(this.radius * 2) / (c1 * 2);
        const mu2 = this.minDiameter.map(joint.radius * 2) / (c2 * 2);
        const s1 = Math.max(-axisLength * delta1, mu1 - 1);
        const s2 = Math.max(-axisLength * delta2, mu2 - 1);
        deform(this.shape, axis, s1);
        deform(joint.shape, axis, s2);
        axisLength += s1 * c1 + s2 * c2;
        // Update position
        axis.multiplyScalar(axisLength / 2);
        this.pos.sub(axis);
        joint.pos.add(axis);
    }
    getOverlap(joint) {
        if (joint.pos.clone().sub(this.pos).length() > 1) return 0;
        return Math.max(collisionAxis(this.pos, this.shape, joint.pos, joint.shape)[0], 0);
    }
    grow(amount, repeat) {
        for (let i = 0; i < repeat; ++i) {
            const p = randomDirection();
            deform(this.shape, p, (this.radius / extremum(this.shape, p).dot(p) - 1) * amount);
        }
    }
    draw(scene, mesh) {
        const m = mesh.clone();
        m.matrixAutoUpdate = false;
        m.matrix = mat3ToMat4(this.shape).setPosition(this.pos);
        scene.add(m);
    }
}
