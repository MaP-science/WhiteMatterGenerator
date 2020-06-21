import { Vector3, Matrix3, Box3 } from "three";
import { addMatrix3, mat3ToMat4, outerProduct, randomDirection } from "./helperFunctions";

const axisOverlap = (p, A, q, B, axis) => {
    let Aaxis = axis.clone().applyMatrix3(A.clone().transpose());
    let Baxis = axis.clone().applyMatrix3(B.clone().transpose());
    const AaxisLength = Aaxis.length();
    const BaxisLength = Baxis.length();
    if (AaxisLength > 0.00001) Aaxis.normalize();
    if (BaxisLength > 0.00001) Baxis.normalize();
    return p
        .clone()
        .sub(q.clone())
        .add(Aaxis.applyMatrix3(A).add(Baxis.applyMatrix3(B)))
        .dot(axis);
};

const collisionAxis = (p, A, q, B) => {
    let a = q.clone().sub(p);
    a.normalize();
    let overlap = axisOverlap(p, A, q, B, a);
    while (1) {
        if (overlap < 0) return [overlap, a];
        const r = randomDirection().multiplyScalar(0.1);
        let b = a.clone().add(r);
        b.normalize();
        let o = axisOverlap(p, A, q, B, b);
        if (o < overlap) {
            a = b.clone();
            overlap = o;
            continue;
        }
        b = a.clone().multiplyScalar(2).sub(b);
        o = axisOverlap(p, A, q, B, b);
        if (o < overlap) {
            a = b.clone();
            overlap = o;
            continue;
        }
        const d = a.clone().cross(b.clone().sub(a));
        d.normalize().multiplyScalar(0.1);
        b = a.clone().add(d);
        b.normalize();
        o = axisOverlap(p, A, q, B, b);
        if (o < overlap) {
            a = b.clone();
            overlap = o;
            continue;
        }
        b = a.clone().multiplyScalar(2).sub(b);
        o = axisOverlap(p, A, q, B, b);
        if (o < overlap) {
            a = b.clone();
            overlap = o;
            continue;
        }
        break;
    }
    return [overlap, a];
};

export default class {
    constructor(pos, radius, deformation, minDiameter) {
        this.pos = pos.clone();
        this.radius = radius;
        this.deformation = deformation;
        this.minDiameter = minDiameter;
        this.shape = new Matrix3().multiplyScalar(0.1);
    }
    deform(axis, s) {
        this.shape.multiply(addMatrix3(outerProduct(axis, axis).multiplyScalar(s / axis.dot(axis)), new Matrix3()));
    }
    extremum(axis) {
        const a = axis.clone();
        a.applyMatrix3(this.shape.transpose());
        const axisLength = a.length();
        if (axisLength > 0.00001) a.multiplyScalar(1 / axisLength);
        return a.applyMatrix3(this.shape);
    }
    boundingBox() {
        const x = this.extremum(new Vector3(1, 0, 0)).dot(new Vector3(1, 0, 0));
        const y = this.extremum(new Vector3(0, 1, 0)).dot(new Vector3(0, 1, 0));
        const z = this.extremum(new Vector3(0, 0, 1)).dot(new Vector3(0, 0, 1));
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
            const r = new Vector3(0, 0, 0).add(
                new Vector3(Math.random() * 0.01, Math.random() * 0.0001, Math.random() * 0.01)
            );
            this.pos.clone().sub(r);
            joint.pos.clone().add(r);
            return;
        }
        let [axisLength, axis] = collisionAxis(this.pos, this.shape, joint.pos, joint.shape);
        if (axisLength < 0) return;
        // Collision resolution
        // Updating shape
        const c1 = this.extremum(axis).dot(axis);
        const c2 = joint.extremum(axis).dot(axis);
        const delta1 = this.deformation.map(2 * c1);
        const delta2 = this.deformation.map(2 * c2);
        const mu1 = this.minDiameter.map(this.radius * 2) / 2;
        const mu2 = this.minDiameter.map(joint.radius * 2) / 2;
        const s1 = Math.max((-delta1 * axisLength) / (2 * c1), mu1 / c1 - 1);
        const s2 = Math.max((-delta2 * axisLength) / (2 * c2), mu2 / c2 - 1);
        this.deform(axis, s1);
        joint.deform(axis, s2);
        axisLength += s1 * c1 + s2 * c2;
        // Updating position
        axis.multiplyScalar(axisLength * 0.5);
        this.pos.sub(axis);
        joint.pos.add(axis);
    }
    getOverlap(joint) {
        if (joint.pos.clone().sub(this.pos).length() > 1) return 0;
        return Math.max(collisionAxis(this.pos, this.shape, joint.pos, joint.shape)[0], 0);
    }
    draw(scene, mesh) {
        const m = mesh.clone();
        m.matrixAutoUpdate = false;
        m.matrix = mat3ToMat4(this.shape).setPosition(this.pos);
        scene.add(m);
    }
}
