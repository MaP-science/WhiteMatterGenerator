import {
    Vector3,
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
import Axon from "./axon";
import Joint from "./joint";
import Mapping from "./mapping";

import { randomPosition, projectOntoCube } from "./helperFunctions";

const wireframeCube = size =>
    new LineSegments(
        new EdgesGeometry(new CubeGeometry(size, size, size)),
        new LineBasicMaterial({ color: 0xffffff, linewidth: 2 })
    );

export default class {
    constructor(voxelSize, gridSize, axonCount, jointCount, cellCount, minSeparation) {
        this.jointCount = jointCount;
        this.voxelSize = voxelSize;
        this.gridSize = gridSize;
        this.deformation = new Mapping([0, 0.4, 1], [0, 0.5, 1]);
        this.minDiameter = new Mapping([0, 2], [0, 0.2]);
        this.axons = [];
        for (let i = 0; i < axonCount; ++i)
            for (let j = 0; j < 100; ++j) {
                if (
                    this.addAxon(
                        randomPosition().multiplyScalar(gridSize),
                        randomPosition(),
                        0.5 + Math.random(),
                        minSeparation
                    )
                )
                    break;
            }
        console.log("Total number of axons: " + this.axons.length);
        let maxRadius = 0;
        this.axons.forEach(axon => (maxRadius = Math.max(maxRadius, axon.radius)));
        this.cells = [];
        for (let i = 0; this.cells.length < cellCount && i < 10 * cellCount; ++i) {
            const cell = new Joint(
                randomPosition().multiplyScalar(gridSize),
                Math.random() * 10,
                new Mapping([0], [0]),
                new Mapping([0], [0]),
                0
            );
            cell.grow(0.1, 100);
            let create = true;
            this.cells.forEach(c => {
                if (c.getOverlap(cell, Infinity) > 0) create = false;
            });
            if (create) this.cells.push(cell);
        }
        console.log("Total number of cells: " + this.cells.length);
    }
    keepInVoxel() {
        this.axons.forEach(axon => axon.keepInVoxel());
    }
    collision(maxOverlap) {
        this.axons.forEach(a => a.computeCollisionTree());
        this.axons.forEach((a, i) => {
            this.axons.forEach((b, j) => {
                if (i >= j) return;
                a.collision(b, maxOverlap);
            });
        });
        this.axons.forEach((a, i) =>
            a.joints.forEach(joint => this.cells.forEach(c => joint.collision(c, maxOverlap)))
        );
    }
    getOverlap(maxOverlap) {
        let result = maxOverlap;
        this.axons.forEach(a => a.computeCollisionTree());
        this.axons.forEach((a, i) => {
            this.axons.forEach((b, j) => {
                if (i >= j) return;
                result = Math.max(result, a.getOverlap(b, result));
            });
        });
        return result;
    }
    addAxon(pos, dir, r, minSeparation) {
        const a = projectOntoCube(pos, dir, this.gridSize);
        const b = projectOntoCube(pos, dir.clone().negate(), this.gridSize);
        let create = true;
        this.axons.forEach(axon => {
            const d1 = axon.start.clone().sub(a);
            const d2 = axon.start.clone().sub(b);
            const d3 = axon.end.clone().sub(a);
            const d4 = axon.end.clone().sub(b);
            const d = axon.radius + r;
            if (d1.length() < minSeparation * d) create = false;
            if (d2.length() < minSeparation * d) create = false;
            if (d3.length() < minSeparation * d) create = false;
            if (d4.length() < minSeparation * d) create = false;
        });
        if (!create) return false;
        this.axons.push(
            new Axon(a, b, r, this.deformation, this.minDiameter, 1, this.jointCount, this.voxelSize, this.gridSize)
        );
        return true;
    }
    volumeFraction(n) {
        this.axons.forEach(axon => axon.computeCollisionTree());
        let inCount = 0;
        for (let i = 0; i < n; ++i) {
            for (let j = 0; j < n; ++j) {
                for (let k = 0; k < n; ++k) {
                    const p = new Vector3(i + 0.5, j + 0.5, k + 0.5)
                        .divideScalar(n)
                        .sub(new Vector3(0.5, 0.5, 0.5))
                        .multiplyScalar(this.voxelSize);
                    let inside = false;
                    this.axons.forEach(axon => {
                        if (axon.collisionTree.containsPoint(p)) inside = true;
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
            this.collision(maxOverlap);
            const mo = this.getOverlap(maxOverlap * 0.999);
            console.log("Max overlap: " + mo);
            if (mo < maxOverlap) break;
        }
        const vf = this.volumeFraction(20);
        console.log("Volume fraction: " + 100 * vf + "%");
        return vf;
    }
    generatePipes(scene) {
        this.axons.forEach((axon, i) => {
            console.log("Adding axon " + i);
            scene.add(new Mesh(axon.generatePipe(), new MeshPhongMaterial({ color: "#ffffff" })));
        });
        return scene;
    }
    draw(mode, showCells) {
        const scene = new Scene();
        scene.add(new AmbientLight(0xffffff, 0.4));
        const light = new DirectionalLight(0xffffff, 0.4);
        light.position.set(0, 1, 0);
        scene.add(light);
        scene.add(wireframeCube(this.voxelSize));
        scene.add(wireframeCube(this.gridSize));
        if (showCells) {
            const cellMesh = new Mesh(new SphereGeometry(1, 16, 16), new MeshPhongMaterial({ color: "#0000ff" }));
            this.cells.forEach(cell => cell.draw(scene, cellMesh));
        }
        const jointMesh = new Mesh(new SphereGeometry(1, 16, 16), new MeshPhongMaterial({ color: "#ffffff" }));
        switch (mode) {
            case "pipes":
                return this.generatePipes(scene);
            case "ellipsoids":
            default:
                this.axons.forEach(axon => axon.draw(scene, jointMesh));
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
