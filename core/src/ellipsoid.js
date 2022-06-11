import {
    addMatrix3,
    collisionAxis,
    deform,
    extremum,
    hexColorToVector,
    mat3ToMat4,
    randomDirection,
    randomHexColor,
    valueToColor
} from "./helperFunctions.js";

import THREE from "./three.js";
import plyParser from "./plyParser.js";
import { v4 } from "uuid";

const { Vector3, Matrix3, Box3, SphereGeometry, Mesh, MeshToonMaterial, BufferGeometry } = THREE;

class Ellipsoid {
    constructor(pos, radius, deformation, minDiameter, movement, color, generateMesh) {
        this.pos = pos.clone();
        this.radius = radius;
        this.deformation = deformation;
        this.minDiameter = minDiameter;
        this.movement = movement;
        this.shape = new Matrix3().multiplyScalar(this.minDiameter.map(this.radius * 2) / 2);
        this.id = v4();
        this.color = color || randomHexColor();
        this.axisCache = {};
        if (generateMesh) this.mesh = new Mesh(this.getGeometry(false), new MeshToonMaterial({ color: this.color }));
    }
    dispose() {
        if (!this.mesh) return;
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
    clone() {
        const result = new Ellipsoid(
            this.pos,
            this.radius,
            this.deformation,
            this.minDiameter,
            this.movement,
            this.color,
            !!this.mesh
        );
        result.shape = this.shape;
        return result;
    }
    boundingBoxD(minDist) {
        const x = extremum(this.shape, new Vector3(1, 0, 0)).dot(new Vector3(1, 0, 0));
        const y = extremum(this.shape, new Vector3(0, 1, 0)).dot(new Vector3(0, 1, 0));
        const z = extremum(this.shape, new Vector3(0, 0, 1)).dot(new Vector3(0, 0, 1));
        return new Vector3(x + minDist / 2, y + minDist / 2, z + minDist / 2);
    }
    boundingBox(minDist) {
        const d = this.boundingBoxD(minDist);
        return new Box3(this.pos.clone().sub(d), this.pos.clone().add(d));
    }
    containsPoint(p) {
        return p.clone().sub(this.pos).applyMatrix3(new Matrix3().getInverse(this.shape)).length() < 1;
    }
    keepInVoxel(voxelSize, minDist, entireCell) {
        if (entireCell) {
            const bb = new Vector3().fromArray(
                this.boundingBoxD(minDist)
                    .toArray()
                    .map(v => v + minDist)
            );
            this.pos.fromArray(
                this.pos.toArray().map((v, i) => {
                    const s = voxelSize.getComponent(i) / 2 - bb.getComponent(i);
                    return Math.min(Math.max(v, -s), s);
                })
            );
        } else {
            this.pos.fromArray(
                this.pos
                    .toArray()
                    .map((v, i) => Math.min(Math.max(v, -voxelSize.getComponent(i) / 2), voxelSize.getComponent(i) / 2))
            );
        }
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
        const ratio = ellipsoid.radius / this.radius;
        // Collision resolution
        // Update shape
        const c1 = extremum(this.shape, axis).dot(axis);
        const c2 = extremum(ellipsoid.shape, axis).dot(axis);
        const delta1 = (this.deformation.map(c1 * 2) / (c1 * 2)) * Math.min(ratio, 1);
        const delta2 = (ellipsoid.deformation.map(c2 * 2) / (c2 * 2)) * Math.min(1 / ratio, 1);
        const mu1 = this.minDiameter.map(this.radius * 2) / (c1 * 2);
        const mu2 = ellipsoid.minDiameter.map(ellipsoid.radius * 2) / (c2 * 2);
        const s1 = Math.max(-axisLength * delta1, mu1 - 1);
        const s2 = Math.max(-axisLength * delta2, mu2 - 1);
        deform(this.shape, axis, s1);
        deform(ellipsoid.shape, axis, s2);
        axisLength += s1 * c1 + s2 * c2;
        // Update position
        const m1 = this.movement * ratio;
        const m2 = ellipsoid.movement;
        const w = axisLength / (m1 + m2);
        this.pos.sub(axis.clone().multiplyScalar(m1 * w));
        ellipsoid.pos.add(axis.clone().multiplyScalar(m2 * w));
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
        if (amount >= 0)
            this.shape = addMatrix3(
                this.shape.multiplyScalar(1 - amount),
                new Matrix3().multiplyScalar(this.radius * amount)
            );
        else
            this.shape = addMatrix3(
                this.shape.multiplyScalar(1 + amount),
                new Matrix3().multiplyScalar((-amount * this.minDiameter.map(this.radius * 2)) / 2)
            );
        const w = 0.2;
        const avg = Math.cbrt(this.shape.determinant());
        this.shape = addMatrix3(this.shape.multiplyScalar(1 - w), new Matrix3().multiplyScalar(w * avg));
    }
    getColor(viewSizes, minAndMaxDiameter) {
        return viewSizes ? valueToColor(this.diameter(), minAndMaxDiameter) : hexColorToVector(this.color);
    }
    draw(scene, generateMesh, viewSizes, minAndMaxDiameter) {
        const g = this.getGeometry(viewSizes, minAndMaxDiameter);
        if (generateMesh)
            this.mesh = new Mesh(g, new MeshToonMaterial({ color: this.getColor(viewSizes, minAndMaxDiameter) }));
        this.mesh.geometry = g;
        this.mesh.matrixAutoUpdate = false;
        this.mesh.matrix = this.getMatrix4();
        this.mesh.updateMatrix();
        scene.add(this.mesh);
        return this.mesh;
    }
    getMatrix4() {
        return mat3ToMat4(this.shape).setPosition(this.pos);
    }
    getGeometry(viewSizes, minAndMaxDiameter) {
        const geom = new SphereGeometry(1, 16, 16).applyMatrix4(this.getMatrix4());
        geom.computeVertexNormals();
        const color = this.getColor(viewSizes, minAndMaxDiameter);
        geom.faces.forEach(face => (face.vertexColors = new Array(3).fill(true).map(() => color)));
        const bg = new BufferGeometry().fromGeometry(geom);
        delete bg.attributes.uv;
        return bg;
    }
    diameter() {
        return 2 * Math.cbrt(this.shape.determinant());
    }
    crossSectionDiameter(axis) {
        axis.normalize();
        return 2 * Math.sqrt(this.shape.determinant() / extremum(this.shape, axis).dot(axis));
    }
    toPLY(binary, simple) {
        return plyParser([this.mesh.geometry], {
            binary: binary,
            includeColors: !simple,
            includeNormals: !simple
        });
    }
}

export default Ellipsoid;
