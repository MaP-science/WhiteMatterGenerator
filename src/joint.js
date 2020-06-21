import { Vector3, Matrix3 } from "three";
import { addMatrix3, mat3ToMat4, outerProduct } from "./helperFunctions";

export default class {
    constructor(pos) {
        this.pos = pos.clone();
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
        return { min: this.pos.clone().sub(d), max: this.pos.clone().add(d) };
    }
    inside(p) {
        return p.clone().sub(this.pos).applyMatrix3(new Matrix3().getInverse(this.shape)).length() < 1;
    }
    draw(scene, mesh) {
        const m = mesh.clone();
        m.matrixAutoUpdate = false;
        m.matrix = mat3ToMat4(this.shape).setPosition(this.pos);
        scene.add(m);
    }
}
