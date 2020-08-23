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
    const [pipeResolution, setPipeResolution] = useState(64);
    const [viewModeCell, setViewModeCell] = useState("all");
    const [volumeFraction, setVolumeFraction] = useState([]);
    const [volumeFractionTarget, setVolumeFractionTarget] = useState(null);
    const [voxelSizeInner, setVoxelSizeInner] = useState(5);
    const [voxelSizeOuter, setVoxelSizeOuter] = useState(6);
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
        if (updateState.name === "ready" && volumeFraction !== updateState.volumeFraction) {
            setVolumeFraction(updateState.volumeFraction);
            setScene(synthesizer.draw(viewModeVoxel, viewModeAxon, pipeResolution, viewModeCell));
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
        pipeResolution,
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

            setVoxelSizeInner(data.voxelSizeInner);
            setVoxelSizeOuter(data.voxelSizeOuter);
            setEllipsoidDensity(data.ellipsoidDensity);
            setGrowSpeed(data.growSpeed);
            setContractSpeed(data.contractSpeed);
            setMapFromDiameterToDeformationFactor(data.mapFromDiameterToDeformationFactor);
            setMapFromMaxDiameterToMinDiameter(data.mapFromMaxDiameterToMinDiameter);

            const s = new Synthesizer(
                data.voxelSizeInner,
                data.voxelSizeOuter,
                data.ellipsoidDensity,
                new Mapping(data.mapFromDiameterToDeformationFactor.from, data.mapFromDiameterToDeformationFactor.to),
                new Mapping(data.mapFromMaxDiameterToMinDiameter.from, data.mapFromMaxDiameterToMinDiameter.to)
            );
            setAxonCount(data.axons.length);
            data.axons.forEach(axon =>
                s.addAxon(new Vector3(...axon.position), new Vector3(...axon.direction), axon.maxDiameter / 2)
            );
            data.cells.forEach(cell => s.addCell(new Vector3(...cell.position), new Matrix3().set(...cell.shape)));
            setSynthesizer(s);
            setScene(s.draw(viewModeVoxel, viewModeAxon, pipeResolution, viewModeCell));
            setUpdateState(s.updateState);
        };
        reader.readAsText(inputFile);
        setInputFile(null);
    }, [inputFile, viewModeVoxel, viewModeAxon, pipeResolution, viewModeCell]);

    return (
        <>
            <Grid container item xs={11}>
                <Grid item xs={4}>
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
                                            label="Inner voxel side length"
                                            InputProps={{
                                                endAdornment: <InputAdornment position="start">µm</InputAdornment>
                                            }}
                                            value={voxelSizeInner}
                                            onChange={e => setVoxelSizeInner(Number(e.target.value))}
                                        />
                                        <TextField
                                            type="number"
                                            label="Outer voxel side length"
                                            InputProps={{
                                                endAdornment: <InputAdornment position="start">µm</InputAdornment>
                                            }}
                                            value={voxelSizeOuter}
                                            onChange={e => setVoxelSizeOuter(Number(e.target.value))}
                                        />
                                        <TextField
                                            type="number"
                                            label="Number of axons"
                                            value={axonCount}
                                            onChange={e => setAxonCount(Number(e.target.value))}
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
                                            onChange={e => setEllipsoidDensity(Number(e.target.value))}
                                        />
                                        <TextField
                                            type="number"
                                            label="Number of cells"
                                            value={cellCount}
                                            onChange={e => setCellCount(Number(e.target.value))}
                                        />
                                    </ListItem>
                                    <ListItem>
                                        {synthesizer ? (
                                            <Button
                                                variant="contained"
                                                onClick={() => {
                                                    if (!window.confirm("Are you sure?")) return;
                                                    window.location.reload();
                                                }}>
                                                Reset
                                            </Button>
                                        ) : (
                                            <Button
                                                variant="contained"
                                                onClick={() => {
                                                    const s = new Synthesizer(
                                                        voxelSizeInner,
                                                        voxelSizeOuter,
                                                        ellipsoidDensity,
                                                        new Mapping(
                                                            mapFromDiameterToDeformationFactor.from,
                                                            mapFromDiameterToDeformationFactor.to
                                                        ),
                                                        new Mapping(
                                                            mapFromMaxDiameterToMinDiameter.from,
                                                            mapFromMaxDiameterToMinDiameter.to
                                                        )
                                                    );
                                                    s.addAxonsRandomly(axonCount);
                                                    s.addCellsRandomly(cellCount);
                                                    setSynthesizer(s);
                                                    setScene(
                                                        s.draw(
                                                            viewModeVoxel,
                                                            viewModeAxon,
                                                            pipeResolution,
                                                            viewModeCell
                                                        )
                                                    );
                                                    setUpdateState(s.updateState);
                                                }}>
                                                Initialize
                                            </Button>
                                        )}
                                        {" or "}
                                        {synthesizer ? (
                                            <Button
                                                variant="contained"
                                                onClick={() => {
                                                    const config = {
                                                        voxelSizeInner: voxelSizeInner,
                                                        voxelSizeOuter: voxelSizeOuter,
                                                        ellipsoidDensity: ellipsoidDensity,
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
                                                            maxDiameter: axon.radius * 2
                                                        })),
                                                        cells: synthesizer.cells.map(cell => ({
                                                            position: [cell.pos.x, cell.pos.y, cell.pos.z],
                                                            shape: cell.shape.elements
                                                        }))
                                                    };
                                                    save(JSON.stringify(config, null, 4), "config.json");
                                                }}>
                                                Download the current config file
                                            </Button>
                                        ) : (
                                            <Button variant="contained" onClick={() => inputFileRef.current.click()}>
                                                upload config file
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
                                            <Grid item>Volume fraction of inner voxel:</Grid>
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
                                                                    pipeResolution,
                                                                    viewModeCell
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
                                                            const pr =
                                                                vm === "pipes"
                                                                    ? Number(window.prompt("Resolution", 64)) || 64
                                                                    : pipeResolution;
                                                            if (vm === "pipes") setPipeResolution(pr);
                                                            setScene(
                                                                synthesizer.draw(viewModeVoxel, vm, pr, viewModeCell)
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
                                                            setScene(synthesizer.draw(viewModeVoxel, viewModeAxon, vm));
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
