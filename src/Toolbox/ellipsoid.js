import { Vector3, Matrix3, Box3 } from "three";
import { v4 } from "uuid";
import { mat3ToMat4, randomDirection, collisionAxis, deform, extremum, min, max } from "./helperFunctions";

export default class {
    constructor(pos, radius, deformation, minDiameter, movement) {
        this.pos = pos.clone();
        this.radius = radius;
        this.deformation = deformation;
        this.minDiameter = minDiameter;
        this.movement = movement;
        this.shape = new Matrix3().multiplyScalar(this.minDiameter.map(this.radius * 2) / 2);
        this.id = v4();
        this.axisCache = {};
    }
    boundingBox(minDist) {
        const x = extremum(this.shape, new Vector3(1, 0, 0)).dot(new Vector3(1, 0, 0));
        const y = extremum(this.shape, new Vector3(0, 1, 0)).dot(new Vector3(0, 1, 0));
        const z = extremum(this.shape, new Vector3(0, 0, 1)).dot(new Vector3(0, 0, 1));
        const d = new Vector3(x + minDist / 2, y + minDist / 2, z + minDist / 2);
        return new Box3(this.pos.clone().sub(d), this.pos.clone().add(d));
    }
    containsPoint(p) {
        return p.clone().sub(this.pos).applyMatrix3(new Matrix3().getInverse(this.shape)).length() < 1;
    }
    keepInVoxel(voxelSizeOuter) {
        const gridMin = new Vector3(-voxelSizeOuter / 2, -voxelSizeOuter / 2, -voxelSizeOuter / 2);
        const gridMax = new Vector3(voxelSizeOuter / 2, voxelSizeOuter / 2, voxelSizeOuter / 2);
        this.pos = min(max(this.pos, gridMin), gridMax);
    }
    collision(ellipsoid, minDist, maxOverlap) {
        const d = ellipsoid.pos.clone().sub(this.pos);
        const dSqr = d.dot(d);
        if (dSqr < 0.00001) {
            const r = randomDirection().multiplyScalar(0.0001);
            this.pos.sub(r);
            ellipsoid.pos.add(r);
            return;
        }
        let [axisLength, axis] = collisionAxis(
            this.pos,
            this.shape,
            ellipsoid.pos,
            ellipsoid.shape,
            this.axisCache[ellipsoid.id],
            maxOverlap
        );
        this.axisCache[ellipsoid.id] = axis;
        axisLength += minDist;
        if (axisLength < 0) return;
        // Collision resolution
        // Update shape
        const c1 = extremum(this.shape, axis).dot(axis);
        const c2 = extremum(ellipsoid.shape, axis).dot(axis);
        const delta1 = this.deformation.map(c1 * 2) / (c1 * 2);
        const delta2 = ellipsoid.deformation.map(c2 * 2) / (c2 * 2);
        const mu1 = this.minDiameter.map(this.radius * 2) / (c1 * 2);
        const mu2 = ellipsoid.minDiameter.map(ellipsoid.radius * 2) / (c2 * 2);
        const s1 = Math.max(-axisLength * delta1, mu1 - 1);
        const s2 = Math.max(-axisLength * delta2, mu2 - 1);
        deform(this.shape, axis, s1);
        deform(ellipsoid.shape, axis, s2);
        axisLength += s1 * c1 + s2 * c2;
        // Update position
        const w = axisLength / (this.movement + ellipsoid.movement);
        this.pos.sub(axis.clone().multiplyScalar(this.movement * w));
        ellipsoid.pos.add(axis.clone().multiplyScalar(ellipsoid.movement * w));
    }
    getOverlap(ellipsoid, minDist, maxOverlap) {
        let [axisLength, axis] = collisionAxis(
            this.pos,
            this.shape,
            ellipsoid.pos,
            ellipsoid.shape,
            this.axisCache[ellipsoid.id],
            maxOverlap
        );
        this.axisCache[ellipsoid.id] = axis;
        return Math.max(axisLength + minDist, 0);
    }
    getSurfacePoint(pos, dir) {
        const inv = new Matrix3().getInverse(this.shape);
        const p = pos.clone().sub(this.pos).applyMatrix3(inv);
        const d = dir.clone().applyMatrix3(inv);
        d.normalize();
        const r = p.clone().sub(d.clone().multiplyScalar(d.dot(p)));
        const rLen = r.length();
        if (rLen > 1) return undefined;
        const x = d.multiplyScalar(Math.sqrt(1 - rLen ** 2));
        return r.clone().add(x).applyMatrix3(this.shape).add(this.pos);
    }
    grow(amount) {
        const s = this.shape.clone().transpose().multiply(this.shape);
        const sx = Math.sqrt(s.elements[0]);
        const sy = Math.sqrt(s.elements[4]);
        const sz = Math.sqrt(s.elements[8]);
        this.shape.multiply(
            new Matrix3().set(
                1 + amount * (this.radius / sx - 1),
                0,
                0,
                0,
                1 + amount * (this.radius / sy - 1),
                0,
                0,
                0,
                1 + amount * (this.radius / sz - 1)
            )
        );
    }
    draw(scene, mesh) {
        const m = mesh.clone();
        m.matrixAutoUpdate = false;
        m.matrix = mat3ToMat4(this.shape).setPosition(this.pos);
        scene.add(m);
    }
}
