import * as THREE from "three";

import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter";
import { MarchingCubes } from "three/examples/jsm/objects/MarchingCubes";
import Axon from "./axon";
import Mapping from "./mapping";

const randPos = () => new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);

const min = (a, b) => new THREE.Vector3().set(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.min(a.z, b.z));
const max = (a, b) => new THREE.Vector3().set(Math.max(a.x, b.x), Math.max(a.y, b.y), Math.max(a.z, b.z));

let iter = 0;

const randomVector = () => {
    const result = new THREE.Vector3(2 * Math.random() - 1, 2 * Math.random() - 1, 2 * Math.random() - 1);
    if (result.length() < 0.00001) return randomVector();
    return result.normalize();
};

export default class {
    constructor(voxelSize, gridSize, axonCount, jointCount) {
        const scene = new THREE.Scene();
        scene.add(new THREE.AmbientLight(0xffffff, 0.4));
        const light = new THREE.DirectionalLight(0xffffff, 0.4);
        light.position.set(0, 1, 0);
        scene.add(light);
        const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(1, 16, 16),
            new THREE.MeshPhongMaterial({ color: "#ffffff" })
        );
        this.scene = scene;
        this.jointCount = jointCount;
        this.maxOverlap = 0.1;
        this.voxelSize = new THREE.Vector3(voxelSize, voxelSize, voxelSize);
        this.gridSize = new THREE.Vector3(gridSize, gridSize, gridSize);
        this.deformation = new Mapping([0, 0.8, 2], [0, 0.5, 1]);
        this.minDiameter = new Mapping([0, 1], [0, 0.2]);
        this.axons = [];
        for (let i = 0; i < axonCount; ++i) this.addAxon(randPos().multiplyScalar(3), randPos(), 0.5, 0, scene, mesh);
        let maxRadius = 0;
        this.axons.forEach(axon => (maxRadius = Math.max(maxRadius, axon.radius)));
        this.scale = 2 * maxRadius;
        this.maxOverlap /= this.scale;
        this.gridSize.clone().multiplyScalar(1 / this.scale);
        this.voxelSize.clone().multiplyScalar(1 / this.scale);
        for (let i = 0; i < this.deformation.values.length; ++i) {
            this.deformation.values[i].x /= this.scale;
            this.deformation.valuesInverse[i].y /= this.scale;
        }
        for (let i = 0; i < this.minDiameter.values.length; ++i) {
            this.minDiameter.values[i].x /= this.scale;
            this.minDiameter.values[i].y /= this.scale;
            this.minDiameter.valuesInverse[i].x /= this.scale;
            this.minDiameter.valuesInverse[i].y /= this.scale;
        }
        this.axons.forEach(axon => {
            axon.start.multiplyScalar(1 / this.scale);
            axon.end.multiplyScalar(1 / this.scale);
            axon.radius /= this.scale;
            axon.joints.forEach(joint => joint.pos.multiplyScalar(1 / this.scale));
        });
    }
    keepInVoxel() {
        const gridMin = this.gridSize.clone().multiplyScalar(-1 / 2);
        const gridMax = this.gridSize.clone().multiplyScalar(1 / 2);
        this.axons.forEach(axon => axon.joints.forEach(joint => (joint.pos = min(max(joint.pos, gridMin), gridMax))));
    }
    collision() {
        this.axons.forEach(axon => axon.computeBoundingBoxes());
        this.axons.forEach((a, i) => {
            if (a.boundingBoxes.length === 0) return;
            this.axons.forEach((b, j) => {
                if (i >= j) return;
                if (b.boundingBoxes.length === 0) return;
                this.collision2(a, b, a.boundingBoxes.length - 1, b.boundingBoxes.length - 1, 0, 0);
            });
        });
    }
    collision2(a1, a2, i1, i2, j1, j2) {
        if (i1 > i2) return this.collision2(a2, a1, i2, i1, j2, j1);
        if (j1 >= a1.boundingBoxes[i1].length) return;
        if (j2 >= a2.boundingBoxes[i2].length) return;
        if (a1.boundingBoxes[i1][j1].min.x > a2.boundingBoxes[i2][j2].max.x) return;
        if (a1.boundingBoxes[i1][j1].max.x < a2.boundingBoxes[i2][j2].min.x) return;
        if (a1.boundingBoxes[i1][j1].min.y > a2.boundingBoxes[i2][j2].max.y) return;
        if (a1.boundingBoxes[i1][j1].max.y < a2.boundingBoxes[i2][j2].min.y) return;
        if (a1.boundingBoxes[i1][j1].min.z > a2.boundingBoxes[i2][j2].max.z) return;
        if (a1.boundingBoxes[i1][j1].max.z < a2.boundingBoxes[i2][j2].min.z) return;
        if (i2 === 0)
            return this.collision3(
                a1,
                a2,
                a1.joints[j1],
                a2.joints[j2],
                a1.joints.length * i1 + j1,
                a2.joints.length * i2 + j2
            );
        this.collision2(a1, a2, i1, i2 - 1, j1, 2 * j2);
        this.collision2(a1, a2, i1, i2 - 1, j1, 2 * j2 + 1);
    }
    collision3(a1, a2, a, b, i, j) {
        const d = b.pos.clone().sub(a.pos);
        const dSqr = d.dot(d);
        if (dSqr > 1) return;
        if (dSqr < 0.00001) {
            const r = new THREE.Vector3(0, 0, 0).add(
                new THREE.Vector3(Math.random() * 0.01, Math.random() * 0.0001, Math.random() * 0.01)
            );
            a.pos.clone().sub(r);
            b.pos.clone().add(r);
            return;
        }
        let [axisLength, axis] = this.collisionAxis(a.pos, a.shape, b.pos, b.shape, i, j);
        if (axisLength < 0) return;
        // Collision resolution
        // Updating shape
        const c1 = a.extremum(axis).dot(axis);
        const c2 = b.extremum(axis).dot(axis);
        const delta1 = this.deformation.map(2 * c1);
        const delta2 = this.deformation.map(2 * c2);
        const mu1 = this.minDiameter.map(a1.radius * 2) / 2;
        const mu2 = this.minDiameter.map(a2.radius * 2) / 2;
        const s1 = Math.max((-delta1 * axisLength) / (2 * c1), mu1 / c1 - 1);
        const s2 = Math.max((-delta2 * axisLength) / (2 * c2), mu2 / c2 - 1);
        a.deform(axis, s1);
        b.deform(axis, s2);
        axisLength += s1 * c1 + s2 * c2;
        // Updating position
        axis.multiplyScalar(axisLength * 0.5);
        a.pos.sub(axis);
        b.pos.add(axis);
    }
    getMaxOverlap() {
        this.axons.forEach(axon => axon.computeBoundingBoxes());
        let result = 0;
        this.axons.forEach((a, i) => {
            if (a.boundingBoxes.length === 0) return;
            this.axons.forEach((b, j) => {
                if (i >= j) return;
                if (b.boundingBoxes.length === 0) return;
                result = Math.max(
                    result,
                    this.getMaxOverlap2(a, b, a.boundingBoxes.length - 1, b.boundingBoxes.length - 1, 0, 0)
                );
            });
        });
        return result;
    }
    getMaxOverlap2(a1, a2, i1, i2, j1, j2) {
        if (i1 > i2) return this.getMaxOverlap2(a2, a1, i2, i1, j2, j1);
        if (j1 >= a1.boundingBoxes[i1].length) return 0;
        if (j2 >= a2.boundingBoxes[i2].length) return 0;
        if (a1.boundingBoxes[i1][j1].min.x > a2.boundingBoxes[i2][j2].max.x) return 0;
        if (a1.boundingBoxes[i1][j1].max.x < a2.boundingBoxes[i2][j2].min.x) return 0;
        if (a1.boundingBoxes[i1][j1].min.y > a2.boundingBoxes[i2][j2].max.y) return 0;
        if (a1.boundingBoxes[i1][j1].max.y < a2.boundingBoxes[i2][j2].min.y) return 0;
        if (a1.boundingBoxes[i1][j1].min.z > a2.boundingBoxes[i2][j2].max.z) return 0;
        if (a1.boundingBoxes[i1][j1].max.z < a2.boundingBoxes[i2][j2].min.z) return 0;
        if (i2 === 0)
            return this.getMaxOverlap3(
                a1.joints[j1],
                a2.joints[j2],
                a1.joints.length * i1 + j1,
                a2.joints.length * i2 + j2
            );
        return Math.max(
            this.getMaxOverlap2(a1, a2, i1, i2 - 1, j1, 2 * j2),
            this.getMaxOverlap2(a1, a2, i1, i2 - 1, j1, 2 * j2 + 1)
        );
    }
    getMaxOverlap3(a, b, i, j) {
        if (b.pos.clone().sub(a.pos).length() > 1) return 0;
        return Math.max(this.collisionAxis(a.pos, a.shape, b.pos, b.shape, i, j)[0], 0);
    }
    axisOverlap(p, A, q, B, axis) {
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
    }
    collisionAxis(p, A, q, B, i, j) {
        let a = q.clone().sub(p);
        a.normalize();
        let overlap = this.axisOverlap(p, A, q, B, a);
        while (1) {
            if (overlap < 0) return [overlap, a];
            const r = randomVector().multiplyScalar(0.1);
            let b = a.clone().add(r);
            b.normalize();
            let o = this.axisOverlap(p, A, q, B, b);
            if (o < overlap) {
                a = b.clone();
                overlap = o;
                continue;
            }
            b = a.clone().multiplyScalar(2).sub(b);
            o = this.axisOverlap(p, A, q, B, b);
            if (o < overlap) {
                a = b.clone();
                overlap = o;
                continue;
            }
            const d = a.clone().cross(b.clone().sub(a));
            d.normalize().multiplyScalar(0.1);
            b = a.clone().add(d);
            b.normalize();
            o = this.axisOverlap(p, A, q, B, b);
            if (o < overlap) {
                a = b.clone();
                overlap = o;
                continue;
            }
            b = a.clone().multiplyScalar(2).sub(b);
            o = this.axisOverlap(p, A, q, B, b);
            if (o < overlap) {
                a = b.clone();
                overlap = o;
                continue;
            }
            break;
        }
        return [overlap, a];
    }
    addAxon(pos, dir, r, minSeparation, scene, mesh) {
        const a = this.project(pos, dir);
        const b = this.project(pos, dir.negate());
        this.axons.forEach(axon => {
            const d1 = axon.start.clone().sub(a);
            const d2 = axon.start.clone().sub(b);
            const d3 = axon.end.clone().sub(a);
            const d4 = axon.end.clone().sub(b);
            const d = axon.radius + r;
            if (d1.length() < minSeparation * d) return false;
            if (d2.length() < minSeparation * d) return false;
            if (d3.length() < minSeparation * d) return false;
            if (d4.length() < minSeparation * d) return false;
        });
        this.axons.push(new Axon(a, b, r, this.jointCount, scene, mesh));
        return true;
    }
    project(pos, dir) {
        const p1 = this.projectX(pos, dir);
        const p2 = this.projectY(pos, dir);
        const p3 = this.projectZ(pos, dir);
        const d1 = p1.clone().sub(pos);
        const d2 = p2.clone().sub(pos);
        const d3 = p3.clone().sub(pos);
        const dist1 = d1.dot(dir);
        const dist2 = d2.dot(dir);
        const dist3 = d3.dot(dir);
        if (dist1 < dist2 && dist1 < dist3) return p1;
        if (dist2 < dist3) return p2;
        return p3;
    }
    projectX(pos, dir) {
        if (Math.abs(dir.x) < 0.00001) return pos.clone().add(dir.clone().multiplyScalar(1e10));
        return pos
            .clone()
            .add(dir.clone().multiplyScalar((((dir.x > 0 ? 1 : -1) * this.gridSize.x) / 2 - pos.x) / dir.x));
    }
    projectY(pos, dir) {
        if (Math.abs(dir.y) < 0.00001) return pos.clone().add(dir.clone().multiplyScalar(1e10));
        return pos
            .clone()
            .add(dir.clone().multiplyScalar((((dir.y > 0 ? 1 : -1) * this.gridSize.y) / 2 - pos.y) / dir.y));
    }
    projectZ(pos, dir) {
        if (Math.abs(dir.z) < 0.00001) return pos.clone().add(dir.clone().multiplyScalar(1e10));
        return pos
            .clone()
            .add(dir.clone().multiplyScalar((((dir.z > 0 ? 1 : -1) * this.gridSize.z) / 2 - pos.z) / dir.z));
    }
    volumeFraction(n) {
        const voxelMin = this.voxelSize.clone().multiplyScalar(-1 / 2);
        let inCount = 0;
        for (let i = 0; i < n; ++i) {
            for (let j = 0; j < n; ++j) {
                for (let k = 0; k < n; ++k) {
                    const p = new THREE.Vector3(i + 0.5, j + 0.5, k + 0.5)
                        .multiplyScalar(1 / n)
                        .multiply(this.voxelSize)
                        .add(voxelMin);
                    let inside = false;
                    this.axons.forEach(axon => {
                        if (axon.inside(p)) inside = true;
                    });
                    if (inside) ++inCount;
                }
            }
        }
        return inCount / (n * n * n);
    }
    update(growSpeed, growRepeat, contractSpeed) {
        this.axons.forEach(axon => axon.grow(growSpeed, growRepeat));
        this.axons.forEach(axon => axon.contract(contractSpeed));
        while (1) {
            this.keepInVoxel();
            this.collision();
            const mo = this.getMaxOverlap();
            console.log("Max overlap: " + mo * this.scale);
            if (mo < this.maxOverlap) break;
        }
        const vf = this.volumeFraction(50);
        console.log("Volume fraction: " + 100 * vf + "%");
        ++iter;
        console.log("Number of iterations: " + iter);
        return vf;
    }
    generatePipes() {
        const addEllipsoid = (mc, pos, shape, min, max) => {
            const metaballSize = Math.sqrt(2); // Between sqrt(2) and 2
            for (let x = min.x; x < max.x; x++) {
                for (let y = min.y; y < max.y; y++) {
                    for (let z = min.z; z < max.z; z++) {
                        if (x < 0 || x >= mc.size) continue;
                        if (y < 0 || y >= mc.size) continue;
                        if (z < 0 || z >= mc.size) continue;
                        const p = new THREE.Vector3(x, y, z).divideScalar(mc.size).sub(pos);
                        p.applyMatrix3(new THREE.Matrix3().getInverse(shape));
                        const val = metaballSize / (0.000001 + p.dot(p)) - 1;
                        if (val > 0) mc.field[mc.size2 * z + mc.size * y + x] += val;
                    }
                }
            }
        };
        const scene = new THREE.Scene();
        scene.add(new THREE.AmbientLight(0xffffff, 0.4));
        const light = new THREE.DirectionalLight(0xffffff, 0.4);
        light.position.set(0, 1, 0);
        scene.add(light);
        this.axons.forEach((axon, i) => {
            console.log("Adding axon " + i);
            const mc = new MarchingCubes(64, new THREE.MeshPhongMaterial({ color: "#ffffff" }), true, false);
            mc.isolation = 1;
            axon.joints.forEach(joint => {
                const bb = joint.boundingBox();
                addEllipsoid(
                    mc,
                    joint.pos.clone().divide(this.voxelSize).add(new THREE.Vector3(0.5, 0.5, 0.5)),
                    joint.shape.clone().multiplyScalar(1 / this.voxelSize.x),
                    bb.min
                        .divide(this.voxelSize)
                        .add(new THREE.Vector3(0.5, 0.5, 0.5))
                        .multiplyScalar(mc.size)
                        .floor()
                        .max(new THREE.Vector3(0, 0, 0)),
                    bb.max
                        .divide(this.voxelSize)
                        .add(new THREE.Vector3(0.5, 0.5, 0.5))
                        .multiplyScalar(mc.size)
                        .ceil()
                        .min(new THREE.Vector3(mc.size, mc.size, mc.size))
                );
            });
            scene.add(
                new THREE.Mesh(
                    mc.generateBufferGeometry().scale(this.voxelSize.x / 2, this.voxelSize.y / 2, this.voxelSize.z / 2),
                    new THREE.MeshPhongMaterial({ color: "#ffffff" })
                )
            );
        });
        return scene;
    }
    draw(mode) {
        switch (mode) {
            case "pipes":
                return this.generatePipes();
            case "ellipsoids":
            default:
                this.axons.forEach(axon => axon.draw());
                return this.scene;
        }
    }
    exportFile() {
        try {
            return new OBJExporter().parse(this.generatePipes(), {});
        } catch (err) {
            console.log(err);
        }
    }
}
