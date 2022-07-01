import { createSynthesizer, SynthesizerJSON } from "../../core/src/index";
import arrayBufferToBuffer from "arraybuffer-to-buffer";

interface Options {
    resolution: number;
    extended: boolean;
    exportBinary: boolean;
    exportSimple: boolean;
    multiple: boolean;
}

const configToSinglePly = (
    config: SynthesizerJSON,
    options: Options
): { name: string; data: string | ArrayBuffer }[] => {
    const synthesizer = createSynthesizer(config);
    synthesizer.draw("none", "pipes", "all", options.resolution, options.extended, 0, false);
    const result = synthesizer.toPLY(options.exportBinary, options.exportSimple);
    if (options.exportBinary) return [{ name: "axons.ply", data: arrayBufferToBuffer(result) }];
    return [{ name: "axons.ply", data: result }];
};

const configToMultiplePly = (
    config: SynthesizerJSON,
    options: Options
): { name: string; data: string | ArrayBuffer }[] => {
    const synthesizer = createSynthesizer(config);
    synthesizer.draw("none", "pipes", "all", options.resolution, options.extended, 0, false);

    const result = [];

    const name = "@type_@index_@color.ply";

    for (let i = 0; i < synthesizer.axons.length; ++i) {
        const axon = synthesizer.axons[i];
        result.push({
            data: axon.toPLY(options.exportBinary, options.exportSimple, 0),
            name: name
                .replace(/@type/g, "myelin")
                .replace(/@index/g, String(i))
                .replace(/@color/g, axon.color)
        });
        if (Number(axon.gRatio) !== 1)
            result.push({
                data: axon.toPLY(options.exportBinary, options.exportSimple, 1),
                name: name
                    .replace(/@type/g, "axon")
                    .replace(/@index/g, String(i))
                    .replace(/@color/g, axon.color)
            });
    }
    for (let i = 0; i < synthesizer.cells.length; ++i) {
        const cell = synthesizer.cells[i];
        result.push({
            data: cell.toPLY(options.exportBinary, options.exportSimple),
            name: name
                .replace(/@type/g, "cell")
                .replace(/@index/g, String(i))
                .replace(/@color/g, cell.color)
        });
    }

    if (options.exportBinary) result.forEach(r => (r.data = arrayBufferToBuffer(r.data)));
    return result;
};

export default (config: SynthesizerJSON, options: Options) =>
    (options.multiple ? configToMultiplePly : configToSinglePly)(config, options);
