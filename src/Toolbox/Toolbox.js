import React, { useEffect, useRef, useState } from "react";
import { Vector3, Matrix3, PerspectiveCamera, WebGLRenderer } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { PLYExporter } from "three/examples/jsm/exporters/PLYExporter";
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
    MenuItem
} from "@material-ui/core";
import { save } from "save-file";

import Synthesizer from "./synthesizer";
import Mapping from "./mapping";
import { round2Decimals } from "./helperFunctions";

const useStyles = makeStyles(theme => ({
    gridItem: {
        padding: theme.spacing(2),
        textAlign: "center"
    }
}));

export default props => {
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
    const [voxelSize, setVoxelSize] = useState(5);
    const [axonCount, setAxonCount] = useState(80);
    const [ellipsoidDensity, setEllipsoidDensity] = useState(10);
    const [cellCount, setCellCount] = useState(0);
    const [growSpeed, setGrowSpeed] = useState(0.02);
    const [contractSpeed, setContractSpeed] = useState(0.01);
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
    useEffect(() => {
        if (!mount.current) return;
        const width = window.innerWidth * 0.55;
        const height = window.innerHeight * 0.9;
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
        if (updateState.name === "getOverlap")
            setScene(synthesizer.draw(viewModeVoxel, viewModeAxon, viewModeCell, resolution));
        if (updateState.name === "ready" && volumeFraction !== updateState.volumeFraction) {
            setVolumeFraction(updateState.volumeFraction);
            setGrowCount(growCount === null ? 0 : growCount + 1);
        }
        if (updateState.name !== "ready" || automaticGrowth) {
            const us = { ...synthesizer.update(growSpeed, contractSpeed, minDist, maxOverlap) };
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
        volumeFractionTarget
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
                new Mapping(data.mapFromDiameterToDeformationFactor.from, data.mapFromDiameterToDeformationFactor.to),
                new Mapping(data.mapFromMaxDiameterToMinDiameter.from, data.mapFromMaxDiameterToMinDiameter.to)
            );
            setAxonCount(data.axons.length);
            data.axons.forEach(axon =>
                s.addAxon(
                    new Vector3(...axon.position),
                    new Vector3(...axon.direction),
                    axon.maxDiameter / 2,
                    axon.color
                )
            );
            data.cells.forEach(cell => s.addCell(new Vector3(...cell.position), new Matrix3().set(...cell.shape)));
            setSynthesizer(s);
            setScene(s.draw(viewModeVoxel, viewModeAxon, viewModeCell, resolution));
            setUpdateState(s.updateState);
        };
        reader.readAsText(inputFile);
        setInputFile(null);
    }, [inputFile, viewModeVoxel, viewModeAxon, resolution, viewModeCell]);

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
                                            label="Number of cells"
                                            value={cellCount}
                                            onChange={e => setCellCount(e.target.value)}
                                        />
                                    </ListItem>
                                    <ListItem>
                                        <Button
                                            variant="contained"
                                            onClick={() => {
                                                const s = new Synthesizer(
                                                    Number(voxelSize),
                                                    Number(ellipsoidDensity),
                                                    new Mapping(
                                                        mapFromDiameterToDeformationFactor.from,
                                                        mapFromDiameterToDeformationFactor.to
                                                    ),
                                                    new Mapping(
                                                        mapFromMaxDiameterToMinDiameter.from,
                                                        mapFromMaxDiameterToMinDiameter.to
                                                    )
                                                );
                                                s.addAxonsRandomly(Number(axonCount));
                                                s.addCellsRandomly(Number(cellCount));
                                                setSynthesizer(s);
                                                setScene(s.draw(viewModeVoxel, viewModeAxon, viewModeCell, resolution));
                                                setUpdateState(s.updateState);
                                            }}>
                                            Initialize
                                        </Button>
                                        <Button variant="contained" onClick={() => inputFileRef.current.click()}>
                                            upload config file
                                        </Button>
                                        {synthesizer && (
                                            <Button
                                                variant="contained"
                                                onClick={() => {
                                                    const config = {
                                                        voxelSize: Number(voxelSize),
                                                        ellipsoidDensity: Number(ellipsoidDensity),
                                                        growSpeed: growSpeed,
                                                        contractSpeed: contractSpeed,
                                                        mapFromDiameterToDeformationFactor: mapFromDiameterToDeformationFactor,
                                                        mapFromMaxDiameterToMinDiameter: mapFromMaxDiameterToMinDiameter,
                                                        axons: synthesizer.axons.map(axon => ({
                                                            position: [axon.start.x, axon.start.y, axon.start.z],
                                                            direction: [
                                                                axon.end.x - axon.start.x,
                                                                axon.end.y - axon.start.y,
                                                                axon.end.z - axon.start.z
                                                            ],
                                                            maxDiameter: axon.radius * 2,
                                                            color: axon.color
                                                        })),
                                                        cells: synthesizer.cells.map(cell => ({
                                                            position: [cell.pos.x, cell.pos.y, cell.pos.z],
                                                            shape: cell.shape.elements
                                                        }))
                                                    };
                                                    save(JSON.stringify(config, null, 4), "config.json");
                                                }}>
                                                Download config file
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
                                                                    maxOverlap
                                                                )
                                                            })
                                                        }>
                                                        Perform 1 grow step
                                                    </Button>
                                                )}
                                            </ListItem>
                                            <Grid item>Volume fraction:</Grid>
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
                                                                    resolution
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
                                                            setViewModeAxon(vm);
                                                            const res =
                                                                vm === "pipes"
                                                                    ? window.prompt("Resolution", resolution)
                                                                    : resolution;
                                                            setResolution(res);
                                                            setScene(
                                                                synthesizer.draw(viewModeVoxel, vm, viewModeCell, res)
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
                                                                    resolution
                                                                )
                                                            );
                                                        }}>
                                                        <MenuItem value="none">hide</MenuItem>
                                                        <MenuItem value="all">show</MenuItem>
                                                    </Select>
                                                </FormControl>
                                                <Button
                                                    variant="contained"
                                                    onClick={() =>
                                                        save(
                                                            new PLYExporter().parse(scene, null, {
                                                                binary: true
                                                            }),
                                                            "axons.ply"
                                                        )
                                                    }>
                                                    Export
                                                </Button>
                                            </ListItem>
                                        </List>
                                    </Paper>
                                </Grid>
                            </>
                        )}
                    </Grid>
                </Grid>
                <Grid item xs={5} ref={mount} />
            </Grid>
        </>
    );
};
