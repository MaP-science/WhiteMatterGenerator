import { Vector3, Matrix3, Matrix4, BufferAttribute, Color, BufferGeometry } from "three";
import random from "./random";
import nelderMead from "./nelderMead";

export const randomPosition = () => new Vector3(random() - 0.5, random() - 0.5, random() - 0.5);

export const randomDirection = (): Vector3 => {
    const result = new Vector3(2 * random() - 1, 2 * random() - 1, 2 * random() - 1);
    if (result.length() < 0.00001) return randomDirection();
    return result.normalize();
};

export const addMatrix3 = (a: Matrix3, b: Matrix3) =>
    new Matrix3().fromArray(a.elements.map((e, i) => e + b.elements[i]));

export const mat3ToMat4 = (m: Matrix3) =>
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

export const outerProduct = (a: Vector3, b: Vector3) =>
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

export const projectOntoCube = (pos: Vector3, dir: Vector3, size: Vector3) => {
    const projectCoord = (pos: Vector3, dir: Vector3, posCoord: number, dirCoord: number, s: number) => {
        const scalar = Math.abs(dirCoord) < 0.00001 ? 1e10 : (((dirCoord > 0 ? 1 : -1) * s) / 2 - posCoord) / dirCoord;
        return pos.clone().add(dir.clone().multiplyScalar(scalar));
    };
    const p1 = projectCoord(pos, dir, pos.x, dir.x, size.x);
    const p2 = projectCoord(pos, dir, pos.y, dir.y, size.y);
    const p3 = projectCoord(pos, dir, pos.z, dir.z, size.z);
    const dist1 = p1.clone().sub(pos).dot(dir);
    const dist2 = p2.clone().sub(pos).dot(dir);
    const dist3 = p3.clone().sub(pos).dot(dir);
    if (dist1 < dist2 && dist1 < dist3) return p1;
    if (dist2 < dist3) return p2;
    return p3;
};

export const collisionAxis = (p: Vector3, A: Matrix3, q: Vector3, B: Matrix3, init: Vector3, maxOverlap: number) => {
    const axisOverlap = (param: number[]) => {
        const axis = new Vector3().fromArray(param).normalize();
        return p.clone().sub(q).add(extremum(A, axis)).add(extremum(B, axis)).dot(axis);
    };
    if (init) {
        const ao = axisOverlap(init.toArray());
        if (ao < maxOverlap) return [ao, init];
    }
    const solution = nelderMead(axisOverlap, (init || q.clone().sub(p).normalize()).toArray());
    return [solution.fx, new Vector3().fromArray(solution.x).normalize()];
};

export const deform = (shape: Matrix3, axis: Vector3, amount: number) =>
    shape.multiply(addMatrix3(outerProduct(axis, axis).multiplyScalar(amount / axis.dot(axis)), new Matrix3()));

export const extremum = (shape: Matrix3, axis: Vector3) => {
    const a = axis.clone();
    a.applyMatrix3(shape.clone().transpose());
    const axisLength = a.length();
    if (axisLength > 0.00001) a.divideScalar(axisLength);
    return a.applyMatrix3(shape);
};

export const shuffle = (a: number[]) => {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};

export const randomHexColor = () => "#" + random().toString(16).substr(2, 6);

export const hexColorToVector = (color: string) =>
    new Color(
        parseInt(color.substr(1, 6).substr(0, 2), 16) / 255,
        parseInt(color.substr(1, 6).substr(2, 2), 16) / 255,
        parseInt(color.substr(1, 6).substr(4, 2), 16) / 255
    );

export const applyColor = (geometry: BufferGeometry, color: string) => {
    if (!(((geometry || {}).attributes || {}).position || {}).count) return geometry;
    const col = hexColorToVector(color);
    return geometry.setAttribute(
        "color",
        new BufferAttribute(new Float32Array(Array(geometry.attributes.position.count).fill(col.toArray()).flat()), 3)
    );
};

export const scaledValueToColor = (v: number) => new Color().setHSL((1 - v) * (2 / 3), 1, 0.5);

export const valueToColor = (value: number, { min, max }: { min: number; max: number }) =>
    scaledValueToColor((value - min) / (max - min));
