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
    Select,
    MenuItem
} from "@material-ui/core";

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
    const [viewModeCell, setViewModeCell] = useState("all");
    const [volumeFraction, setVolumeFraction] = useState([]);
    const [volumeFractionTarget, setVolumeFractionTarget] = useState(null);
    const [voxelSize, setVoxelSize] = useState(5);
    const [gridSize, setGridSize] = useState(6);
    const [axonCount, setAxonCount] = useState(80);
    const [jointDensity, setJointDensity] = useState(10);
    const [cellCount, setCellCount] = useState(0);
    const [growSpeed, setGrowSpeed] = useState(0.02);
    const [contractSpeed, setContractSpeed] = useState(0.01);
    const [minDist, setMinDist] = useState(0.01);
    const inputFileRef = useRef();
    const [inputFile, setInputFile] = useState(null);
    const [updateState, setUpdateState] = useState({});
    const [growCount, setGrowCount] = useState(null);
    const [automaticGrowth, setAutomaticGrowth] = useState(false);

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
            setScene(synthesizer.draw(viewModeVoxel, viewModeAxon, viewModeCell));
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

            setVoxelSize(data.voxelSizeInner);
            setGridSize(data.voxelSizeOuter);
            setJointDensity(data.jointDensity);
            setGrowSpeed(data.grow);
            setContractSpeed(data.contract);

            const s = new Synthesizer(
                data.voxelSizeInner,
                data.voxelSizeOuter,
                data.jointDensity,
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
                                            label="Inner voxel size"
                                            value={voxelSize}
                                            onChange={e => setVoxelSize(Number(e.target.value))}
                                        />
                                        <TextField
                                            type="number"
                                            label="Outer voxel size"
                                            value={gridSize}
                                            onChange={e => setGridSize(Number(e.target.value))}
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
                                            label="Number of joints per unit length"
                                            value={jointDensity}
                                            onChange={e => setJointDensity(Number(e.target.value))}
                                        />
                                        <TextField
                                            type="number"
                                            label="Number of cells"
                                            value={cellCount}
                                            onChange={e => setCellCount(Number(e.target.value))}
                                        />
                                    </ListItem>
                                    <ListItem>
                                        <Button
                                            variant="contained"
                                            onClick={() => {
                                                const s = new Synthesizer(
                                                    voxelSize,
                                                    gridSize,
                                                    jointDensity,
                                                    new Mapping([0, 0.4, 1], [0, 0.5, 1]),
                                                    new Mapping([0, 2], [0, 0.2])
                                                );
                                                s.addAxonsRandomly(axonCount);
                                                s.addCellsRandomly(cellCount);
                                                setSynthesizer(s);
                                                setScene(s.draw(viewModeVoxel, viewModeAxon, viewModeCell));
                                                setUpdateState(s.updateState);
                                            }}>
                                            Initialize
                                        </Button>
                                        {" or "}
                                        <Button variant="contained" onClick={() => inputFileRef.current.click()}>
                                            upload input file
                                        </Button>
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
                                                            setScene(synthesizer.draw(vm, viewModeAxon, viewModeCell));
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
                                                            setScene(synthesizer.draw(viewModeVoxel, vm, viewModeCell));
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
                                                    onClick={() => {
                                                        try {
                                                            const link = document.createElement("a");
                                                            link.setAttribute(
                                                                "href",
                                                                "data:text/obj;charset=utf-8," +
                                                                    new PLYExporter().parse(scene)
                                                            );
                                                            link.setAttribute("download", "axons.ply");
                                                            window.document.body.appendChild(link);
                                                            link.click();
                                                            window.document.body.removeChild(link);
                                                        } catch (err) {
                                                            console.log(err);
                                                        }
                                                    }}>
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
