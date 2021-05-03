#!/usr/bin/env node

const { argv } = require("yargs")
    .scriptName("axon-generator-toolbox")
    .usage("Usage: $0 -f file [-i iterations] [-v volumeFraction]")
    .example("$0 -f ./config.json -i 10 -o 5 -v 70 -l log.txt")
    .option("f", {
        alias: "file",
        describe: "Config file",
        demandOption: "Please specify a config file",
        type: "string",
        nargs: 1
    })
    .option("i", {
        alias: "iterations",
        default: 10,
        describe: "Number of iterations",
        type: "number",
        nargs: 1
    })
    .option("o", {
        alias: "outputInterval",
        default: 1,
        describe: "Save output to file every o'th iteration",
        type: "number",
        nargs: 1
    })
    .option("v", {
        alias: "volumeFraction",
        default: 100,
        describe: "Stop simulation when this volume fraction has been reached (number between 0 and 100)",
        type: "number",
        nargs: 1
    })
    .option("l", {
        alias: "logFile",
        default: "log.txt",
        describe: "Log file",
        type: "string",
        nargs: 1
    })
    .option("r", {
        alias: "resolution",
        default: 32,
        describe: "PLY: Axon resolution",
        type: "number",
        nargs: 1
    })
    .option("b", {
        alias: "binary",
        default: true,
        describe: "PLY: Binary",
        type: "boolean",
        nargs: 1
    })
    .option("s", {
        alias: "simple_mesh",
        default: false,
        describe: "PLY: Simple mesh",
        type: "boolean",
        nargs: 1
    })
    .option("x", {
        alias: "extend_axons",
        default: false,
        describe: "PLY: Extended axons",
        type: "boolean",
        nargs: 1
    })
    .option("e", {
        alias: "export_as",
        default: "single",
        describe: "PLY: Export as single or multiple files",
        type: "string",
        nargs: 1
    });

import fs from "fs";
import { Synthesizer } from "@axon-generator-toolbox/core/dist/index.js";
import configToPly from "./configToPly";

const data = JSON.parse(fs.readFileSync(argv.file));

const growSpeed = data.growSpeed;
const contractSpeed = data.contractSpeed;
const border = data.border;

const synthesizer = new Synthesizer(data);

const outputDir = argv.file.substring(0, argv.file.lastIndexOf("/")) + "/output";

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

let logs = "";
const log = s => {
    console.log(s);
    logs += s + "\n";
    fs.writeFileSync(`${outputDir}/${argv.logFile}`, logs);
};

const colWidth = 20;

log(
    ["Iterations", "Axon volume (%)", "Cell volume (%)", "Total volume (%)"].map(s => s.padEnd(colWidth, " ")).join("")
);

const getConfig = () => ({
    growSpeed: growSpeed,
    contractSpeed: contractSpeed,
    border: border,
    ...synthesizer.toJSON()
});

const exportPly = i => {
    const outputDirPly = outputDir + `/ply_${i}`;
    if (!fs.existsSync(outputDirPly)) fs.mkdirSync(outputDirPly);
    const multiple = argv.export_as === "multiple";
    const ply = configToPly(getConfig(), {
        resolution: argv.resolution,
        exportBinary: argv.binary,
        exportSimple: argv.simple_mesh,
        extended: argv.extend_axons,
        multiple: multiple
    });
    if (multiple) ply.forEach(file => fs.writeFileSync(`${outputDirPly}/${file.name}`, file.data));
    else fs.writeFileSync(`${outputDirPly}/axons.ply`, ply);
};

exportPly(0);

for (let i = 0; i < argv.iterations; ) {
    do synthesizer.update(growSpeed, contractSpeed, 0.01, 0.0001, 0);
    while (synthesizer.updateState?.name !== "ready");
    const [vfa, vfc] = synthesizer.updateState.volumeFraction;
    const vf = vfa + vfc;
    ++i;
    if (i % argv.o === 0) {
        fs.writeFileSync(`${outputDir}/config_output_${i}.json`, JSON.stringify(getConfig(), null, 4));
        exportPly(i);
    }
    log(
        [
            `${i} / ${argv.iterations}`,
            (100 * vfa).toFixed(2),
            (100 * vfc).toFixed(2),
            `${(100 * vf).toFixed(2)} / ${argv.volumeFraction}`
        ]
            .map(s => s.padEnd(colWidth, " "))
            .join("")
    );
    if (vf >= argv.volumeFraction / 100) {
        log("Target volume fraction reached");
        break;
    }
    if (i === argv.iterations) {
        log("Number of max iterations reached");
        break;
    }
}
