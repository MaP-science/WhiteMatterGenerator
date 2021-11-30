import { addMatrix3, randomPosition, shuffle } from "./helperFunctions.js";

import Axon from "./axon.js";
import { BufferGeometryUtils } from "./BufferGeometryUtils.js";
import Ellipsoid from "./ellipsoid.js";
import Mapping from "./mapping.js";
import THREE from "./three.js";
import plyParser from "./plyParser.js";

const {
    Vector3,
    Matrix3,
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
        new EdgesGeometry(new BoxGeometry(size.x, size.y, size.z)),
        new LineBasicMaterial({ color: 0xffffff, linewidth: 2 })
    );

export default class {
    constructor(config) {
        this.voxelSize =
            typeof config.voxelSize === "number"
                ? new Vector3(config.voxelSize, config.voxelSize, config.voxelSize)
                : new Vector3().fromArray(config.voxelSize);
        this.ellipsoidDensity = Number(config.ellipsoidDensity);
        this.deformation = new Mapping(config.mapFromDiameterToDeformationFactor);
        this.minDiameter = new Mapping(config.mapFromMaxDiameterToMinDiameter);
        this.axons = [];
        this.cells = [];
        this.updateState = { name: "ready" };
        this.focus = null;
        (config.axons || []).forEach(axon => {
            this.axons.push(
                new Axon(
                    new Vector3(...axon.position),
                    new Vector3(...axon.direction),
                    axon.maxDiameter / 2,
                    axon.color,
                    axon.gFactor,
                    this
                )
            );
            const a = this.axons[this.axons.length - 1];
            if (!axon.ellipsoids) return;
            a.ellipsoids.forEach((e, i) => {
                const t = (axon.ellipsoids.length - 1) * (i / (a.ellipsoids.length - 1));
                const index = Math.min(Math.floor(t), axon.ellipsoids.length - 2);
                const w = t - index;
                e.pos = new Vector3(...axon.ellipsoids[index].position)
                    .clone()
                    .multiplyScalar(1 - w)
                    .add(new Vector3(...axon.ellipsoids[index + 1].position).clone().multiplyScalar(w));
                e.shape = addMatrix3(
                    new Matrix3()
                        .set(...axon.ellipsoids[index].shape)
                        .clone()
                        .multiplyScalar(1 - w),
                    new Matrix3()
                        .set(...axon.ellipsoids[index + 1].shape)
                        .clone()
                        .multiplyScalar(w)
                );
            });
        });
        (config.cells || []).forEach(c => {
            const shape = new Matrix3().set(...c.shape);
            const cell = new Ellipsoid(
                new Vector3(...c.position),
                Math.cbrt(shape.determinant()),
                new Mapping({ from: [0], to: [0] }),
                new Mapping({ from: [0], to: [0] }),
                0,
                c.color,
                true
            );
            cell.shape = shape.clone();
            this.cells.push(cell);
        });
        this.computeMinAndMaxDiameter();
    }
    dispose() {
        this.axons.forEach(axon => axon.dispose());
        this.cells.forEach(cell => cell.dispose());
    }
    toJSON() {
        return {
            voxelSize: this.voxelSize.toArray(),
            ellipsoidDensity: this.ellipsoidDensity,
            mapFromDiameterToDeformationFactor: this.deformation.toJSON(),
            mapFromMaxDiameterToMinDiameter: this.minDiameter.toJSON(),
            axons: this.axons.map(axon => axon.toJSON()),
            cells: this.cells.map(cell => ({
                position: cell.pos.toArray(),
                shape: cell.shape.elements,
                color: cell.color
            }))
        };
    }
    toPLY(binary, simple) {
        return plyParser(
            [
                this.axons.map(a =>
                    a.meshes.filter((_, i) => i !== 1 || Number(a.gFactor) !== 1).map(mesh => mesh.geometry)
                ),
                this.cells.map(c => c.mesh.geometry)
            ]
                .flat()
                .flat()
                .map(geom => BufferGeometryUtils.mergeVertices(geom)),
            {
                binary: binary,
                includeColors: !simple,
                includeNormals: !simple
            }
        );
    }
    keepInVoxel(minDist) {
        this.axons.forEach(axon => axon.keepInVoxel(minDist));
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
        this.axons.forEach(a =>
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
            this.axons.push(
                new Axon(
                    randomPosition().multiply(this.voxelSize),
                    randomPosition(),
                    0.1 + Math.random() * 10,
                    undefined,
                    gFactor,
                    this
                )
            );
        this.computeMinAndMaxDiameter();
        console.log("Total number of axons: " + this.axons.length);
    }
    addCellsRandomly(cellCount, minDist) {
        for (let i = 0; i < cellCount; ++i) {
            const p = randomPosition().multiply(this.voxelSize);
            const r = 2.5 + Math.random() * 7;
            this.cells.push(
                new Ellipsoid(
                    p,
                    r,
                    new Mapping({ from: [0, 1], to: [0, 0] }),
                    new Mapping({ from: [0, 1], to: [0, 0.01] }),
                    1,
                    null,
                    true
                )
            );
        }
        const maxOverlap = 0.0001;
        this.cells.forEach(a => a.grow(1));
        for (let mo = 1; mo > maxOverlap; ) {
            this.cells.forEach((a, i) => {
                this.cells.forEach((b, j) => {
                    if (i >= j) return;
                    a.collision(b, maxOverlap, maxOverlap);
                });
            });
            mo = 0;
            this.cells.forEach(c => c.keepInVoxel(this.voxelSize, minDist, true));
            this.cells.forEach((a, i) => {
                this.cells.forEach((b, j) => {
                    if (i >= j) return;
                    mo = Math.max(mo, a.getOverlap(b, 0, mo));
                });
            });
            this.cells.forEach(a => a.grow(-0.05));
        }
        this.cells.forEach(a => {
            a.deformation = new Mapping({ from: [0], to: [0] });
            a.movement = 0;
        });
        this.computeMinAndMaxDiameter();
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
                        .multiply(new Vector3().fromArray(this.voxelSize.toArray().map(v => v - 2 * border)));
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
                for (let i = 0; i < contractSpeed; ++i)
                    this.axons.forEach(axon => axon.contract(Math.min(contractSpeed - i, 1)));
                this.updateState = { name: "keepInVoxel", progress: 0 };
                break;
            case "keepInVoxel":
                this.keepInVoxel(minDist);
                this.updateState.name = "collision";
                break;
            case "collision":
                this.collision(minDist, maxOverlap);
                this.updateState.name = "getOverlap";
                break;
            case "getOverlap": {
                const mo = this.getOverlap(minDist, maxOverlap * 0.999);
                if (mo < maxOverlap) {
                    this.updateState = { name: "volumeFraction", progress: 0 };
                    break;
                }
                ++this.updateState.progress;
                if (this.updateState.progress === 100) this.updateState = { name: "volumeFraction", progress: 0 };
                else this.updateState.name = "keepInVoxel";
                break;
            }
            case "volumeFraction": {
                const [avf, cvf] = this.volumeFraction(20, border);
                this.updateState = { name: "ready", volumeFraction: [avf, cvf] };
                this.computeMinAndMaxDiameter();
                break;
            }
            default:
                this.updateState = { name: "ready" };
                break;
        }
        return this.updateState;
    }
    generatePipes(scene, resolution, extended, viewSizes) {
        this.axons.forEach(axon => {
            axon.generatePipes(scene, resolution, extended, viewSizes, this.minAndMaxDiameterAxons);
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
        const size = new Vector3().fromArray(this.voxelSize.toArray().map(v => v - 2 * border));
        if (border > 0) scene.add(wireframeCube(size));
    }
    drawAxons(scene, mode, viewSizes, resolution, extended) {
        switch (mode) {
            case "skeleton":
                this.axons.forEach(axon => axon.generateSkeleton(scene, viewSizes, this.minAndMaxDiameterAxons));
                break;
            case "pipes":
                this.generatePipes(scene, resolution, extended, viewSizes);
                break;
            case "ellipsoids": {
                this.axons.forEach(axon => axon.draw(scene, viewSizes, this.minAndMaxDiameterAxons));
                break;
            }
            default:
                break;
        }
    }
    drawCells(scene, mode, viewSizes) {
        if (mode === "none") return;
        this.cells.forEach(cell => cell.draw(scene, true, viewSizes, this.minAndMaxDiameterCells));
    }
    computeMinAndMaxDiameter() {
        const dAxons = this.axons.map(a => a.getMinAndMaxDiameter());
        const dCells = this.cells.map(c => c.diameter());
        this.minAndMaxDiameterAxons =
            dAxons.length > 0
                ? {
                      min: Math.min(...dAxons.map(d => d.min)),
                      max: Math.max(...dAxons.map(d => d.max))
                  }
                : undefined;
        this.minAndMaxDiameterCells =
            dCells.length > 0
                ? {
                      min: Math.min(...dCells),
                      max: Math.max(...dCells)
                  }
                : undefined;
    }
    draw(voxelMode, axonMode, cellMode, resolution, extended, border, viewSizes) {
        const scene = new Scene();
        this.drawLight(scene);
        this.drawVoxels(scene, voxelMode, border);
        this.drawCells(scene, cellMode, viewSizes);
        this.drawAxons(scene, axonMode, viewSizes, resolution, extended);
        return scene;
    }
    point(camPos, cursorDir, viewSizes) {
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
        if (minDist < 100000 && (this.focus || {}).object === result.object) return this.focus;
        if ((result || {}).type === "axon")
            result.object.meshes.forEach(
                mesh => (mesh.material = new MeshPhongMaterial({ color: new Color(0xffffff), side: DoubleSide }))
            );
        this.focus = result;
        if ((((this.focus || {}).object || {}).mesh || {}).material)
            this.focus.object.mesh.material = new MeshToonMaterial({ color: new Color(0xffffff) });
        this.deselectAll(viewSizes);
        return this.focus;
    }
    deselectAll(viewSizes) {
        this.axons.forEach(axon => {
            if (axon === (this.focus || {}).object) return;
            axon.meshes.forEach(
                mesh => (mesh.material = new MeshPhongMaterial({ vertexColors: VertexColors, side: DoubleSide }))
            );
        });
        this.cells.forEach(cell => {
            if (cell === (this.focus || {}).object) return;
            cell.mesh.material = new MeshToonMaterial({ color: cell.getColor(viewSizes, this.minAndMaxDiameterCells) });
        });
    }
}
