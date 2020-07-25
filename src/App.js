import React, { useEffect, useRef, useState } from "react";
import { Vector3, Matrix3, PerspectiveCamera, WebGLRenderer } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter";
import { PLYExporter } from "three/examples/jsm/exporters/PLYExporter";

import Synthesizer from "./synthesizer";
import Mapping from "./mapping";

import InputFormat from "./inputFormat";

export default props => {
    const mount = useRef();
    const maxOverlap = 0.0001;
    const [controls, setControls] = useState(null);
    const [scene, setScene] = useState(null);
    const [camera, setCamera] = useState(null);
    const [renderer, setRenderer] = useState(null);
    const [synthesizer, setSynthesizer] = useState(null);
    const [frame, setFrame] = useState(0);
    const [viewModeVoxel, setViewModeVoxel] = useState("all");
    const [viewModeAxon, setViewModeAxon] = useState("ellipsoids");
    const [viewModeCell, setViewModeCell] = useState("all");
    const [volumeFraction, setVolumeFraction] = useState([]);
    const [volumeFractionTarget, setVolumeFractionTarget] = useState(null);
    const [voxelSize, setVoxelSize] = useState(5);
    const [gridSize, setGridSize] = useState(6);
    const [axonCount, setAxonCount] = useState(200);
    const [jointDensity, setJointDensity] = useState(10);
    const [cellCount, setCellCount] = useState(0);
    const [growSpeed, setGrowSpeed] = useState(0.02);
    const [contractSpeed, setContractSpeed] = useState(0.01);
    const [minSeparation, setMinSeparation] = useState(0.3);
    const source = "https://gitlab.gbar.dtu.dk/s164179/axon-generator-toolbox";
    const inputFileRef = useRef();
    const [inputFile, setInputFile] = useState(null);
    const [updateState, setUpdateState] = useState({});
    const [growCount, setGrowCount] = useState(null);
    const [automaticGrowth, setAutomaticGrowth] = useState(false);
    const [exportFormat, setExportFormat] = useState("obj");

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
        if (
            automaticGrowth &&
            updateState.volumeFraction &&
            100 * (updateState.volumeFraction[0] + updateState.volumeFraction[1]) >= volumeFractionTarget
        )
            return setAutomaticGrowth(false);
        if (JSON.stringify(updateState) !== JSON.stringify(synthesizer.updateState)) return;
        if (updateState.name === "ready" && volumeFraction !== updateState.volumeFraction) {
            setVolumeFraction(updateState.volumeFraction);
            setScene(synthesizer.draw(viewModeVoxel, viewModeAxon, viewModeCell));
            setGrowCount(growCount === null ? 0 : growCount + 1);
        }
        if (updateState.name !== "ready" || automaticGrowth) {
            const us = { ...synthesizer.update(growSpeed, contractSpeed, maxOverlap) };
            window.setTimeout(() => setUpdateState(us), 0);
            return;
        }
    }, [
        controls,
        renderer,
        scene,
        camera,
        frame,
        updateState,
        synthesizer,
        viewModeVoxel,
        viewModeAxon,
        viewModeCell,
        growSpeed,
        contractSpeed,
        maxOverlap,
        volumeFraction,
        automaticGrowth,
        growCount,
        volumeFractionTarget
    ]);

    useEffect(() => {
        if (!inputFile) return;
        const reader = new FileReader();
        reader.onload = async event => {
            const data = JSON.parse(event.target.result);

            setVoxelSize(data.voxelSizeInner);
            setGridSize(data.voxelSizeOuter);
            setJointDensity(data.jointsPerAxon);
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
            setScene(s.draw(viewModeVoxel, viewModeAxon, viewModeCell));
            setUpdateState(s.updateState);
        };
        reader.readAsText(inputFile);
        setInputFile(null);
    }, [inputFile, viewModeVoxel, viewModeAxon, viewModeCell]);

    return (
        <>
            <div style={{ display: "flex", flexDirection: "row" }}>
                <div ref={mount} style={{ flex: 1 }} />
                <div style={{ flex: 1 }}>
                    <b>Setup:</b>
                    <br />
                    <label>Inner voxel size: </label>
                    <input type="number" value={voxelSize} onChange={e => setVoxelSize(Number(e.target.value))} />
                    <br />
                    <label>Outer voxel size: </label>
                    <input type="number" value={gridSize} onChange={e => setGridSize(Number(e.target.value))} />
                    <br />
                    <label>Number of axons: </label>
                    <input type="number" value={axonCount} onChange={e => setAxonCount(Number(e.target.value))} />
                    <br />
                    <label>Number of joints per unit length: </label>
                    <input type="number" value={jointDensity} onChange={e => setJointDensity(Number(e.target.value))} />
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
                                jointDensity,
                                new Mapping([0, 0.4, 1], [0, 0.5, 1]),
                                new Mapping([0, 2], [0, 0.2])
                            );
                            s.addAxonsRandomly(axonCount, minSeparation);
                            s.addCellsRandomly(cellCount, minSeparation);
                            setSynthesizer(s);
                            setScene(s.draw(viewModeVoxel, viewModeAxon, viewModeCell));
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
                            <br />
                            <b>After setup:</b>
                            <br />
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
                                onClick={() => {
                                    if (automaticGrowth) return setAutomaticGrowth(false);
                                    const target = window.prompt("Specify total volume fraction target in %");
                                    if (!target) return;
                                    setVolumeFractionTarget(target);
                                    setAutomaticGrowth(true);
                                }}>
                                Automatic growth: {automaticGrowth ? "on" : "off"}
                            </button>
                            {automaticGrowth ? (
                                <>
                                    Stop when total volume fraction is{" "}
                                    <input
                                        type="number"
                                        value={volumeFractionTarget}
                                        onChange={e => setVolumeFractionTarget(Number(e.target.value))}
                                    />{" "}
                                    %
                                </>
                            ) : (
                                <button
                                    onClick={() =>
                                        setUpdateState({ ...synthesizer.update(growSpeed, contractSpeed, maxOverlap) })
                                    }>
                                    Perform 1 grow step
                                </button>
                            )}
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
                            <b>Visual</b>
                            <br />
                            <label>Voxels: </label>
                            <select
                                value={viewModeVoxel}
                                onChange={event => {
                                    const vm = event.target.value;
                                    setViewModeVoxel(vm);
                                    setScene(synthesizer.draw(vm, viewModeAxon, viewModeCell));
                                }}>
                                <option value="none">hide</option>
                                <option value="all">show</option>
                            </select>
                            <br />
                            <label>Axons: </label>
                            <select
                                value={viewModeAxon}
                                onChange={event => {
                                    const vm = event.target.value;
                                    setViewModeAxon(vm);
                                    setScene(synthesizer.draw(viewModeVoxel, vm, viewModeCell));
                                }}>
                                <option value="none">hide</option>
                                <option value="ellipsoids">ellipsoids</option>
                                <option value="skeleton">skeleton</option>
                                <option value="pipes">pipes</option>
                            </select>
                            <br />
                            <label>Cells: </label>
                            <select
                                value={viewModeCell}
                                onChange={event => {
                                    const vm = event.target.value;
                                    setViewModeCell(vm);
                                    setScene(synthesizer.draw(viewModeVoxel, viewModeAxon, vm));
                                }}>
                                <option value="none">hide</option>
                                <option value="all">show</option>
                            </select>
                            <br />
                            <label>Format:</label>
                            <select value={exportFormat} onChange={event => setExportFormat(event.target.value)}>
                                <option value="obj">OBJ</option>
                                <option value="ply">PLY</option>
                            </select>
                            <br />
                            <button
                                onClick={() => {
                                    let exporter = null;
                                    switch (exportFormat) {
                                        case "obj":
                                            exporter = OBJExporter;
                                            break;
                                        case "ply":
                                            exporter = PLYExporter;
                                            break;
                                        default:
                                            exporter = OBJExporter;
                                            break;
                                    }
                                    try {
                                        const link = document.createElement("a");
                                        link.setAttribute(
                                            "href",
                                            "data:text/obj;charset=utf-8," + new exporter().parse(scene, {})
                                        );
                                        link.setAttribute("download", "axons." + exportFormat);
                                        window.document.body.appendChild(link);
                                        link.click();
                                        window.document.body.removeChild(link);
                                    } catch (err) {
                                        console.log(err);
                                    }
                                }}>
                                Export
                            </button>
                        </>
                    )}
                </div>
            </div>
            <b>To get started:</b>
            <ul>
                <li>Press "Initialize"</li>
                <li>Press "Perform 1 grow step" until the volume fraction is at least 30%</li>
                <li>Switch the view mode to "pipes" to see the final result</li>
            </ul>
            <br />
            <InputFormat />
            <br />
            Source: <a href={source}>{source}</a>
        </>
    );
};
