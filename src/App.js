import React, { useEffect, useRef, useState } from "react";
import { Vector3, Matrix3, PerspectiveCamera, WebGLRenderer } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

import Synthesizer from "./synthesizer";
import Mapping from "./mapping";

export default props => {
    const mount = useRef();
    const maxOverlap = 0.0001;
    const [controls, setControls] = useState(null);
    const [scene, setScene] = useState(null);
    const [camera, setCamera] = useState(null);
    const [renderer, setRenderer] = useState(null);
    const [synthesizer, setSynthesizer] = useState(null);
    const [frame, setFrame] = useState(0);
    const [viewMode, setViewMode] = useState("ellipsoids");
    const [showCells, setShowCells] = useState(true);
    const [volumeFraction, setVolumeFraction] = useState([]);
    const [voxelSize, setVoxelSize] = useState(5);
    const [gridSize, setGridSize] = useState(6);
    const [axonCount, setAxonCount] = useState(200);
    const [jointCount, setJointCount] = useState(50);
    const [cellCount, setCellCount] = useState(0);
    const [growSpeed, setGrowSpeed] = useState(0.02);
    const [contractSpeed, setContractSpeed] = useState(0.01);
    const [minSeparation, setMinSeparation] = useState(0.3);
    const source = "https://gitlab.gbar.dtu.dk/s164179/axon-generator-toolbox";
    const inputFileRef = useRef();
    const [inputFile, setInputFile] = useState(null);
    const [updateState, setUpdateState] = useState({});
    const [growCount, setGrowCount] = useState(null);

    useEffect(() => {
        if (!mount.current) return;
        const width = 640;
        const height = 480;
        // Camera
        const cam = new PerspectiveCamera(75, width / height, 0.1, 1000);
        cam.position.set(5, 5, 5);
        cam.lookAt(0, 0, 0);
        setCamera(cam);
        // Renderer
        const ren = new WebGLRenderer({ antialias: true });
        ren.setClearColor("#000000");
        ren.setSize(width, height);
        mount.current.appendChild(ren.domElement);
        setRenderer(ren);
        // Controls
        const ctrls = new OrbitControls(cam, ren.domElement);
        ctrls.enableDamping = true;
        ctrls.dampingFactor = 0.5;
        setControls(ctrls);
        // Animate
        window.setInterval(() => setFrame(frame => frame + 1), 1000 / 30);
    }, [mount]);

    useEffect(() => {
        if (controls) controls.update();
        if (renderer && scene && camera) renderer.render(scene, camera);
        if (!synthesizer) return;
        if (!updateState.name) return;
        if (JSON.stringify(updateState) !== JSON.stringify(synthesizer.updateState)) return;
        if (updateState.name !== "ready") {
            const us = { ...synthesizer.update(growSpeed, contractSpeed, maxOverlap) };
            window.setTimeout(() => setUpdateState(us), 0);
            return;
        }
        if (volumeFraction === updateState.volumeFraction) return;
        setVolumeFraction(updateState.volumeFraction);
        setScene(synthesizer.draw(viewMode, showCells));
        setGrowCount(growCount === null ? 0 : growCount + 1);
    }, [
        controls,
        renderer,
        scene,
        camera,
        frame,
        updateState,
        synthesizer,
        viewMode,
        showCells,
        growSpeed,
        contractSpeed,
        maxOverlap,
        volumeFraction
    ]);

    useEffect(() => {
        if (!inputFile) return;
        const reader = new FileReader();
        reader.onload = async event => {
            const data = JSON.parse(event.target.result);

            setVoxelSize(data.voxelSizeInner);
            setGridSize(data.voxelSizeOuter);
            setJointCount(data.jointsPerAxon);
            setGrowSpeed(data.grow);
            setContractSpeed(data.contract);

            const s = new Synthesizer(
                data.voxelSizeInner,
                data.voxelSizeOuter,
                data.jointsPerAxon,
                new Mapping(data.mapFromDiameterToDeformationFactor.from, data.mapFromDiameterToDeformationFactor.to),
                new Mapping(data.mapFromMaxDiameterToMinDiameter.from, data.mapFromMaxDiameterToMinDiameter.to)
            );
            data.axons.forEach(axon =>
                s.addAxon(new Vector3(...axon.position), new Vector3(...axon.direction), axon.maxDiameter, 0)
            );
            data.cells.forEach(cell => s.addCell(new Vector3(...cell.position), new Matrix3().set(...cell.shape)));
            setSynthesizer(s);
            setScene(s.draw(viewMode, showCells));
        };
        reader.readAsText(inputFile);
        setInputFile(null);
    }, [inputFile, viewMode, showCells]);

    return (
        <>
            <div style={{ display: "flex", flexDirection: "row" }}>
                <div ref={mount} style={{ flex: 1 }} />
                <div style={{ flex: 1 }}>
                    <p>Setup:</p>
                    <label>Inner voxel size: </label>
                    <input type="number" value={voxelSize} onChange={e => setVoxelSize(Number(e.target.value))} />
                    <br />
                    <label>Outer voxel size: </label>
                    <input type="number" value={gridSize} onChange={e => setGridSize(Number(e.target.value))} />
                    <br />
                    <label>Number of axons: </label>
                    <input type="number" value={axonCount} onChange={e => setAxonCount(Number(e.target.value))} />
                    <br />
                    <label>Number of joints per axon: </label>
                    <input type="number" value={jointCount} onChange={e => setJointCount(Number(e.target.value))} />
                    <br />
                    <label>Number of cells: </label>
                    <input type="number" value={cellCount} onChange={e => setCellCount(Number(e.target.value))} />
                    <br />
                    <label>Minimum separation of axon endpoints (0: none, 1: completely separated): </label>
                    <input
                        type="number"
                        value={minSeparation}
                        onChange={e => setMinSeparation(Number(e.target.value))}
                    />
                    <br />
                    <button
                        onClick={() => {
                            const s = new Synthesizer(
                                voxelSize,
                                gridSize,
                                jointCount,
                                new Mapping([0, 0.4, 1], [0, 0.5, 1]),
                                new Mapping([0, 2], [0, 0.2])
                            );
                            s.addAxonsRandomly(axonCount, minSeparation);
                            s.addCellsRandomly(cellCount, minSeparation);
                            setSynthesizer(s);
                            setScene(s.draw(viewMode, showCells));
                            setUpdateState(s.updateState);
                        }}>
                        Initialize
                    </button>
                    {" or "}
                    <button
                        onClick={() => {
                            inputFileRef.current.click();
                        }}>
                        upload input file
                    </button>
                    <input
                        ref={inputFileRef}
                        type="file"
                        style={{ display: "none" }}
                        onClick={e => (e.target.value = null)}
                        onChange={e => {
                            setInputFile(e.target.files[0]);
                        }}
                    />
                    {synthesizer && (
                        <>
                            <p>After setup:</p>
                            <label>Grow speed (between 0 and 1): </label>
                            <input
                                type="number"
                                value={growSpeed}
                                onChange={e => setGrowSpeed(Number(e.target.value))}
                            />
                            <br />
                            <label>Contract speed (between 0 and 1): </label>
                            <input
                                type="number"
                                value={contractSpeed}
                                onChange={e => setContractSpeed(Number(e.target.value))}
                            />
                            <br />
                            <button
                                onClick={() =>
                                    setUpdateState({ ...synthesizer.update(growSpeed, contractSpeed, maxOverlap) })
                                }>
                                Perform 1 grow step
                            </button>
                            <div>Volume fraction of inner voxel:</div>
                            <ul>
                                <li>Axons: {100 * (volumeFraction || ["", ""])[0]}%</li>
                                <li>Cells: {100 * (volumeFraction || ["", ""])[1]}%</li>
                                <li>
                                    Total: {100 * ((volumeFraction || ["", ""])[0] + (volumeFraction || ["", ""])[1])}%
                                </li>
                            </ul>
                            <br />
                            <div>
                                Status: {updateState.name}
                                {updateState.progress !== undefined ? `, iteration ${updateState.progress}` : ""}
                            </div>
                            <div>Grow steps completed: {growCount}</div>
                            <button
                                onClick={() => {
                                    const vm = viewMode === "ellipsoids" ? "pipes" : "ellipsoids";
                                    setViewMode(vm);
                                    setScene(synthesizer.draw(vm, showCells));
                                }}>
                                View mode: {viewMode}
                            </button>
                            <button
                                onClick={() => {
                                    try {
                                        const link = document.createElement("a");
                                        link.setAttribute(
                                            "href",
                                            "data:text/obj;charset=utf-8," + synthesizer.exportFile()
                                        );
                                        link.setAttribute("download", "axons.obj");
                                        window.document.body.appendChild(link);
                                        link.click();
                                        window.document.body.removeChild(link);
                                    } catch (err) {
                                        console.log(err);
                                    }
                                }}>
                                Export as pipes
                            </button>
                            <button
                                onClick={() => {
                                    setShowCells(!showCells);
                                    setScene(synthesizer.draw(viewMode, !showCells));
                                }}>
                                Show cells: {String(showCells)}
                            </button>
                        </>
                    )}
                </div>
            </div>
            Source: <a href={source}>{source}</a>
            <br />
            <p>To get started:</p>
            <ul>
                <li>Press "Initialize"</li>
                <li>Press "Grow" until the volume fraction is at least 30%</li>
                <li>Switch the view mode to "pipes" to see the final result</li>
                <li>Press "Export as pipes" to download the scene as an OBJ file (this might take some time)</li>
            </ul>
        </>
    );
};
