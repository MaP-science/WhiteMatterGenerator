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
    constructor(voxelSize, gridSize, jointDensity, deformation, minDiameter) {
        this.jointDensity = jointDensity;
        this.voxelSize = voxelSize;
        this.gridSize = gridSize;
        this.deformation = deformation;
        this.minDiameter = minDiameter;
        this.axons = [];
        this.cells = [];
        this.updateState = { name: "ready" };
    }
    keepInVoxel() {
        this.axons.forEach(axon => axon.keepInVoxel());
    }
    collision(minDist, maxOverlap) {
        this.axons.forEach(a => a.computeCollisionTree(minDist));
        this.axons.forEach((a, i) => {
            this.axons.forEach((b, j) => {
                if (i >= j) return;
                a.collision(b, minDist, maxOverlap);
            });
        });
        this.axons.forEach((a, i) =>
            a.joints.forEach(joint => this.cells.forEach(c => joint.collision(c, minDist, maxOverlap)))
        );
    }
    getOverlap(minDist, maxOverlap) {
        let result = maxOverlap;
        this.axons.forEach(a => a.computeCollisionTree(minDist));
        this.axons.forEach((a, i) => {
            this.axons.forEach((b, j) => {
                if (i >= j) return;
                result = Math.max(result, a.getOverlap(b, minDist, result));
            });
        });
        return result;
    }
    addAxonsRandomly(axonCount) {
        for (let i = 0; i < axonCount; ++i)
            for (let j = 0; j < 100; ++j) {
                if (this.addAxon(randomPosition().multiplyScalar(this.gridSize), randomPosition(), 0.5 + Math.random()))
                    break;
            }
        console.log("Total number of axons: " + this.axons.length);
    }
    addAxon(pos, dir, r) {
        const a = projectOntoCube(pos, dir, this.gridSize);
        const b = projectOntoCube(pos, dir.clone().negate(), this.gridSize);
        this.axons.push(
            new Axon(a, b, r, this.deformation, this.minDiameter, 1, this.jointDensity, this.voxelSize, this.gridSize)
        );
        return true;
    }
    addCellsRandomly(cellCount) {
        for (let i = 0; i < cellCount; ++i)
            for (let j = 0; j < 100; ++j) {
                const p = randomPosition().multiplyScalar(this.gridSize);
                const r = 0.1 + Math.random() * 0.5;
                let create = true;
                [this.axons.map(axon => [axon.joints[0], axon.joints[axon.joints.length - 1]]).flat(), this.cells]
                    .flat()
                    .forEach(joint => {
                        const dist = joint.pos.clone().sub(p);
                        const d = joint.radius + r;
                        if (dist.length() < d) create = false;
                    });
                if (!create) continue;
                const cell = new Joint(p, r, new Mapping([0], [0]), new Mapping([0, 1], [0, 1]), 0);
                cell.grow(1);
                this.cells.push(cell);
                break;
            }
        console.log("Total number of cells: " + this.cells.length);
    }
    addCell(pos, shape) {
        const cell = new Joint(pos, 0, new Mapping([0], [0]), new Mapping([0], [0]), 0);
        cell.shape = shape.clone();
        this.cells.push(cell);
    }
    volumeFraction(n) {
        this.axons.forEach(axon => axon.computeCollisionTree(0));
        let axonCount = 0;
        let cellCount = 0;
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
                    if (inside) ++axonCount;
                    inside = false;
                    this.cells.forEach(cell => {
                        if (cell.containsPoint(p)) inside = true;
                    });
                    if (inside) ++cellCount;
                }
            }
        }
        return [axonCount / (n * n * n), cellCount / (n * n * n)];
    }
    update(growSpeed, contractSpeed, minDist, maxOverlap) {
        switch (this.updateState.name) {
            case "ready":
                this.updateState = { name: "grow" };
                break;
            case "grow":
                this.axons.forEach(axon => axon.grow(growSpeed));
                this.updateState = { name: "contract" };
                break;
            case "contract":
                this.axons.forEach(axon => axon.contract(contractSpeed));
                this.updateState = { name: "keepInVoxel", progress: 0 };
                break;
            case "keepInVoxel":
                this.keepInVoxel();
                this.updateState.name = "collision";
                break;
            case "collision":
                this.collision(minDist, maxOverlap);
                this.updateState.name = "getOverlap";
                break;
            case "getOverlap":
                const mo = this.getOverlap(minDist, maxOverlap * 0.999);
                console.log("Max overlap: " + mo);
                if (mo < maxOverlap) {
                    this.updateState = { name: "volumeFraction", progress: 0 };
                    break;
                }
                ++this.updateState.progress;
                if (this.updateState.progress === 100) this.updateState = { name: "volumeFraction", progress: 0 };
                else this.updateState.name = "keepInVoxel";
                break;
            case "volumeFraction":
                const [avf, cvf] = this.volumeFraction(20);
                console.log(`Volume fraction: ${100 * avf} % + ${100 * cvf} % = ${100 * (avf + cvf)} %`);
                this.updateState = { name: "ready", volumeFraction: [avf, cvf] };
                break;
            default:
                this.updateState = { name: "ready" };
                break;
        }
        return this.updateState;
    }
    generatePipes(scene) {
        this.axons.forEach((axon, i) => {
            console.log("Adding axon " + i);
            scene.add(new Mesh(axon.generatePipe(), new MeshPhongMaterial({ color: "#ffffff" })));
        });
        return scene;
    }
    drawLight(scene) {
        scene.add(new AmbientLight(0xffffff, 0.4));
        const light = new DirectionalLight(0xffffff, 0.4);
        light.position.set(0, 1, 0);
        scene.add(light);
    }
    drawVoxels(scene, mode) {
        if (mode === "none") return;
        scene.add(wireframeCube(this.voxelSize));
        scene.add(wireframeCube(this.gridSize));
    }
    drawAxons(scene, mode) {
        switch (mode) {
            case "skeleton":
                this.axons.forEach(axon => axon.generateSkeleton(scene));
                break;
            case "pipes":
                this.generatePipes(scene);
                break;
            case "ellipsoids": {
                const jointMesh = new Mesh(new SphereGeometry(1, 16, 16), new MeshPhongMaterial({ color: "#ffffff" }));
                this.axons.forEach(axon => axon.draw(scene, jointMesh));
                break;
            }
            default:
                break;
        }
    }
    drawCells(scene, mode) {
        if (mode === "none") return;
        const cellMesh = new Mesh(new SphereGeometry(1, 16, 16), new MeshPhongMaterial({ color: "#0000ff" }));
        this.cells.forEach(cell => cell.draw(scene, cellMesh));
    }
    draw(voxelMode, axonMode, cellMode) {
        const scene = new Scene();
        this.drawLight(scene);
        this.drawVoxels(scene, voxelMode);
        this.drawCells(scene, cellMode);
        this.drawAxons(scene, axonMode);
        return scene;
    }
}
