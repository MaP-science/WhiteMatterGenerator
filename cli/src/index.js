import yargs from "yargs";

const { argv } = yargs
    .scriptName("axon-generator-toolbox")
    .usage("Usage: $0 -f file [-i iterations] [-v volumeFraction]")
    .example([["$0 -f ./config.json -i 10 -o 5 -v 70 -l log.txt"]])
    .option("f", {
        alias: "file",
        describe: "Config file",
        demandOption: "Please specify a config file",
        type: "string",
        nargs: 1
    })
    .option("d", {
        alias: "destination",
        describe: "Output folder",
        default: "./output",
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
        default: 1,
        describe: "Stop simulation when this volume fraction has been reached (number between 0 and 1)",
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
import { createSynthesizer, setRandomSeed } from "../../core/src/index";
import configToPly from "./configToPly";

const data = JSON.parse(fs.readFileSync(argv.file, "utf-8"));

const randomSeed = data.randomSeed;
setRandomSeed(randomSeed);
const growSpeed = data.growSpeed;
const contractSpeed = data.contractSpeed;
const minimumDistance = data.minimumDistance;
const border = data.border;

const synthesizer = createSynthesizer(data);

const outputDir = argv.destination;

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

let logs = "";
const log = s => {
    console.log(s);
    logs += s + "\n";
    fs.writeFileSync(`${outputDir}/${argv.logFile}`, logs);
};

const colWidth = 20;

log(
    ["Iterations", "Axon volume fraction", "Cell volume fraction", "Total volume fraction"]
        .map(s => s.padEnd(colWidth, " "))
        .join("")
);

const getConfig = () => ({
    randomSeed: randomSeed,
    growSpeed: growSpeed,
    contractSpeed: contractSpeed,
    minimumDistance: minimumDistance,
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

if (argv.iterations === 0) exportPly(0);

for (let i = 0; i < argv.iterations; ) {
    do synthesizer.update(growSpeed, contractSpeed, minimumDistance, 0.0001, border);
    while (synthesizer.updateState?.name !== "ready");
    const [vfa, vfc] = synthesizer.updateState.volumeFraction;
    const vf = vfa + vfc;
    ++i;
    log(
        [`${i} / ${argv.iterations}`, vfa.toFixed(2), vfc.toFixed(2), `${vf.toFixed(2)} / ${argv.volumeFraction}`]
            .map(s => s.padEnd(colWidth, " "))
            .join("")
    );
    let done = false;
    if (vf >= argv.volumeFraction) {
        log("Target volume fraction reached");
        done = true;
    }
    if (i === argv.iterations) {
        log("Number of max iterations reached");
        done = true;
    }
    if (i % argv.outputInterval === 0 || done) {
        fs.writeFileSync(`${outputDir}/config_output_${i}.json`, JSON.stringify(getConfig(), null, 4));
        exportPly(i);
    }
    if (done) break;
}
