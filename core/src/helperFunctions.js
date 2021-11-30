import random from "./random.js";
import THREE from "./three.js";
import fmin from "fmin";
const { Vector3, Matrix3, Matrix4, BufferAttribute, Color } = THREE;

export const randomPosition = () => new Vector3(random() - 0.5, random() - 0.5, random() - 0.5);

export const randomDirection = () => {
    const result = new Vector3(2 * random() - 1, 2 * random() - 1, 2 * random() - 1);
    if (result.length() < 0.00001) return randomDirection();
    return result.normalize();
};

export const addMatrix3 = (a, b) => new Matrix3().set(...a.elements.map((e, i) => e + b.elements[i]));

export const mat3ToMat4 = m =>
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

export const outerProduct = (a, b) =>
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

export const projectOntoCube = (pos, dir, size) => {
    const projectCoord = (pos, dir, posCoord, dirCoord, s) => {
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

export const collisionAxis = (p, A, q, B, init, maxOverlap) => {
    const axisOverlap = param => {
        const axis = new Vector3().fromArray(param).normalize();
        return p.clone().sub(q).add(extremum(A, axis)).add(extremum(B, axis)).dot(axis);
    };
    if (init) {
        const ao = axisOverlap(init.toArray());
        if (ao < maxOverlap) return [ao, init];
    }
    const solution = fmin.nelderMead(axisOverlap, (init || q.clone().sub(p).normalize()).toArray());
    return [solution.fx, new Vector3().fromArray(solution.x).normalize()];
};

export const deform = (shape, axis, amount) =>
    shape.multiply(addMatrix3(outerProduct(axis, axis).multiplyScalar(amount / axis.dot(axis)), new Matrix3()));

export const extremum = (shape, axis) => {
    const a = axis.clone();
    a.applyMatrix3(shape.clone().transpose());
    const axisLength = a.length();
    if (axisLength > 0.00001) a.divideScalar(axisLength);
    return a.applyMatrix3(shape);
};

export const shuffle = a => {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};

export const randomHexColor = () => "#" + random().toString(16).substr(2, 6);

export const hexColorToVector = color =>
    new Color(
        parseInt(color.substr(1, 6).substr(0, 2), 16) / 255,
        parseInt(color.substr(1, 6).substr(2, 2), 16) / 255,
        parseInt(color.substr(1, 6).substr(4, 2), 16) / 255
    );

export const applyColor = (geometry, color) => {
    if (!(((geometry || {}).attributes || {}).position || {}).count) return geometry;
    const col = hexColorToVector(color);
    return geometry.setAttribute(
        "color",
        new BufferAttribute(new Float32Array(Array(geometry.attributes.position.count).fill(col.toArray()).flat()), 3)
    );
};

export const scaledValueToColor = v => new Color().setHSL((1 - v) * (2 / 3), 1, 0.5);

export const valueToColor = (value, { min, max }) => scaledValueToColor((value - min) / (max - min));
