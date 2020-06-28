import { Vector3, Matrix3, Matrix4 } from "three";
import fmin from "fmin";

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

export const projectOntoCube = (pos, dir, size) => {
    const projectCoord = (pos, dir, posCoord, dirCoord) => {
        const scalar =
            Math.abs(dirCoord) < 0.00001 ? 1e10 : (((dirCoord > 0 ? 1 : -1) * size) / 2 - posCoord) / dirCoord;
        return pos.clone().add(dir.clone().multiplyScalar(scalar));
    };
    const p1 = projectCoord(pos, dir, pos.x, dir.x);
    const p2 = projectCoord(pos, dir, pos.y, dir.y);
    const p3 = projectCoord(pos, dir, pos.z, dir.z);
    const dist1 = p1.clone().sub(pos).dot(dir);
    const dist2 = p2.clone().sub(pos).dot(dir);
    const dist3 = p3.clone().sub(pos).dot(dir);
    if (dist1 < dist2 && dist1 < dist3) return p1;
    if (dist2 < dist3) return p2;
    return p3;
};

export const collisionAxis = (p, A, q, B) => {
    const axisOverlap = param => {
        const axis = new Vector3().fromArray(param).normalize();
        const a = axis.clone().applyMatrix3(A.clone().transpose()).normalize().applyMatrix3(A);
        const b = axis.clone().applyMatrix3(B.clone().transpose()).normalize().applyMatrix3(B);
        return p.clone().sub(q).add(a).add(b).dot(axis);
    };
    const solution = fmin.nelderMead(axisOverlap, q.clone().sub(p).normalize().toArray());
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
