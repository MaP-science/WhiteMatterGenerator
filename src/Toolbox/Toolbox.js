import React, { useEffect, useRef, useState } from "react";
import { Vector3, Matrix3, PerspectiveCamera, WebGLRenderer, Geometry } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import {
    Grid,
    Paper,
    makeStyles,
    TextField,
    Button,
    List,
    ListItem,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableRow,
    FormControl,
    InputLabel,
    InputAdornment,
    Select,
    MenuItem,
    FormControlLabel,
    Switch
} from "@material-ui/core";
import download from "in-browser-download";

import plyParser from "../core/plyParser";
import Synthesizer from "../core/synthesizer";
import Mapping from "../core/mapping";

const round2Decimals = n => Math.round(n * 100) / 100;

const useStyles = makeStyles(theme => ({
    gridItem: {
        padding: theme.spacing(2),
        textAlign: "center"
    }
}));

const width = window.innerWidth * 0.55;
const height = window.innerHeight * 0.9;

export default props => {
    const fov = 75;
    const classes = useStyles();
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
    const [resolution, setResolution] = useState(32);
    const [viewModeCell, setViewModeCell] = useState("all");
    const [volumeFraction, setVolumeFraction] = useState([]);
    const [volumeFractionTarget, setVolumeFractionTarget] = useState(null);
    const [voxelSize, setVoxelSize] = useState(100);
    const [axonCount, setAxonCount] = useState(50);
    const [ellipsoidDensity, setEllipsoidDensity] = useState(10);
    const [cellCount, setCellCount] = useState(0);
    const [growSpeed, setGrowSpeed] = useState(0.02);
    const [contractSpeed, setContractSpeed] = useState(0.1);
    const [minDist, setMinDist] = useState(0.01);
    const inputFileRef = useRef();
    const [inputFile, setInputFile] = useState(null);
    const [updateState, setUpdateState] = useState({});
    const [growCount, setGrowCount] = useState(null);
    const [automaticGrowth, setAutomaticGrowth] = useState(false);
    const [mapFromDiameterToDeformationFactor, setMapFromDiameterToDeformationFactor] = useState({
        from: [0, 2],
        to: [0, 0.2]
    });
    const [mapFromMaxDiameterToMinDiameter, setMapFromMaxDiameterToMinDiameter] = useState({
        from: [0, 2],
        to: [0, 0.2]
    });
    const [selectItem, setSelectItem] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [exportBinary, setExportBinary] = useState(true);
    const [exportSimple, setExportSimple] = useState(false);
    const [border, setBorder] = useState(0);
    const [gFactor, setGFactor] = useState(0.7);
    useEffect(() => {
        if (!mount.current) return;
        // Camera
        const cam = new PerspectiveCamera(fov, width / height, 0.1, 1000);
        cam.position.set(50, 50, 50);
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
        if (!selectItem) return;
        if (!synthesizer) return;
        if (!renderer) return;
        if (!camera) return;
        if (!["ellipsoids", "pipes"].includes(viewModeAxon)) return;
        const mousemove = e => {
            const x = (e.offsetX / width - 0.5) * 2 * Math.tan((fov * (width / height) * (Math.PI / 180)) / 2);
            const y = -(e.offsetY / height - 0.5) * 2 * Math.tan((fov * (Math.PI / 180)) / 2);
            const center = new Vector3(0, 0, 0);
            const forward = center.clone().sub(camera.position).normalize();
            const right = forward.clone().cross(new Vector3(0, 1, 0)).normalize();
            const up = right.clone().cross(forward).normalize();
            right.multiplyScalar(x);
            up.multiplyScalar(y);
            setSelectedItem(synthesizer.point(camera.position, forward.clone().add(right).add(up)));
        };
        const click = e => {
            if (!selectedItem) return;
            const geoms =
                selectedItem.type === "axon"
                    ? selectedItem.object.meshes.map(mesh => mesh.geometry)
                    : [selectedItem.object.mesh.geometry];
            synthesizer.focus = null;
            synthesizer.deselectAll();
            setSelectedItem(null);
            setSelectItem(false);
            const name = window.prompt("File name", (selectedItem.type === "axon" ? "@type" : "cell") + "_@color.ply");
            if (!name) return;
            geoms.forEach((geom, i) =>
                download(
                    plyParser(geom, {
                        binary: exportBinary,
                        includeColors: !exportSimple,
                        includeNormals: !exportSimple
                    }),
                    name.replace(/@type/g, i === 0 ? "myelin" : "axon").replace(/@color/g, selectedItem.object.color)
                )
            );
        };
        renderer.domElement.addEventListener("mousemove", mousemove);
        renderer.domElement.addEventListener("click", click);
        return () => {
            renderer.domElement.removeEventListener("mousemove", mousemove);
            renderer.domElement.removeEventListener("click", click);
        };
    }, [synthesizer, renderer, camera, viewModeAxon, selectItem, selectedItem, resolution, exportBinary, exportSimple]);

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
        if (updateState.name === "getOverlap")
            setScene(synthesizer.draw(viewModeVoxel, viewModeAxon, viewModeCell, Number(resolution), Number(border)));
        if (
            updateState.name === "ready" &&
            updateState.volumeFraction &&
            volumeFraction !== updateState.volumeFraction
        ) {
            setVolumeFraction(updateState.volumeFraction);
            setGrowCount(growCount === null ? 0 : growCount + 1);
        }
        if (updateState.name !== "ready" || automaticGrowth) {
            const us = { ...synthesizer.update(growSpeed, contractSpeed, minDist, maxOverlap, Number(border)) };
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
        resolution,
        viewModeCell,
        growSpeed,
        contractSpeed,
        minDist,
        maxOverlap,
        volumeFraction,
        automaticGrowth,
        growCount,
        volumeFractionTarget,
        border
    ]);

    useEffect(() => {
        if (!inputFile) return;
        const reader = new FileReader();
        reader.onload = async event => {
            const data = JSON.parse(event.target.result);

            setVoxelSize(data.voxelSize);
            setEllipsoidDensity(data.ellipsoidDensity);
            setGrowSpeed(data.growSpeed);
            setContractSpeed(data.contractSpeed);
            setMapFromDiameterToDeformationFactor(data.mapFromDiameterToDeformationFactor);
            setMapFromMaxDiameterToMinDiameter(data.mapFromMaxDiameterToMinDiameter);

            const s = new Synthesizer(
                data.voxelSize,
                data.ellipsoidDensity,
                new Mapping(data.mapFromDiameterToDeformationFactor),
                new Mapping(data.mapFromMaxDiameterToMinDiameter)
            );
            setAxonCount(data.axons.length);
            data.axons.forEach(axon => {
                s.addAxon(
                    new Vector3(...axon.position),
                    new Vector3(...axon.direction),
                    axon.maxDiameter / 2,
                    axon.color,
                    axon.gFactor
                );
                const a = s.axons[s.axons.length - 1];
                if (axon.ellipsoids)
                    axon.ellipsoids.forEach((ellipsoid, i) => {
                        a.ellipsoids[i].pos = new Vector3(...ellipsoid.position);
                        a.ellipsoids[i].shape = new Matrix3().set(...ellipsoid.shape);
                    });
            });
            setCellCount(data.cells.length);
            data.cells.forEach(cell =>
                s.addCell(new Vector3(...cell.position), new Matrix3().set(...cell.shape), cell.color)
            );
            setSynthesizer(s);
            setScene(s.draw(viewModeVoxel, viewModeAxon, viewModeCell, Number(resolution), Number(border)));
            setUpdateState(s.updateState);
        };
        reader.readAsText(inputFile);
        setInputFile(null);
    }, [inputFile, viewModeVoxel, viewModeAxon, resolution, viewModeCell, border]);

    return (
        <>
            <Grid container item xs={11}>
                <Grid
                    item
                    xs={4}
                    style={{ height: window.innerHeight * 0.9, overflowX: "hidden", overflowY: "scroll" }}>
                    <Grid container direction="column">
                        <Grid item className={classes.gridItem}>
                            <Paper>
                                <List>
                                    <ListItem>
                                        <b>Setup</b>
                                    </ListItem>
                                    <ListItem>
                                        <TextField
                                            type="number"
                                            label="Voxel side length"
                                            InputProps={{
                                                endAdornment: <InputAdornment position="start">µm</InputAdornment>
                                            }}
                                            value={voxelSize}
                                            onChange={e => setVoxelSize(e.target.value)}
                                        />
                                        <TextField
                                            type="number"
                                            label="Number of axons"
                                            value={axonCount}
                                            onChange={e => setAxonCount(e.target.value)}
                                        />
                                        <TextField
                                            type="number"
                                            label="Number of cells"
                                            value={cellCount}
                                            onChange={e => setCellCount(e.target.value)}
                                        />
                                    </ListItem>
                                    <ListItem>
                                        <TextField
                                            type="number"
                                            label="Ellipsoid density of axons"
                                            InputProps={{
                                                endAdornment: <InputAdornment position="start">µm⁻¹</InputAdornment>
                                            }}
                                            value={ellipsoidDensity}
                                            onChange={e => setEllipsoidDensity(e.target.value)}
                                        />
                                        <TextField
                                            type="number"
                                            label="g-factor"
                                            value={gFactor}
                                            onChange={e => setGFactor(e.target.value)}
                                        />
                                    </ListItem>
                                    <ListItem>
                                        <Button
                                            variant="contained"
                                            onClick={() => {
                                                const s = new Synthesizer(
                                                    Number(voxelSize),
                                                    Number(ellipsoidDensity),
                                                    new Mapping(mapFromDiameterToDeformationFactor),
                                                    new Mapping(mapFromMaxDiameterToMinDiameter)
                                                );
                                                s.addAxonsRandomly(Number(axonCount), gFactor);
                                                s.addCellsRandomly(Number(cellCount));
                                                setSynthesizer(s);
                                                setScene(
                                                    s.draw(
                                                        viewModeVoxel,
                                                        viewModeAxon,
                                                        viewModeCell,
                                                        Number(resolution),
                                                        Number(border)
                                                    )
                                                );
                                                setUpdateState(s.updateState);
                                                setVolumeFraction(0);
                                                setGrowCount(0);
                                            }}>
                                            Initialize
                                        </Button>
                                        <Button variant="contained" onClick={() => inputFileRef.current.click()}>
                                            upload
                                        </Button>
                                        {synthesizer && (
                                            <Button
                                                variant="contained"
                                                onClick={() => {
                                                    const config = {
                                                        voxelSize: synthesizer.voxelSize,
                                                        ellipsoidDensity: synthesizer.ellipsoidDensity,
                                                        growSpeed: growSpeed,
                                                        contractSpeed: contractSpeed,
                                                        mapFromDiameterToDeformationFactor: synthesizer.deformation.toJSON(),
                                                        mapFromMaxDiameterToMinDiameter: synthesizer.minDiameter.toJSON(),
                                                        axons: synthesizer.axons.map(axon => ({
                                                            position: [axon.start.x, axon.start.y, axon.start.z],
                                                            direction: [
                                                                axon.end.x - axon.start.x,
                                                                axon.end.y - axon.start.y,
                                                                axon.end.z - axon.start.z
                                                            ],
                                                            maxDiameter: axon.radius * axon.gFactor * 2,
                                                            color: axon.color,
                                                            gFactor: axon.gFactor,
                                                            ellipsoids: axon.ellipsoids.map(ellipsoid => ({
                                                                position: [
                                                                    ellipsoid.pos.x,
                                                                    ellipsoid.pos.y,
                                                                    ellipsoid.pos.z
                                                                ],
                                                                shape: ellipsoid.shape.elements
                                                            }))
                                                        })),
                                                        cells: synthesizer.cells.map(cell => ({
                                                            position: [cell.pos.x, cell.pos.y, cell.pos.z],
                                                            shape: cell.shape.elements,
                                                            color: cell.color
                                                        }))
                                                    };
                                                    download(JSON.stringify(config, null, 4), "config.json");
                                                }}>
                                                Download
                                            </Button>
                                        )}
                                    </ListItem>
                                    <input
                                        ref={inputFileRef}
                                        type="file"
                                        style={{ display: "none" }}
                                        onClick={e => (e.target.value = null)}
                                        onChange={e => setInputFile(e.target.files[0])}
                                    />
                                </List>
                            </Paper>
                        </Grid>
                        {synthesizer && (
                            <>
                                <Grid item className={classes.gridItem}>
                                    <Paper>
                                        <List>
                                            <ListItem>
                                                <b>After setup</b>
                                            </ListItem>
                                            <ListItem>
                                                <TextField
                                                    type="number"
                                                    label="Grow speed"
                                                    value={growSpeed}
                                                    onChange={e => setGrowSpeed(Number(e.target.value))}
                                                />
                                                <TextField
                                                    type="number"
                                                    label="Contract speed"
                                                    value={contractSpeed}
                                                    onChange={e => setContractSpeed(Number(e.target.value))}
                                                />
                                                <TextField
                                                    type="number"
                                                    label="Minimum distance"
                                                    InputProps={{
                                                        endAdornment: (
                                                            <InputAdornment position="start">µm</InputAdornment>
                                                        )
                                                    }}
                                                    value={minDist}
                                                    onChange={e => setMinDist(Number(e.target.value))}
                                                />
                                            </ListItem>
                                            <ListItem>
                                                <Button
                                                    variant="contained"
                                                    onClick={() => {
                                                        if (automaticGrowth) return setAutomaticGrowth(false);
                                                        const target = window.prompt(
                                                            "Specify total volume fraction target in %"
                                                        );
                                                        if (!target) return;
                                                        setVolumeFractionTarget(target);
                                                        setAutomaticGrowth(true);
                                                    }}>
                                                    Automatic growth: {automaticGrowth ? "on" : "off"}
                                                </Button>
                                                {automaticGrowth ? (
                                                    <>
                                                        <TextField
                                                            type="number"
                                                            label="Target volume fraction"
                                                            value={volumeFractionTarget}
                                                            onChange={e =>
                                                                setVolumeFractionTarget(Number(e.target.value))
                                                            }
                                                        />{" "}
                                                        %
                                                    </>
                                                ) : (
                                                    <Button
                                                        variant="contained"
                                                        onClick={() =>
                                                            setUpdateState({
                                                                ...synthesizer.update(
                                                                    growSpeed,
                                                                    contractSpeed,
                                                                    minDist,
                                                                    maxOverlap,
                                                                    Number(border)
                                                                )
                                                            })
                                                        }>
                                                        Perform 1 grow step
                                                    </Button>
                                                )}
                                            </ListItem>
                                            <Grid item>
                                                <b>Volume fraction estimation</b>
                                            </Grid>
                                            <Grid item>
                                                Select how many µm to exclude from each side of the voxel when doing the
                                                estimation:
                                            </Grid>
                                            <TextField
                                                type="number"
                                                label="Border"
                                                value={border}
                                                onChange={e => {
                                                    const b = e.target.value;
                                                    setBorder(b);
                                                    setScene(
                                                        synthesizer.draw(
                                                            viewModeVoxel,
                                                            viewModeAxon,
                                                            viewModeCell,
                                                            Number(resolution),
                                                            Number(b)
                                                        )
                                                    );
                                                }}
                                            />
                                            <TableContainer component={Paper}>
                                                <Table className={classes.table} aria-label="simple table">
                                                    <TableBody>
                                                        <TableRow>
                                                            <TableCell component="th" scope="row">
                                                                Axons
                                                            </TableCell>
                                                            <TableCell component="th" scope="row">
                                                                Cells
                                                            </TableCell>
                                                            <TableCell component="th" scope="row">
                                                                Total
                                                            </TableCell>
                                                        </TableRow>
                                                        <TableRow>
                                                            <TableCell>
                                                                {round2Decimals(100 * (volumeFraction || [0, 0])[0])}%
                                                            </TableCell>
                                                            <TableCell>
                                                                {round2Decimals(100 * (volumeFraction || [0, 0])[1])}%
                                                            </TableCell>
                                                            <TableCell>
                                                                {round2Decimals(
                                                                    100 *
                                                                        ((volumeFraction || [0, 0])[0] +
                                                                            (volumeFraction || [0, 0])[1])
                                                                )}
                                                                %
                                                            </TableCell>
                                                        </TableRow>
                                                    </TableBody>
                                                </Table>
                                            </TableContainer>
                                            <Grid item>
                                                Status: {updateState.name}
                                                {updateState.progress !== undefined
                                                    ? `, iteration ${updateState.progress}`
                                                    : ""}
                                            </Grid>
                                            <Grid item>Grow steps completed: {growCount}</Grid>
                                        </List>
                                    </Paper>
                                </Grid>
                                <Grid item className={classes.gridItem}>
                                    <Paper>
                                        <List>
                                            <ListItem>
                                                <b>Visual</b>
                                            </ListItem>
                                            <ListItem>
                                                <FormControl>
                                                    <InputLabel>Voxels</InputLabel>
                                                    <Select
                                                        value={viewModeVoxel}
                                                        onChange={event => {
                                                            const vm = event.target.value;
                                                            setViewModeVoxel(vm);
                                                            setScene(
                                                                synthesizer.draw(
                                                                    vm,
                                                                    viewModeAxon,
                                                                    viewModeCell,
                                                                    Number(resolution),
                                                                    Number(border)
                                                                )
                                                            );
                                                        }}>
                                                        <MenuItem value="none">hide</MenuItem>
                                                        <MenuItem value="all">show</MenuItem>
                                                    </Select>
                                                </FormControl>
                                                <FormControl>
                                                    <InputLabel>Axons</InputLabel>
                                                    <Select
                                                        value={viewModeAxon}
                                                        onChange={event => {
                                                            const vm = event.target.value;
                                                            const res =
                                                                vm === "pipes"
                                                                    ? window.prompt("Resolution", resolution)
                                                                    : resolution;
                                                            if (!res) return;
                                                            setViewModeAxon(vm);
                                                            setResolution(res);
                                                            setScene(
                                                                synthesizer.draw(
                                                                    viewModeVoxel,
                                                                    vm,
                                                                    viewModeCell,
                                                                    Number(res),
                                                                    Number(border)
                                                                )
                                                            );
                                                        }}>
                                                        <MenuItem value="none">hide</MenuItem>
                                                        <MenuItem value="ellipsoids">ellipsoids</MenuItem>
                                                        <MenuItem value="skeleton">skeleton</MenuItem>
                                                        <MenuItem value="pipes">pipes</MenuItem>
                                                    </Select>
                                                </FormControl>
                                                <FormControl>
                                                    <InputLabel>Cells</InputLabel>
                                                    <Select
                                                        value={viewModeCell}
                                                        onChange={event => {
                                                            const vm = event.target.value;
                                                            setViewModeCell(vm);
                                                            setScene(
                                                                synthesizer.draw(
                                                                    viewModeVoxel,
                                                                    viewModeAxon,
                                                                    vm,
                                                                    Number(resolution),
                                                                    Number(border)
                                                                )
                                                            );
                                                        }}>
                                                        <MenuItem value="none">hide</MenuItem>
                                                        <MenuItem value="all">show</MenuItem>
                                                    </Select>
                                                </FormControl>
                                            </ListItem>
                                        </List>
                                    </Paper>
                                </Grid>
                                {viewModeAxon === "pipes" && (
                                    <Grid item className={classes.gridItem}>
                                        <Paper>
                                            <List>
                                                <ListItem>
                                                    <b>Export</b>
                                                </ListItem>
                                                <ListItem>
                                                    <Button
                                                        variant="contained"
                                                        onClick={() => {
                                                            const name = window.prompt("File name", "axons.ply");
                                                            if (!name) return;
                                                            download(
                                                                plyParser(
                                                                    [
                                                                        synthesizer.axons.map(a =>
                                                                            a.meshes.map(mesh => mesh.geometry)
                                                                        ),
                                                                        synthesizer.cells.map(c => c.mesh.geometry)
                                                                    ]
                                                                        .flat()
                                                                        .flat()
                                                                        .reduce((result, geom) => {
                                                                            result.merge(geom);
                                                                            return result;
                                                                        }, new Geometry()),
                                                                    {
                                                                        binary: exportBinary,
                                                                        includeColors: !exportSimple,
                                                                        includeNormals: !exportSimple
                                                                    }
                                                                ),
                                                                name
                                                            );
                                                        }}>
                                                        Export as single file
                                                    </Button>
                                                </ListItem>
                                                <ListItem>
                                                    <Button
                                                        variant="contained"
                                                        onClick={async () => {
                                                            const name = window.prompt(
                                                                "File name",
                                                                "@type_@index_@color.ply"
                                                            );
                                                            if (!name) return;
                                                            const wait = async () =>
                                                                await (milliseconds =>
                                                                    new Promise(resolve =>
                                                                        window.setTimeout(resolve, milliseconds)
                                                                    ))(100);

                                                            for (let i = 0; i < synthesizer.axons.length; ++i) {
                                                                const axon = synthesizer.axons[i];
                                                                await download(
                                                                    plyParser(axon.meshes[0].geometry, {
                                                                        binary: exportBinary,
                                                                        includeColors: !exportSimple,
                                                                        includeNormals: !exportSimple
                                                                    }),
                                                                    name
                                                                        .replace(/@type/g, "myelin")
                                                                        .replace(/@index/g, i)
                                                                        .replace(/@color/g, axon.color)
                                                                );
                                                                await download(
                                                                    plyParser(axon.meshes[1].geometry, {
                                                                        binary: exportBinary,
                                                                        includeColors: !exportSimple,
                                                                        includeNormals: !exportSimple
                                                                    }),
                                                                    name
                                                                        .replace(/@type/g, "axon")
                                                                        .replace(/@index/g, i)
                                                                        .replace(/@color/g, axon.color)
                                                                );
                                                                await wait();
                                                            }
                                                            if (viewModeCell === "hide") return;
                                                            for (let i = 0; i < synthesizer.cells.length; ++i) {
                                                                const cell = synthesizer.cells[i];
                                                                await download(
                                                                    plyParser(cell.getGeometry(), {
                                                                        binary: exportBinary,
                                                                        includeColors: !exportSimple,
                                                                        includeNormals: !exportSimple
                                                                    }),
                                                                    name
                                                                        .replace(/@type/g, "cell")
                                                                        .replace(/@index/g, i)
                                                                        .replace(/@color/g, cell.color)
                                                                );
                                                                await wait();
                                                            }
                                                        }}>
                                                        Export as multiple files
                                                    </Button>
                                                </ListItem>
                                                <ListItem>
                                                    <Button
                                                        variant="contained"
                                                        onClick={() => setSelectItem(!selectItem)}>
                                                        {selectItem ? "Select an element" : "Export single element"}
                                                    </Button>
                                                </ListItem>
                                                <ListItem>
                                                    <FormControlLabel
                                                        control={
                                                            <Switch
                                                                checked={exportBinary}
                                                                onChange={() => setExportBinary(!exportBinary)}
                                                                color="primary"
                                                            />
                                                        }
                                                        label="Binary format"
                                                    />
                                                </ListItem>
                                                <ListItem>
                                                    <FormControlLabel
                                                        control={
                                                            <Switch
                                                                checked={exportSimple}
                                                                onChange={() => setExportSimple(!exportSimple)}
                                                                color="primary"
                                                            />
                                                        }
                                                        label="Simple mesh"
                                                    />
                                                </ListItem>
                                            </List>
                                        </Paper>
                                    </Grid>
                                )}
                            </>
                        )}
                    </Grid>
                </Grid>
                <Grid item xs={5} ref={mount} />
            </Grid>
        </>
    );
};
