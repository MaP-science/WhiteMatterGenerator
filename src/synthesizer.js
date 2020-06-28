import {
    Vector3,
    Matrix3,
    LineSegments,
    CubeGeometry,
    EdgesGeometry,
    Mesh,
    LineBasicMaterial,
    Scene,
    AmbientLight,
    DirectionalLight,
    SphereGeometry,
    MeshPhongMaterial
} from "three";

import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter";
import { MarchingCubes } from "three/examples/jsm/objects/MarchingCubes";
import Axon from "./axon";
import Mapping from "./mapping";

import { min, max, randomPosition } from "./helperFunctions";

const wireframeCube = size =>
    new LineSegments(
        new EdgesGeometry(new CubeGeometry(size, size, size)),
        new LineBasicMaterial({ color: 0xffffff, linewidth: 2 })
    );

export default class {
    constructor(voxelSize, gridSize, axonCount, jointCount) {
        this.jointCount = jointCount;
        this.voxelSize = voxelSize;
        this.gridSize = gridSize;
        this.deformation = new Mapping([0, 0.8, 2], [0, 0.5, 1]);
        this.minDiameter = new Mapping([0, 1], [0, 0.2]);
        this.axons = [];
        for (let i = 0; i < axonCount; ++i) this.addAxon(randomPosition().multiplyScalar(3), randomPosition(), 0.5, 0);
        let maxRadius = 0;
        this.axons.forEach(axon => (maxRadius = Math.max(maxRadius, axon.radius)));
        this.scale = 2 * maxRadius;
        this.gridSize /= this.scale;
        this.voxelSize /= this.scale;
        this.deformation.values.forEach(value => (value.x /= this.scale));
        this.deformation.valuesInverse.forEach(value => (value.x /= this.scale));
        this.minDiameter.values.forEach(value => {
            value.x /= this.scale;
            value.y /= this.scale;
        });
        this.minDiameter.valuesInverse.forEach(value => {
            value.x /= this.scale;
            value.y /= this.scale;
        });
        this.axons.forEach(axon => {
            axon.start.multiplyScalar(1 / this.scale);
            axon.end.multiplyScalar(1 / this.scale);
            axon.radius /= this.scale;
            axon.joints.forEach(joint => joint.pos.multiplyScalar(1 / this.scale));
        });
    }
    keepInVoxel() {
        const gridMin = new Vector3(-this.gridSize / 2, -this.gridSize / 2, -this.gridSize / 2);
        const gridMax = new Vector3(this.gridSize / 2, this.gridSize / 2, this.gridSize / 2);
        this.axons.forEach(axon => axon.joints.forEach(joint => (joint.pos = min(max(joint.pos, gridMin), gridMax))));
    }
    collision() {
        this.axons.forEach((a, i) => {
            this.axons.forEach((b, j) => {
                if (i >= j) return;
                a.collision(b);
            });
        });
    }
    getOverlap() {
        let result = 0;
        this.axons.forEach((a, i) => {
            this.axons.forEach((b, j) => {
                if (i >= j) return;
                result = Math.max(result, a.getOverlap(b));
            });
        });
        return result;
    }
    addAxon(pos, dir, r, minSeparation) {
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
        this.axons.push(new Axon(a, b, r, this.deformation, this.minDiameter, this.jointCount));
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
            .add(dir.clone().multiplyScalar((((dir.x > 0 ? 1 : -1) * this.gridSize) / 2 - pos.x) / dir.x));
    }
    projectY(pos, dir) {
        if (Math.abs(dir.y) < 0.00001) return pos.clone().add(dir.clone().multiplyScalar(1e10));
        return pos
            .clone()
            .add(dir.clone().multiplyScalar((((dir.y > 0 ? 1 : -1) * this.gridSize) / 2 - pos.y) / dir.y));
    }
    projectZ(pos, dir) {
        if (Math.abs(dir.z) < 0.00001) return pos.clone().add(dir.clone().multiplyScalar(1e10));
        return pos
            .clone()
            .add(dir.clone().multiplyScalar((((dir.z > 0 ? 1 : -1) * this.gridSize) / 2 - pos.z) / dir.z));
    }
    volumeFraction(n) {
        const voxelMin = new Vector3(-this.voxelSize / 2, -this.voxelSize / 2, -this.voxelSize / 2);
        let inCount = 0;
        const trees = this.axons.map(axon => axon.computeCollisionTree());
        for (let i = 0; i < n; ++i) {
            for (let j = 0; j < n; ++j) {
                for (let k = 0; k < n; ++k) {
                    const p = new Vector3(i + 0.5, j + 0.5, k + 0.5).multiplyScalar(this.voxelSize / n).add(voxelMin);
                    let inside = false;
                    trees.forEach(tree => {
                        if (tree.containsPoint(p)) inside = true;
                    });
                    if (inside) ++inCount;
                }
            }
        }
        return inCount / (n * n * n);
    }
    update(growSpeed, growRepeat, contractSpeed, maxOverlap) {
        this.axons.forEach(axon => axon.grow(growSpeed, growRepeat));
        this.axons.forEach(axon => axon.contract(contractSpeed));
        while (1) {
            this.keepInVoxel();
            this.collision();
            const mo = this.getOverlap();
            console.log("Max overlap: " + mo * this.scale);
            if (mo < maxOverlap / this.scale) break;
        }
        const vf = this.volumeFraction(50);
        console.log("Volume fraction: " + 100 * vf + "%");
        return vf;
    }
    generatePipes(scene) {
        const addEllipsoid = (mc, pos, shape, min, max) => {
            const metaballSize = Math.sqrt(2); // Between sqrt(2) and 2
            for (let x = min.x; x < max.x; x++) {
                for (let y = min.y; y < max.y; y++) {
                    for (let z = min.z; z < max.z; z++) {
                        if (x < 0 || x >= mc.size) continue;
                        if (y < 0 || y >= mc.size) continue;
                        if (z < 0 || z >= mc.size) continue;
                        const p = new Vector3(x, y, z).divideScalar(mc.size).sub(pos);
                        p.applyMatrix3(new Matrix3().getInverse(shape));
                        const val = metaballSize / (0.000001 + p.dot(p)) - 1;
                        if (val > 0) mc.field[mc.size2 * z + mc.size * y + x] += val;
                    }
                }
            }
        };
        this.axons.forEach((axon, i) => {
            console.log("Adding axon " + i);
            const mc = new MarchingCubes(64, new MeshPhongMaterial({ color: "#ffffff" }), true, false);
            mc.isolation = 1;
            axon.joints.forEach(joint => {
                const bb = joint.boundingBox();
                addEllipsoid(
                    mc,
                    joint.pos.clone().divideScalar(this.voxelSize).add(new Vector3(0.5, 0.5, 0.5)),
                    joint.shape.clone().multiplyScalar(1 / this.voxelSize),
                    bb.min
                        .divideScalar(this.voxelSize)
                        .add(new Vector3(0.5, 0.5, 0.5))
                        .multiplyScalar(mc.size)
                        .floor()
                        .max(new Vector3(0, 0, 0)),
                    bb.max
                        .divideScalar(this.voxelSize)
                        .add(new Vector3(0.5, 0.5, 0.5))
                        .multiplyScalar(mc.size)
                        .ceil()
                        .min(new Vector3(mc.size, mc.size, mc.size))
                );
            });
            scene.add(
                new Mesh(
                    mc.generateBufferGeometry().scale(this.voxelSize / 2, this.voxelSize / 2, this.voxelSize / 2),
                    new MeshPhongMaterial({ color: "#ffffff" })
                )
            );
        });
        return scene;
    }
    draw(mode) {
        const scene = new Scene();
        scene.add(new AmbientLight(0xffffff, 0.4));
        const light = new DirectionalLight(0xffffff, 0.4);
        light.position.set(0, 1, 0);
        scene.add(light);
        scene.add(wireframeCube(this.voxelSize));
        scene.add(wireframeCube(this.gridSize));
        const mesh = new Mesh(new SphereGeometry(1, 16, 16), new MeshPhongMaterial({ color: "#ffffff" }));
        switch (mode) {
            case "pipes":
                return this.generatePipes(scene);
            case "ellipsoids":
            default:
                this.axons.forEach(axon => axon.draw(scene, mesh));
                return scene;
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
