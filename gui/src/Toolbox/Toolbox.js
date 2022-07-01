import {
    Button,
    FormControl,
    FormControlLabel,
    Grid,
    InputAdornment,
    InputLabel,
    List,
    ListItem,
    MenuItem,
    Paper,
    Select,
    Switch,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableRow,
    TextField,
    makeStyles
} from "@material-ui/core";
import { PerspectiveCamera, Vector3, WebGLRenderer } from "three";
import React, { useEffect, useRef, useState } from "react";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import SizeScale from "./SizeScale";
import { createSynthesizer, setRandomSeed } from "@axon-generator-toolbox/core";
import download from "in-browser-download";
import { useWindowSize } from "@react-hook/window-size";

const useStyles = makeStyles(theme => ({
    gridItem: {
        padding: theme.spacing(2),
        textAlign: "center"
    }
}));

export default () => {
    const [windowWidth, windowHeight] = useWindowSize();
    const width = windowWidth * 0.55;
    const height = windowHeight * 0.85;
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
    const [viewSizes, setViewSizes] = useState(false);
    const [resolution, setResolution] = useState(32);
    const [viewModeCell, setViewModeCell] = useState("all");
    const [volumeFraction, setVolumeFraction] = useState([]);
    const [volumeFractionTarget, setVolumeFractionTarget] = useState(null);
    const [seed, setSeed] = useState(0);
    const [voxelSize, setVoxelSize] = useState([100, 100, 100]);
    const [axonCount, setAxonCount] = useState(50);
    const [ellipsoidDensity, setEllipsoidDensity] = useState(5);
    const [cellCount, setCellCount] = useState(0);
    const [growSpeed, setGrowSpeed] = useState(0.02);
    const [contractSpeed, setContractSpeed] = useState(1);
    const [minDist, setMinDist] = useState(0.07);
    const inputFileRef = useRef();
    const [inputFile, setInputFile] = useState(null);
    const [updateState, setUpdateState] = useState({});
    const [growCount, setGrowCount] = useState(null);
    const [growCountTarget, setGrowCountTarget] = useState(null);
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
        const mc = mount.current;
        if (!mc) return;
        // Camera
        const cam = new PerspectiveCamera(fov, width / height, 0.1, 1000);
        cam.position.set(50, 50, 50);
        cam.lookAt(0, 0, 0);
        setCamera(cam);
        // Renderer
        const ren = new WebGLRenderer({ antialias: true });
        ren.setClearColor("#000000");
        ren.setSize(width, height);
        mc.appendChild(ren.domElement);
        setRenderer(ren);
        // Controls
        const ctrls = new OrbitControls(cam, ren.domElement);
        ctrls.enableDamping = true;
        ctrls.dampingFactor = 0.5;
        setControls(ctrls);
        // Animate
        const t = window.setInterval(() => setFrame(frame => frame + 1), 1000 / 30);
        return () => {
            window.clearInterval(t);
            mc.removeChild(ren.domElement);
            ren.renderLists.dispose();
        };
    }, [mount, width, height]);

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
            setSelectedItem(synthesizer.point(camera.position, forward.clone().add(right).add(up), viewSizes));
        };
        const click = () => {
            if (!selectedItem) return;
            const geoms =
                selectedItem.type === "axon"
                    ? selectedItem.object.meshes
                          .filter((_, i) => i !== 1 || Number(selectedItem.object.gFactor) !== 1)
                          .map(mesh => mesh.geometry)
                    : [selectedItem.object.mesh.geometry];
            synthesizer.focus = null;
            synthesizer.deselectAll(viewSizes);
            setSelectedItem(null);
            setSelectItem(false);
            const name = window.prompt("File name", (selectedItem.type === "axon" ? "@type" : "cell") + "_@color.ply");
            if (!name) return;
            geoms.forEach((geom, i) =>
                download(
                    selectedItem.object.toPLY(exportBinary, exportSimple, i),
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
    }, [
        synthesizer,
        renderer,
        camera,
        viewModeAxon,
        selectItem,
        selectedItem,
        resolution,
        exportBinary,
        exportSimple,
        width,
        height,
        viewSizes
    ]);

    useEffect(() => {
        if (controls) controls.update();
        if (renderer && scene && camera) renderer.render(scene, camera);
        if (!synthesizer) return;
        if (!updateState.name) return;
        if (
            automaticGrowth &&
            updateState.volumeFraction &&
            updateState.volumeFraction[0] + updateState.volumeFraction[1] >= volumeFractionTarget
        )
            return setAutomaticGrowth(false);
        if (JSON.stringify(updateState) !== JSON.stringify(synthesizer.updateState)) return;
        if (updateState.name === "getOverlap")
            setScene(
                synthesizer.draw(
                    viewModeVoxel,
                    viewModeAxon,
                    viewModeCell,
                    Number(resolution),
                    false,
                    Number(border),
                    viewSizes
                )
            );
        let gc = growCount;
        if (
            updateState.name === "ready" &&
            updateState.volumeFraction &&
            volumeFraction !== updateState.volumeFraction
        ) {
            setVolumeFraction(updateState.volumeFraction);
            gc = (growCount || 0) + 1;
        }
        setGrowCount(gc);
        if (updateState.name !== "ready" || automaticGrowth || gc < growCountTarget) {
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
        growCountTarget,
        volumeFractionTarget,
        border
    ]);

    useEffect(() => {
        if (!inputFile) return;
        const reader = new FileReader();
        reader.onload = event => {
            const data = JSON.parse(event.target.result);
            data.voxelSize = isNaN(Number(data.voxelSize))
                ? data.voxelSize
                : [data.voxelSize, data.voxelSize, data.voxelSize];
            if (synthesizer) synthesizer.dispose();
            const s = createSynthesizer(data);
            setSeed(data.randomSeed || 0);
            setRandomSeed(data.randomSeed || 0);
            setVoxelSize(data.voxelSize);
            setBorder(data.border || 0);
            setEllipsoidDensity(data.ellipsoidDensity);
            setGrowSpeed(data.growSpeed);
            setContractSpeed(data.contractSpeed);
            setMinDist(data.minimumDistance || 0.07);
            setMapFromDiameterToDeformationFactor(data.mapFromDiameterToDeformationFactor);
            setMapFromMaxDiameterToMinDiameter(data.mapFromMaxDiameterToMinDiameter);
            setAxonCount(data.axons.length);
            setCellCount(data.cells.length);
            setSynthesizer(s);
            setScene(
                s.draw(
                    viewModeVoxel,
                    viewModeAxon,
                    viewModeCell,
                    Number(resolution),
                    false,
                    Number(data.border),
                    viewSizes
                )
            );
            setUpdateState(s.updateState);
            setVolumeFraction(0);
            setGrowCountTarget(0);
            setGrowCount(0);
        };
        reader.readAsText(inputFile);
        setInputFile(null);
    }, [inputFile, viewModeVoxel, viewModeAxon, resolution, viewModeCell, border, synthesizer]);

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
                                        {["x", "y", "z"].map((v, i) => (
                                            <TextField
                                                key={v}
                                                type="number"
                                                label={`Voxel side length ${v}`}
                                                InputProps={{
                                                    endAdornment: <InputAdornment position="start">µm</InputAdornment>
                                                }}
                                                value={voxelSize[i]}
                                                onChange={e => {
                                                    const result = [...voxelSize];
                                                    result[i] = Number(e.target.value);
                                                    setVoxelSize(result);
                                                }}
                                            />
                                        ))}
                                    </ListItem>
                                    <ListItem>
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
                                                if (synthesizer) synthesizer.dispose();
                                                const s = createSynthesizer({
                                                    voxelSize: voxelSize,
                                                    ellipsoidDensity: ellipsoidDensity,
                                                    mapFromDiameterToDeformationFactor: mapFromDiameterToDeformationFactor,
                                                    mapFromMaxDiameterToMinDiameter: mapFromMaxDiameterToMinDiameter
                                                });
                                                s.addAxonsRandomly(Number(axonCount), gFactor);
                                                s.addCellsRandomly(Number(cellCount), minDist);
                                                setSynthesizer(s);
                                                setScene(
                                                    s.draw(
                                                        viewModeVoxel,
                                                        viewModeAxon,
                                                        viewModeCell,
                                                        Number(resolution),
                                                        false,
                                                        Number(border),
                                                        viewSizes
                                                    )
                                                );
                                                setUpdateState(s.updateState);
                                                setVolumeFraction(0);
                                                setGrowCount(0);
                                                setGrowCountTarget(0);
                                                setRandomSeed(seed);
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
                                                        randomSeed: seed,
                                                        growSpeed: growSpeed,
                                                        contractSpeed: contractSpeed,
                                                        minimumDistance: minDist,
                                                        border: border,
                                                        ...synthesizer.toJSON()
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
                                                Ellipsoid density of axons: {ellipsoidDensity}
                                                <Button
                                                    variant="contained"
                                                    onClick={() => {
                                                        const value = Number(window.prompt("New ellipsoid density"));
                                                        if (!value) return;
                                                        const data = synthesizer.toJSON();
                                                        data.ellipsoidDensity = value;
                                                        if (synthesizer) synthesizer.dispose();
                                                        const s = createSynthesizer(data);
                                                        setSynthesizer(s);
                                                        setScene(
                                                            s.draw(
                                                                viewModeVoxel,
                                                                viewModeAxon,
                                                                viewModeCell,
                                                                Number(resolution),
                                                                false,
                                                                Number(border),
                                                                viewSizes
                                                            )
                                                        );
                                                        setEllipsoidDensity(value);
                                                        setUpdateState(s.updateState);
                                                    }}>
                                                    Change
                                                </Button>
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
                                                            "Specify total volume fraction target"
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
                                                        />
                                                    </>
                                                ) : (
                                                    <>
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
                                                        <Button
                                                            variant="contained"
                                                            onClick={() => {
                                                                const x = parseInt(
                                                                    window.prompt("How many grow steps?")
                                                                );
                                                                if (x) setGrowCountTarget(growCount + x);
                                                            }}>
                                                            Perform x grow steps
                                                        </Button>
                                                    </>
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
                                                            false,
                                                            Number(b),
                                                            viewSizes
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
                                                                {((volumeFraction || [0, 0])[0] || 0).toFixed(2)}
                                                            </TableCell>
                                                            <TableCell>
                                                                {((volumeFraction || [0, 0])[1] || 0).toFixed(2)}
                                                            </TableCell>
                                                            <TableCell>
                                                                {(
                                                                    ((volumeFraction || [0, 0])[0] || 0) +
                                                                    ((volumeFraction || [0, 0])[1] || 0)
                                                                ).toFixed(2)}
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
                                                                    false,
                                                                    Number(border),
                                                                    viewSizes
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
                                                            const extended =
                                                                vm === "pipes"
                                                                    ? window.prompt(
                                                                          'Extended axons - "yes"/"no"',
                                                                          "no"
                                                                      ) === "yes"
                                                                    : false;
                                                            if (!res) return;
                                                            setViewModeAxon(vm);
                                                            setResolution(res);
                                                            setScene(
                                                                synthesizer.draw(
                                                                    viewModeVoxel,
                                                                    vm,
                                                                    viewModeCell,
                                                                    Number(res),
                                                                    extended,
                                                                    Number(border),
                                                                    viewSizes
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
                                                                    false,
                                                                    Number(border),
                                                                    viewSizes
                                                                )
                                                            );
                                                        }}>
                                                        <MenuItem value="none">hide</MenuItem>
                                                        <MenuItem value="all">show</MenuItem>
                                                    </Select>
                                                </FormControl>
                                            </ListItem>
                                            <ListItem>
                                                <FormControlLabel
                                                    control={
                                                        <Switch
                                                            checked={viewSizes}
                                                            onChange={e => {
                                                                const vs = e.target.checked;
                                                                setViewSizes(vs);
                                                                setScene(
                                                                    synthesizer.draw(
                                                                        viewModeVoxel,
                                                                        viewModeAxon,
                                                                        viewModeCell,
                                                                        Number(resolution),
                                                                        false,
                                                                        Number(border),
                                                                        vs
                                                                    )
                                                                );
                                                            }}
                                                            color="primary"
                                                        />
                                                    }
                                                    label="Size color codes"
                                                />
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
                                                                synthesizer.toPLY(exportBinary, exportSimple),
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
                                                                    axon.toPLY(exportBinary, exportSimple, 0),
                                                                    name
                                                                        .replace(/@type/g, "myelin")
                                                                        .replace(/@index/g, i)
                                                                        .replace(/@color/g, axon.color)
                                                                );
                                                                if (Number(axon.gFactor) !== 1)
                                                                    await download(
                                                                        axon.toPLY(exportBinary, exportSimple, 1),
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
                                                                    cell.toPLY(exportBinary, exportSimple),
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
                                                                onChange={e => setExportBinary(e.target.checked)}
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
                                                                onChange={e => setExportSimple(e.target.checked)}
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
                <Grid item xs={5}>
                    <div ref={mount} />
                    {viewSizes && (
                        <>
                            {synthesizer.minAndMaxDiameterAxons && (
                                <>
                                    Myelin
                                    <SizeScale
                                        width={width}
                                        min={synthesizer.minAndMaxDiameterAxons.min}
                                        max={synthesizer.minAndMaxDiameterAxons.max}
                                    />
                                </>
                            )}
                            {synthesizer.minAndMaxDiameterCells && (
                                <>
                                    Cells
                                    <SizeScale
                                        width={width}
                                        min={synthesizer.minAndMaxDiameterCells.min}
                                        max={synthesizer.minAndMaxDiameterCells.max}
                                    />
                                </>
                            )}
                        </>
                    )}
                </Grid>
            </Grid>
        </>
    );
};
