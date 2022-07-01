import {
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
    Color,
    DoubleSide,
    Geometry,
    BufferGeometry
} from "three";
import { addMatrix3, randomPosition, shuffle } from "./helperFunctions";
import random from "./random";
import createAxon, { Axon, AxonJSON } from "./axon";
import { BufferGeometryUtils } from "./BufferGeometryUtils";
import createEllipsoid, { Ellipsoid, CellJSON } from "./ellipsoid";
import createMapping, { Mapping, MappingJSON } from "./mapping";
import plyParser from "./plyParser";

const wireframeCube = (size: Vector3) =>
    new LineSegments(
        new EdgesGeometry(new BoxGeometry(size.x, size.y, size.z)),
        new LineBasicMaterial({ color: 0xffffff, linewidth: 2 })
    );

export type SynthesizerJSON = {
    voxelSize: number[];
    ellipsoidDensity: number;
    mapFromDiameterToDeformationFactor: MappingJSON;
    mapFromMaxDiameterToMinDiameter: MappingJSON;
    axons: AxonJSON[];
    cells: CellJSON[];
};

type UpdateState = {
    name: string;
    progress: number;
    volumeFraction?: [number, number];
};

type Focus = {
    type: string;
    object: Axon | Ellipsoid | null;
};

const isAxon = (type: string, object: Axon | Ellipsoid | null): object is Axon => type === "axon";

interface SynthesizerState {
    voxelSize: Vector3;
    ellipsoidDensity: number;
    deformation: Mapping;
    minDiameter: Mapping;
    axons: Axon[];
    cells: Ellipsoid[];
    updateState: UpdateState;
    focus: Focus;
    minAndMaxDiameterAxons: { min: number; max: number };
    minAndMaxDiameterCells: { min: number; max: number };
}

export interface Synthesizer extends SynthesizerState {
    dispose: () => void;
    toJSON: () => SynthesizerJSON;
    toPLY: (binary: boolean, simple: boolean) => string | DataView;
    keepInVoxel: (minDist: number) => void;
    collision: (minDist: number, maxOverlap: number) => void;
    getOverlap: (minDist: number, maxOverlap: number) => number;
    addAxonsRandomly: (axonCount: number, gRatio: number) => void;
    addCellsRandomly: (cellCount: number, minDist: number) => void;
    volumeFraction: (n: number, border: number) => [number, number];
    update: (growSpeed: number, contractSpeed: number, minDist: number, maxOverlap: number, border: number) => void;
    generatePipes: (scene: Scene, resolution: number, extended: boolean, viewSizes: boolean) => Scene;
    drawLight: (scene: Scene) => void;
    drawVoxels: (scene: Scene, mode: string, border: number) => void;
    drawAxons: (scene: Scene, mode: string, viewSizes: boolean, resolution: number, extended: boolean) => void;
    drawCells: (scene: Scene, mode: string) => void;
    computeMinAndMaxDiameter: () => void;
    draw: (
        voxelMode: string,
        axonMode: string,
        cellMode: string,
        resolution: number,
        extended: boolean,
        border: number,
        viewSizes: boolean
    ) => Scene;
    point: (camPos: Vector3, cursorDir: Vector3) => Focus;
    deselectAll: () => void;
}

const createSynthesizer = (config: SynthesizerJSON): Synthesizer => {
    const synthesizer: SynthesizerState = {
        voxelSize:
            typeof config.voxelSize === "number"
                ? new Vector3(config.voxelSize, config.voxelSize, config.voxelSize)
                : new Vector3().fromArray(config.voxelSize),
        ellipsoidDensity: Number(config.ellipsoidDensity),
        deformation: createMapping(config.mapFromDiameterToDeformationFactor),
        minDiameter: createMapping(config.mapFromMaxDiameterToMinDiameter),
        axons: [],
        cells: [],
        updateState: {
            name: "ready",
            progress: 0
        },
        focus: {
            type: "",
            object: null
        },
        minAndMaxDiameterAxons: { min: 0, max: 0 },
        minAndMaxDiameterCells: { min: 0, max: 0 }
    };
    (config.axons || []).forEach(axon => {
        synthesizer.axons.push(
            createAxon(
                new Vector3(...axon.position),
                new Vector3(...axon.direction),
                axon.maxDiameter / 2,
                axon.color,
                axon.gRatio,
                synthesizer
            )
        );
        const a = synthesizer.axons[synthesizer.axons.length - 1];
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
                    .fromArray(axon.ellipsoids[index].shape)
                    .clone()
                    .multiplyScalar(1 - w),
                new Matrix3()
                    .fromArray(axon.ellipsoids[index + 1].shape)
                    .clone()
                    .multiplyScalar(w)
            );
        });
    });

    const computeMinAndMaxDiameter = () => {
        const dAxons = synthesizer.axons.map(a => a.getMinAndMaxDiameter());
        const dCells = synthesizer.cells.map(c => c.diameter());
        synthesizer.minAndMaxDiameterAxons = {
            min: Math.min(...dAxons.map(d => d.min)),
            max: Math.max(...dAxons.map(d => d.max))
        };
        synthesizer.minAndMaxDiameterCells = {
            min: Math.min(...dCells),
            max: Math.max(...dCells)
        };
    };

    (config.cells || []).forEach(c => {
        const shape = new Matrix3().fromArray(c.shape);
        const cell = createEllipsoid(
            new Vector3(...c.position),
            Math.cbrt(shape.determinant()),
            createMapping({ from: [0], to: [0] }),
            createMapping({ from: [0], to: [0] }),
            0,
            c.color,
            true
        );
        cell.shape = shape.clone();
        synthesizer.cells.push(cell);
    });
    computeMinAndMaxDiameter();

    const dispose = () => {
        synthesizer.axons.forEach(axon => axon.dispose());
        synthesizer.cells.forEach(cell => cell.dispose());
    };
    const toJSON = () => {
        return {
            voxelSize: synthesizer.voxelSize.toArray(),
            ellipsoidDensity: synthesizer.ellipsoidDensity,
            mapFromDiameterToDeformationFactor: synthesizer.deformation.toJSON(),
            mapFromMaxDiameterToMinDiameter: synthesizer.minDiameter.toJSON(),
            axons: synthesizer.axons.map(axon => axon.toJSON()),
            cells: synthesizer.cells.map(cell => ({
                position: cell.pos.toArray(),
                shape: cell.shape.elements,
                color: cell.color
            }))
        };
    };
    const toPLY = (binary: boolean, simple: boolean) => {
        return plyParser(
            [
                synthesizer.axons.map(a =>
                    a.meshes.filter((_, i) => i !== 1 || Number(a.gRatio) !== 1).map(mesh => mesh.geometry)
                ),
                synthesizer.cells.map(c => c.mesh?.geometry || new BufferGeometry())
            ]
                .flat()
                .flat()
                .map(geom => (geom instanceof Geometry ? new BufferGeometry().fromGeometry(geom) : geom))
                .map(geom => BufferGeometryUtils.mergeVertices(geom)),
            {
                binary: binary,
                includeColors: !simple,
                includeNormals: !simple,
                littleEndian: false
            }
        );
    };
    const keepInVoxel = (minDist: number) => {
        synthesizer.axons.forEach(axon => axon.keepInVoxel(minDist));
    };
    const collision = (minDist: number, maxOverlap: number) => {
        synthesizer.axons.forEach(a => a.computeCollisionTree(minDist));
        const pairs: Axon[][] = [];
        synthesizer.axons.forEach((a, i) => {
            synthesizer.axons.forEach((b, j) => {
                if (i < j) pairs.push(shuffle([a, b]));
            });
        });
        shuffle(pairs);
        pairs.forEach(pair => pair[0].collision(pair[1], minDist, maxOverlap));
        synthesizer.axons.forEach(a =>
            a.ellipsoids.forEach(ellipsoid =>
                synthesizer.cells.forEach(c => ellipsoid.collision(c, minDist, maxOverlap))
            )
        );
    };
    const getOverlap = (minDist: number, maxOverlap: number) => {
        let result = maxOverlap;
        synthesizer.axons.forEach(a => a.computeCollisionTree(minDist));
        synthesizer.axons.forEach((a, i) => {
            synthesizer.axons.forEach((b, j) => {
                if (i >= j) return;
                result = Math.max(result, a.getOverlap(b, minDist, result));
            });
        });
        return result;
    };
    const addAxonsRandomly = (axonCount: number, gRatio: number) => {
        for (let i = 0; i < axonCount; ++i)
            synthesizer.axons.push(
                createAxon(
                    randomPosition().multiply(synthesizer.voxelSize),
                    randomPosition(),
                    0.1 + random() * 10,
                    undefined,
                    gRatio,
                    synthesizer
                )
            );
        computeMinAndMaxDiameter();
        console.log("Total number of axons: " + synthesizer.axons.length);
    };
    const addCellsRandomly = (cellCount: number, minDist: number) => {
        for (let i = 0; i < cellCount; ++i) {
            const p = randomPosition().multiply(synthesizer.voxelSize);
            const r = 2.5 + random() * 7;
            synthesizer.cells.push(
                createEllipsoid(
                    p,
                    r,
                    createMapping({ from: [0, 1], to: [0, 0] }),
                    createMapping({ from: [0, 1], to: [0, 0.01] }),
                    1,
                    undefined,
                    true
                )
            );
        }
        const maxOverlap = 0.0001;
        synthesizer.cells.forEach(a => a.grow(1));
        for (let mo = 1; mo > maxOverlap; ) {
            synthesizer.cells.forEach((a, i) => {
                synthesizer.cells.forEach((b, j) => {
                    if (i >= j) return;
                    a.collision(b, maxOverlap, maxOverlap);
                });
            });
            mo = 0;
            synthesizer.cells.forEach(c => c.keepInVoxel(synthesizer.voxelSize, minDist, true));
            synthesizer.cells.forEach((a, i) => {
                synthesizer.cells.forEach((b, j) => {
                    if (i >= j) return;
                    mo = Math.max(mo, a.getOverlap(b, 0, mo));
                });
            });
            synthesizer.cells.forEach(a => a.grow(-0.05));
        }
        synthesizer.cells.forEach(a => {
            a.deformation = createMapping({ from: [0], to: [0] });
            a.movement = 0;
        });
        computeMinAndMaxDiameter();
    };
    const volumeFraction = (n: number, border: number): [number, number] => {
        synthesizer.axons.forEach(axon => axon.computeCollisionTree(0));
        let axonCount = 0;
        let cellCount = 0;
        for (let i = 0; i < n; ++i) {
            for (let j = 0; j < n; ++j) {
                for (let k = 0; k < n; ++k) {
                    const p = new Vector3(i + 0.5, j + 0.5, k + 0.5)
                        .divideScalar(n)
                        .sub(new Vector3(0.5, 0.5, 0.5))
                        .multiply(new Vector3().fromArray(synthesizer.voxelSize.toArray().map(v => v - 2 * border)));
                    let inside = false;
                    synthesizer.axons.forEach(axon => {
                        if (axon.collisionTree.containsPoint(p)) inside = true;
                    });
                    if (inside) ++axonCount;
                    inside = false;
                    synthesizer.cells.forEach(cell => {
                        if (cell.containsPoint(p)) inside = true;
                    });
                    if (inside) ++cellCount;
                }
            }
        }
        return [axonCount / (n * n * n), cellCount / (n * n * n)];
    };
    const update = (growSpeed: number, contractSpeed: number, minDist: number, maxOverlap: number, border: number) => {
        switch (synthesizer.updateState.name) {
            case "ready":
                synthesizer.updateState = { name: "grow", progress: 0 };
                break;
            case "grow":
                synthesizer.axons.forEach(axon => axon.grow(growSpeed));
                synthesizer.updateState = { name: "contract", progress: 0 };
                break;
            case "contract":
                for (let i = 0; i < contractSpeed; ++i)
                    synthesizer.axons.forEach(axon => axon.contract(Math.min(contractSpeed - i, 1)));
                synthesizer.updateState = { name: "keepInVoxel", progress: 0 };
                break;
            case "keepInVoxel":
                keepInVoxel(minDist);
                synthesizer.updateState.name = "collision";
                break;
            case "collision":
                collision(minDist, maxOverlap);
                synthesizer.updateState.name = "getOverlap";
                break;
            case "getOverlap": {
                const mo = getOverlap(minDist, maxOverlap * 0.999);
                if (mo < maxOverlap) {
                    synthesizer.updateState = { name: "volumeFraction", progress: 0 };
                    break;
                }
                ++synthesizer.updateState.progress;
                if (synthesizer.updateState.progress === 100)
                    synthesizer.updateState = { name: "volumeFraction", progress: 0 };
                else synthesizer.updateState.name = "keepInVoxel";
                break;
            }
            case "volumeFraction": {
                const [avf, cvf] = volumeFraction(20, border);
                synthesizer.updateState = { name: "ready", progress: 0, volumeFraction: [avf, cvf] };
                computeMinAndMaxDiameter();
                break;
            }
            default:
                synthesizer.updateState = { name: "ready", progress: 0 };
                break;
        }
        return synthesizer.updateState;
    };
    const generatePipes = (scene: Scene, resolution: number, extended: boolean, viewSizes: boolean) => {
        synthesizer.axons.forEach(axon => {
            axon.generatePipes(scene, resolution, extended, viewSizes, synthesizer.minAndMaxDiameterAxons);
        });
        return scene;
    };
    const drawLight = (scene: Scene) => {
        scene.add(new AmbientLight(0xffffff, 0.4));
        const light = new DirectionalLight(0xffffff, 0.4);
        light.position.set(0, 1, 0);
        scene.add(light);
    };
    const drawVoxels = (scene: Scene, mode: string, border: number) => {
        if (mode === "none") return;
        scene.add(wireframeCube(synthesizer.voxelSize));
        const size = new Vector3().fromArray(synthesizer.voxelSize.toArray().map(v => v - 2 * border));
        if (border > 0) scene.add(wireframeCube(size));
    };
    const drawAxons = (scene: Scene, mode: string, viewSizes: boolean, resolution: number, extended: boolean) => {
        switch (mode) {
            case "skeleton":
                synthesizer.axons.forEach(axon =>
                    axon.generateSkeleton(scene, viewSizes, synthesizer.minAndMaxDiameterAxons)
                );
                break;
            case "pipes":
                generatePipes(scene, resolution, extended, viewSizes);
                break;
            case "ellipsoids": {
                synthesizer.axons.forEach(axon => axon.draw(scene, viewSizes, synthesizer.minAndMaxDiameterAxons));
                break;
            }
            default:
                break;
        }
    };
    const drawCells = (scene: Scene, mode: string) => {
        if (mode === "none") return;
        synthesizer.cells.forEach(cell => cell.draw(scene, true, synthesizer.minAndMaxDiameterCells));
    };
    const draw = (
        voxelMode: string,
        axonMode: string,
        cellMode: string,
        resolution: number,
        extended: boolean,
        border: number,
        viewSizes: boolean
    ) => {
        const scene = new Scene();
        drawLight(scene);
        drawVoxels(scene, voxelMode, border);
        drawCells(scene, cellMode);
        drawAxons(scene, axonMode, viewSizes, resolution, extended);
        return scene;
    };
    const point = (camPos: Vector3, cursorDir: Vector3) => {
        let result: Focus = {
            type: "",
            object: null
        };
        let minDist = 10000000;
        const pos = camPos.clone().add(cursorDir.clone().multiplyScalar(1000000));
        const dir = cursorDir.clone().negate();
        [
            synthesizer.axons.map(a => ({ type: "axon", object: a })),
            synthesizer.cells.map(c => ({ type: "cell", object: c }))
        ]
            .flat()
            .forEach(item => {
                const sp = item.object.getSurfacePoint(pos, dir);
                if (!sp) return;
                const dist = cursorDir.dot(sp.clone().sub(camPos));
                if (dist > minDist) return;
                minDist = dist;
                result = item;
            });
        if (minDist < 100000 && synthesizer.focus.object === result.object) return synthesizer.focus;
        if (isAxon(result.type, result.object))
            result.object.meshes.forEach(
                mesh => (mesh.material = new MeshPhongMaterial({ color: new Color(0xffffff), side: DoubleSide }))
            );
        synthesizer.focus = result;
        const mesh = (synthesizer.focus.object as Ellipsoid)?.mesh;
        if (mesh?.material) mesh.material = new MeshToonMaterial({ color: new Color(0xffffff) });
        deselectAll();
        return synthesizer.focus;
    };
    const deselectAll = () => {
        synthesizer.axons.forEach(axon => {
            if (axon === (synthesizer.focus || {}).object) return;
            axon.meshes.forEach(
                mesh => (mesh.material = new MeshPhongMaterial({ vertexColors: true, side: DoubleSide }))
            );
        });
        synthesizer.cells.forEach(cell => {
            if (cell === synthesizer.focus.object) return;
            if (!cell.mesh) return;
            cell.mesh.material = new MeshToonMaterial({
                color: cell.getColor(synthesizer.minAndMaxDiameterCells)
            });
        });
    };
    return Object.assign(synthesizer, {
        dispose,
        toJSON,
        toPLY,
        keepInVoxel,
        collision,
        getOverlap,
        addAxonsRandomly,
        addCellsRandomly,
        volumeFraction,
        update,
        generatePipes,
        drawLight,
        drawVoxels,
        drawAxons,
        drawCells,
        computeMinAndMaxDiameter,
        draw,
        point,
        deselectAll
    });
};

export default createSynthesizer;
