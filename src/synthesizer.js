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
    constructor(voxelSize, gridSize, jointCount, deformation, minDiameter) {
        this.jointCount = jointCount;
        this.voxelSize = voxelSize;
        this.gridSize = gridSize;
        this.deformation = deformation;
        this.minDiameter = minDiameter;
        this.axons = [];
        this.cells = [];
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
    addAxonsRandomly(axonCount, minSeparation) {
        for (let i = 0; i < axonCount; ++i)
            for (let j = 0; j < 100; ++j) {
                if (
                    this.addAxon(
                        randomPosition().multiplyScalar(this.gridSize),
                        randomPosition(),
                        0.5 + Math.random(),
                        minSeparation
                    )
                )
                    break;
            }
        console.log("Total number of axons: " + this.axons.length);
    }
    addAxon(pos, dir, r, minSeparation) {
        const a = projectOntoCube(pos, dir, this.gridSize);
        const b = projectOntoCube(pos, dir.clone().negate(), this.gridSize);
        let create = true;
        [this.axons.map(axon => [axon.joints[0], axon.joints[axon.joints.length - 1]]).flat(), this.cells]
            .flat()
            .forEach(joint => {
                const d1 = joint.pos.clone().sub(a);
                const d2 = joint.pos.clone().sub(b);
                const d = joint.radius + r;
                if (d1.length() < minSeparation * d) create = false;
                if (d2.length() < minSeparation * d) create = false;
            });
        if (!create) return false;
        this.axons.push(
            new Axon(a, b, r, this.deformation, this.minDiameter, 1, this.jointCount, this.voxelSize, this.gridSize)
        );
        return true;
    }
    addCellsRandomly(cellCount, minSeparation) {
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
    update(growSpeed, contractSpeed, maxOverlap) {
        this.axons.forEach(axon => axon.grow(growSpeed));
        this.axons.forEach(axon => axon.contract(contractSpeed));
        for (let i = 0; i < 100; ++i) {
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
        return new OBJExporter().parse(this.generatePipes(new Scene()), {});
    }
}
