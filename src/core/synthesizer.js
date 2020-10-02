import THREE from "./three.js";
import Axon from "./axon.js";
import Ellipsoid from "./ellipsoid.js";
import Mapping from "./mapping.js";
import { randomPosition, projectOntoCube, shuffle, randomHexColor } from "./helperFunctions.js";
const {
    Vector3,
    LineSegments,
    BoxGeometry,
    EdgesGeometry,
    LineBasicMaterial,
    Scene,
    AmbientLight,
    DirectionalLight,
    MeshPhongMaterial,
    MeshToonMaterial,
    VertexColors,
    Color,
    DoubleSide
} = THREE;

const wireframeCube = size =>
    new LineSegments(
        new EdgesGeometry(new BoxGeometry(size, size, size)),
        new LineBasicMaterial({ color: 0xffffff, linewidth: 2 })
    );

export default class {
    constructor(voxelSize, ellipsoidDensity, deformation, minDiameter) {
        this.ellipsoidDensity = ellipsoidDensity;
        this.voxelSize = voxelSize;
        this.deformation = deformation;
        this.minDiameter = minDiameter;
        this.axons = [];
        this.cells = [];
        this.updateState = { name: "ready" };
        this.focus = null;
    }
    keepInVoxel() {
        this.axons.forEach(axon => axon.keepInVoxel());
    }
    collision(minDist, maxOverlap) {
        this.axons.forEach(a => a.computeCollisionTree(minDist));
        const pairs = [];
        this.axons.forEach((a, i) => {
            this.axons.forEach((b, j) => {
                if (i < j) pairs.push(shuffle([a, b]));
            });
        });
        shuffle(pairs);
        pairs.forEach(pair => pair[0].collision(pair[1], minDist, maxOverlap));
        this.axons.forEach((a, i) =>
            a.ellipsoids.forEach(ellipsoid => this.cells.forEach(c => ellipsoid.collision(c, minDist, maxOverlap)))
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
    addAxonsRandomly(axonCount, gFactor) {
        for (let i = 0; i < axonCount; ++i)
            this.addAxon(
                randomPosition().multiplyScalar(this.voxelSize),
                randomPosition(),
                0.1 + Math.random() * 10,
                undefined,
                gFactor
            );
        console.log("Total number of axons: " + this.axons.length);
    }
    addAxon(pos, dir, r, color, gFactor) {
        const a = projectOntoCube(pos, dir, this.voxelSize);
        const b = projectOntoCube(pos, dir.clone().negate(), this.voxelSize);
        this.axons.push(
            new Axon(
                a,
                b,
                r,
                this.deformation,
                this.minDiameter,
                1,
                this.ellipsoidDensity,
                this.voxelSize,
                color || randomHexColor(),
                gFactor
            )
        );
    }
    addCellsRandomly(cellCount) {
        for (let i = 0; i < cellCount; ++i) {
            const p = randomPosition().multiplyScalar(this.voxelSize);
            const r = 2.5 + Math.random() * 7;
            this.cells.push(
                new Ellipsoid(
                    p,
                    r,
                    new Mapping([0, 1], [0, 0]),
                    new Mapping([0, 1], [0, 0.01]),
                    1,
                    randomHexColor(),
                    true
                )
            );
        }
        const maxOverlap = 0.0001;
        this.cells.forEach((a, i) => a.grow(1));
        for (let mo = 1; mo > maxOverlap; ) {
            this.cells.forEach((a, i) => {
                this.cells.forEach((b, j) => {
                    if (i >= j) return;
                    a.collision(b, maxOverlap, maxOverlap);
                });
            });
            mo = 0;
            this.cells.forEach((a, i) => a.keepInVoxel(this.voxelSize));
            this.cells.forEach((a, i) => {
                this.cells.forEach((b, j) => {
                    if (i >= j) return;
                    mo = Math.max(mo, a.getOverlap(b, 0, mo));
                });
            });
            this.cells.forEach((a, i) => a.grow(-0.05));
        }
        this.cells.forEach((a, i) => {
            a.deformation = new Mapping([0], [0]);
            a.movement = 0;
        });
    }
    addCell(pos, shape, color) {
        const cell = new Ellipsoid(
            pos,
            0,
            new Mapping([0], [0]),
            new Mapping([0], [0]),
            0,
            color || randomHexColor(),
            true
        );
        cell.shape = shape.clone();
        this.cells.push(cell);
    }
    volumeFraction(n, border) {
        this.axons.forEach(axon => axon.computeCollisionTree(0));
        let axonCount = 0;
        let cellCount = 0;
        for (let i = 0; i < n; ++i) {
            for (let j = 0; j < n; ++j) {
                for (let k = 0; k < n; ++k) {
                    const p = new Vector3(i + 0.5, j + 0.5, k + 0.5)
                        .divideScalar(n)
                        .sub(new Vector3(0.5, 0.5, 0.5))
                        .multiplyScalar(this.voxelSize - 2 * border);
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
    update(growSpeed, contractSpeed, minDist, maxOverlap, border) {
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
                const [avf, cvf] = this.volumeFraction(20, border);
                console.log(`Volume fraction: ${100 * avf} % + ${100 * cvf} % = ${100 * (avf + cvf)} %`);
                this.updateState = { name: "ready", volumeFraction: [avf, cvf] };
                break;
            default:
                this.updateState = { name: "ready" };
                break;
        }
        return this.updateState;
    }
    generatePipes(scene, resolution) {
        this.axons.forEach((axon, i) => {
            console.log("Adding axon " + i);
            axon.generatePipe(scene, resolution);
        });
        return scene;
    }
    drawLight(scene) {
        scene.add(new AmbientLight(0xffffff, 0.4));
        const light = new DirectionalLight(0xffffff, 0.4);
        light.position.set(0, 1, 0);
        scene.add(light);
    }
    drawVoxels(scene, mode, border) {
        if (mode === "none") return;
        scene.add(wireframeCube(this.voxelSize));
        const size = this.voxelSize - 2 * border;
        if (size > 0) scene.add(wireframeCube(size));
    }
    drawAxons(scene, mode, resolution) {
        switch (mode) {
            case "skeleton":
                this.axons.forEach(axon => axon.generateSkeleton(scene));
                break;
            case "pipes":
                this.generatePipes(scene, resolution);
                break;
            case "ellipsoids": {
                this.axons.forEach(axon => axon.draw(scene));
                break;
            }
            default:
                break;
        }
    }
    drawCells(scene, mode) {
        if (mode === "none") return;
        this.cells.forEach(cell => cell.draw(scene));
    }
    draw(voxelMode, axonMode, cellMode, resolution, border) {
        const scene = new Scene();
        this.drawLight(scene);
        this.drawVoxels(scene, voxelMode, border);
        this.drawCells(scene, cellMode);
        this.drawAxons(scene, axonMode, resolution);
        return scene;
    }
    point(camPos, cursorDir) {
        let result = null;
        let minDist = 10000000;
        const pos = camPos.clone().add(cursorDir.clone().multiplyScalar(1000000));
        const dir = cursorDir.clone().negate();
        [this.axons.map(a => ({ type: "axon", object: a })), this.cells.map(c => ({ type: "cell", object: c }))]
            .flat()
            .forEach(item => {
                const sp = item.object.getSurfacePoint(pos, dir);
                if (!sp) return;
                const dist = cursorDir.dot(sp.clone().sub(camPos));
                if (dist > minDist) return;
                minDist = dist;
                result = item;
            });
        console.log(result);
        if (minDist < 100000 && (this.focus || {}).object === result.object) return this.focus;
        if ((result || {}).type === "axon")
            result.object.mesh.material = new MeshPhongMaterial({ color: new Color(0xffffff), side: DoubleSide });
        this.focus = result;
        if ((((this.focus || {}).object || {}).mesh || {}).material)
            this.focus.object.mesh.material = new MeshToonMaterial({ color: new Color(0xffffff) });
        console.log((((this.focus || {}).object || {}).mesh || {}).uuid);
        this.deselectAll();
        return this.focus;
    }
    deselectAll() {
        this.axons.forEach(axon => {
            if (axon === (this.focus || {}).object) return;
            axon.mesh.material = new MeshPhongMaterial({ vertexColors: VertexColors, side: DoubleSide });
        });
        this.cells.forEach(cell => {
            if (cell === (this.focus || {}).object) return;
            console.log(this.focus);
            console.log(cell.mesh.uuid);
            cell.mesh.material = new MeshToonMaterial({ color: cell.color });
        });
    }
}
