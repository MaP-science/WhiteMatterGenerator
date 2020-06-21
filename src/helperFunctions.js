import { Vector3, Matrix3, Matrix4 } from "three";

export const min = (a, b) => new Vector3().set(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.min(a.z, b.z));

export const max = (a, b) => new Vector3().set(Math.max(a.x, b.x), Math.max(a.y, b.y), Math.max(a.z, b.z));

export const randomPosition = () => new Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);

export const randomDirection = () => {
    const result = new Vector3(2 * Math.random() - 1, 2 * Math.random() - 1, 2 * Math.random() - 1);
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
