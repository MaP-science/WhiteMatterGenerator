import { Vector3, Matrix3, Matrix4 } from "three";

const add = (a, b) => new Matrix3().set(...a.elements.map((e, i) => e + b.elements[i]));

const mat3ToMat4 = m =>
    new Matrix4().set(
        m.elements[0],
        m.elements[1],
        m.elements[2],
        0,
        m.elements[3],
        m.elements[4],
        m.elements[5],
        0,
        m.elements[6],
        m.elements[7],
        m.elements[8],
        0,
        0,
        0,
        0,
        1
    );

const outerProduct = (a, b) =>
    new Matrix3().set(
        a.x * b.x,
        a.x * b.y,
        a.x * b.z,
        a.y * b.x,
        a.y * b.y,
        a.y * b.z,
        a.z * b.x,
        a.z * b.y,
        a.z * b.z
    );

export default class {
    constructor(scene, mesh, pos) {
        this.mesh = mesh.clone();
        this.mesh.matrixAutoUpdate = false;
        this.pos = pos.clone();
        this.shape = new Matrix3().multiplyScalar(0.1);
        this.prev = -2;
        this.next = -1;
        this.draw();
        scene.add(this.mesh);
    }
    deform(axis, s) {
        this.shape.multiply(add(outerProduct(axis, axis).multiplyScalar(s / axis.dot(axis)), new Matrix3()));
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
    draw() {
        this.mesh.matrix = mat3ToMat4(this.shape).setPosition(this.pos);
    }
}
